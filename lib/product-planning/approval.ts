import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ACTIVE_GENERATION_STATUSES } from "@/lib/types";
import { adminCreditService } from "@/lib/credits";
import { scopeQuote } from "./scope-outputs";
import { insertProjectMessage } from "@/lib/supabase/queries";
import { approveProductScope, type ProductPlanning } from "./model";
import { productScopeContract, scopedGenerationPrompt } from "./generation-context";
import { loadPlanningReference } from "./references";
import { loadProductPlanning, saveProductPlanning, PlanningConflict, type PlanningStore } from "./store";

export async function prepareProductApproval(admin: PlanningStore, ownerId: string, body: Record<string, unknown>) {
  const projectId = z.string().uuid().parse(body.projectId);
  const state = await loadProductPlanning(admin, projectId, ownerId);
  if (!state) return null;
  if (!body.productApproval) {
    if (state.phase === "discovery") throw new PlanningConflict("Review and approve the product design scope in chat before generating screens.");
    return null;
  }
  const { revision } = z.object({ revision: z.number().int().nonnegative() }).parse(body.productApproval);
  if (state.scope?.status !== "approved" && state.input.imageReferenceMode !== "recreate"
    && state.scope?.manifest?.some(item => item.kind === "state")) {
    throw new PlanningConflict("This older draft includes automatic state frames. Ask Drawgle to refresh the scope with inline behavior and main product tasks before approving. Additional states are now created from the canvas.");
  }
  let approved: ProductPlanning;
  try { approved = approveProductScope(state, revision); } catch (error) {
    throw new PlanningConflict(error instanceof Error ? error.message : "Review the current scope before approving.");
  }
  const { data: active, error } = await admin.from("generation_runs").select("id")
    .eq("project_id", projectId).in("status", [...ACTIVE_GENERATION_STATUSES]).limit(1).maybeSingle();
  if (error) throw error;
  if (active) throw new PlanningConflict("A generation is already running. Wait for it to finish before approving another scope.");
  const requiredCredits = scopeQuote(approved).credits;
  const creditCheck = await adminCreditService.hasCredits(ownerId, requiredCredits);
  if (!creditCheck.hasCredits) throw new PlanningConflict(`This scope needs ${requiredCredits} credits; your balance is ${creditCheck.currentBalance}. Add credits before approving.`);
  // Load evidence before claiming; storage failure leaves the approval available for retry.
  const image = await loadPlanningReference(admin, state.input.imagePath, ownerId);
  if (state.designerVersion === 2 && (!image || createHash("sha256").update(image.data).digest("hex") !== state.experience?.referenceHash)) {
    throw new PlanningConflict("The reference changed or could not be verified. Inspect it again before approving.");
  }
  const leaseId = crypto.randomUUID();
  let current = await saveProductPlanning(admin, projectId, ownerId, state, {
    ...approved, lease: { id: leaseId, expiresAt: new Date(Date.now() + 240_000).toISOString() },
  });
  const referenceMode = image ? state.input.imageReferenceMode === "recreate" ? "user_recreate" : "user_style" : "internal_style";
  return {
    snapshot: approved,
    initialGeneration: state.phase === "discovery",
    body: {
      projectId, clientRequestId: body.clientRequestId, prompt: approved.scope?.manifest?.length ? approved.scope.goal : scopedGenerationPrompt(approved),
      image, imageReferenceMode: state.input.imageReferenceMode, stylePresetSlug: state.input.stylePresetSlug,
      scopeContract: productScopeContract(approved, referenceMode),
    },
    async queued(generationRunId: string) {
      current = await saveProductPlanning(admin, projectId, ownerId, current, {
        ...current, phase: "canvas", lease: null, scope: { ...current.scope!, generationRunId },
        input: { ...current.input, imageReferenceMode: "style" },
      });
      await insertProjectMessage(admin, { projectId, ownerId, role: "user", content: `Approved: ${approved.scope!.goal}`, metadata: {
        action: "product_scope_approved", revision, generationRunId, productScope: approved.scope,
      } });
    },
    async rollback() {
      const latest = await loadProductPlanning(admin, projectId, ownerId);
      if (!latest || latest.revision !== current.revision) return;
      const restored: ProductPlanning = { ...state, lease: null };
      await saveProductPlanning(admin, projectId, ownerId, latest, restored);
    },
  };
}
