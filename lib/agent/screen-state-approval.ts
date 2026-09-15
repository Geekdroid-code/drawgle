import "server-only";
import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { readScreenStateProposal } from "@/lib/agent/message-metadata";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { adminCreditService } from "@/lib/credits";
import { STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import { screenPlanFromRoadmap, stateVariantFromRoadmap } from "@/lib/generation/project-roadmap";
import { compileProductContent } from "@/lib/product-planning/content-contract";
import { readProductPlanning } from "@/lib/product-planning/model";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";
import type { GenerateUiFlowPayload, generateUiFlowTask } from "@/trigger/generate-ui-flow";

type AdminClient = ReturnType<typeof createAdminClient>;
export class ScreenStateApprovalError extends Error {
  constructor(message: string, public status = 400, public activeGenerationRunId: string | null = null) {
    super(message); this.name = "ScreenStateApprovalError";
  }
}

export async function approveScreenStateProposal({ admin, ownerId, projectId, proposalMessageId }: {
  admin: AdminClient; ownerId: string; projectId: string; proposalMessageId: string;
}) {
  const [{ data: project, error: projectError }, { data: message, error: messageError }] = await Promise.all([
    admin.from("projects").select("id, design_tokens, project_charter, product_planning").eq("id", projectId).eq("owner_id", ownerId).maybeSingle(),
    admin.from("project_messages").select("id, metadata").eq("id", proposalMessageId).eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle(),
  ]);
  if (projectError || messageError) throw projectError ?? messageError;
  if (!project || !message) throw new ScreenStateApprovalError("Project or state request not found.", 404);
  const proposal = readScreenStateProposal(message.metadata as Record<string, unknown>);
  if (!proposal) throw new ScreenStateApprovalError("That message does not contain a buildable state.");
  const { data: parent, error: parentError } = await admin.from("screens").select("id, code, status, roadmap_item_id, generation_run_id")
    .eq("id", proposal.parentScreenId).eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (parentError) throw parentError;
  if (!parent?.code) throw new ScreenStateApprovalError("The parent screen is unavailable.", 409);
  if (!proposal.approvedGenerationRunId) {
    const credits = await adminCreditService.hasCredits(ownerId, STATE_GENERATION_CREDIT_COST);
    if (!credits.hasCredits) throw new ScreenStateApprovalError(`This state needs ${STATE_GENERATION_CREDIT_COST} credits; your balance is ${credits.currentBalance}.`, 402);
  }
  const { data: claimed, error: claimError } = await admin.rpc("claim_screen_state_generation", {
    input_project_id: projectId, input_owner_id: ownerId, input_message_id: proposalMessageId,
    input_parent_hash: createHash("sha256").update(parent.code).digest("hex"),
  });
  if (claimError) throw new ScreenStateApprovalError(claimError.message, claimError.code === "42501" ? 404 : 409);
  const generationRunId = (claimed as { generationRunId: string }).generationRunId;
  const { data: run, error: runError } = await admin.from("generation_runs").select("metadata, status, trigger_run_id")
    .eq("id", generationRunId).eq("owner_id", ownerId).single();
  if (runError) throw runError;
  if (run.trigger_run_id || run.status !== "queued") return { generationRunId, parentScreenId: parent.id };
  const metadata = run.metadata as Record<string, unknown>;
  let workerPayload = metadata.manualStatePayload as GenerateUiFlowPayload | undefined;
  if (!workerPayload) {
    const [{ data: state, error: stateError }, { data: parentItem, error: parentItemError }, { data: nav, error: navError }] = await Promise.all([
      admin.from("project_screen_roadmap").select("*").eq("id", String(metadata.stateRoadmapItemId)).eq("project_id", projectId).eq("owner_id", ownerId).single(),
      admin.from("project_screen_roadmap").select("*").eq("id", proposal.parentRoadmapItemId).eq("project_id", projectId).eq("owner_id", ownerId).single(),
      admin.from("project_navigation").select("plan").eq("project_id", projectId).maybeSingle(),
    ]);
    if (stateError || parentItemError || navError) throw stateError ?? parentItemError ?? navError;
    const variant = stateVariantFromRoadmap(state);
    workerPayload = { generationRunId, projectId, ownerId, prompt: proposal.prompt,
      imagePath: null, imageReferenceMode: "style", referencePolicy: "project_memory",
      designTokens: project.design_tokens ? normalizeDesignTokens(project.design_tokens as DesignTokens) : null,
      plannedScreens: [screenPlanFromRoadmap(parentItem, [variant])], stateVariants: [variant],
      navigationPlan: nav?.plan as NavigationPlan | null, requiresBottomNav: Boolean(nav?.plan?.enabled),
      projectCharter: project.project_charter as ProjectCharter | null, planningMode: "single-screen",
      approvalUserMessageId: proposalMessageId, parentRevisionHash: String(metadata.parentRevisionHash),
      productContent: compileProductContent(readProductPlanning(project.product_planning)),
      retryContext: { sourceGenerationRunId: parent.generation_run_id ?? generationRunId, mode: "state_variants", parentScreenId: parent.id },
    };
    const { error } = await admin.from("generation_runs").update({ metadata: { ...metadata,
      ...workerPayload, manualStatePayload: workerPayload, selectedStateVariantIds: [variant.id] } as never })
      .eq("id", generationRunId).eq("owner_id", ownerId).eq("status", "queued").is("trigger_run_id", null);
    if (error) throw error;
  }
  // An uncertain dispatch is retried with this SAME identity. Do not reset the
  // proposal or manufacture another generation run after a network timeout.
  const handle = await tasks.trigger<typeof generateUiFlowTask>("generate-ui-flow", workerPayload, {
    concurrencyKey: ownerId, ttl: "30m", idempotencyKey: `state-run:${generationRunId}`, idempotencyKeyTTL: "30d",
  });
  const { error: bindError } = await admin.from("generation_runs").update({ trigger_run_id: handle.id })
    .eq("id", generationRunId).eq("owner_id", ownerId);
  if (bindError) throw bindError;
  return { generationRunId, triggerRunId: handle.id, parentScreenId: parent.id };
}
