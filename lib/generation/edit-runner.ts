import "server-only";

import { createHash } from "node:crypto";

import { detectTargetBlocks, indexScreenCode, isScreenBlockIndexUsable } from "@/lib/generation/block-index";
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
import {
  countDrawgleIdOccurrencesInHtml,
  replaceSelectedDrawgleElement,
  type SelectedElementDomMergeDiagnostics,
} from "@/lib/drawgle-dom-server";
import {
  buildScreenHealthError,
  detectScreenHealth,
  isBlockingScreenHealthFailure,
  screenStatusForHealth,
  stripGenerationCompleteSentinel,
  validateSourceCompletion,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";
import { findRepairTarget, replaceSourceRegion, type RepairTarget } from "@/lib/generation/screen-repair";
import { sanitizeScreenCodeForSharedNavigation, validateNavigationShell } from "@/lib/project-navigation";
import { deriveRequiresBottomNav } from "@/lib/navigation";
import type { AgentStepMetadata } from "@/lib/agent/message-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProjectMessages, insertProjectMessage } from "@/lib/supabase/queries";
import { tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { createGeminiClient } from "@/lib/ai/gemini";
import type {
  DesignTokens,
  LlmLogFn,
  NavigationArchitecture,
  NavigationPlan,
  ProjectCharter,
  ScreenBlockIndex,
  ScreenChromePolicy,
  ScreenPlan,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type ProjectMessageInput = Parameters<typeof insertProjectMessage>[1];
type EditTargetScope = "selected_element" | "screen_region" | "whole_screen" | "screen" | "navigation";
type EditOperation = "none" | "append_content" | "replace_region" | "restyle_region" | "rewrite_screen" | "repair_screen";
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
  editOperation?: EditOperation | string | null;
  editStrategy?: EditStrategy | string | null;
  conversationContext?: Array<{ role: "user" | "model" | "system"; content: string; screenId?: string | null; screenName?: string | null; event?: string | null }> | null;
  recoveryContext?: Record<string, unknown> | null;
  routerDecision?: Record<string, unknown> | null;
};

async function generateDesignSummaryLLM(prompt: string, targetName: string) {
  try {
    const ai = createGeminiClient();
    const systemInstruction = 
      "You are an elite visual UI designer and creative art director. The user gave a design/edit request on a specific target screen.\n" +
      "Write:\n" +
      "1. A highly premium completed title matching the intent (e.g. 'Redesigned GoalsList card layout', 'Infused colorful icon highlights across navigation'). Do not use generic 'Applied changes' boilerplates.\n" +
      "2. A short, elegant, single-sentence design summary detailing your visual decisions.\n" +
      "3. An extremely short visual style diff summarizing the visual changes (use + for additions, - for deletions).\n\n" +
      "Return strictly a JSON object matching this schema:\n" +
      "{\n" +
      "  \"title\": \"Premium dynamic completed title\",\n" +
      "  \"summary\": \"One-sentence visual design log\",\n" +
      "  \"styleDiff\": \"e.g., '+ backdrop-blur-md glassmorphism\\n- Solid grey backgrounds'\"\n" +
      "}\n" +
      "Keep output extremely short and direct to save tokens. Total JSON output must be under 35 words.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User Prompt: "${prompt}"\nTarget Screen Element: "${targetName}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : `Applied changes to ${targetName}`,
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : `Successfully completed visual modifications on ${targetName}.`,
      styleDiff: typeof parsed.styleDiff === "string" && parsed.styleDiff.trim() ? parsed.styleDiff.trim() : null,
    };
  } catch (error) {
    console.error("Failed to generate design summary via LLM:", error);
    return {
      title: `Applied changes to ${targetName}`,
      summary: `Successfully completed visual modifications on ${targetName}.`,
      styleDiff: null,
    };
  }
}

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

const isKnownEditOperation = (value: unknown): value is EditOperation =>
  value === "none" ||
  value === "append_content" ||
  value === "replace_region" ||
  value === "restyle_region" ||
  value === "rewrite_screen" ||
  value === "repair_screen";

const isRootReplacementAllowed = ({
  requestedEditStrategy,
  payloadTargetScope,
  editOperation,
  prompt,
}: {
  requestedEditStrategy: EditStrategy | null;
  payloadTargetScope: string | null;
  editOperation: EditOperation;
  prompt: string;
}) => {
  if (requestedEditStrategy !== "screen_root_region_replace") {
    return false;
  }

  return (
    payloadTargetScope === "whole_screen" ||
    editOperation === "rewrite_screen" ||
    isBackgroundRegionEditPrompt(prompt)
  );
};

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

const buildAppliedEditMessage = (screenName: string, targetName: string) =>
  targetName === "screen" || targetName === "full screen"
    ? `Applied changes to ${screenName}.`
    : `Updated ${targetName} in ${screenName}.`;

const buildEditingMessage = (screenName: string, targetName: string) =>
  targetName === "screen" || targetName === "full screen"
    ? `Editing ${screenName}...`
    : `Editing ${targetName} in ${screenName}...`;

const buildRepairingMessage = (screenName: string, targetName: string) =>
  targetName === "screen" || targetName === "full screen"
    ? `Repairing ${screenName}...`
    : `Repairing ${targetName} in ${screenName}...`;

const metadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const metadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const SELECTED_EDIT_PREVIEW_LIMIT = 2400;

const previewSelectedEditText = (value: string) => {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > SELECTED_EDIT_PREVIEW_LIMIT
    ? `${collapsed.slice(0, SELECTED_EDIT_PREVIEW_LIMIT)}...`
    : collapsed;
};

const hashSelectedEditText = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const buildSelectedElementFailureDiagnostics = ({
  drawgleId,
  sourceCode,
  replacement,
  rawReplacement,
  error,
}: {
  drawgleId: string;
  sourceCode: string;
  replacement: string;
  rawReplacement: string;
  error: unknown;
}) => ({
  selectedDrawgleId: drawgleId,
  sourceIdCount: countDrawgleIdOccurrencesInHtml(sourceCode, drawgleId),
  replacementIdCount: countDrawgleIdOccurrencesInHtml(replacement, drawgleId),
  finalIdCount: null,
  hadMarkdownFence: /```|`/.test(rawReplacement),
  replacementRootTag: null,
  replacementRootCount: null,
  changed: false,
  rawReplacementPreview: previewSelectedEditText(rawReplacement),
  outputHash: hashSelectedEditText(rawReplacement),
  errorMessage: errorMessage(error, "Selected-element DOM merge failed."),
});

const finalizeSelectedElementDiagnostics = ({
  diagnostics,
  nextCode,
  drawgleId,
  changed,
}: {
  diagnostics: SelectedElementDomMergeDiagnostics | null;
  nextCode: string;
  drawgleId?: string | null;
  changed: boolean;
}) => {
  if (!diagnostics || !drawgleId) {
    return null;
  }

  return {
    ...diagnostics,
    finalIdCount: countDrawgleIdOccurrencesInHtml(nextCode, drawgleId),
    changed,
  };
};

const inferAgentStep = (content: string, metadata: Record<string, unknown>): AgentStepMetadata | null => {
  if (metadata.agentStep && typeof metadata.agentStep === "object" && !Array.isArray(metadata.agentStep)) {
    return metadata.agentStep as AgentStepMetadata;
  }

  const editJob = metadataRecord(metadata.editJob);
  const rawStatus = metadataString(editJob, "status");
  const action = metadataString(metadata, "action");
  const screenName = metadataString(metadata, "screenName");
  const isNavigation = metadataString(editJob, "targetType") === "navigation" || screenName === "Navigation";
  const failed = rawStatus === "failed" || action?.includes("blocked") || action?.includes("failed");
  const completed = rawStatus === "completed" || action?.includes("applied") || action?.includes("noop");
  const queued = rawStatus === "queued" || action?.includes("queued");
  const editing = rawStatus === "editing" || action?.includes("start");

  if (!rawStatus && !action) {
    return null;
  }

  return {
    kind: isNavigation ? "navigation" : "edit",
    status: failed ? "failed" : completed ? "completed" : queued ? "queued" : editing ? "editing" : "editing",
    title: content.replace(/\s+/g, " ").replace(/\.\.\.$/, "").trim() || "Edit UI",
    detail: content,
    targetLabel: screenName,
    processLines: [
      queued ? "Queued the edit request." : null,
      editing ? "Applying the UI edit with the resolved canvas target." : null,
      completed && !failed ? "Saved the updated UI state." : null,
      failed ? "Stopped before saving an unsafe or incomplete result." : null,
    ].filter((line): line is string => Boolean(line)),
  };
};

const completionTextForStep = (content: string, step: AgentStepMetadata) => {
  if (step.status === "failed") {
    return content.startsWith("I ") ? content : `I hit a snag with ${step.targetLabel ?? "that edit"}: ${content}`;
  }

  if (step.status !== "completed") {
    return null;
  }

  if (/^no material/i.test(content)) {
    return content;
  }

  return `Done - ${content.replace(/\.$/, "")}. What do you think?`;
};

async function insertCompletionMessageOnce(
  admin: AdminClient,
  activityKey: string,
  input: ProjectMessageInput,
  actionMessageId: string,
  step: AgentStepMetadata | null,
) {
  if (!step || (step.status !== "completed" && step.status !== "failed")) {
    return;
  }

  const completionContent = completionTextForStep(input.content, step);
  if (!completionContent) {
    return;
  }

  const { data: existing, error: existingError } = await admin
    .from("project_messages")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("owner_id", input.ownerId)
    .contains("metadata", { completionForActivityKey: activityKey })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return;
  }

  await insertProjectMessage(admin, {
    projectId: input.projectId,
    ownerId: input.ownerId,
    screenId: input.screenId ?? null,
    role: "model",
    content: completionContent,
    messageType: step.status === "failed" ? "error" : "chat",
    metadata: {
      ...(input.metadata ?? {}),
      ui: { variant: step.status === "failed" ? "error" : "chat" },
      action: "edit_completion",
      completionForActivityKey: activityKey,
      completionForMessageId: actionMessageId,
    },
  });
}

