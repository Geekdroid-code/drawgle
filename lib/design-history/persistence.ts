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
export async function readDesignTarget(client: Client, identity: DesignIdentity) {
  const { data, error } = await client.rpc("read_design_target", identityArgs(identity));
  if (error) throw new Error("The saved design is unavailable. Refresh before retrying.");
  const result = z.object({ revision: z.number().int().nonnegative(), ready: z.boolean(), payload: z.unknown() }).parse(data);
  return { ...result, payload: snapshotSchemaFor(identity.target).parse(result.payload) };
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

// Deliberate release interlock. Changing an environment flag cannot bypass unfinished writer coverage.
// Remove only after the writer inventory and real PostgreSQL concurrency acceptance record pass.
export const RECOVERY_WRITERS_VERIFIED = false;
export const recoveryEnabled = () => RECOVERY_WRITERS_VERIFIED && process.env.DRAWGLE_DESIGN_RECOVERY_ENABLED === "true";
