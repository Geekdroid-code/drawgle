import "server-only";

import { tasks } from "@trigger.dev/sdk";

import { readScreenStateProposal, type AgentStepMetadata } from "@/lib/agent/message-metadata";
import { newStateRoadmapStableKey } from "@/lib/agent/screen-state-proposal";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { adminCreditService } from "@/lib/credits";
import { persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { screenPlanFromRoadmap, stateVariantFromRoadmap } from "@/lib/generation/project-roadmap";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import { insertProjectMessage } from "@/lib/supabase/queries";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type NavigationPlan,
  type ProjectCharter,
} from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";

type AdminClient = ReturnType<typeof createAdminClient>;

export class ScreenStateApprovalError extends Error {
  status: number;
  activeGenerationRunId: string | null;

  constructor(message: string, status = 400, activeGenerationRunId: string | null = null) {
    super(message);
    this.name = "ScreenStateApprovalError";
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
  if (error) throw error;
  return data as { id: string; status: GenerationStatus } | null;
}

export async function approveScreenStateProposal({
  admin,
  ownerId,
  projectId,
  proposalMessageId,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  proposalMessageId: string;
}) {
  const [{ data: project, error: projectError }, { data: proposalMessage, error: proposalError }] = await Promise.all([
    admin.from("projects").select("id, owner_id, design_tokens, project_charter").eq("id", projectId).maybeSingle(),
    admin.from("project_messages").select("id, metadata").eq("id", proposalMessageId).eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle(),
  ]);
  if (projectError || !project || project.owner_id !== ownerId) {
    throw new ScreenStateApprovalError("Project not found.", 404);
  }
  if (proposalError || !proposalMessage) {
    throw new ScreenStateApprovalError("Screen state proposal not found.", 404);
  }

  const proposalMetadata = proposalMessage.metadata && typeof proposalMessage.metadata === "object" && !Array.isArray(proposalMessage.metadata)
    ? proposalMessage.metadata as Record<string, unknown>
    : {};
  const proposal = readScreenStateProposal(proposalMetadata);
  if (!proposal) throw new ScreenStateApprovalError("That message does not contain a buildable screen state.", 400);
  if (proposal.status === "approved" || proposal.approvedGenerationRunId) {
    throw new ScreenStateApprovalError("That screen state has already been approved.", 409, proposal.approvedGenerationRunId ?? null);
  }
  if (new Date(proposal.expiresAt).getTime() < Date.now()) {
    await admin.from("project_messages").update({
      metadata: { ...proposalMetadata, screenStateProposal: { ...proposal, status: "expired" } } as never,
    }).eq("id", proposalMessage.id);
    throw new ScreenStateApprovalError("That state proposal expired. Ask me to prepare it again.", 410);
  }

  const activeGeneration = await findActiveGenerationRun(admin, projectId);
  if (activeGeneration) {
    throw new ScreenStateApprovalError(
      "A screen generation is already running. Let that finish, then build this state.",
      409,
      activeGeneration.id,
    );
  }

  const creditCheck = await adminCreditService.hasCredits(ownerId, 20);
  if (!creditCheck.hasCredits) {
    throw new ScreenStateApprovalError(
      `Insufficient credits to build this state. (Required: 20, Balance: ${creditCheck.currentBalance}). Please upgrade your plan.`,
      402,
    );
  }

  const { data: parentScreen, error: parentScreenError } = await admin
    .from("screens")
    .select("id, name, status, code, roadmap_item_id")
    .eq("id", proposal.parentScreenId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (parentScreenError || !parentScreen || parentScreen.status !== "ready" || !parentScreen.code) {
    throw new ScreenStateApprovalError("The parent screen is no longer ready to clone.", 409);
  }

  const { data: parentRoadmap, error: parentRoadmapError } = await admin
    .from("project_screen_roadmap")
    .select("*")
    .eq("id", proposal.parentRoadmapItemId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (
    parentRoadmapError || !parentRoadmap || parentRoadmap.kind !== "screen" ||
    parentRoadmap.status !== "ready" || parentRoadmap.generated_screen_id !== parentScreen.id ||
    parentScreen.roadmap_item_id !== parentRoadmap.id
  ) {
    throw new ScreenStateApprovalError("The parent screen roadmap link changed. Refresh and prepare the state again.", 409);
  }

  let stateRoadmap: ProjectScreenRoadmapRow | null = null;
  if (proposal.existingRoadmapItemId) {
    const { data, error } = await admin
      .from("project_screen_roadmap")
      .select("*")
      .eq("id", proposal.existingRoadmapItemId)
      .eq("project_id", projectId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error || !data || data.kind !== "state" || data.parent_item_id !== parentRoadmap.id) {
      throw new ScreenStateApprovalError("The planned state no longer belongs to this parent screen.", 409);
    }
    stateRoadmap = data as ProjectScreenRoadmapRow;
  } else {
    const stableKey = newStateRoadmapStableKey(parentRoadmap.stable_key, proposal.state.stateKey);
    const { data, error } = await admin
      .from("project_screen_roadmap")
      .upsert({
        project_id: projectId,
        owner_id: ownerId,
        parent_item_id: parentRoadmap.id,
        generated_screen_id: null,
        stable_key: stableKey,
        kind: "state",
        screen_type: null,
        name: `${parentRoadmap.name} - ${proposal.state.stateLabel}`,
        description: proposal.state.description,
        priority: "required",
        status: "planned",
        source: "prompt",
        explicitly_requested: true,
        sequence: parentRoadmap.sequence + 1,
        tranche: parentRoadmap.tranche,
        dependency_keys: [parentRoadmap.stable_key],
        state_key: proposal.state.stateKey,
        state_label: proposal.state.stateLabel,
        state_role: proposal.state.stateRole,
        trigger_label: proposal.state.triggerLabel,
        metadata: { editInstruction: proposal.state.editInstruction, defaultSelected: true },
        updated_at: now(),
      }, { onConflict: "project_id,stable_key", defaultToNull: false })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Failed to create the state roadmap entry.");
    stateRoadmap = data as ProjectScreenRoadmapRow;
  }

  if (stateRoadmap.status === "ready" || stateRoadmap.generated_screen_id) {
    throw new ScreenStateApprovalError("That state already exists on the canvas.", 409);
  }
  const stateVariant = stateVariantFromRoadmap(stateRoadmap);
  const parentPlan = screenPlanFromRoadmap(parentRoadmap as ProjectScreenRoadmapRow, [stateVariant]);
  const { data: projectNavigation } = await admin
    .from("project_navigation")
    .select("plan")
    .eq("project_id", projectId)
    .maybeSingle();
  const navigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;
  const designTokens = project.design_tokens ? normalizeDesignTokens(project.design_tokens as DesignTokens) : null;
  const projectCharter = (project.project_charter as ProjectCharter | null) ?? null;

  const claimedMetadata = {
    ...proposalMetadata,
    screenStateProposal: { ...proposal, status: "approved" as const, approvedGenerationRunId: null },
  };
  const { data: claim, error: claimError } = await admin
    .from("project_messages")
    .update({ metadata: claimedMetadata as never })
    .eq("id", proposalMessage.id)
    .eq("metadata->screenStateProposal->>status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claim) throw new ScreenStateApprovalError("That screen state is already being approved.", 409);

  await admin.from("projects").update({ status: "queued", updated_at: now() }).eq("id", projectId);
  const { data: generationRun, error: generationRunError } = await admin.from("generation_runs").insert({
    project_id: projectId,
    owner_id: ownerId,
    prompt: proposal.prompt,
    image_path: null,
    requested_screen_count: 1,
    status: "queued",
    metadata: {
      requestedFrom: "agent-screen-state-approval",
      proposalMessageId,
      planningMode: "single-screen",
      referencePolicy: "project_memory",
      plannedScreens: [parentPlan],
      stateVariants: [stateVariant],
      selectedStateVariantIds: [stateVariant.id],
      retryContext: { sourceGenerationRunId: parentScreen.id, mode: "state_variants", parentScreenId: parentScreen.id },
    } as never,
    created_at: now(),
    updated_at: now(),
  }).select("id").single();
  if (generationRunError || !generationRun) {
    await admin.from("project_messages").update({ metadata: proposalMetadata as never }).eq("id", proposalMessage.id);
    throw generationRunError ?? new Error("Failed to create generation run.");
  }

  const approvalMessage = await insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId: parentScreen.id,
    role: "user",
    content: `Build ${proposal.state.stateLabel} state.`,
    messageType: "chat",
    metadata: { action: "screen_state_approved", proposalMessageId, generationRunId: generationRun.id },
  });
  const queuedStep: AgentStepMetadata = {
    kind: "generation",
    status: "queued",
    title: `Build ${proposal.state.stateLabel}`,
    detail: `Creating one state from ${parentScreen.name}.`,
    targetLabel: parentScreen.name,
    processLines: ["Approved one screen state.", "Queued one clone-and-edit output."],
  };
  const queuedMessage = await insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId: parentScreen.id,
    role: "system",
    content: `Queued ${proposal.state.stateLabel} as a state of ${parentScreen.name}.`,
    messageType: "generation_started",
    metadata: {
      action: "generation_queued",
      activityKey: summaryActivityKey(generationRun.id),
      generationRunId: generationRun.id,
      proposalMessageId,
      userMessageId: approvalMessage.id,
      ui: { variant: "action_card" },
      agentStep: queuedStep,
    },
  });

