import "server-only";
import type { PlanningStore } from "./store";

export async function saveExecutionProgress(admin: PlanningStore, approvalId: string, ownerId: string, attempt: number,
  status: "building" | "completed" | "failed" | null, progress: Record<string, number> | null, errorMessage: string | null = null) {
  const { data, error } = await admin.rpc("set_product_generation_progress", {
    input_approval_id: approvalId, input_owner_id: ownerId, input_attempt: attempt,
    input_status: status, input_progress: progress, input_error: errorMessage,
  });
  if (error) throw error;
  return data === true;
}
