import { Buffer } from "node:buffer";

import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_GENERATION_STATUSES, type DesignTokens, type GenerationStatus, type ProjectCharter, type ScreenPlan } from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid().optional(),
  projectName: z.string().trim().min(1).max(100).optional(),
  prompt: z.string().trim().max(10000),
  sourceGenerationRunId: z.string().uuid().optional(),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .nullable()
    .optional(),
  plannedScreens: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        type: z.enum(["root", "detail"]),
        description: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
  requiresBottomNav: z.boolean().optional(),
  projectCharter: z
    .object({
      originalPrompt: z.string().trim().min(1).max(10000),
      imageReferenceSummary: z.string().trim().max(4000).nullable().optional(),
      appType: z.string().trim().min(1).max(120),
      targetAudience: z.string().trim().min(1).max(240),
      navigationModel: z.string().trim().min(1).max(240),
      keyFeatures: z.array(z.string().trim().min(1).max(240)).min(1).max(16),
      designRationale: z.string().trim().min(1).max(4000),
    })
    .optional(),
  designTokens: z.unknown().nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt, a reference image, or both.",
      path: ["prompt"],
    });
  }
});

const now = () => new Date().toISOString();

class DuplicateGenerationError extends Error {
  activeGenerationRunId: string | null;
  activeStatus: GenerationStatus | null;

  constructor(message: string, activeGenerationRunId?: string | null, activeStatus?: GenerationStatus | null) {
    super(message);
    this.name = "DuplicateGenerationError";
    this.activeGenerationRunId = activeGenerationRunId ?? null;
    this.activeStatus = activeStatus ?? null;
  }
}

async function findActiveGenerationRun(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data, error } = await admin
    .from("generation_runs")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", [...ACTIVE_GENERATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function isActiveGenerationConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error);

  return code === "23505" && message.includes("generation_runs_project_single_active_idx");
}

const deriveProjectName = (prompt: string, explicitName?: string) => {
  if (explicitName?.trim()) {
    return explicitName.trim().slice(0, 100);
  }

  return prompt
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(" ")
    .slice(0, 100) || "Untitled project";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  let generationRunId: string | undefined;
  let projectId: string | undefined;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const ownerId = authData.user.id;
    const designTokens = (payload.designTokens ?? null) as DesignTokens | null;
    const plannedScreens = (payload.plannedScreens ?? null) as ScreenPlan[] | null;
    const projectCharter = (payload.projectCharter ?? null) as ProjectCharter | null;

    projectId = payload.projectId;

    if (payload.sourceGenerationRunId && !projectId) {
      return NextResponse.json({ error: "Retries require an existing project." }, { status: 400 });
    }

    if (projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, owner_id")
        .eq("id", projectId)
        .single();

      if (projectError || !project || project.owner_id !== ownerId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const activeGenerationRun = await findActiveGenerationRun(admin, projectId);
      if (activeGenerationRun) {
        throw new DuplicateGenerationError(
          "A generation is already queued or building for this project.",
          activeGenerationRun.id,
          activeGenerationRun.status,
        );
      }

      const projectUpdate: Database["public"]["Tables"]["projects"]["Update"] = {
        status: "queued",
        updated_at: now(),
      };

      if (payload.designTokens !== undefined) {
        projectUpdate.design_tokens = designTokens as never;
      }

      const { error: updateError } = await admin.from("projects").update(projectUpdate).eq("id", projectId);
      if (updateError) {
        throw updateError;
      }
    } else {
      const { data: project, error: projectInsertError } = await admin
        .from("projects")
        .insert({
          owner_id: ownerId,
          name: deriveProjectName(payload.prompt, payload.projectName),
          prompt: payload.prompt,
          status: "queued",
          project_charter: projectCharter as never,
          design_tokens: designTokens as never,
          created_at: now(),
          updated_at: now(),
        })
        .select("id")
        .single();

      if (projectInsertError || !project) {
        throw projectInsertError ?? new Error("Failed to create project.");
      }

      projectId = project.id;
    }

    let imagePath: string | null = null;
    if (payload.sourceGenerationRunId) {
      const { data: sourceRun, error: sourceRunError } = await admin
        .from("generation_runs")
        .select("id, image_path")
        .eq("id", payload.sourceGenerationRunId)
        .eq("project_id", projectId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (sourceRunError || !sourceRun) {
        return NextResponse.json({ error: "Source generation run not found." }, { status: 404 });
      }

      imagePath = sourceRun.image_path;
    } else if (payload.image) {
      const extension = payload.image.mimeType.split("/")[1] ?? "bin";
      imagePath = `${ownerId}/prompt-images/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await admin.storage
        .from("generation-assets")
        .upload(imagePath, Buffer.from(payload.image.data, "base64"), {
          contentType: payload.image.mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }
    }

    const { data: generationRun, error: generationRunError } = await admin
      .from("generation_runs")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        prompt: payload.prompt,
        image_path: imagePath,
        status: "queued",
        metadata: {
          requestedFrom: payload.sourceGenerationRunId ? "retry" : "nextjs-route",
          sourceGenerationRunId: payload.sourceGenerationRunId ?? null,
        } as never,
        created_at: now(),
        updated_at: now(),
      })
      .select("id")
      .single();

    if (generationRunError || !generationRun) {
      throw generationRunError ?? new Error("Failed to create generation run.");
    }

    generationRunId = generationRun.id;

    const handle = await tasks.trigger<typeof generateUiFlowTask>(
      "generate-ui-flow",
      {
        generationRunId,
        projectId,
        ownerId,
        prompt: payload.prompt,
        imagePath,
        designTokens,
        plannedScreens,
        requiresBottomNav: payload.requiresBottomNav,
        projectCharter,
      },
      {
        concurrencyKey: ownerId,
        ttl: "30m",
      },
    );

    const { error: triggerUpdateError } = await admin
      .from("generation_runs")
      .update({
        trigger_run_id: handle.id,
        updated_at: now(),
      })
      .eq("id", generationRunId);

    if (triggerUpdateError) {
      throw triggerUpdateError;
    }

    return NextResponse.json(
      {
        projectId,
        generationRunId,
        triggerRunId: handle.id,
      },
      { status: 202 },
    );
  } catch (error: any) {
    console.error("Generation queue route error", error);

    if (error instanceof DuplicateGenerationError) {
      return NextResponse.json(
        {
          error: error.message,
          activeGenerationRunId: error.activeGenerationRunId,
          activeStatus: error.activeStatus,
        },
        { status: 409 },
      );
    }

    if (projectId && isActiveGenerationConflict(error)) {
      const activeGenerationRun = await findActiveGenerationRun(admin, projectId).catch((lookupError) => {
        console.error("Failed to load active run after conflict", lookupError);
        return null;
      });

      return NextResponse.json(
        {
          error: "A generation is already queued or building for this project.",
          activeGenerationRunId: activeGenerationRun?.id ?? null,
          activeStatus: activeGenerationRun?.status ?? null,
        },
        { status: 409 },
      );
    }

    if (generationRunId) {
      await admin
        .from("generation_runs")
        .update({
          status: "failed",
          error: error?.message ?? String(error),
          completed_at: now(),
          updated_at: now(),
        })
        .eq("id", generationRunId);
    }

    if (projectId) {
      await admin
        .from("projects")
        .update({
          status: "failed",
          updated_at: now(),
        })
        .eq("id", projectId);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error?.message ?? "Failed to enqueue the generation run.",
      },
      { status: 500 },
    );
  }
}