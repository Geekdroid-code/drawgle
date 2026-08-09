import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";

import { applyDeterministicEdits, ensureDrawgleIds, type DeterministicEditOperation, type DrawgleElementTargetType } from "@/lib/drawgle-dom";
import { indexScreenCode } from "@/lib/generation/block-index";
import { buildStaticScreenQualityDiagnostics, normalizeGeneratedUiContracts } from "@/lib/generation/ui-contract-normalizer";
import { persistWithOptionalQualityDiagnostics } from "@/lib/generation/persist-safe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import type { DesignTokens } from "@/lib/types";
import type { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";

export const runtime = "nodejs";

const isOperation = (value: unknown): value is DeterministicEditOperation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const operation = value as Partial<DeterministicEditOperation>;
  if (operation.type === "replaceText") {
    return typeof operation.text === "string";
  }

  if (operation.type === "setStyle") {
    return typeof operation.property === "string" && typeof operation.value === "string";
  }

  if (operation.type === "clearStyle") {
    return typeof operation.property === "string";
  }
  if (operation.type === "setClassUtility") {
    return typeof operation.family === "string" && typeof operation.className === "string";
  }

  if (operation.type === "removeClassUtility") {
    return typeof operation.family === "string";
  }

  if (operation.type === "replaceClassList") {
    return typeof operation.className === "string";
  }

  if (operation.type === "setAttribute") {
    return typeof operation.name === "string" && (typeof operation.value === "string" || operation.value === null);
  }
  if (operation.type === "replaceImage") {
    return typeof operation.mode === "string" && typeof operation.src === "string";
  }

  if (operation.type === "deleteElement") {
    return true;
  }

  if (operation.type === "duplicateElement") {
    return true;
  }

  return false;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const screenId = typeof body.screenId === "string" ? body.screenId : null;
    const targetType: DrawgleElementTargetType = body.targetType === "navigation" ? "navigation" : "screen";
    const drawgleId = typeof body.drawgleId === "string" ? body.drawgleId : "";
    const operations = Array.isArray(body.operations) ? body.operations.filter(isOperation) : [];

    if (!projectId || !drawgleId || operations.length === 0) {
      return NextResponse.json(
        { error: "projectId, drawgleId, and operations are required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id, design_tokens")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const designTokens = (project.design_tokens as DesignTokens | null) ?? null;

    if (targetType === "navigation") {
      const { data: navigation, error: navigationError } = await admin
        .from("project_navigation")
        .select("id, shell_code")
        .eq("project_id", projectId)
        .maybeSingle();

      if (navigationError || !navigation) {
        return NextResponse.json({ error: "Shared navigation not found." }, { status: 404 });
      }

      const currentCode = ensureDrawgleIds(navigation.shell_code ?? "", "dg-nav").code;
      const editedCode = applyDeterministicEdits({
        code: currentCode,
        drawgleId,
        operations,
        prefix: "dg-nav",
      });
      const normalized = normalizeGeneratedUiContracts({ code: editedCode, designTokens });
      const nextCode = tokenizeStaticDrawgleHtml(normalized.code, designTokens).code;

      const { error: updateError } = await admin
        .from("project_navigation")
        .update({
          shell_code: nextCode,
          block_index: indexScreenCode(nextCode) as never,
          status: "ready",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", navigation.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ ok: true, targetType, changed: nextCode !== currentCode });
    }

    if (!screenId) {
      return NextResponse.json({ error: "screenId is required for screen edits." }, { status: 400 });
    }

    const { data: screen, error: screenError } = await admin
      .from("screens")
      .select("id, code")
      .eq("id", screenId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (screenError || !screen) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }

    const currentCode = ensureDrawgleIds(screen.code ?? "").code;
    const editedCode = applyDeterministicEdits({
      code: currentCode,
      drawgleId,
      operations,
    });
    const normalized = normalizeGeneratedUiContracts({ code: editedCode, designTokens });
    const nextCode = tokenizeStaticDrawgleHtml(normalized.code, designTokens).code;
    const qualityDiagnostics = buildStaticScreenQualityDiagnostics(nextCode, normalized.report);

    const { error: updateError } = await persistWithOptionalQualityDiagnostics(
      {
        code: nextCode,
        quality_diagnostics: qualityDiagnostics,
        block_index: indexScreenCode(nextCode),
        status: "ready",
        error: null,
        updated_at: new Date().toISOString(),
      },
      async (patch) => {
        const { error } = await admin
          .from("screens")
          .update(patch)
          .eq("id", screen.id);
        return { error };
      },
    );

    if (updateError) {
      throw updateError;
    }

    if (nextCode !== currentCode) {
      await tasks.trigger<typeof enrichScreenMemoryTask>(
        "enrich-screen-memory",
        { screenId: screen.id },
        { concurrencyKey: `screen-memory-${screen.id}` },
      );
    }

    return NextResponse.json({ ok: true, targetType, changed: nextCode !== currentCode });
  } catch (error: unknown) {
    console.error("Element edit API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
