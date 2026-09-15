import "server-only";
import type { PlanningStore } from "./store";
import type { FunctionalItem } from "./functional-plan";
import { outputRendering } from "./output-policy";

// Reuse failed canvas frame identities through the existing worker retry path.
// Ready outputs are protected by approval fulfillment and never reset here.
export async function reusableProductOutputs(admin: PlanningStore, projectId: string, ownerId: string, batch: FunctionalItem[], recreate = false) {
  const { data: rows, error } = await admin.from("project_screen_roadmap").select("id, stable_key")
    .eq("project_id", projectId).eq("owner_id", ownerId).in("stable_key", batch.map(item => item.stableKey));
  if (error) throw error;
  const reuseScreenIdsByName: Record<string, string> = {};
  const reuseStateVariantIdsByKey: Record<string, string> = {};
  if (!rows?.length) return { reuseScreenIdsByName, reuseStateVariantIdsByKey };
  const { data: screens, error: screenError } = await admin.from("screens").select("id, roadmap_item_id")
    .eq("project_id", projectId).eq("owner_id", ownerId).in("roadmap_item_id", rows.map((row: { id: string }) => row.id))
    .eq("status", "failed").order("created_at", { ascending: false });
  if (screenError) throw screenError;
  for (const item of batch) {
    const roadmap = rows.find((row: { stable_key: string }) => row.stable_key === item.stableKey);
    const screen = screens?.find((row: { roadmap_item_id: string }) => row.roadmap_item_id === roadmap?.id);
    if (!screen) continue;
    if (outputRendering(item, recreate) !== "derived_state") reuseScreenIdsByName[item.name.trim().toLowerCase().replace(/\s+/g, " ")] = screen.id;
    else reuseStateVariantIdsByKey[item.stableKey] = screen.id;
  }
  return { reuseScreenIdsByName, reuseStateVariantIdsByKey };
}
