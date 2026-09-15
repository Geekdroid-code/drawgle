import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { approveScreenStateProposal, ScreenStateApprovalError } from "./screen-state-approval";
import { readScreenStateProposal } from "./message-metadata";

export const manualStateRequestSchema = z.object({
  projectId: z.string().uuid(), parentScreenId: z.string().uuid(), requestId: z.string().uuid(),
  prompt: z.string().trim().min(3).max(3000),
});
export const parentRevisionHash = (code: string) => createHash("sha256").update(code).digest("hex");

export async function createManualScreenState(admin: ReturnType<typeof createAdminClient>, ownerId: string,
  input: z.infer<typeof manualStateRequestSchema>, duplicateRetry = false) {
  const { data: existing, error: readError } = await admin.from("project_messages").select("metadata")
    .eq("id", input.requestId).eq("project_id", input.projectId).eq("owner_id", ownerId).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const proposal = readScreenStateProposal(existing.metadata as Record<string, unknown>);
    if (!proposal || proposal.parentScreenId !== input.parentScreenId || proposal.prompt !== input.prompt) throw new ScreenStateApprovalError("This request identity belongs to a different state. Start a new request.", 409);
  } else {
    const { data: parent, error } = await admin.from("screens").select("id, name, code, status, roadmap_item_id, parent_screen_id")
      .eq("id", input.parentScreenId).eq("project_id", input.projectId).eq("owner_id", ownerId).maybeSingle();
    if (error) throw error;
    if (!parent || parent.status !== "ready" || !parent.code || !parent.roadmap_item_id || parent.parent_screen_id) throw new ScreenStateApprovalError("Choose a ready main screen to create a state.", 409);
    const { error: insertError } = await admin.from("project_messages").insert({
      id: input.requestId, project_id: input.projectId, owner_id: ownerId, screen_id: parent.id,
      role: "user", message_type: "chat", content: `Create a state of ${parent.name}: ${input.prompt}`,
      metadata: { action: "manual_state_request", parentRevisionHash: parentRevisionHash(parent.code),
        screenStateProposal: { version: 1, prompt: input.prompt, parentScreenId: parent.id,
          parentScreenName: parent.name, parentRoadmapItemId: parent.roadmap_item_id,
          state: { stateKey: `custom-${input.requestId}`, stateLabel: input.prompt.slice(0, 70), stateRole: "custom",
            triggerLabel: "User-requested state", description: input.prompt, editInstruction: input.prompt },
          status: "pending", expiresAt: new Date(Date.now() + 86400000).toISOString() } } as never,
    });
    if (insertError && insertError.code !== "23505") throw insertError;
    if (insertError) {
      if (duplicateRetry) throw new ScreenStateApprovalError("That request identity is already in use. Close and reopen Create state.", 409);
      return createManualScreenState(admin, ownerId, input, true);
    }
  }
  return approveScreenStateProposal({ admin, ownerId, projectId: input.projectId, proposalMessageId: input.requestId });
}
