import { logger, task } from "@trigger.dev/sdk";

import { executeModifyScreenTask, type ModifyScreenPayload } from "@/lib/generation/edit-runner";
import { createAdminClient } from "@/lib/supabase/admin";

const now = () => new Date().toISOString();

const buildFailedEditAgentState = (payload: ModifyScreenPayload, message: string) => {
  const targetType = payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation
    ? "navigation"
    : payload.selectedElementDrawgleId
      ? "selected_element"
      : "screen";
  const scope = payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation
    ? "navigation"
    : payload.targetScope ?? null;

  return {
    kind: "failed_edit_recovery",
    instruction: payload.resolvedInstruction ?? payload.prompt,
    missingFields: ["edit_recovery"],
    targetCandidates: null,
    lastKnownTarget: {
      targetType,
      scope,
      screenId: payload.screenId ?? null,
      screenName: null,
      selectedElementDrawgleId: payload.selectedElementDrawgleId ?? null,
    },
    message,
    expiresAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
  };
};

async function markEditFailed(payload: ModifyScreenPayload, message: string) {
  const admin = createAdminClient();
  const activityKey = `edit:${payload.userMessageId}`;

  const { data: existingMessage } = await admin
    .from("project_messages")
    .select("id, metadata")
    .eq("project_id", payload.projectId)
    .eq("owner_id", payload.ownerId)
    .contains("metadata", { activityKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingMessage) {
    const existingMetadata = existingMessage.metadata &&
      typeof existingMessage.metadata === "object" &&
      !Array.isArray(existingMessage.metadata)
      ? existingMessage.metadata as Record<string, unknown>
      : {};

    await admin
      .from("project_messages")
      .update({
        role: "model",
        content: message,
        message_type: "error",
        metadata: {
          ...existingMetadata,
          activityKey,
          action: "edit_failed",
          editJob: {
            status: "failed",
            targetType: payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation ? "navigation" : "screen",
            screenId: payload.screenId ?? null,
            drawgleId: payload.selectedElementDrawgleId ?? null,
          },
          editStrategy: payload.editStrategy ?? null,
          editOperation: payload.editOperation ?? null,
          recoveryContext: payload.recoveryContext ?? null,
          agentState: buildFailedEditAgentState(payload, message),
          error: message,
        } as never,
      })
      .eq("id", existingMessage.id);
    return;
  }

  await admin.from("project_messages").insert({
    project_id: payload.projectId,
    owner_id: payload.ownerId,
    screen_id: payload.screenId ?? null,
    role: "model",
    content: message,
    message_type: "error",
    metadata: {
      activityKey,
      action: "edit_failed",
      editJob: {
        status: "failed",
        targetType: payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation ? "navigation" : "screen",
        screenId: payload.screenId ?? null,
        drawgleId: payload.selectedElementDrawgleId ?? null,
      },
      editStrategy: payload.editStrategy ?? null,
      editOperation: payload.editOperation ?? null,
      recoveryContext: payload.recoveryContext ?? null,
      agentState: buildFailedEditAgentState(payload, message),
      createdAt: now(),
      error: message,
    } as never,
  });
}

export const modifyScreenTask = task({
  id: "modify-screen",
  retry: {
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15000,
    randomize: true,
  },
  queue: {
    concurrencyLimit: 8,
  },
  maxDuration: 300,
  onFailure: async ({ payload, error }: { payload: ModifyScreenPayload; error: unknown }) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Modify screen task failed", {
      projectId: payload.projectId,
      screenId: payload.screenId,
      error: message,
    });
    await markEditFailed(payload, `Edit failed: ${message}`);
  },
  run: async (payload: ModifyScreenPayload) => {
    logger.info("Running async Drawgle edit", {
      projectId: payload.projectId,
      screenId: payload.screenId,
      target: payload.selectedElementTarget,
    });

    return executeModifyScreenTask(payload);
  },
});
