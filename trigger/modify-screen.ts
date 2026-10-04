import { logger, task } from "@trigger.dev/sdk";

import { executeModifyScreenTask, type ModifyScreenPayload } from "@/lib/generation/edit-runner";
import type { AgentStepMetadata } from "@/lib/agent/message-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreditService } from "@/lib/credits";
import {
  CreditReservationError,
  captureEditCredit,
  editOutputKey,
  releaseEditCredit,
  reserveEditCredit,
} from "@/lib/generation/credit-reservations";
import { cleanErrorMessage } from "@/lib/ai/error-handler";
import { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";

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
  const activityKey = payload.activityKey?.trim() || `edit:${payload.userMessageId}`;
  const isNavigation = payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation;
  const failedStep: AgentStepMetadata = {
    kind: isNavigation ? "navigation" : "edit",
    status: "failed",
    title: isNavigation ? "Edit project navigation" : "Edit screen",
    detail: message,
    targetLabel: isNavigation ? "Navigation" : null,
    processLines: [message],
  };

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
            targetType: isNavigation ? "navigation" : "screen",
            screenId: payload.screenId ?? null,
            drawgleId: payload.selectedElementDrawgleId ?? null,
          },
          ui: { variant: "action_card" },
          agentStep: failedStep,
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
        targetType: isNavigation ? "navigation" : "screen",
        screenId: payload.screenId ?? null,
        drawgleId: payload.selectedElementDrawgleId ?? null,
      },
      ui: { variant: "action_card" },
      agentStep: failedStep,
      editStrategy: payload.editStrategy ?? null,
      editOperation: payload.editOperation ?? null,
      recoveryContext: payload.recoveryContext ?? null,
      agentState: buildFailedEditAgentState(payload, message),
      createdAt: now(),
      error: message,
    } as never,
  });
}

// Hands a reservation back without ever hiding the failure that caused it. A reservation
// that cannot be released here is refunded by the stale-reservation sweep once it expires.
async function releaseEditReservation(payload: ModifyScreenPayload, outputKey: string, reason: string) {
  try {
    await releaseEditCredit({ admin: createAdminClient(), ownerId: payload.ownerId, outputKey, reason });
  } catch (error) {
    logger.error("Failed to release edit credits", {
      ownerId: payload.ownerId,
      outputKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
    const rawMessage = error instanceof Error ? error.message : String(error);
    logger.error("Modify screen task failed", {
      projectId: payload.projectId,
      screenId: payload.screenId,
      error: rawMessage,
    });
    // A timeout or crash never reaches the catch in run(); release here so a dead edit never keeps credits.
    await releaseEditReservation(payload, editOutputKey(payload.userMessageId), "The edit run failed.");
    await markEditFailed(payload, `Edit failed: ${cleanErrorMessage(rawMessage)}`);
  },
  run: async (payload: ModifyScreenPayload) => {
    logger.info("Running async Drawgle edit", {
      projectId: payload.projectId,
      screenId: payload.screenId,
      target: payload.selectedElementTarget,
    });

    // Calculate dynamic credit cost based on the scope/size of the edit
    const selectedElementHtml = payload.selectedElementHtml?.trim() || "";
    const isNavigation = payload.selectedElementTarget === "navigation" || payload.requestTargetsNavigation;
    
    let requiredCredits = 20; // Default to full screen or navigation edit
    let scopeLabel = "Full Screen Edit";

    if (isNavigation) {
      requiredCredits = 20;
      scopeLabel = "Navigation Edit";
    } else if (selectedElementHtml) {
      const length = selectedElementHtml.length;
      if (length < 1000) {
        requiredCredits = 3;
        scopeLabel = "Small Component Edit";
      } else if (length <= 3000) {
        requiredCredits = 10;
        scopeLabel = "Medium Container Edit";
      } else {
        requiredCredits = 15;
        scopeLabel = "Large Section Edit";
      }
    }

    // Reserve the credits before the model runs. The reservation takes them out of the
    // balance under a row lock, so parallel edits cannot all pass the same balance check.
    // They are kept if the edit changes something and handed back if it does not.
    const admin = createAdminClient();
    const outputKey = editOutputKey(payload.userMessageId);

    try {
      await reserveEditCredit({
        admin,
        ownerId: payload.ownerId,
        projectId: payload.projectId,
        outputKey,
        amount: requiredCredits,
        metadata: { scope: scopeLabel, screenId: payload.screenId ?? null },
      });
    } catch (error) {
      let errorMessage = "Could not reserve credits for this edit. Nothing was charged. Please try again.";
      if (error instanceof CreditReservationError && error.code === "insufficient_credits") {
        const { balance } = await adminCreditService.getUserCredits(payload.ownerId);
        errorMessage = `Insufficient credits for ${scopeLabel}. (Required: ${requiredCredits}, Balance: ${balance}). Please upgrade your plan.`;
      } else {
        logger.error("Could not reserve edit credits", {
          ownerId: payload.ownerId,
          outputKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await markEditFailed(payload, errorMessage);
      throw new Error(errorMessage);
    }

    let result: Awaited<ReturnType<typeof executeModifyScreenTask>>;
    try {
      result = await executeModifyScreenTask(payload, (label, data) => logger.info(label, data));
    } catch (error) {
      await releaseEditReservation(payload, outputKey, "The edit failed.");
      throw error;
    }

    if (!result.changed) {
      await releaseEditReservation(payload, outputKey, "The edit made no change.");
      return result;
    }

    try {
      await captureEditCredit({ admin, ownerId: payload.ownerId, outputKey });
      logger.info("Captured edit credits", { ownerId: payload.ownerId, requiredCredits, outputKey });
    } catch (error) {
      // The edit is saved. The reservation stays open and the stale-reservation sweep settles it.
      logger.error("Failed to capture edit credits after a successful edit", {
        ownerId: payload.ownerId,
        requiredCredits,
        outputKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (payload.screenId && !isNavigation) {
      await enrichScreenMemoryTask.trigger(
        { screenId: payload.screenId },
        { concurrencyKey: `screen-memory-${payload.screenId}` },
      );
    }

    return result;
  },
});
