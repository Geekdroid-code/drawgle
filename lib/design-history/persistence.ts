import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/lib/supabase/database.types";
import { historyResultSchema, historyTargetSchema, snapshotSchemaFor, type HistoryTarget } from "./types";
import { indexScreenCode } from "@/lib/generation/block-index";
import { indexNavigationShell } from "@/lib/project-navigation";

type Client = SupabaseClient<Database>;
export type DesignIdentity = { projectId: string; ownerId: string; target: HistoryTarget };
const identityArgs = ({ projectId, ownerId, target }: DesignIdentity) => ({
  input_project_id: z.string().uuid().parse(projectId), input_owner_id: z.string().uuid().parse(ownerId),
  input_context: historyTargetSchema.parse(target).context,
  input_target_id: target.context === "screen" ? target.screenId : projectId,
});
/**
 * The latest saved navigation changes on the current timeline, newest first, for an edit that refers back to one
 * ("put back the tab you removed"). Context only: a failure to read returns nothing rather than failing the edit.
 */
export async function readRecentNavigationChanges(client: Client, projectId: string, ownerId: string, limit = 3) {
  const target = { input_project_id: projectId, input_owner_id: ownerId, input_context: "navigation", input_target_id: projectId };
  const { data: listing, error } = await client.rpc("list_design_history", target);
  const parsed = z.object({ entries: z.array(z.object({ id: z.string(), sequence: z.number(), isCurrent: z.boolean() })) }).safeParse(listing);
  if (error || !parsed.success) return [];
  // Entries come newest first; changes after the current one were undone and are not part of the design.
  const current = parsed.data.entries.findIndex(entry => entry.isCurrent);
  if (current < 0) return [];
  const changes: Array<{ label: string; created_at: string; before_snapshot: unknown; after_snapshot: unknown }> = [];
  for (const entry of parsed.data.entries.slice(current, current + limit)) {
    const { data, error: entryError } = await client.rpc("read_design_history_entry", { ...target, input_entry_id: entry.id });
    const read = z.object({ label: z.string(), createdAt: z.string(), payload: z.unknown(), beforePayload: z.unknown() }).safeParse(data);
    if (entryError || !read.success) break;
    changes.push({ label: read.data.label, created_at: read.data.createdAt, before_snapshot: read.data.beforePayload, after_snapshot: read.data.payload });
  }
  return changes;
}

export async function readDesignTarget(client: Client, identity: DesignIdentity) {
  const { data, error } = await client.rpc("read_design_target", identityArgs(identity));
  if (error) throw new Error("The saved design is unavailable. Refresh before retrying.");
  const result = z.object({ revision: z.number().int().nonnegative(), ready: z.boolean(), payload: z.unknown() }).parse(data);
  return { ...result, payload: snapshotSchemaFor(identity.target).parse(result.payload) };
}
export async function readDesignRequestReplay(client: Client, identity: DesignIdentity, request: { expectedRevision: number; requestId: string; origin: string }) {
  const { data, error } = await client.rpc("read_design_request_replay", {
    ...identityArgs(identity), input_expected_revision: z.number().int().nonnegative().parse(request.expectedRevision),
    input_request_id: z.string().uuid().parse(request.requestId), input_origin: request.origin,
  });
  if (error) throw new Error("Could not verify the previous save. Your draft is retained.");
  return data ? historyResultSchema.parse(data) : null;
}
export async function persistDesignChange(client: Client, identity: DesignIdentity, change: {
  expectedRevision: number; requestId: string; payload: unknown; label: string; origin: string; generationRunId?: string;
}) {
  const { data, error } = await client.rpc("apply_design_history", {
    ...identityArgs(identity), input_action: "commit",
    input_expected_revision: z.number().int().nonnegative().parse(change.expectedRevision),
    input_request_id: z.string().uuid().parse(change.requestId),
    ...(change.generationRunId ? { input_generation_run_id: z.string().uuid().parse(change.generationRunId) } : {}),
    input_payload: snapshotSchemaFor(identity.target).parse(change.payload) as Json,
    input_block_index: identity.target.context === "screen" ? indexScreenCode((change.payload as { code: string }).code) as unknown as Json
      : identity.target.context === "navigation" ? indexNavigationShell((change.payload as { shellCode: string }).shellCode) as unknown as Json : null,
    input_label: z.string().min(1).max(160).parse(change.label), input_origin: z.string().min(1).max(80).parse(change.origin),
  });
  if (error) throw new Error("Could not save the design and its recovery record. Your draft has not been saved.");
  return historyResultSchema.parse(data);
}