  let handle;
  try {
    handle = await tasks.trigger<typeof generateUiFlowTask>("generate-ui-flow", {
      generationRunId: generationRun.id,
      projectId,
      ownerId,
      prompt: proposal.prompt,
      imagePath: null,
      imageReferenceMode: "style",
      referencePolicy: "project_memory",
      designTokens,
      plannedScreens: [parentPlan],
      requiresBottomNav: Boolean(navigationPlan?.enabled),
      navigationPlan,
      projectCharter,
      planningMode: "single-screen",
      stateVariants: [stateVariant],
      approvalUserMessageId: approvalMessage.id,
      retryContext: {
        sourceGenerationRunId: parentScreen.id,
        mode: "state_variants",
        parentScreenId: parentScreen.id,
      },
    }, { concurrencyKey: ownerId, ttl: "30m" });
  } catch (error) {
    await Promise.all([
      admin.from("generation_runs").update({ status: "failed", error: error instanceof Error ? error.message : "Failed to queue state build.", updated_at: now() }).eq("id", generationRun.id),
      admin.from("project_messages").update({ metadata: proposalMetadata as never }).eq("id", proposalMessage.id),
      admin.from("projects").update({ status: "failed", updated_at: now() }).eq("id", projectId),
    ]);
    throw error;
  }

  await Promise.all([
    admin.from("generation_runs").update({ trigger_run_id: handle.id, updated_at: now() }).eq("id", generationRun.id),
    admin.from("project_messages").update({ metadata: { ...queuedMessage.metadata, triggerRunId: handle.id } as never }).eq("id", queuedMessage.id),
    admin.from("project_messages").update({
      metadata: {
        ...claimedMetadata,
        screenStateProposal: { ...proposal, status: "approved", approvedGenerationRunId: generationRun.id },
      } as never,
    }).eq("id", proposalMessage.id),
  ]);

  await persistProjectMessageMemoryPair({
    admin,
    userMessageId: approvalMessage.id,
    userContent: approvalMessage.content,
    modelMessageId: queuedMessage.id,
    modelContent: queuedMessage.content,
  }).catch((error) => console.error("Failed to persist screen state approval memory", error));

  return {
    generationRunId: generationRun.id,
    triggerRunId: handle.id,
    proposalMessageId,
    queuedMessageId: queuedMessage.id,
    parentScreenId: parentScreen.id,
    roadmapItemId: stateRoadmap.id,
  };
}
