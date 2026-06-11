import { logger, task } from "@trigger.dev/sdk";

import { executeModifyScreenTask, type ModifyScreenPayload } from "@/lib/generation/edit-runner";
import type { AgentStepMetadata } from "@/lib/agent/message-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreditService } from "@/lib/credits";

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

    // Gated Credit Check
    const creditCheck = await adminCreditService.hasCredits(payload.ownerId, requiredCredits);

    if (!creditCheck.hasCredits) {
      const errorMessage = `Insufficient credits for ${scopeLabel}. (Required: ${requiredCredits}, Balance: ${creditCheck.currentBalance}). Please upgrade your plan.`;
      
      await markEditFailed(payload, errorMessage);
      throw new Error(errorMessage);
    }

    const result = await executeModifyScreenTask(payload, (label, data) => logger.info(label, data));

    // Deduct credits ONLY if the edit was successful (changed === true)
    if (result.changed) {
      const deduction = await adminCreditService.deductCredits(
        payload.ownerId,
        requiredCredits,
        `UI Edit: ${scopeLabel}`
      );

      if (!deduction.success) {
        logger.error("Failed to deduct credits after successful edit", {
          ownerId: payload.ownerId,
          requiredCredits,
          error: deduction.error,
        });
      } else {
        logger.info("Successfully deducted credits after successful edit", {
          ownerId: payload.ownerId,
          requiredCredits,
          newBalance: deduction.newBalance,
        });
      }
    }

    return result;
  },
});
