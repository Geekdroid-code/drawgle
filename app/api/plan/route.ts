import { NextResponse } from "next/server";
import { z } from "zod";

import { assembleProjectContext } from "@/lib/generation/context";
import { planUiFlow } from "@/lib/generation/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { DesignTokens, PlanningMode, PromptImagePayload } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  projectId: z.string().uuid().optional(),
  prompt: z.string().trim().max(10000).default(""),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .nullable()
    .optional(),
  designTokens: z.unknown().nullable().optional(),
  planningMode: z.enum(["project", "single-screen"]).optional().default("project"),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt, a reference image, or both.",
      path: ["prompt"],
    });
  }
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await req.json());

    let projectContext: string | null = null;

    if (payload.projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, owner_id")
        .eq("id", payload.projectId)
        .maybeSingle();

      if (projectError || !project || project.owner_id !== user.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      projectContext = await assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: payload.prompt,
      });
    }

    const plan = await planUiFlow({
      prompt: payload.prompt,
      image: (payload.image ?? null) as PromptImagePayload | null,
      designTokens: (payload.designTokens ?? null) as DesignTokens | null,
      projectContext,
      planningMode: payload.planningMode as PlanningMode,
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
