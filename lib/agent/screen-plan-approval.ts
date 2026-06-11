import "server-only";

import { tasks } from "@trigger.dev/sdk";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { readScreenPlanProposal, type AgentStepMetadata } from "@/lib/agent/message-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertProjectMessage } from "@/lib/supabase/queries";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type ProjectCharter,
} from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";

type AdminClient = ReturnType<typeof createAdminClient>;

export class ScreenPlanApprovalError extends Error {
  status: number;
  activeGenerationRunId: string | null;

  constructor(message: string, status = 400, activeGenerationRunId: string | null = null) {
    super(message);
    this.name = "ScreenPlanApprovalError";
    this.status = status;
    this.activeGenerationRunId = activeGenerationRunId;
  }
}

const now = () => new Date().toISOString();
const summaryActivityKey = (generationRunId: string) => `run:${generationRunId}:summary`;

async function findActiveGenerationRun(admin: AdminClient, projectId: string) {
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

  return data as { id: string; status: GenerationStatus } | null;
}

export async function approveScreenPlanProposal({
  admin,
  ownerId,
  projectId,
  proposalMessageId,
  approvalContent = "Build this screen.",
  approvalUserMessageId = null,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  proposalMessageId: string;
  approvalContent?: string;
  approvalUserMessageId?: string | null;
}) {
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, owner_id, design_tokens, project_charter")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project || project.owner_id !== ownerId) {
    throw new ScreenPlanApprovalError("Project not found.", 404);
  }

  const activeGeneration = await findActiveGenerationRun(admin, projectId);
  if (activeGeneration) {
    throw new ScreenPlanApprovalError(
      "A screen generation is already running. Let that finish, then build this plan.",
      409,
      activeGeneration.id,
    );
  }

  const { data: proposalMessage, error: proposalError } = await admin
    .from("project_messages")
    .select("id, metadata")
    .eq("id", proposalMessageId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (proposalError || !proposalMessage) {
    throw new ScreenPlanApprovalError("Screen plan proposal not found.", 404);
  }

  const proposalMetadata = proposalMessage.metadata &&
    typeof proposalMessage.metadata === "object" &&
    !Array.isArray(proposalMessage.metadata)
    ? proposalMessage.metadata as Record<string, unknown>
    : {};
  const proposal = readScreenPlanProposal(proposalMetadata);

  if (!proposal) {
    throw new ScreenPlanApprovalError("That message does not contain a buildable screen plan.", 400);
  }

  if (proposal.status === "approved" || proposal.approvedGenerationRunId) {
    throw new ScreenPlanApprovalError("That screen plan has already been approved.", 409, proposal.approvedGenerationRunId ?? null);
  }

  if (new Date(proposal.expiresAt).getTime() < Date.now()) {
    await admin
      .from("project_messages")
      .update({
        metadata: {
          ...proposalMetadata,
          screenPlanProposal: {
            ...proposal,
            status: "expired",
          },
        } as never,
      })
      .eq("id", proposalMessage.id);

    throw new ScreenPlanApprovalError("That screen plan expired. Ask me to draft it again and I will rebuild the brief.", 410);
  }

  const designTokens = project.design_tokens
    ? normalizeDesignTokens(project.design_tokens as DesignTokens)
    : null;
  const projectCharter = (project.project_charter as ProjectCharter | null) ?? null;

  await admin
    .from("projects")
    .update({
      status: "queued",
      updated_at: now(),
    })
    .eq("id", projectId);

  const { data: generationRun, error: generationRunError } = await admin
    .from("generation_runs")
    .insert({
      project_id: projectId,
      owner_id: ownerId,
      prompt: proposal.prompt,
      image_path: proposal.imagePath ?? null,
      status: "queued",
      metadata: {
        requestedFrom: "agent-screen-plan-approval",
        proposalMessageId,
        planningMode: "single-screen",
        requestedImageReferenceMode: proposal.imageReferenceMode ?? "recreate",
        navigationArchitecture: proposal.navigationArchitecture,
        navigationPlan: proposal.navigationPlan,
        plannedScreens: [proposal.screenPlan],
      } as never,
      created_at: now(),
      updated_at: now(),
    })
    .select("id")
    .single();

  if (generationRunError || !generationRun) {
    throw generationRunError ?? new Error("Failed to create generation run.");
  }

  const userMessageId = approvalUserMessageId ?? (await insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId: null,
    role: "user",
    content: approvalContent,
    messageType: "chat",
    metadata: {
      action: "screen_plan_approved",
      proposalMessageId,
      generationRunId: generationRun.id,
    },
  })).id;

  const queuedStep: AgentStepMetadata = {
    kind: "generation",
    status: "queued",
    title: `Build ${proposal.screenPlan.name}`,
    detail: proposal.screenPlan.description,
    targetLabel: proposal.screenPlan.name,
    processLines: [
      "Approved the screen plan.",
      "Queued one screen for generation.",
    ],
  };

  const queuedMessage = await insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId: null,
    role: "system",
    content: `Queued ${proposal.screenPlan.name} for generation.`,
    messageType: "generation_started",
    metadata: {
      action: "generation_queued",
      activityKey: summaryActivityKey(generationRun.id),
      generationRunId: generationRun.id,
      proposalMessageId,
      userMessageId,
      ui: { variant: "action_card" },
      agentStep: queuedStep,
    },
  });

  const handle = await tasks.trigger<typeof generateUiFlowTask>(
    "generate-ui-flow",
    {
      generationRunId: generationRun.id,
      projectId,
      ownerId,
      prompt: proposal.prompt,
      imagePath: proposal.imagePath ?? null,
      imageReferenceMode: proposal.imageReferenceMode ?? "recreate",
      designTokens,
      plannedScreens: [proposal.screenPlan],
      requiresBottomNav: proposal.requiresBottomNav,
      navigationArchitecture: proposal.navigationArchitecture,
      navigationPlan: proposal.navigationPlan,
      projectCharter,
      planningMode: "single-screen",
    },
    {
      concurrencyKey: ownerId,
      ttl: "30m",
    },
  );

  await admin
    .from("generation_runs")
    .update({
      trigger_run_id: handle.id,
      updated_at: now(),
    })
    .eq("id", generationRun.id);

  await admin
    .from("project_messages")
    .update({
      metadata: {
        ...queuedMessage.metadata,
        triggerRunId: handle.id,
      } as never,
    })
    .eq("id", queuedMessage.id);

  await admin
    .from("project_messages")
    .update({
      metadata: {
        ...proposalMetadata,
        screenPlanProposal: {
          ...proposal,
          status: "approved",
          approvedGenerationRunId: generationRun.id,
        },
      } as never,
    })
    .eq("id", proposalMessage.id);

  await persistProjectMessageMemoryPair({
    admin,
    userMessageId,
    userContent: approvalContent,
    modelMessageId: queuedMessage.id,
    modelContent: queuedMessage.content,
  }).catch((error) => {
    console.error("Failed to persist screen approval memory", error);
  });

  return {
    generationRunId: generationRun.id,
    triggerRunId: handle.id,
    proposalMessageId,
    queuedMessageId: queuedMessage.id,
  };
}
