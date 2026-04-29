import "server-only";

import { detectTargetBlocks, indexScreenCode } from "@/lib/generation/block-index";
import { assembleChatContext } from "@/lib/generation/context";
import { persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import {
  buildFullScreenReconstructionCode,
  buildSectionRepairCode,
  buildSourceRegionReplacementCode,
  editNavigationShellCode,
  editScreenStream,
} from "@/lib/generation/service";
import { applyEdits } from "@/lib/diff-engine";
import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { detectScreenHealth, validateStaticDrawgleHtml } from "@/lib/generation/screen-quality";
import { findRepairTarget, replaceSourceRegion, type RepairTarget } from "@/lib/generation/screen-repair";
import { sanitizeScreenCodeForSharedNavigation } from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProjectMessages, insertProjectMessage } from "@/lib/supabase/queries";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import type {
  DesignTokens,
  NavigationArchitecture,
  NavigationPlan,
  ProjectCharter,
  ScreenBlockIndex,
  ScreenChromePolicy,
  ScreenPlan,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type ProjectMessageInput = Parameters<typeof insertProjectMessage>[1];
type ScreenHealthResult = ReturnType<typeof detectScreenHealth>;
type EditTargetScope = "selected_element" | "screen_region" | "whole_screen" | "screen" | "navigation";
type EditStrategy =
  | "selected_element_region_replace"
  | "screen_root_region_replace"
  | "block_region_replace"
  | "legacy_patch_then_region_replace"
  | "navigation_replace";

export type ModifyScreenPayload = {
  projectId: string;
  ownerId: string;
  prompt: string;
  resolvedInstruction?: string | null;
  userMessageId: string;
  screenId?: string | null;
  selectedElementHtml?: string | null;
  selectedElementDrawgleId?: string | null;
  selectedElementTarget?: "screen" | "navigation" | null;
  requestTargetsNavigation?: boolean;
  targetScope?: EditTargetScope | string | null;
  editStrategy?: EditStrategy | string | null;
  conversationContext?: Array<{ role: "user" | "model" | "system"; content: string; screenId?: string | null; metadata?: Record<string, unknown> | null }> | null;
  recoveryContext?: Record<string, unknown> | null;
  routerDecision?: Record<string, unknown> | null;
};

const now = () => new Date().toISOString();

const buildEditAgentState = ({
  kind,
  instruction,
  scope,
  screenId,
  screenName,
  selectedElementDrawgleId,
  message,
}: {
  kind: "failed_edit_recovery" | "last_actionable_request";
  instruction: string;
  scope: "selected_element" | "screen_region" | "whole_screen" | "screen" | "navigation";
  screenId?: string | null;
  screenName?: string | null;
  selectedElementDrawgleId?: string | null;
  message?: string | null;
}) => ({
  kind,
  instruction,
  missingFields: kind === "failed_edit_recovery" ? ["edit_recovery"] : null,
  targetCandidates: null,
  lastKnownTarget: {
    targetType: scope === "navigation" ? "navigation" : selectedElementDrawgleId ? "selected_element" : "screen",
    scope: scope === "screen" ? "whole_screen" : scope,
    screenId: screenId ?? null,
    screenName: screenName ?? null,
    selectedElementDrawgleId: selectedElementDrawgleId ?? null,
  },
  message: message ?? null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
});

const isNavigationEditPrompt = (prompt: string) =>
  /\b(nav|navigation|tab bar|tabs|bottom bar|bottom nav|bottom navigation|floating dock|dock)\b/i.test(prompt);

const isNavigationElementHtml = (html?: string | null) =>
  /data-drawgle-primary-nav|data-nav-item-id/i.test(html ?? "");

const isScreenRepairPrompt = (prompt: string) =>
  /\b(repair|fix|complete|finish|continue|half[-\s]?built|broken|truncated|missing|incomplete|not complete|couldn'?t be completed)\b/i.test(prompt);

const isScreenLevelEditPrompt = (prompt: string) =>
  /\b(whole|entire|full)\s+(screen|page)|\b(redesign|rewrite|rebuild|replace)\s+(the\s+)?(screen|page)\b|\boverall\s+(layout|design)\b|\boutside\s+(the\s+)?selected\b/i.test(prompt);

const isBackgroundRegionEditPrompt = (prompt: string) =>
  /\b(bg|background|gradient|blob|glow|light effect|lighting|aura|ambient)\b/i.test(prompt);

const isKnownEditStrategy = (value: unknown): value is EditStrategy =>
  value === "selected_element_region_replace" ||
  value === "screen_root_region_replace" ||
  value === "block_region_replace" ||
  value === "legacy_patch_then_region_replace" ||
  value === "navigation_replace";

const buildRootRepairTarget = (code: string, blockIndex: ScreenBlockIndex): RepairTarget => {
  const rootBlock = blockIndex.blocks.find((block) => block.id === blockIndex.rootId);

  return {
    startOffset: rootBlock?.startOffset ?? 0,
    endOffset: rootBlock?.endOffset ?? code.length,
    snippet: code.slice(rootBlock?.startOffset ?? 0, rootBlock?.endOffset ?? code.length).trim(),
    reason: "screen_root_region",
    blockId: blockIndex.rootId,
    drawgleId: null,
  };
};

const buildScreenHealthError = (health: ScreenHealthResult) => {
  if (health.healthy) {
    return null;
  }

  const staticCodes = health.staticValidation.codes.length > 0
    ? ` [static_html:${health.staticValidation.codes.join(",")}]`
    : "";
  return `[screen_health:${health.status}]${staticCodes} ${health.issues.join(" | ")}`;
};

const screenStatusForHealth = (health: ScreenHealthResult) => health.healthy ? "ready" : "failed";

async function upsertActivityMessage(
  admin: AdminClient,
  activityKey: string,
  input: ProjectMessageInput,
) {
  const metadata = {
    ...(input.metadata ?? {}),
    activityKey,
  };

  const { data: existingMessage, error: existingError } = await admin
    .from("project_messages")
    .select("id, metadata")
    .eq("project_id", input.projectId)
    .eq("owner_id", input.ownerId)
    .contains("metadata", { activityKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingMessage) {
    return insertProjectMessage(admin, {
      ...input,
      metadata,
    });
  }

  const existingMetadata = existingMessage.metadata &&
    typeof existingMessage.metadata === "object" &&
    !Array.isArray(existingMessage.metadata)
    ? existingMessage.metadata as Record<string, unknown>
    : {};

  const { data, error } = await admin
    .from("project_messages")
    .update({
      screen_id: input.screenId ?? null,
      role: input.role,
      content: input.content,
      message_type: input.messageType ?? "chat",
      metadata: {
        ...existingMetadata,
        ...metadata,
      } as never,
    })
    .eq("id", existingMessage.id)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { id: data.id };
}

const persistEditMemoryPair = async (
  admin: AdminClient,
  userMessageId: string,
  userContent: string,
  modelMessageId: string,
  modelContent: string,
) => {
  try {
    await persistProjectMessageMemoryPair({
      admin,
      userMessageId,
      userContent,
      modelMessageId,
      modelContent,
    });
  } catch (error) {
    console.error("Failed to persist edit message memory", error);
  }
};

async function runEditScreenStream(input: Parameters<typeof editScreenStream>[0]) {
  let output = "";
  for await (const chunk of editScreenStream(input)) {
    output += chunk;
  }
  return output;
}

export async function executeModifyScreenTask(payload: ModifyScreenPayload) {
  const admin = createAdminClient();
  const originalPrompt = payload.prompt.trim();
  const prompt = payload.resolvedInstruction?.trim() || originalPrompt;
  const editActivityKey = `edit:${payload.userMessageId}`;
  const routerScope = typeof payload.routerDecision?.targetScope === "string"
    ? payload.routerDecision.targetScope
    : null;
  const payloadTargetScope = typeof payload.targetScope === "string" ? payload.targetScope : null;
  const shouldUseSelectedElement = Boolean(payload.selectedElementDrawgleId || payload.selectedElementHtml) &&
    (payloadTargetScope === "selected_element" || routerScope === "selected_element" || !isScreenLevelEditPrompt(originalPrompt));
  const selectedElementHtml = shouldUseSelectedElement ? payload.selectedElementHtml?.trim() || null : null;
  const selectedElementDrawgleId = shouldUseSelectedElement ? payload.selectedElementDrawgleId?.trim() || null : null;
  const selectedElementTarget = payload.selectedElementTarget === "navigation" ? "navigation" : "screen";
  const requestedEditStrategy = isKnownEditStrategy(payload.editStrategy) ? payload.editStrategy : null;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, owner_id, design_tokens, project_charter")
    .eq("id", payload.projectId)
    .maybeSingle();

  if (projectError || !project || project.owner_id !== payload.ownerId) {
    throw new Error("Project not found for edit task.");
  }

  const designTokens = (project.design_tokens as DesignTokens | null) ?? null;
  const projectCharter = (project.project_charter as ProjectCharter | null) ?? null;
  const navigationArchitecture = (projectCharter?.navigationArchitecture ?? null) as NavigationArchitecture | null;
  const requestedNavigationEdit =
    payload.requestTargetsNavigation ||
    selectedElementTarget === "navigation" ||
    isNavigationElementHtml(selectedElementHtml) ||
    isNavigationEditPrompt(prompt);
  const selectedNavigationElement = selectedElementTarget === "navigation" || isNavigationElementHtml(selectedElementHtml);

  if (requestedNavigationEdit) {
    const { data: projectNavigation, error: navigationError } = await admin
      .from("project_navigation")
      .select("id, shell_code, block_index, plan")
      .eq("project_id", payload.projectId)
      .maybeSingle();

    if (navigationError || !projectNavigation?.shell_code) {
      throw new Error(navigationError?.message ?? "Shared project navigation was not found for this project.");
    }

    const navigationCode = ensureDrawgleIds(projectNavigation.shell_code).code;
    const navigationPlan = projectNavigation.plan as unknown as NavigationPlan;

    await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: null,
      role: "system",
      content: "Editing shared project navigation...",
      messageType: "chat",
      metadata: {
        action: "navigation_edit_start",
        target: "project_navigation",
        screenName: "Navigation",
        userMessageId: payload.userMessageId,
        editJob: { status: "editing", targetType: "navigation" },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    const editedNavigationCode = await editNavigationShellCode({
      prompt,
      currentShellCode: navigationCode,
      navigationPlan,
      designTokens,
      projectCharter,
      selectedElementHtml: selectedNavigationElement ? selectedElementHtml : null,
    });
    const nextCode = ensureDrawgleIds(tokenizeStaticDrawgleHtml(editedNavigationCode, designTokens).code).code;

    if (nextCode !== navigationCode) {
      const { error: updateError } = await admin
        .from("project_navigation")
        .update({
          shell_code: nextCode,
          block_index: indexScreenCode(nextCode) as never,
          status: "ready",
          error: null,
          updated_at: now(),
        })
        .eq("id", projectNavigation.id);

      if (updateError) {
        throw updateError;
      }
    }

    const fullResponse = nextCode === navigationCode
      ? "No material code changes were applied to Navigation."
      : "Updated shared project navigation.";
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: null,
      role: "model",
      content: fullResponse,
      messageType: nextCode === navigationCode ? "chat" : "edit_applied",
      metadata: {
        action: nextCode === navigationCode ? "edit_noop" : "edit_applied",
        target: "project_navigation",
        screenName: "Navigation",
        userMessageId: payload.userMessageId,
        editJob: { status: "completed", targetType: "navigation" },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
    return { targetType: "navigation" as const, changed: nextCode !== navigationCode, message: fullResponse };
  }

  if (!payload.screenId) {
    throw new Error("No screen target was provided for this edit.");
  }

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, name, prompt, code, block_index, chrome_policy, navigation_item_id")
    .eq("id", payload.screenId)
    .eq("project_id", payload.projectId)
    .maybeSingle();

  if (screenError || !screen) {
    throw new Error("Screen not found for edit task.");
  }

  const { data: projectNavigation } = await admin
    .from("project_navigation")
    .select("plan")
    .eq("project_id", payload.projectId)
    .maybeSingle();

  const projectNavigationPlan = (projectNavigation?.plan as unknown as NavigationPlan | null) ?? null;
  const screenCode = ensureDrawgleIds(typeof screen.code === "string" && screen.code.length > 0 ? screen.code : "").code;
  const blockIndex = ((screen.block_index as ScreenBlockIndex | null) ?? indexScreenCode(screenCode));
  const selectedSourceRegion = selectedElementDrawgleId
    ? findRepairTarget({
        code: screenCode,
        drawgleId: selectedElementDrawgleId,
        blockIndex,
      })
    : null;
  const resolvedEditStrategy: EditStrategy = requestedEditStrategy ??
    (selectedSourceRegion
      ? "selected_element_region_replace"
      : isBackgroundRegionEditPrompt(prompt) || payloadTargetScope === "screen_region" || payloadTargetScope === "whole_screen"
        ? "screen_root_region_replace"
        : "legacy_patch_then_region_replace");
  const rootSourceRegion = resolvedEditStrategy === "screen_root_region_replace"
    ? buildRootRepairTarget(screenCode, blockIndex)
    : null;
  const blockSourceRegion = resolvedEditStrategy === "block_region_replace"
    ? findRepairTarget({ code: screenCode, blockIndex, prompt })
    : null;
  const regionReplacementTarget = selectedSourceRegion ?? rootSourceRegion ?? blockSourceRegion;
  const selectedSourceElementHtml = regionReplacementTarget?.snippet || selectedElementHtml;
  const resolution = selectedSourceElementHtml
    ? { scope: "scoped" as const, targetBlockIds: [] }
    : detectTargetBlocks(prompt, blockIndex);
  const targetBlockIds = resolution.scope === "scoped" && !selectedSourceElementHtml ? resolution.targetBlockIds : [];
  const allMessages = await fetchProjectMessages(admin, payload.projectId);
  const chatHistory = selectedSourceElementHtml
    ? [{ role: "user" as const, content: prompt }]
    : await assembleChatContext({
        admin,
        projectId: payload.projectId,
        userPrompt: prompt,
        recentMessages: allMessages,
      });
  const targetNames = selectedSourceElementHtml
    ? regionReplacementTarget?.reason === "screen_root_region"
      ? "screen background"
      : "selected element"
    : targetBlockIds.length > 0
      ? targetBlockIds.map((id) => blockIndex.blocks.find((block) => block.id === id)?.name ?? id).join(", ")
      : "full screen";
  const screenPrompt = typeof screen.prompt === "string" ? screen.prompt : "";
  const screenPlanForSave: ScreenPlan = {
    name: screen.name,
    type: "root",
    description: screenPrompt,
    chromePolicy: (screen.chrome_policy as ScreenChromePolicy | null) ?? null,
    navigationItemId: typeof screen.navigation_item_id === "string" ? screen.navigation_item_id : null,
  };
  const normalizeScreenCodeForSave = (code: string) =>
    ensureDrawgleIds(tokenizeStaticDrawgleHtml(sanitizeScreenCodeForSharedNavigation(code, screenPlanForSave), designTokens).code).code;
  const health = detectScreenHealth({ code: screenCode, screenPrompt });
  const selectedRegionStaticHealth = regionReplacementTarget
    ? validateStaticDrawgleHtml({ code: regionReplacementTarget.snippet })
    : null;

  if (regionReplacementTarget) {
    await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "system",
      content: `Editing ${targetNames} in ${screen.name}...`,
      messageType: "chat",
      metadata: {
        action: "source_region_replace_start",
        editStrategy: resolvedEditStrategy,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        repairTarget: {
          reason: regionReplacementTarget.reason,
          blockId: regionReplacementTarget.blockId ?? null,
          drawgleId: regionReplacementTarget.drawgleId ?? selectedElementDrawgleId ?? null,
          startOffset: regionReplacementTarget.startOffset,
          endOffset: regionReplacementTarget.endOffset,
        },
        health,
        selectedRegionStaticHealth,
        recoveryContext: payload.recoveryContext ?? null,
        editJob: { status: "editing", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    const replacement = await buildSourceRegionReplacementCode({
      screenName: screen.name,
      screenPrompt,
      userPrompt: prompt,
      currentCode: screenCode,
      repairTarget: regionReplacementTarget,
      designTokens,
      projectCharter,
      navigationArchitecture,
    });

    if (!replacement.trim()) {
      throw new Error("Selected-region edit returned an empty replacement.");
    }

    const replacedCode = replaceSourceRegion(screenCode, regionReplacementTarget, replacement);
    const nextCode = normalizeScreenCodeForSave(replacedCode);
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });

    if (nextCode !== screenCode) {
      const { error: updateError } = await admin
        .from("screens")
        .update({
          code: nextCode,
          block_index: indexScreenCode(nextCode) as never,
          status: screenStatusForHealth(nextHealth),
          error: buildScreenHealthError(nextHealth),
          updated_at: now(),
        })
        .eq("id", screen.id);

      if (updateError) {
        throw updateError;
      }
    }

    const fullResponse = nextCode === screenCode
      ? `No material code changes were applied to ${screen.name}.`
      : nextHealth.healthy
        ? `Updated ${targetNames} in ${screen.name}.`
        : `Updated ${targetNames} in ${screen.name}, but the screen still has source health warnings.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: nextCode === screenCode ? "error" : nextHealth.healthy ? "edit_applied" : "chat",
      metadata: {
        action: nextCode === screenCode ? "source_region_replace_noop" : nextHealth.healthy ? "source_region_replace_applied" : "source_region_replace_partial",
        editStrategy: resolvedEditStrategy,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        nextHealth,
        selectedRegionStaticHealth,
        recoveryContext: nextCode === screenCode ? {
          kind: "failed_edit_recovery",
          instruction: prompt,
          targetType: "screen",
          targetScope: resolvedEditStrategy === "selected_element_region_replace" ? "selected_element" : "screen_region",
          targetScreenId: screen.id,
          selectedElementDrawgleId,
          strategy: resolvedEditStrategy,
        } : null,
        agentState: buildEditAgentState({
          kind: nextCode === screenCode ? "failed_edit_recovery" : "last_actionable_request",
          instruction: prompt,
          scope: resolvedEditStrategy === "selected_element_region_replace" ? "selected_element" : "screen_region",
          screenId: screen.id,
          screenName: screen.name,
          selectedElementDrawgleId,
          message: fullResponse,
        }),
        editJob: { status: "completed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
    return { targetType: "screen" as const, screenId: screen.id, changed: nextCode !== screenCode, message: fullResponse };
  }

  if (health.staticValidation.unrecoverable) {
    await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "system",
      content: `Reconstructing ${screen.name} from invalid source...`,
      messageType: "chat",
      metadata: {
        action: "full_screen_reconstruction_start",
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        editJob: { status: "editing", targetType: "screen", screenId: screen.id },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    const reconstructed = await buildFullScreenReconstructionCode({
      screenPlan: screenPlanForSave,
      userPrompt: prompt,
      currentCode: screenCode,
      designTokens,
      projectCharter,
      navigationArchitecture,
      navigationPlan: projectNavigationPlan,
    });

    if (!reconstructed.trim()) {
      throw new Error("Full-screen reconstruction returned empty code.");
    }

    const nextCode = normalizeScreenCodeForSave(reconstructed);
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });

    const { error: updateError } = await admin
      .from("screens")
      .update({
        code: nextCode,
        block_index: indexScreenCode(nextCode) as never,
        status: screenStatusForHealth(nextHealth),
        error: buildScreenHealthError(nextHealth),
        updated_at: now(),
      })
      .eq("id", screen.id);

    if (updateError) {
      throw updateError;
    }

    const fullResponse = nextHealth.healthy
      ? `Reconstructed ${screen.name} from invalid source.`
      : `Reconstructed ${screen.name}, but the screen still has source health warnings.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: nextHealth.healthy ? "edit_applied" : "error",
      metadata: {
        action: nextHealth.healthy ? "full_screen_reconstruction_applied" : "full_screen_reconstruction_partial",
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        nextHealth,
        editJob: { status: "completed", targetType: "screen", screenId: screen.id },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
    return { targetType: "screen" as const, screenId: screen.id, changed: true, message: fullResponse };
  }

  const shouldRepairScreen = isScreenRepairPrompt(prompt) || !health.healthy;

  if (shouldRepairScreen) {
    const repairTarget = findRepairTarget({
      code: screenCode,
      drawgleId: selectedElementDrawgleId,
      blockIndex,
      prompt: `${prompt}\n${health.missingAnchors.join(" ")}`,
    }) ?? {
      startOffset: 0,
      endOffset: screenCode.length,
      snippet: screenCode,
      reason: "whole_screen_unrecoverable",
      blockId: blockIndex.rootId,
      drawgleId: null,
    };

    await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "system",
      content: `Repairing ${targetNames} in ${screen.name}...`,
      messageType: "chat",
      metadata: {
        action: "screen_repair_start",
        targetBlockIds,
        repairTarget: {
          reason: repairTarget.reason,
          blockId: repairTarget.blockId ?? null,
          drawgleId: repairTarget.drawgleId ?? selectedElementDrawgleId ?? null,
        },
        health,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        editJob: { status: "editing", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    const replacement = await buildSectionRepairCode({
      screenName: screen.name,
      screenPrompt,
      userPrompt: prompt,
      currentCode: screenCode,
      repairTarget,
      missingAnchors: health.missingAnchors,
      healthIssues: health.issues,
      designTokens,
      projectCharter,
      navigationArchitecture,
    });

    if (!replacement.trim()) {
      throw new Error("Repair model returned an empty replacement section.");
    }

    const repairedCode = replaceSourceRegion(screenCode, repairTarget, replacement);
    const nextCode = normalizeScreenCodeForSave(repairedCode);
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });

    if (nextCode !== screenCode) {
      const { error: updateError } = await admin
        .from("screens")
        .update({
          code: nextCode,
          block_index: indexScreenCode(nextCode) as never,
          status: screenStatusForHealth(nextHealth),
          error: buildScreenHealthError(nextHealth),
          updated_at: now(),
        })
        .eq("id", screen.id);

      if (updateError) {
        throw updateError;
      }
    }

    const fullResponse = nextCode === screenCode
      ? `Repair could not apply a material code change to ${screen.name}.`
      : nextHealth.healthy
        ? `Repaired ${targetNames} in ${screen.name}.`
        : `Repaired ${targetNames} in ${screen.name}, but the screen still has health warnings.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: nextCode === screenCode ? "error" : nextHealth.healthy ? "edit_applied" : "chat",
      metadata: {
        action: nextCode === screenCode ? "screen_repair_failed" : nextHealth.healthy ? "screen_repair_applied" : "screen_repair_partial",
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        repairTarget: {
          reason: repairTarget.reason,
          blockId: repairTarget.blockId ?? null,
          drawgleId: repairTarget.drawgleId ?? selectedElementDrawgleId ?? null,
        },
        health,
        nextHealth,
        editJob: { status: "completed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
    return { targetType: "screen" as const, screenId: screen.id, changed: nextCode !== screenCode, message: fullResponse };
  }

  await upsertActivityMessage(admin, editActivityKey, {
    projectId: payload.projectId,
    ownerId: payload.ownerId,
    screenId: screen.id,
    role: "system",
    content: `Editing ${targetNames} in ${screen.name}...`,
    messageType: "chat",
    metadata: {
      action: "edit_start",
      editStrategy: "legacy_patch_then_region_replace",
      targetBlockIds,
      screenName: screen.name,
      userMessageId: payload.userMessageId,
      editJob: { status: "editing", targetType: "screen", screenId: screen.id },
      routerDecision: payload.routerDecision ?? null,
    },
  });

  const normalizeEditedCode = (editsText: string) => {
    const editedCode = editsText.includes("<edit>") ? applyEdits(screenCode, editsText) : screenCode;
    return normalizeScreenCodeForSave(editedCode);
  };

  let responseToApply = await runEditScreenStream({
    messages: chatHistory,
    screenCode,
    blockIndex,
    targetBlockIds,
    designTokens,
    navigationArchitecture,
    selectedElementHtml: selectedSourceElementHtml,
    selectedElementDrawgleId,
  });
  let nextCode = normalizeEditedCode(responseToApply);

  if (nextCode === screenCode) {
    const retryResponse = await runEditScreenStream({
      messages: [{
        role: "user" as const,
        content: [
          prompt,
          "",
          "The previous edit attempt did not apply any material source-code change.",
          "Return ONLY <edit> blocks whose <search> content exactly matches the current source HTML below.",
          "Make a visible change that satisfies the request. Do not explain.",
        ].join("\n"),
      }],
      screenCode,
      blockIndex,
      targetBlockIds,
      designTokens,
      navigationArchitecture,
      selectedElementHtml: selectedSourceElementHtml,
      selectedElementDrawgleId,
    });

    if (retryResponse.trim()) {
      responseToApply = `${responseToApply}\n\n${retryResponse}`;
      nextCode = normalizeEditedCode(retryResponse);
    }
  }

  let fallbackRegionTarget: RepairTarget | null = null;
  let fallbackRegionAttempted = false;

  if (nextCode === screenCode) {
    fallbackRegionTarget = isBackgroundRegionEditPrompt(prompt)
      ? buildRootRepairTarget(screenCode, blockIndex)
      : findRepairTarget({
          code: screenCode,
          blockIndex,
          prompt,
        });

    if (fallbackRegionTarget) {
      fallbackRegionAttempted = true;
      const replacement = await buildSourceRegionReplacementCode({
        screenName: screen.name,
        screenPrompt,
        userPrompt: prompt,
        currentCode: screenCode,
        repairTarget: fallbackRegionTarget,
        designTokens,
        projectCharter,
        navigationArchitecture,
      });

      if (replacement.trim()) {
        const replacedCode = replaceSourceRegion(screenCode, fallbackRegionTarget, replacement);
        nextCode = normalizeScreenCodeForSave(replacedCode);
        responseToApply = `${responseToApply}\n\n<!-- fallback_region_replace:${fallbackRegionTarget.reason} -->`;
      }
    }
  }

  if (nextCode === screenCode || (!responseToApply.includes("<edit>") && !fallbackRegionAttempted)) {
    const noEditContent = responseToApply.includes("<edit>")
      ? `I could not apply that edit to ${screen.name}. The patch did not match the saved source, and ${fallbackRegionAttempted ? "the region replacement fallback also produced no material change" : "no safe region replacement target was found"}.`
      : responseToApply.trim() || `No material code changes were applied to ${screen.name}.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: noEditContent,
      messageType: "chat",
      metadata: {
        action: "edit_noop",
        editStrategy: "legacy_patch_then_region_replace",
        fallbackRegionAttempted,
        fallbackRegionTarget: fallbackRegionTarget ? {
          reason: fallbackRegionTarget.reason,
          blockId: fallbackRegionTarget.blockId ?? null,
          drawgleId: fallbackRegionTarget.drawgleId ?? null,
          startOffset: fallbackRegionTarget.startOffset,
          endOffset: fallbackRegionTarget.endOffset,
        } : null,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        modelOutputHidden: responseToApply.includes("<edit>"),
        recoveryContext: {
          kind: "failed_edit_recovery",
          instruction: prompt,
          targetType: "screen",
          targetScope: fallbackRegionTarget?.reason === "screen_root_region" ? "screen_region" : "screen",
          targetScreenId: screen.id,
          strategy: "legacy_patch_then_region_replace",
        },
        agentState: buildEditAgentState({
          kind: "failed_edit_recovery",
          instruction: prompt,
          scope: fallbackRegionTarget?.reason === "screen_root_region" ? "screen_region" : "screen",
          screenId: screen.id,
          screenName: screen.name,
          selectedElementDrawgleId: null,
          message: noEditContent,
        }),
        editJob: { status: "completed", targetType: "screen", screenId: screen.id },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, noEditContent);
    return { targetType: "screen" as const, screenId: screen.id, changed: false, message: noEditContent };
  }

  const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });
  const { error: updateError } = await admin
    .from("screens")
    .update({
      code: nextCode,
      block_index: indexScreenCode(nextCode) as never,
      status: screenStatusForHealth(nextHealth),
      error: buildScreenHealthError(nextHealth),
      updated_at: now(),
    })
    .eq("id", screen.id);

  if (updateError) {
    throw updateError;
  }

  const visibleEditContent = nextHealth.healthy
    ? `Applied changes to ${screen.name}.`
    : `Applied changes to ${screen.name}, but source health warnings remain.`;
  const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
    projectId: payload.projectId,
    ownerId: payload.ownerId,
    screenId: screen.id,
    role: "model",
    content: visibleEditContent,
    messageType: nextHealth.healthy ? "edit_applied" : "error",
    metadata: {
      action: nextHealth.healthy ? "edit_applied" : "edit_applied_with_source_health_failure",
      editStrategy: fallbackRegionAttempted ? "legacy_patch_then_region_replace" : "legacy_patch",
      fallbackRegionAttempted,
      fallbackRegionTarget: fallbackRegionTarget ? {
        reason: fallbackRegionTarget.reason,
        blockId: fallbackRegionTarget.blockId ?? null,
        drawgleId: fallbackRegionTarget.drawgleId ?? null,
        startOffset: fallbackRegionTarget.startOffset,
        endOffset: fallbackRegionTarget.endOffset,
      } : null,
      screenName: screen.name,
      userMessageId: payload.userMessageId,
      nextHealth,
      modelOutputHidden: responseToApply.includes("<edit>"),
      agentState: buildEditAgentState({
        kind: "last_actionable_request",
        instruction: prompt,
        scope: fallbackRegionTarget?.reason === "screen_root_region" ? "screen_region" : "screen",
        screenId: screen.id,
        screenName: screen.name,
        selectedElementDrawgleId: null,
        message: visibleEditContent,
      }),
      editJob: { status: "completed", targetType: "screen", screenId: screen.id },
      routerDecision: payload.routerDecision ?? null,
    },
  });

  await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, visibleEditContent);
  return { targetType: "screen" as const, screenId: screen.id, changed: true, message: visibleEditContent };
}
