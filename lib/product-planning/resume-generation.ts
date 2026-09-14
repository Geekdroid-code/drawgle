import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { readProductPlanning } from "./model";
import type { PlanningStore } from "./store";
import { saveExecutionProgress } from "./execution-progress";

export async function resumeProductGeneration(admin: PlanningStore, ownerId: string, projectId: string, approvalId: string, requestId: string) {
  const { data: root, error } = await admin.from("generation_runs").select("*")
    .eq("id", approvalId).eq("project_id", projectId).eq("owner_id", ownerId).single();
  if (error) throw error;
  const state = readProductPlanning(root.metadata?.productPlanning);
  if (!state?.scope?.manifest?.length) throw new Error("This run does not own an approved product scope.");
  const { data: attempt, error: resumeError } = await admin.rpc("resume_product_generation", {
    input_approval_id: approvalId, input_owner_id: ownerId, input_request_id: requestId,
  });
  if (resumeError) throw resumeError;
  // Persisted request/attempt makes an uncertain dispatch retry use the same key.
  const handle = await tasks.trigger("generate-product-flow", {
    generationRunId: approvalId, projectId, ownerId, productPlanning: state, productAttempt: attempt,
    prompt: root.prompt, imagePath: root.image_path, imageReferenceMode: state.input.imageReferenceMode,
    referencePolicy: root.metadata.referencePolicy, isNewProject: false,
  }, { idempotencyKey: `product-resume:${approvalId}:${attempt}`, idempotencyKeyTTL: "30d" }).catch(async error => {
    await saveExecutionProgress(admin, approvalId, ownerId, attempt, "failed", null,
      "Continuation could not confirm dispatch. Resume again to recover the same pending work.");
    throw error;
  });
  const { error: updateError } = await admin.from("generation_runs").update({ trigger_run_id: handle.id }).eq("id", approvalId);
  if (updateError) console.error("Product resume dispatched but trigger metadata update failed", updateError);
  return { projectId, generationRunId: approvalId, triggerRunId: handle.id };
}