async function upsertActivityMessage(
  admin: AdminClient,
  activityKey: string,
  input: ProjectMessageInput,
) {
  const metadata: any = {
    ...(input.metadata ?? {}),
    activityKey,
  };
  const agentStep = inferAgentStep(input.content, metadata);
  if (agentStep && metadata.designSummary) {
    const summary = metadata.designSummary as any;
    agentStep.title = summary.title || agentStep.title;
    agentStep.detail = summary.summary || agentStep.detail;
    (agentStep as any).styleDiff = summary.styleDiff || null;
  }
  const metadataWithUi = {
    ...metadata,
    ...(agentStep ? {
      ui: { variant: "action_card" },
      agentStep,
    } : {}),
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

  let resolvedExistingMessage = existingMessage;

  if (!resolvedExistingMessage) {
    const { data: pathMatchedMessage, error: pathMatchError } = await admin
      .from("project_messages")
      .select("id, metadata")
      .eq("project_id", input.projectId)
      .eq("owner_id", input.ownerId)
      .filter("metadata->>activityKey", "eq", activityKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pathMatchError) {
      throw pathMatchError;
    }

    resolvedExistingMessage = pathMatchedMessage;
  }

  if (!resolvedExistingMessage) {
    const inserted = await insertProjectMessage(admin, {
      ...input,
      metadata: metadataWithUi,
    });
    await insertCompletionMessageOnce(admin, activityKey, input, inserted.id, agentStep);
    return inserted;
  }

  const existingMetadata = resolvedExistingMessage.metadata &&
    typeof resolvedExistingMessage.metadata === "object" &&
    !Array.isArray(resolvedExistingMessage.metadata)
    ? resolvedExistingMessage.metadata as Record<string, unknown>
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
        ...metadataWithUi,
      } as never,
    })
    .eq("id", resolvedExistingMessage.id)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await insertCompletionMessageOnce(admin, activityKey, input, data.id, agentStep);

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

