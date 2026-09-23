import "server-only";
import { z } from "zod";
import { indexScreenCode } from "@/lib/generation/block-index";
import { indexNavigationShell } from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { historyResultSchema, historyTargetSchema, snapshotSchemaFor, type HistoryTarget } from "./types";

const targetArgs = (projectId: string, ownerId: string, target: HistoryTarget) => ({
  input_project_id: z.string().uuid().parse(projectId), input_owner_id: z.string().uuid().parse(ownerId),
  input_context: historyTargetSchema.parse(target).context,
  input_target_id: target.context === "screen" ? target.screenId : projectId,
});
export const historySummarySchema = z.object({
  revision: z.number().int().nonnegative(), canUndo: z.boolean(), canRedo: z.boolean(),
  entries: z.array(z.object({ id: z.string().uuid(), sequence: z.number().int(), label: z.string(), origin: z.string(), createdAt: z.string(), isCurrent: z.boolean() })),
});
export async function listHistory(projectId: string, ownerId: string, target: HistoryTarget) {
  const { data, error } = await createAdminClient().rpc("list_design_history", targetArgs(projectId,ownerId,target));
  if (error) throw new Error("History is unavailable for this target.");
  return historySummarySchema.parse(data);
}
export async function previewHistory(projectId: string, ownerId: string, target: HistoryTarget, entryId: string) {
  const { data, error } = await createAdminClient().rpc("read_design_history_entry", {
    ...targetArgs(projectId,ownerId,target), input_entry_id: z.string().uuid().parse(entryId),
  });
  if (error || !data) return null;
  const preview = z.object({ id: z.string().uuid(), label: z.string(), createdAt: z.string(), payload: z.unknown() }).parse(data);
  return { ...preview, payload: snapshotSchemaFor(target).parse(preview.payload) };
}
export async function recoverDesign(projectId: string, ownerId: string, request: {
  target: HistoryTarget; action: "undo" | "redo" | "restore"; expectedRevision: number; requestId: string; entryId?: string;
}) {
  const args = targetArgs(projectId,ownerId,request.target);
  const client = createAdminClient();
  const { data: candidate, error: readError } = await client.rpc("read_design_history_operation", {
    ...args, input_action: request.action, ...(request.entryId ? { input_entry_id: request.entryId } : {}),
  });
  if (readError) throw new Error("History is unavailable for this target.");
  // A replay may no longer have the same cursor. The transaction handles its identity.
  const snapshot = candidate ? snapshotSchemaFor(request.target).parse(candidate) : null;
  const blockIndex: Json | null = snapshot && request.target.context === "screen"
    ? indexScreenCode((snapshot as { code: string }).code) as unknown as Json
    : snapshot && request.target.context === "navigation"
      ? indexNavigationShell((snapshot as { shellCode: string }).shellCode) as unknown as Json : null;
  const { data, error } = await client.rpc("apply_design_history", {
    ...args, input_expected_revision: z.number().int().nonnegative().parse(request.expectedRevision),
    input_request_id: z.string().uuid().parse(request.requestId), input_action: request.action,
    ...(request.entryId ? { input_entry_id: request.entryId } : {}),
    input_label: request.action === "restore" ? "Restored earlier design" : "History navigation",
    input_origin: "history", input_block_index: blockIndex,
  });
  if (error) throw new Error("Could not restore this design. The saved design was left unchanged.");
  return historyResultSchema.parse(data);
}
