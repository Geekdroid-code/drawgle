import { NextResponse } from "next/server";
import { z } from "zod";

import { assembleProjectContext } from "@/lib/generation/context";
import { planUiFlow } from "@/lib/generation/service";
import {
  applyNavigationPlanToScreens,
  indexNavigationShell,
  normalizeNavigationPlan,
  parseStoredNavigationPlan,
  renderDeterministicNavigationShell,
  validateNavigationShell,
} from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NavigationPlan, ProjectCharter, ScreenChromePolicy, ScreenPlan } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview"),
    projectId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("apply"),
    projectId: z.string().uuid(),
    confirmedPlan: z.unknown(),
  }),
]);

const toScreenPlan = (screen: {
  name: string;
  prompt: string | null;
  chrome_policy: unknown;
}): ScreenPlan => {
  const chromePolicy = screen.chrome_policy as ScreenChromePolicy | null;
  const detailChrome = chromePolicy?.chrome === "top-bar-back" || chromePolicy?.chrome === "modal-sheet";
  return {
    name: screen.name,
    type: detailChrome ? "detail" : "root",
    description: screen.prompt ?? screen.name,
    chromePolicy,
  };
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const [{ data: project, error: projectError }, { data: screenRows, error: screensError }, { data: navigationRow }] = await Promise.all([
      admin
        .from("projects")
        .select("id, owner_id, prompt, project_charter, design_tokens")
        .eq("id", payload.projectId)
        .maybeSingle(),
      admin
        .from("screens")
        .select("id, name, prompt, chrome_policy, navigation_item_id, parent_screen_id, state_key, roadmap_item_id, sort_index")
        .eq("project_id", payload.projectId)
        .order("sort_index", { ascending: true }),
      admin
        .from("project_navigation")
        .select("id, plan, shell_code, block_index, status, error, design_revision")
        .eq("project_id", payload.projectId)
        .maybeSingle(),
    ]);

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (screensError || !screenRows?.length) {
      return NextResponse.json({ error: "Project has no screens to repair." }, { status: 400 });
    }

    const screens = screenRows.map(toScreenPlan);
    const existingNavigationPlan = navigationRow?.plan
      ? parseStoredNavigationPlan(navigationRow.plan)
      : null;

    if (payload.action === "preview") {
      const projectContext = await assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: project.prompt,
      });
      const repairPlan = await planUiFlow({
        prompt: [
          project.prompt,
          "Repair the existing project navigation only.",
          "Use persistent navigation only with positive evidence in the project brief or existing product architecture.",
          "When navigation belongs, return Navigation V2 with meaningful project-native destinations and planned future routes without adding generated screens.",
        ].filter(Boolean).join("\n\n"),
        referenceMode: "user_style",
        projectContext,
        existingCharter: (project.project_charter as ProjectCharter | null) ?? null,
        existingNavigationPlan,
        planningMode: "project",
      });
      const normalized = normalizeNavigationPlan({
        navigationPlan: repairPlan.navigationPlan,
        screens,
        navigationArchitecture: repairPlan.navigationArchitecture,
      });
      const shellCode = renderDeterministicNavigationShell(normalized);
      if (normalized.enabled && !validateNavigationShell(shellCode, normalized)) {
        return NextResponse.json({ error: "Navigation repair preview did not pass shell validation." }, { status: 422 });
      }
      return NextResponse.json({
        action: "preview",
        projectId: payload.projectId,
        plan: normalized,
        shellCode,
        screenChrome: normalized.screenChrome,
        requiresConfirmation: true,
      });
    }

    const requestedPlan = parseStoredNavigationPlan(payload.confirmedPlan);
    if (requestedPlan.version !== 2) {
      return NextResponse.json({ error: "Only a confirmed Navigation V2 plan can be applied." }, { status: 400 });
    }
    const normalized = normalizeNavigationPlan({
      navigationPlan: requestedPlan,
      screens,
      navigationArchitecture: (project.project_charter as ProjectCharter | null)?.navigationArchitecture ?? null,
    });
    const shellCode = renderDeterministicNavigationShell(normalized);
    if (normalized.enabled && !validateNavigationShell(shellCode, normalized)) {
      return NextResponse.json({ error: "Confirmed navigation plan did not pass shell validation." }, { status: 422 });
    }

    const plannedScreens = applyNavigationPlanToScreens(screens, normalized);
    const { data: applied, error: applyError } = await admin.rpc("apply_navigation_repair", {
      input_project_id: payload.projectId,
      input_owner_id: user.id,
      input_expected_revision: navigationRow?.design_revision ?? null,
      input_request_id: crypto.randomUUID(),
      input_payload: {
        plan: normalized,
        shellCode,
        assignments: screenRows.map((row, index) => ({
          screenId: row.id,
          chromePolicy: plannedScreens[index].chromePolicy ?? null,
          navigationItemId: plannedScreens[index].navigationItemId ?? null,
          parentScreenId: row.parent_screen_id,
          stateKey: row.state_key,
          roadmapItemId: row.roadmap_item_id,
        })),
      } as never,
      input_block_index: indexNavigationShell(shellCode) as never,
    });
    if (applyError) throw applyError;
    if ((applied as { status?: string } | null)?.status !== "success") {
      return NextResponse.json({ error: "Navigation changed while repairing. Refresh and try again." }, { status: 409 });
    }
    return NextResponse.json({
      action: "applied",
      projectId: payload.projectId,
      plan: normalized,
      shellCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Navigation repair failed.";
    console.error("Navigation repair API error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