async function runEditScreenStream(input: Parameters<typeof editScreenStream>[0], llmLog?: LlmLogFn) {
  let output = "";
  const usageMetadata: Record<string, number> = {};
  for await (const chunk of editScreenStream({
    ...input,
    llmLog,
    onResponseChunk: (c) => {
      if (!c || typeof c !== "object") return;
      const rawUsage = (c as { usageMetadata?: unknown }).usageMetadata;
      if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) return;
      for (const [key, value] of Object.entries(rawUsage)) {
        if (typeof value === "number" && Number.isFinite(value)) usageMetadata[key] = value;
      }
    },
  })) {
    output += chunk;
  }
  if (llmLog && Object.keys(usageMetadata).length > 0) {
    llmLog(`[TOKEN USAGE] edit-stream`, usageMetadata);
  }
  return output;
}

export async function executeModifyScreenTask(payload: ModifyScreenPayload, llmLog?: LlmLogFn) {
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
  const editOperation = isKnownEditOperation(payload.editOperation) ? payload.editOperation : "none";
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
  let requestedNavigationEdit =
    payload.requestTargetsNavigation ||
    selectedElementTarget === "navigation" ||
    isNavigationElementHtml(selectedElementHtml);

  if (requestedNavigationEdit) {
    const { data: navData, error: navError } = await admin
      .from("project_navigation")
      .select("id, shell_code")
      .eq("project_id", payload.projectId)
      .maybeSingle();

    if (navError || !navData?.shell_code) {
      if (payload.screenId) {
        requestedNavigationEdit = false;
      }
    }
  }

  const selectedNavigationElement = requestedNavigationEdit && (selectedElementTarget === "navigation" || isNavigationElementHtml(selectedElementHtml));

  if (requestedNavigationEdit) {
    const { data: projectNavigation, error: navigationError } = await admin
      .from("project_navigation")
      .select("id, shell_code, block_index, plan")
      .eq("project_id", payload.projectId)
      .maybeSingle();

    if (navigationError || !projectNavigation?.shell_code) {
      throw new Error(navigationError?.message ?? "Shared project navigation was not found for this project.");
    }

    const navigationCode = ensureDrawgleIds(projectNavigation.shell_code, "dg-nav").code;
    const navigationPlan = projectNavigation.plan as unknown as NavigationPlan;

    if (selectedNavigationElement && selectedElementDrawgleId) {
      const selectedNavigationTarget = findRepairTarget({
        code: navigationCode,
        drawgleId: selectedElementDrawgleId,
        allowFallback: false,
      });

      if (!selectedNavigationTarget) {
        const failureContent = "I could not locate that selected navigation item in the saved source. Please reselect it and try again.";
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: null,
          role: "model",
          content: failureContent,
          messageType: "error",
          metadata: {
            action: "selected_navigation_target_not_found",
            target: "project_navigation",
            screenName: "Navigation",
            userMessageId: payload.userMessageId,
            editStrategy: "selected_element_region_replace",
            editJob: { status: "failed", targetType: "navigation", drawgleId: selectedElementDrawgleId },
            routerDecision: payload.routerDecision ?? null,
          },
        });

        await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
        return { targetType: "navigation" as const, changed: false, message: failureContent };
      }

      await upsertActivityMessage(admin, editActivityKey, {
        projectId: payload.projectId,
        ownerId: payload.ownerId,
        screenId: null,
        role: "system",
        content: "Editing selected navigation element...",
        messageType: "chat",
        metadata: {
          action: "selected_navigation_region_replace_start",
          target: "project_navigation",
          screenName: "Navigation",
          userMessageId: payload.userMessageId,
          editStrategy: "selected_element_region_replace",
          repairTarget: {
            reason: selectedNavigationTarget.reason,
            blockId: selectedNavigationTarget.blockId ?? null,
            drawgleId: selectedNavigationTarget.drawgleId ?? selectedElementDrawgleId,
            startOffset: selectedNavigationTarget.startOffset,
            endOffset: selectedNavigationTarget.endOffset,
          },
          editJob: { status: "editing", targetType: "navigation", drawgleId: selectedElementDrawgleId },
          routerDecision: payload.routerDecision ?? null,
        },
      });

      let rawReplacement = "";
      const replacement = await buildSourceRegionReplacementCode({
        screenName: "Navigation",
        screenPrompt: `Shared navigation shell plan:\n${JSON.stringify(navigationPlan ?? null, null, 2)}`,
        userPrompt: prompt,
        currentCode: navigationCode,
        repairTarget: selectedNavigationTarget,
        editOperation,
        requiredRootDrawgleId: selectedElementDrawgleId,
        designTokens,
        projectCharter,
        navigationArchitecture,
        llmLog,
        onRawResponse: (rawText) => {
          rawReplacement = rawText;
        },
      });

      let selectedMerge: ReturnType<typeof replaceSelectedDrawgleElement>;
      try {
        selectedMerge = replaceSelectedDrawgleElement({
          sourceCode: navigationCode,
          replacementHtml: replacement,
          rawReplacementHtml: rawReplacement || replacement,
          drawgleId: selectedElementDrawgleId,
        });
      } catch (error) {
        const failureReason = errorMessage(error, "The replacement did not pass Drawgle id checks.");
        const failureContent = `I could not safely apply that selected navigation edit. ${failureReason}`;
        const selectedElementDiagnostics = buildSelectedElementFailureDiagnostics({
          drawgleId: selectedElementDrawgleId,
          sourceCode: navigationCode,
          replacement,
          rawReplacement: rawReplacement || replacement,
          error,
        });
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: null,
          role: "model",
          content: failureContent,
          messageType: "error",
          metadata: {
            action: "selected_navigation_region_replace_failed_integrity",
            target: "project_navigation",
            screenName: "Navigation",
            userMessageId: payload.userMessageId,
            editStrategy: "selected_element_region_replace",
            selectedElementDiagnostics,
            editJob: { status: "failed", targetType: "navigation", drawgleId: selectedElementDrawgleId },
            routerDecision: payload.routerDecision ?? null,
          },
        });

        await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
        return { targetType: "navigation" as const, changed: false, message: failureContent };
      }
      const nextCode = selectedMerge.diagnostics.changed
        ? ensureDrawgleIds(tokenizeStaticDrawgleHtml(selectedMerge.code, designTokens).code).code
        : navigationCode;
      const editChanged = selectedMerge.diagnostics.changed && nextCode !== navigationCode;
      const selectedElementDiagnostics = finalizeSelectedElementDiagnostics({
        diagnostics: selectedMerge.diagnostics,
        nextCode,
        drawgleId: selectedElementDrawgleId,
        changed: editChanged,
      });

      if (editChanged && !validateNavigationShell(nextCode, navigationPlan)) {
        const failureContent = "I could not safely apply that selected navigation edit because the generated replacement would break the shared navigation shell.";
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: null,
          role: "model",
          content: failureContent,
          messageType: "error",
          metadata: {
            action: "selected_navigation_region_replace_blocked_by_validation",
            target: "project_navigation",
            screenName: "Navigation",
            userMessageId: payload.userMessageId,
            editStrategy: "selected_element_region_replace",
            selectedElementDiagnostics,
            editJob: { status: "failed", targetType: "navigation", drawgleId: selectedElementDrawgleId },
            routerDecision: payload.routerDecision ?? null,
          },
        });

        await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
        return { targetType: "navigation" as const, changed: false, message: failureContent };
      }

      if (editChanged) {
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

      let designSummary: any = null;
      if (editChanged) {
        designSummary = await generateDesignSummaryLLM(prompt, "Selected Navigation Element");
      }

      const fullResponse = !editChanged
        ? "No material code changes were applied to the selected navigation element."
        : "Updated selected navigation element.";
      const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
        projectId: payload.projectId,
        ownerId: payload.ownerId,
        screenId: null,
        role: "model",
        content: fullResponse,
        messageType: !editChanged ? "error" : "edit_applied",
        metadata: {
          action: !editChanged
            ? "selected_navigation_region_replace_noop"
            : "selected_navigation_region_replace_applied",
          target: "project_navigation",
          screenName: "Navigation",
          userMessageId: payload.userMessageId,
          editStrategy: "selected_element_region_replace",
          selectedElementDiagnostics,
          editJob: { status: "completed", targetType: "navigation", drawgleId: selectedElementDrawgleId },
          routerDecision: payload.routerDecision ?? null,
          designSummary,
        },
      });

      await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
      return { targetType: "navigation" as const, changed: editChanged, message: fullResponse };
    }

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
      llmLog,
    });
    const nextCode = ensureDrawgleIds(tokenizeStaticDrawgleHtml(editedNavigationCode, designTokens).code, "dg-nav").code;

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

    const isChanged = nextCode !== navigationCode;
    let designSummary: any = null;
    if (isChanged) {
      designSummary = await generateDesignSummaryLLM(prompt, "Navigation");
    }

    const fullResponse = !isChanged
      ? "No material code changes were applied to Navigation."
      : "Updated shared project navigation.";
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: null,
      role: "model",
      content: fullResponse,
      messageType: !isChanged ? "chat" : "edit_applied",
      metadata: {
        action: !isChanged ? "edit_noop" : "edit_applied",
        target: "project_navigation",
        screenName: "Navigation",
        userMessageId: payload.userMessageId,
        editJob: { status: "completed", targetType: "navigation" },
        routerDecision: payload.routerDecision ?? null,
        designSummary,
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

  // Resolve chromePolicy and navigationItemId dynamically
  const resolvedRequiresBottomNav = deriveRequiresBottomNav(navigationArchitecture);
  const resolvedScreenChrome = projectNavigationPlan?.screenChrome?.find(
    (entry) => entry.screenName.toLowerCase() === (screen.name || "").toLowerCase()
  );
  const resolvedNavigationItemId = screen.navigation_item_id ?? resolvedScreenChrome?.navigationItemId ?? null;
  const resolvedIsRoot = resolvedScreenChrome?.chrome === "bottom-tabs" ||
                         (screen.chrome_policy as ScreenPlan["chromePolicy"])?.chrome === "bottom-tabs" ||
                         Boolean(resolvedNavigationItemId) ||
                         (projectNavigationPlan?.items?.some(item => item.linkedScreenName.toLowerCase() === (screen.name || "").toLowerCase()) ?? false);

  const resolvedChromePolicy = (screen.chrome_policy as ScreenPlan["chromePolicy"]) || {
    chrome: resolvedScreenChrome?.chrome ?? (resolvedIsRoot ? (projectNavigationPlan?.enabled ? "bottom-tabs" : "top-bar") : "top-bar-back"),
    showPrimaryNavigation: Boolean(resolvedScreenChrome?.navigationItemId),
    showsBackButton: !resolvedIsRoot && resolvedScreenChrome?.chrome !== "modal-sheet",
  };

  const screenPlanForSave: ScreenPlan = {
    name: screen.name,
    type: resolvedIsRoot ? "root" : "detail",
    description: screen.prompt || "",
    chromePolicy: resolvedChromePolicy,
    navigationItemId: resolvedNavigationItemId,
  };
  const screenCode = ensureDrawgleIds(typeof screen.code === "string" && screen.code.length > 0 ? screen.code : "").code;
  const candidateBlockIndex = screen.block_index as ScreenBlockIndex | null;
  const blockIndex = isScreenBlockIndexUsable(screenCode, candidateBlockIndex)
    ? candidateBlockIndex!
    : indexScreenCode(screenCode);
  const blockIndexUsable = isScreenBlockIndexUsable(screenCode, blockIndex);
  const selectedSourceRegion = selectedElementDrawgleId
    ? findRepairTarget({
        code: screenCode,
        drawgleId: selectedElementDrawgleId,
        blockIndex,
      })
    : null;
  const safeRequestedEditStrategy =
    isRootReplacementAllowed({ requestedEditStrategy, payloadTargetScope, editOperation, prompt })
      ? requestedEditStrategy
      : requestedEditStrategy === "screen_root_region_replace"
        ? null
        : requestedEditStrategy;
  const resolvedEditStrategy: EditStrategy = safeRequestedEditStrategy ??
    (selectedSourceRegion
      ? "selected_element_region_replace"
      : payloadTargetScope === "whole_screen" || editOperation === "rewrite_screen" || isBackgroundRegionEditPrompt(prompt)
        ? "screen_root_region_replace"
        : payloadTargetScope === "screen_region" || editOperation === "append_content" || editOperation === "replace_region" || editOperation === "restyle_region"
          ? "block_region_replace"
          : "legacy_patch_then_region_replace");
  const rootSourceRegion = resolvedEditStrategy === "screen_root_region_replace" && blockIndexUsable
    ? buildRootRepairTarget(screenCode, blockIndex)
    : null;
  const blockSourceRegion = resolvedEditStrategy === "block_region_replace"
    ? findRepairTarget({
        code: screenCode,
        blockIndex,
        prompt,
        preferContainer: editOperation === "append_content",
        allowFallback: false,
      })
    : null;
  const regionReplacementTarget = selectedSourceRegion ?? rootSourceRegion ?? blockSourceRegion;
  const selectedSourceElementHtml = regionReplacementTarget?.snippet || selectedElementHtml;
  const resolution = selectedSourceElementHtml
    ? { scope: "scoped" as const, targetBlockIds: [] }
    : detectTargetBlocks(prompt, blockIndex);
  const targetBlockIds = resolution.scope === "scoped" && !selectedSourceElementHtml ? resolution.targetBlockIds : [];
  const chatHistory = selectedSourceElementHtml
    ? [{ role: "user" as const, content: prompt }]
    : await assembleChatContext({
        admin,
        projectId: payload.projectId,
        userPrompt: prompt,
        recentMessages: await fetchProjectMessages(admin, payload.projectId),
      });
  const targetNames = selectedSourceElementHtml
    ? regionReplacementTarget?.reason === "screen_root_region"
      ? "screen"
      : "selected element"
    : targetBlockIds.length > 0
      ? targetBlockIds.map((id) => blockIndex.blocks.find((block) => block.id === id)?.name ?? id).join(", ")
      : "full screen";
  const screenPrompt = typeof screen.prompt === "string" ? screen.prompt : "";
  const normalizeScreenCodeForSave = (code: string) =>
    ensureDrawgleIds(tokenizeStaticDrawgleHtml(sanitizeScreenCodeForSharedNavigation(stripGenerationCompleteSentinel(code), screenPlanForSave), designTokens).code).code;
  const health = detectScreenHealth({ code: screenCode, screenPrompt });
  const selectedRegionStaticHealth = regionReplacementTarget
    ? validateStaticDrawgleHtml({ code: regionReplacementTarget.snippet })
    : null;
  const explicitRepairRequested = editOperation === "repair_screen" || isScreenRepairPrompt(prompt);
  const explicitRewriteRequested =
    editOperation === "rewrite_screen" ||
    (payloadTargetScope === "whole_screen" && isScreenLevelEditPrompt(originalPrompt));

  if (isBlockingScreenHealthFailure(health) && !explicitRepairRequested && !explicitRewriteRequested) {
    const failureContent = `I cannot safely edit ${screen.name} because its saved source is broken. Please repair the screen first, then reselect the exact section.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: failureContent,
      messageType: "error",
      metadata: {
        action: "edit_blocked_by_existing_source_health",
        editStrategy: resolvedEditStrategy,
        editOperation,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        selectedRegionStaticHealth,
        repairTarget: regionReplacementTarget
          ? {
              reason: regionReplacementTarget.reason,
              blockId: regionReplacementTarget.blockId ?? null,
              drawgleId: regionReplacementTarget.drawgleId ?? selectedElementDrawgleId ?? null,
              startOffset: regionReplacementTarget.startOffset,
              endOffset: regionReplacementTarget.endOffset,
            }
          : null,
        recoveryContext: {
          kind: "failed_edit_recovery",
          instruction: prompt,
          targetType: "screen",
          targetScope: selectedSourceRegion ? "selected_element" : payloadTargetScope ?? "screen_region",
          targetScreenId: screen.id,
          selectedElementDrawgleId,
          strategy: resolvedEditStrategy,
          requiredAction: "repair_source",
        },
        agentState: buildEditAgentState({
          kind: "failed_edit_recovery",
          instruction: prompt,
          scope: selectedSourceRegion ? "selected_element" : "screen_region",
          screenId: screen.id,
          screenName: screen.name,
          selectedElementDrawgleId,
          message: failureContent,
        }),
        editJob: { status: "failed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
    return { targetType: "screen" as const, screenId: screen.id, changed: false, message: failureContent };
  }

  const directRegionReplacementAllowed = Boolean(regionReplacementTarget) &&
    (selectedSourceRegion !== null || !isBlockingScreenHealthFailure(health));

  if (resolvedEditStrategy === "block_region_replace" && !blockSourceRegion && !isBlockingScreenHealthFailure(health)) {
    const noTargetContent = `I could not find a safe section in ${screen.name} for that edit. Please select the exact list, card group, or section and try again.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: noTargetContent,
      messageType: "chat",
      metadata: {
        action: "edit_target_not_found",
        editStrategy: resolvedEditStrategy,
        editOperation,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        recoveryContext: {
          kind: "failed_edit_recovery",
          instruction: prompt,
          targetType: "screen",
          targetScope: "screen_region",
          targetScreenId: screen.id,
          strategy: resolvedEditStrategy,
        },
        agentState: buildEditAgentState({
          kind: "failed_edit_recovery",
          instruction: prompt,
          scope: "screen_region",
          screenId: screen.id,
          screenName: screen.name,
          selectedElementDrawgleId,
          message: noTargetContent,
        }),
        editJob: { status: "completed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, noTargetContent);
    return { targetType: "screen" as const, screenId: screen.id, changed: false, message: noTargetContent };
  }

  if (directRegionReplacementAllowed && regionReplacementTarget) {
    await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "system",
      content: buildEditingMessage(screen.name, targetNames),
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

    let rawReplacement = "";
    const replacement = await buildSourceRegionReplacementCode({
      screenName: screen.name,
      screenPrompt,
      userPrompt: prompt,
      currentCode: screenCode,
      repairTarget: regionReplacementTarget,
      editOperation,
      requiredRootDrawgleId: resolvedEditStrategy === "selected_element_region_replace" ? selectedElementDrawgleId : null,
      designTokens,
      projectCharter,
      navigationArchitecture,
      screenPlan: screenPlanForSave,
      navigationPlan: projectNavigationPlan,
      requiresBottomNav: resolvedRequiresBottomNav,
      llmLog,
      onRawResponse: (rawText) => {
        rawReplacement = rawText;
      },
    });

    if (!replacement.trim()) {
      throw new Error("Selected-region edit returned an empty replacement.");
    }

    if (regionReplacementTarget.reason === "screen_root_region") {
      const replacementCompletion = validateSourceCompletion({
        code: replacement,
        requireSentinel: true,
      });
      if (!replacementCompletion.valid) {
        const failureContent = `I could not safely apply that full-screen edit to ${screen.name}; the generated screen source was incomplete, so the saved screen was left unchanged.`;
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: screen.id,
          role: "model",
          content: failureContent,
          messageType: "error",
          metadata: {
            action: "source_region_replace_blocked_by_completion",
            editStrategy: resolvedEditStrategy,
            editOperation,
            screenName: screen.name,
            userMessageId: payload.userMessageId,
            sourceCompletion: replacementCompletion,
            health,
            selectedRegionStaticHealth,
            editJob: { status: "failed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
            routerDecision: payload.routerDecision ?? null,
          },
        });

        await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
        return { targetType: "screen" as const, screenId: screen.id, changed: false, message: failureContent };
      }
    }

    let selectedElementDiagnostics: SelectedElementDomMergeDiagnostics | null = null;
    let selectedElementTargetChanged: boolean | null = null;
    let replacedCode: string;
    if (resolvedEditStrategy === "selected_element_region_replace" && selectedElementDrawgleId) {
      try {
        const selectedMerge = replaceSelectedDrawgleElement({
          sourceCode: screenCode,
          replacementHtml: replacement,
          rawReplacementHtml: rawReplacement || replacement,
          drawgleId: selectedElementDrawgleId,
        });
        selectedElementDiagnostics = selectedMerge.diagnostics;
        selectedElementTargetChanged = selectedMerge.diagnostics.changed;
        replacedCode = selectedMerge.diagnostics.changed ? selectedMerge.code : screenCode;
      } catch (error) {
        const failureReason = errorMessage(error, "The replacement did not pass Drawgle id checks.");
        const failureContent = `I could not safely apply that selected edit to ${screen.name}. ${failureReason}`;
        const failedDiagnostics = buildSelectedElementFailureDiagnostics({
          drawgleId: selectedElementDrawgleId,
          sourceCode: screenCode,
          replacement,
          rawReplacement: rawReplacement || replacement,
          error,
        });
        const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
          projectId: payload.projectId,
          ownerId: payload.ownerId,
          screenId: screen.id,
          role: "model",
          content: failureContent,
          messageType: "error",
          metadata: {
            action: "selected_element_region_replace_failed_integrity",
            editStrategy: resolvedEditStrategy,
            editOperation,
            screenName: screen.name,
            userMessageId: payload.userMessageId,
            health,
            selectedElementDiagnostics: failedDiagnostics,
            selectedRegionStaticHealth,
            repairTarget: {
              reason: regionReplacementTarget.reason,
              blockId: regionReplacementTarget.blockId ?? null,
              drawgleId: regionReplacementTarget.drawgleId ?? selectedElementDrawgleId,
              startOffset: regionReplacementTarget.startOffset,
              endOffset: regionReplacementTarget.endOffset,
            },
            recoveryContext: {
              kind: "failed_edit_recovery",
              instruction: prompt,
              targetType: "screen",
              targetScope: "selected_element",
              targetScreenId: screen.id,
              selectedElementDrawgleId,
              strategy: resolvedEditStrategy,
            },
            agentState: buildEditAgentState({
              kind: "failed_edit_recovery",
              instruction: prompt,
              scope: "selected_element",
              screenId: screen.id,
              screenName: screen.name,
              selectedElementDrawgleId,
              message: failureContent,
            }),
            editJob: { status: "failed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
            routerDecision: payload.routerDecision ?? null,
          },
        });

        await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
        return { targetType: "screen" as const, screenId: screen.id, changed: false, message: failureContent };
      }
    } else {
      replacedCode = replaceSourceRegion(screenCode, regionReplacementTarget, replacement);
    }
    const nextCode = normalizeScreenCodeForSave(replacedCode);
    const editChanged = (selectedElementTargetChanged ?? true) && nextCode !== screenCode;
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });
    selectedElementDiagnostics = finalizeSelectedElementDiagnostics({
      diagnostics: selectedElementDiagnostics,
      nextCode,
      drawgleId: selectedElementDrawgleId,
      changed: editChanged,
    });

    if (editChanged && isBlockingScreenHealthFailure(nextHealth)) {
      const failureContent = `I could not safely apply that edit to ${screen.name}; the generated replacement would break the saved screen source. Please select a smaller exact section or ask me to repair the screen first.`;
      const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
        projectId: payload.projectId,
        ownerId: payload.ownerId,
        screenId: screen.id,
        role: "model",
        content: failureContent,
        messageType: "error",
        metadata: {
          action: "source_region_replace_blocked_by_health",
          editStrategy: resolvedEditStrategy,
          editOperation,
          screenName: screen.name,
          userMessageId: payload.userMessageId,
          health,
          nextHealth,
          selectedElementDiagnostics,
          selectedRegionStaticHealth,
          repairTarget: {
            reason: regionReplacementTarget.reason,
            blockId: regionReplacementTarget.blockId ?? null,
            drawgleId: regionReplacementTarget.drawgleId ?? selectedElementDrawgleId ?? null,
            startOffset: regionReplacementTarget.startOffset,
            endOffset: regionReplacementTarget.endOffset,
          },
          recoveryContext: {
            kind: "failed_edit_recovery",
            instruction: prompt,
            targetType: "screen",
            targetScope: resolvedEditStrategy === "selected_element_region_replace" ? "selected_element" : "screen_region",
            targetScreenId: screen.id,
            selectedElementDrawgleId,
            strategy: resolvedEditStrategy,
          },
          agentState: buildEditAgentState({
            kind: "failed_edit_recovery",
            instruction: prompt,
            scope: resolvedEditStrategy === "selected_element_region_replace" ? "selected_element" : "screen_region",
            screenId: screen.id,
            screenName: screen.name,
            selectedElementDrawgleId,
            message: failureContent,
          }),
          editJob: { status: "completed", targetType: "screen", screenId: screen.id, drawgleId: selectedElementDrawgleId },
          routerDecision: payload.routerDecision ?? null,
        },
      });

      await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, failureContent);
      return { targetType: "screen" as const, screenId: screen.id, changed: false, message: failureContent };
    }

    if (editChanged) {
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

    let designSummary: any = null;
    if (editChanged) {
      designSummary = await generateDesignSummaryLLM(prompt, targetNames === "full screen" ? screen.name : `${targetNames} in ${screen.name}`);
    }

    const fullResponse = !editChanged
      ? `No material code changes were applied to ${screen.name}.`
      : buildAppliedEditMessage(screen.name, targetNames);
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: !editChanged ? "error" : "edit_applied",
      metadata: {
        action: !editChanged
          ? "source_region_replace_noop"
          : isBlockingScreenHealthFailure(nextHealth)
            ? "source_region_replace_partial"
            : "source_region_replace_applied",
        editStrategy: resolvedEditStrategy,
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        nextHealth,
        selectedElementDiagnostics,
        selectedRegionStaticHealth,
        designSummary,
        recoveryContext: !editChanged ? {
          kind: "failed_edit_recovery",
          instruction: prompt,
          targetType: "screen",
          targetScope: resolvedEditStrategy === "selected_element_region_replace" ? "selected_element" : "screen_region",
          targetScreenId: screen.id,
          selectedElementDrawgleId,
          strategy: resolvedEditStrategy,
        } : null,
        agentState: buildEditAgentState({
          kind: !editChanged ? "failed_edit_recovery" : "last_actionable_request",
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
    return { targetType: "screen" as const, screenId: screen.id, changed: editChanged, message: fullResponse };
  }

  if (isBlockingScreenHealthFailure(health) && explicitRewriteRequested) {
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
      llmLog,
    });

    if (!reconstructed.trim()) {
      throw new Error("Full-screen reconstruction returned empty code.");
    }

    const reconstructionCompletion = validateSourceCompletion({
      code: reconstructed,
      requireSentinel: true,
    });
    if (!reconstructionCompletion.valid) {
      const fullResponse = `I could not safely reconstruct ${screen.name}; the model returned incomplete screen source, so the saved screen was left unchanged.`;
      const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
        projectId: payload.projectId,
        ownerId: payload.ownerId,
        screenId: screen.id,
        role: "model",
        content: fullResponse,
        messageType: "error",
        metadata: {
          action: "full_screen_reconstruction_blocked_by_completion",
          screenName: screen.name,
          userMessageId: payload.userMessageId,
          health,
          sourceCompletion: reconstructionCompletion,
          editJob: { status: "failed", targetType: "screen", screenId: screen.id },
          routerDecision: payload.routerDecision ?? null,
        },
      });

      await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
      return { targetType: "screen" as const, screenId: screen.id, changed: false, message: fullResponse };
    }

    const nextCode = normalizeScreenCodeForSave(reconstructed);
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });

    if (!isBlockingScreenHealthFailure(nextHealth)) {
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

    const fullResponse = !isBlockingScreenHealthFailure(nextHealth)
      ? `Reconstructed ${screen.name} from invalid source.`
      : `I could not safely reconstruct ${screen.name}; the replacement still failed source checks, so the saved screen was left unchanged.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: !isBlockingScreenHealthFailure(nextHealth) ? "edit_applied" : "error",
      metadata: {
        action: !isBlockingScreenHealthFailure(nextHealth) ? "full_screen_reconstruction_applied" : "full_screen_reconstruction_blocked_by_health",
        screenName: screen.name,
        userMessageId: payload.userMessageId,
        health,
        nextHealth,
        editJob: { status: "completed", targetType: "screen", screenId: screen.id },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, fullResponse);
    return { targetType: "screen" as const, screenId: screen.id, changed: !isBlockingScreenHealthFailure(nextHealth), message: fullResponse };
  }

  const shouldRepairScreen = explicitRepairRequested;

  if (shouldRepairScreen) {
    const repairTarget = findRepairTarget({
      code: screenCode,
      drawgleId: selectedElementDrawgleId,
      blockIndex,
      prompt: `${prompt}\n${health.missingAnchors.join(" ")}`,
      preferContainer: editOperation === "append_content",
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
      content: buildRepairingMessage(screen.name, targetNames),
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
      llmLog,
    });

    if (!replacement.trim()) {
      throw new Error("Repair model returned an empty replacement section.");
    }

    const repairedCode = replaceSourceRegion(screenCode, repairTarget, replacement);
    const nextCode = normalizeScreenCodeForSave(repairedCode);
    const nextHealth = detectScreenHealth({ code: nextCode, screenPrompt });

    const repairCanBeSaved = nextCode !== screenCode && !isBlockingScreenHealthFailure(nextHealth);

    if (repairCanBeSaved) {
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
      : isBlockingScreenHealthFailure(nextHealth)
        ? `I could not safely repair ${screen.name}; the repair output still failed source checks, so the saved screen was left unchanged.`
      : targetNames === "screen" || targetNames === "full screen"
        ? `Repaired ${screen.name}.`
        : `Repaired ${targetNames} in ${screen.name}.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: fullResponse,
      messageType: repairCanBeSaved ? "edit_applied" : "error",
      metadata: {
        action: nextCode === screenCode
          ? "screen_repair_failed"
          : isBlockingScreenHealthFailure(nextHealth)
            ? "screen_repair_blocked_by_health"
            : "screen_repair_applied",
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
    return { targetType: "screen" as const, screenId: screen.id, changed: repairCanBeSaved, message: fullResponse };
  }

  await upsertActivityMessage(admin, editActivityKey, {
    projectId: payload.projectId,
    ownerId: payload.ownerId,
    screenId: screen.id,
    role: "system",
    content: buildEditingMessage(screen.name, targetNames),
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
    screenPlan: screenPlanForSave,
    navigationPlan: projectNavigationPlan,
    requiresBottomNav: resolvedRequiresBottomNav,
  }, llmLog);
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
      screenPlan: screenPlanForSave,
      navigationPlan: projectNavigationPlan,
      requiresBottomNav: resolvedRequiresBottomNav,
    }, llmLog);

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
        editOperation,
        designTokens,
        projectCharter,
        navigationArchitecture,
        screenPlan: screenPlanForSave,
        navigationPlan: projectNavigationPlan,
        requiresBottomNav: resolvedRequiresBottomNav,
        llmLog,
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
  if (isBlockingScreenHealthFailure(nextHealth)) {
    const blockedContent = `I could not safely apply that edit to ${screen.name}; the edited HTML failed source checks, so the saved screen was left unchanged.`;
    const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
      projectId: payload.projectId,
      ownerId: payload.ownerId,
      screenId: screen.id,
      role: "model",
      content: blockedContent,
      messageType: "error",
      metadata: {
        action: "edit_blocked_by_health",
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
          message: blockedContent,
        }),
        editJob: { status: "completed", targetType: "screen", screenId: screen.id },
        routerDecision: payload.routerDecision ?? null,
      },
    });

    await persistEditMemoryPair(admin, payload.userMessageId, prompt, modelMessage.id, blockedContent);
    return { targetType: "screen" as const, screenId: screen.id, changed: false, message: blockedContent };
  }

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

  const visibleEditContent = `Applied changes to ${screen.name}.`;
  const modelMessage = await upsertActivityMessage(admin, editActivityKey, {
    projectId: payload.projectId,
    ownerId: payload.ownerId,
    screenId: screen.id,
    role: "model",
    content: visibleEditContent,
    messageType: "edit_applied",
    metadata: {
      action: "edit_applied",
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
