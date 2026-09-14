import "server-only";
import type { PlanningStore } from "./store";
import type { ProductPlanning } from "./model";
import { executionOutputs, scopeParents } from "./scope-outputs";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";

export async function loadExecutionRoadmap(admin: PlanningStore, projectId: string, ownerId: string, state: ProductPlanning, keys: string[]) {
  const expected = [...executionOutputs(state, keys), ...scopeParents(state, keys)];
  const { data, error } = await admin.from("project_screen_roadmap").select("*")
    .eq("project_id", projectId).eq("owner_id", ownerId).in("stable_key", [...new Set(expected.map(item => item.stableKey))]);
  if (error) throw error;
  const rows = (data ?? []) as ProjectScreenRoadmapRow[];
  if (expected.some(item => !rows.some(row => row.stable_key === item.stableKey && row.kind === item.kind))) {
    throw new Error("An approved output identity is missing from the project roadmap. Restore it before continuing.");
  }
  // Functional identities were already committed by discovery. Do not send
  // them through the legacy name-based roadmap reconciliation a second time.
  return rows;
}
