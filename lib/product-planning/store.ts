import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { readProductPlanning, type ProductPlanning } from "./model";

export type PlanningStore = ReturnType<typeof createAdminClient>;
export class PlanningConflict extends Error {}

export async function loadProductPlanning(admin: PlanningStore, projectId: string, ownerId: string) {
  const { data, error } = await admin.from("projects").select("product_planning")
    .eq("id", projectId).eq("owner_id", ownerId).single();
  if (error) throw error;
  return readProductPlanning(data.product_planning);
}

// Optimistic concurrency applies validated incremental changes to exactly the state read.
// A stale writer never silently replaces a newer decision or approval.
export async function saveProductPlanning(admin: PlanningStore, projectId: string, ownerId: string, previous: ProductPlanning, next: ProductPlanning) {
  const saved = { ...next, revision: previous.revision + 1 };
  const { data, error } = await admin.from("projects")
    .update({ product_planning: saved as never, updated_at: new Date().toISOString() })
    .eq("id", projectId).eq("owner_id", ownerId)
    .eq("product_planning->>revision", String(previous.revision))
    .select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new PlanningConflict("The product plan changed in another turn. Please try again with the current plan.");
  return saved;
}
