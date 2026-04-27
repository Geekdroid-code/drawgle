import { Buffer } from "node:buffer";

import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type NavigationArchitecture,
  type NavigationPlan,
  type ProjectCharter,
  type ScreenPlan,
} from "@/lib/types";
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
        description: z.string().trim().min(1).max(8000),
        chromePolicy: z.object({
          chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
          showPrimaryNavigation: z.boolean(),
          showsBackButton: z.boolean(),
        }).nullable().optional(),
        navigationItemId: z.string().trim().min(1).max(80).nullable().optional(),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
  requiresBottomNav: z.boolean().optional(),
  navigationArchitecture: z.object({
    kind: z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
    primaryNavigation: z.enum(["bottom-tabs", "none"]),
    rootChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
    detailChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
    consistencyRules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
    rationale: z.string().trim().min(1).max(2400),
  }).nullable().optional(),
  navigationPlan: z.object({
    enabled: z.boolean(),
    kind: z.enum(["bottom-tabs", "none"]),
    items: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(40),
      icon: z.string().trim().min(1).max(80),
      role: z.string().trim().min(1).max(240),
      linkedScreenName: z.string().trim().min(1).max(100),
    })).max(5),
    visualBrief: z.string().trim().min(1).max(1600),
    screenChrome: z.array(z.object({
      screenName: z.string().trim().min(1).max(100),
      chrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
      navigationItemId: z.string().trim().min(1).max(80).nullable().optional(),
    })),
  }).nullable().optional(),
  projectCharter: z
    .object({
      originalPrompt: z.string().trim().min(1).max(10000),
      imageReferenceSummary: z.string().trim().max(6000).nullable().optional(),
      appType: z.string().trim().min(1).max(240),
      targetAudience: z.string().trim().min(1).max(800),
      navigationModel: z.string().trim().min(1).max(800),
      navigationArchitecture: z.object({
        kind: z.enum(["bottom-tabs-app", "hierarchical", "single-screen"]),
        primaryNavigation: z.enum(["bottom-tabs", "none"]),
        rootChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
        detailChrome: z.enum(["bottom-tabs", "top-bar", "top-bar-back", "modal-sheet", "immersive"]),
        consistencyRules: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
        rationale: z.string().trim().min(1).max(2400),
      }).nullable().optional(),
      keyFeatures: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
      designRationale: z.string().trim().min(1).max(8000),
      creativeDirection: z.object({
        conceptName: z.string().trim().min(1).max(200),
        styleEssence: z.string().trim().min(1).max(2400),
        colorStory: z.string().trim().min(1).max(2400),
        typographyMood: z.string().trim().min(1).max(2400),
        surfaceLanguage: z.string().trim().min(1).max(2400),
        iconographyStyle: z.string().trim().min(1).max(2400),
        compositionPrinciples: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
        signatureMoments: z.array(z.string().trim().min(1).max(600)).min(1).max(10),
        motionTone: z.string().trim().min(1).max(2400),
        avoid: z.array(z.string().trim().min(1).max(600)).min(1).max(12),
      }).nullable().optional(),
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
    const requestedDesignTokens = payload.designTokens
      ? normalizeDesignTokens(payload.designTokens as DesignTokens)
      : null;
    const plannedScreens = (payload.plannedScreens ?? null) as ScreenPlan[] | null;
    const projectCharter = (payload.projectCharter ?? null) as ProjectCharter | null;
    const navigationArchitecture = (payload.navigationArchitecture ?? projectCharter?.navigationArchitecture ?? null) as NavigationArchitecture | null;
    const navigationPlan = (payload.navigationPlan ?? null) as NavigationPlan | null;
    let designTokens = requestedDesignTokens;

    projectId = payload.projectId;

    if (payload.sourceGenerationRunId && !projectId) {
      return NextResponse.json({ error: "Retries require an existing project." }, { status: 400 });
    }

    if (projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, owner_id, design_tokens")
        .eq("id", projectId)
        .single();

      if (projectError || !project || project.owner_id !== ownerId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (!designTokens && project.design_tokens) {
        designTokens = normalizeDesignTokens(project.design_tokens as DesignTokens);
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

      if (payload.designTokens !== undefined || !project.design_tokens) {
        projectUpdate.design_tokens = designTokens as never;
      }

      if (payload.projectCharter !== undefined) {
        projectUpdate.project_charter = projectCharter as never;
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
          navigationArchitecture,
          navigationPlan,
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
        navigationArchitecture,
        navigationPlan,
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
      return NextResponse.json(
        {
          error: "Invalid generation request.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error?.message ?? "Failed to enqueue the generation run.",
      },
      { status: 500 },
    );
  }
}
