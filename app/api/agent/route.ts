import { Buffer } from "node:buffer";

import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  routeAgentPrompt,
  type AgentEditOperation,
  type AgentRouterDecision,
  type AgentScope,
  type AgentTargetType,
  type AgentTurnState,
} from "@/lib/agent/router";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { applyDeterministicEdits, ensureDrawgleIds, type DeterministicEditOperation, type DrawgleImageTargetMeta } from "@/lib/drawgle-dom";
import { indexScreenCode } from "@/lib/generation/block-index";
import { persistProjectMessageMemory, persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { findRepairTarget } from "@/lib/generation/screen-repair";
import { assembleProjectContext } from "@/lib/generation/context";
import { loadCuratedStyleReferenceImage, matchCuratedStyleReference } from "@/lib/generation/curated-style-references";
import { planUiFlow } from "@/lib/generation/service";
import { readScreenPlanProposal, type AgentStepMetadata } from "@/lib/agent/message-metadata";
import { approveScreenPlanProposal, ScreenPlanApprovalError } from "@/lib/agent/screen-plan-approval";
import { classifyHistoryNeed, HISTORY_LIMITS } from "@/lib/agent/history-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchProjectMessages, insertProjectMessage, updateProjectMessage } from "@/lib/supabase/queries";
import { getDrawgleTokenReferences, tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import { storeUserImageAssetFromRemoteUrl } from "@/lib/user-image-assets";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type NavigationPlan,
  type ProjectCharter,
  type ProjectMessage,
  type PromptImagePayload,
  type ReferenceMode,
  type ScreenPlan,
} from "@/lib/types";
import type { generateUiFlowTask } from "@/trigger/generate-ui-flow";
import type { modifyScreenTask } from "@/trigger/modify-screen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().trim().max(10000),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .nullable()
    .optional(),
  imageReferenceMode: z.enum(["recreate", "style"]).optional().default("recreate"),
  selectedScreenId: z.string().uuid().nullable().optional(),
  focusedScreenId: z.string().uuid().nullable().optional(),
  selectedElementHtml: z.string().nullable().optional(),
  selectedElementDrawgleId: z.string().nullable().optional(),
  selectedElementTarget: z.enum(["screen", "navigation"]).nullable().optional(),
  selectedElementPreview: z.string().nullable().optional(),
  selectedElementImageTargets: z.array(z.object({
    drawgleId: z.string(),
    kind: z.enum(["img", "background", "inline_svg", "visual_placeholder"]),
    tagName: z.string().optional().default("div"),
    src: z.string().optional().default(""),
    alt: z.string().optional(),
    label: z.string().optional().default("Image"),
    targetIndex: z.number().int().min(0).nullable().optional(),
  })).optional().default([]),
  selectedElementSelectionVersion: z.number().nullable().optional(),
  activeSelection: z.object({
    present: z.boolean(),
    screenId: z.string().uuid().nullable().optional(),
    drawgleId: z.string().nullable().optional(),
    targetType: z.enum(["screen", "navigation"]).nullable().optional(),
    targetLabel: z.string().nullable().optional(),
    textPreview: z.string().nullable().optional(),
    outerHTML: z.string().nullable().optional(),
    selectionVersion: z.number().nullable().optional(),
    freshness: z.enum(["fresh", "stale"]).nullable().optional(),
  }).nullable().optional(),
  clientTurnId: z.string().trim().max(120).nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.prompt.trim() && !value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a prompt or image.",
      path: ["prompt"],
    });
  }
});

const now = () => new Date().toISOString();
const providerLeakPattern = /\b(gemini|google|openai|gpt|anthropic|claude|model provider|large language model|llm|system prompt|tool call|router)\b/i;
const identityQuestionPattern = /\b(who are you|what are you|which model|what model|are you gemini|are you gpt|powered by|who built you)\b/i;
const structuredLeakPattern = /\b(?:clarificationQuestion|responseMessage|instruction|action|targetType|scope|editOperation)\s*=/i;

type AgentState = AgentTurnState;
type AgentStateTarget = NonNullable<AgentTurnState["lastKnownTarget"]>;
type AgentStateCandidate = NonNullable<AgentTurnState["targetCandidates"]>[number];

const whiteLabelAgentMessage = (prompt: string, message?: string | null) => {
  const fallback = "I am Drawgle AI, your mobile app design assistant. I can help you create new screens, edit existing designs, and refine UI details on this canvas.";
  let cleanMessage = message?.trim() || fallback;

  if (structuredLeakPattern.test(cleanMessage)) {
    cleanMessage = cleanMessage
      .replace(/^[\s,;{}"']+/, "")
      .replace(/\b(?:clarificationQuestion|responseMessage|instruction|action|targetType|scope|editOperation)\s*=\s*/gi, "")
      .replace(/["'{}]+/g, "")
      .trim();
  }

  if (!cleanMessage || /^[,;:=\s-]+$/.test(cleanMessage)) {
    cleanMessage = fallback;
  }

  if (identityQuestionPattern.test(prompt) || providerLeakPattern.test(cleanMessage)) {
    return fallback;
  }

  return cleanMessage;
};

const targetLabelFromContext = ({
  requestTargetsNavigation,
  shouldUseSelectedElement,
  targetScreenName,
}: {
  requestTargetsNavigation?: boolean;
  shouldUseSelectedElement?: boolean;
  targetScreenName?: string | null;
}) => {
  if (requestTargetsNavigation) return "Navigation";
  if (shouldUseSelectedElement) return targetScreenName ? `selected element in ${targetScreenName}` : "selected element";
  return targetScreenName ?? "selected screen";
};

const imageUrlPattern = /https:\/\/[^\s<>"')]+/gi;

const extractSingleImageUrl = (text: string) => {
  const urls = Array.from(text.matchAll(imageUrlPattern))
    .map((match) => match[0].replace(/[.,;!?]+$/, ""))
    .filter((value) => {
      try {
        const url = new URL(value);
        return /\.(png|jpe?g|webp|gif)(?:$|[?#])/i.test(url.pathname + url.search);
      } catch {
        return false;
      }
    });

  return urls.length === 1 ? urls[0] : null;
};

const imageReplacementIntentPattern = /\b(replace|swap|use|update|change)\b[\s\S]{0,160}\b(image|png|photo|picture|placeholder|svg|visual|current)\b|\b(image|png|photo|picture|placeholder|svg|visual|current)\b[\s\S]{0,160}\b(replace|swap|use|update|change)\b/i;
const multiImageReplacementPattern = /\b(both|all|every|placeholders|images|svgs|cards)\b/i;

const modeForImageTarget = (kind: DrawgleImageTargetMeta["kind"]): Extract<DeterministicEditOperation, { type: "replaceImage" }>["mode"] => {
  if (kind === "background") return "background";
  if (kind === "inline_svg") return "inline_svg";
  if (kind === "visual_placeholder") return "visual_placeholder";
  return "src";
};

const normalizeImageTargetsFromPayload = ({
  payloadTargets,
  selectedHtml,
  drawgleId,
}: {
  payloadTargets?: DrawgleImageTargetMeta[];
  selectedHtml?: string | null;
  drawgleId?: string | null;
}) => {
  const targets = (payloadTargets ?? []).filter((target) => target.drawgleId && target.kind);
  if (targets.length > 0 || !selectedHtml || !drawgleId) {
    return targets;
  }

  const svgCount = Array.from(selectedHtml.matchAll(/<svg\b/gi)).length;
  if (svgCount > 0) {
    return Array.from({ length: Math.min(svgCount, 6) }, (_, index): DrawgleImageTargetMeta => ({
      drawgleId,
      kind: "inline_svg",
      tagName: "div",
      src: "",
      alt: "",
      label: "SVG placeholder",
      targetIndex: index,
    }));
  }

  return targets;
};

const pickImageTargetsForPrompt = (targets: DrawgleImageTargetMeta[], prompt: string) => {
  const imageLikeTargets = targets.filter((target) =>
    ["img", "background", "inline_svg", "visual_placeholder"].includes(target.kind),
  );
  if (multiImageReplacementPattern.test(prompt)) {
    return imageLikeTargets
      .slice()
      .sort((left, right) => {
        if (left.drawgleId !== right.drawgleId) return left.drawgleId.localeCompare(right.drawgleId);
        return (right.targetIndex ?? 0) - (left.targetIndex ?? 0);
      });
  }

  return imageLikeTargets.slice(0, 1);
};

const buildVisibleThinkingText = ({
  action,
  targetLabel,
  hasImage,
}: {
  action: AgentRouterDecision["action"];
  targetLabel?: string | null;
  hasImage: boolean;
}) => {
  if (action === "draft_new_screen_plan") {
    return hasImage
      ? "I reviewed your prompt, reference image, and project context, then matched it to a new-screen planning request."
      : "I reviewed your prompt and project context, then matched it to a new-screen planning request.";
  }

  if (action === "approve_pending_plan") {
    return "I matched your reply to the pending screen plan approval.";
  }

  if (action === "modify_existing_ui") {
    return `I checked the selected canvas context and resolved the request to ${targetLabel ?? "the best matching UI target"}.`;
  }

  if (action === "ask_clarification") {
    return "I checked the canvas context and found one missing detail before making a change.";
  }

  return "I read the recent conversation and canvas context before replying.";
};

const fallbackPreActionMessage = ({
  action,
  targetLabel,
}: {
  action: AgentRouterDecision["action"];
  targetLabel?: string | null;
}) => {
  if (action === "draft_new_screen_plan") {
    return "Okay, I'm shaping that into a screen plan for this project.";
  }

  if (action === "modify_existing_ui") {
    return `Okay, I'm applying a precise edit to ${targetLabel ?? "the selected UI"} now.`;
  }

  return null;
};

const latestPendingScreenPlanProposal = (messages: ProjectMessage[]) => {
  for (const message of [...messages].reverse()) {
    const proposal = readScreenPlanProposal(message.metadata);
    if (!proposal || proposal.status !== "pending" || new Date(proposal.expiresAt).getTime() < Date.now()) {
      continue;
    }

    return {
      messageId: message.id,
      proposal,
    };
  }

  return null;
};

const buildProposalStep = (screenPlan: ScreenPlan): AgentStepMetadata => ({
  kind: "proposal",
  status: "completed",
  title: screenPlan.name,
  detail: screenPlan.description,
  targetLabel: screenPlan.type,
  processLines: [
    `Screen type: ${screenPlan.type}`,
    screenPlan.chromePolicy?.chrome ? `Chrome: ${screenPlan.chromePolicy.chrome}` : "Chrome: project default",
    "Review this plan before I build it.",
  ],
});

const buildAgentProgressStep = ({
  status = "thinking",
  title,
  detail,
  targetLabel,
  processLines,
}: {
  status?: AgentStepMetadata["status"];
  title: string;
  detail?: string | null;
  targetLabel?: string | null;
  processLines?: string[] | null;
}): AgentStepMetadata => ({
  kind: "system",
  status,
  title,
  detail: detail ?? null,
  targetLabel: targetLabel ?? null,
  processLines: processLines ?? (detail ? [detail] : null),
});

async function insertPreActionMessage({
  admin,
  projectId,
  ownerId,
  screenId,
  prompt,
  routerDecision,
  routerMetadata,
  targetLabel,
}: {
  admin: ReturnType<typeof createAdminClient>;
  projectId: string;
  ownerId: string;
  screenId?: string | null;
  prompt: string;
  routerDecision: AgentRouterDecision;
  routerMetadata: Record<string, unknown>;
  targetLabel?: string | null;
}) {
  const fallback = fallbackPreActionMessage({ action: routerDecision.action, targetLabel });
  const content = whiteLabelAgentMessage(prompt, routerDecision.responseMessage || fallback);

  if (!fallback && !routerDecision.responseMessage) {
    return null;
  }

  return insertProjectMessage(admin, {
    projectId,
    ownerId,
    screenId: screenId ?? null,
    role: "model",
    content,
    messageType: "chat",
    metadata: {
      ...routerMetadata,
      ui: { variant: "chat" },
      action: "pre_action_response",
      targetLabel: targetLabel ?? null,
    },
  });
}

const buildQueuedAgentStep = (input: AgentStepMetadata): AgentStepMetadata => input;

const metadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const stringOrNull = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

const stringArrayOrNull = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : null;

const parseTargetType = (value: unknown): AgentTargetType | null => {
  if (value === "none" || value === "screen" || value === "selected_element" || value === "navigation" || value === "project") {
    return value;
  }

  return null;
};

const parseScope = (value: unknown): AgentScope | null => {
  if (value === "none" || value === "selected_element" || value === "screen_region" || value === "whole_screen" || value === "navigation" || value === "new_screen") {
    return value;
  }

  if (value === "screen") {
    return "whole_screen";
  }

  return null;
};

const readLastKnownTarget = (value: unknown): AgentStateTarget | null => {
  const record = metadataRecord(value);
  const targetType = parseTargetType(record.targetType);
  const scope = parseScope(record.scope ?? record.targetScope);

  if (!targetType && !scope && !record.screenId && !record.selectedElementDrawgleId) {
    return null;
  }

  return {
    targetType,
    scope,
    screenId: stringOrNull(record.screenId ?? record.targetScreenId),
    screenName: stringOrNull(record.screenName),
    selectedElementDrawgleId: stringOrNull(record.selectedElementDrawgleId),
  };
};

const readTargetCandidates = (value: unknown): AgentStateCandidate[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => {
      const record = metadataRecord(item);
      const targetType = parseTargetType(record.targetType);
      const candidate: AgentStateCandidate = {
        targetType,
        screenId: stringOrNull(record.screenId ?? record.targetScreenId),
        screenName: stringOrNull(record.screenName),
        selectedElementDrawgleId: stringOrNull(record.selectedElementDrawgleId),
        label: stringOrNull(record.label),
      };
      return candidate.targetType || candidate.screenId || candidate.selectedElementDrawgleId || candidate.label ? candidate : null;
    })
    .filter((item): item is AgentStateCandidate => Boolean(item));
};

const readAgentState = (metadata: unknown): AgentState | null => {
  const state = metadataRecord(metadata).agentState;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }

  const record = state as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : null;
  if (kind !== "pending_clarification" && kind !== "failed_edit_recovery" && kind !== "last_actionable_request") {
    return null;
  }

  const expiresAt = stringOrNull(record.expiresAt);
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return null;
  }

  const explicitTarget = readLastKnownTarget(record.lastKnownTarget);
  const legacyTargetType: AgentTargetType | null = record.targetType === "navigation"
    ? "navigation"
    : record.selectedElementDrawgleId
      ? "selected_element"
      : record.targetType === "screen"
        ? "screen"
        : null;
  const legacyScope = parseScope(record.scope ?? record.targetScope);
  const legacyTarget: AgentStateTarget | null = legacyTargetType || legacyScope || record.targetScreenId || record.selectedElementDrawgleId
    ? {
        targetType: legacyTargetType,
        scope: legacyScope,
        screenId: stringOrNull(record.targetScreenId),
        screenName: stringOrNull(record.screenName),
        selectedElementDrawgleId: stringOrNull(record.selectedElementDrawgleId),
      }
    : null;

  return {
    kind,
    instruction: stringOrNull(record.instruction),
    missingFields: stringArrayOrNull(record.missingFields),
    targetCandidates: readTargetCandidates(record.targetCandidates),
    lastKnownTarget: explicitTarget ?? legacyTarget,
    message: stringOrNull(record.message),
    expiresAt,
  };
};

const latestUsableAgentState = (messages: ProjectMessage[]) => {
  for (const message of [...messages].reverse()) {
    const state = readAgentState(message.metadata);
    if (state) {
      return state;
    }
  }

  return null;
};

const makeAgentState = ({
  kind,
  instruction,
  missingFields,
  targetCandidates,
  lastKnownTarget,
  message,
}: {
  kind: AgentState["kind"];
  instruction?: string | null;
  missingFields?: string[] | null;
  targetCandidates?: AgentStateCandidate[] | null;
  lastKnownTarget?: AgentStateTarget | null;
  message?: string | null;
}) => ({
  kind,
  instruction: instruction ?? null,
  missingFields: missingFields ?? null,
  targetCandidates: targetCandidates ?? null,
  lastKnownTarget: lastKnownTarget ?? null,
  message: message ?? null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
});

const compatibilityToolName = (action: AgentRouterDecision["action"]) =>
  action === "modify_existing_ui"
    ? "modify_screen"
    : action === "draft_new_screen_plan"
      ? "create_new_screen"
      : action === "answer_or_discuss"
        ? "chat_response"
        : action;

const makeRouterMetadata = (decision: AgentRouterDecision) => ({
  agentRouter: {
    action: decision.action,
    tool: compatibilityToolName(decision.action),
    executionIntent: decision.executionIntent,
    confidence: decision.confidence,
    reason: decision.reason,
    targetScreenId: decision.targetScreenId ?? null,
    targetType: decision.targetType,
    targetScope: decision.scope,
    scope: decision.scope,
    selectedElementDrawgleId: decision.selectedElementDrawgleId ?? null,
    editOperation: decision.editOperation,
    source: decision.routerSource,
    failureReason: decision.routerFailureReason ?? null,
  },
});

const buildScreenTargetCandidates = (
  screens: Array<{ id: string; name: string }>,
  selectedScreenId: string | null,
  selectedElementDrawgleId?: string | null,
): AgentStateCandidate[] => {
  const candidates: AgentStateCandidate[] = [];

  if (selectedElementDrawgleId) {
    candidates.push({
      targetType: "selected_element",
      screenId: selectedScreenId,
      selectedElementDrawgleId,
      label: "Selected element",
    });
  }

  for (const screen of screens) {
    candidates.push({
      targetType: "screen",
      screenId: screen.id,
      screenName: screen.name,
      label: screen.name,
    });
  }

  return candidates;
};

const buildDecisionTarget = (
  decision: AgentRouterDecision,
  screenName?: string | null,
): AgentStateTarget | null => {
  if (decision.targetType === "none" && decision.scope === "none" && !decision.targetScreenId && !decision.selectedElementDrawgleId) {
    return null;
  }

  return {
    targetType: decision.targetType,
    scope: decision.scope,
    screenId: decision.targetScreenId ?? null,
    screenName: screenName ?? null,
    selectedElementDrawgleId: decision.selectedElementDrawgleId ?? null,
  };
};

const compactMessageContent = (content: string) => {
  const trimmed = content.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
};

const compactEventLabel = (metadata: Record<string, unknown>) => {
  const action = stringOrNull(metadata.action);
  if (action) {
    return action;
  }

  const router = metadataRecord(metadata.agentRouter);
  const routerTool = stringOrNull(router.tool ?? router.action);
  if (routerTool) {
    return routerTool;
  }

  const generationRunId = stringOrNull(metadata.generationRunId);
  return generationRunId ? "generation_event" : null;
};

const buildCompactRecentMessages = (
  messages: ProjectMessage[],
  screens: Array<{ id: string; name: string }>,
  limit: number,
) => {
  if (limit === 0) return [];
  const screenNames = new Map(screens.map((screen) => [screen.id, screen.name]));

  return messages.slice(-limit).map((message) => {
    const metadata = metadataRecord(message.metadata);
    return {
      role: message.role,
      content: compactMessageContent(message.content),
      screenId: message.screenId,
      screenName: message.screenId ? screenNames.get(message.screenId) ?? null : null,
      event: compactEventLabel(metadata),
    };
  });
};

type DeterministicTokenStyleIntent = {
  kind: "deterministic_token_style";
  operations: DeterministicEditOperation[];
  tokenPaths: string[];
  reason: string;
};

const complexStyleRequestPattern = /\b(add|create|remove|delete|rewrite|redesign|rebuild|layout|premium|modern|beautiful|awesome|gradient|glass|map|chart|content)\b/i;

const classifyDeterministicTokenStyleIntent = ({
  prompt,
  designTokens,
}: {
  prompt: string;
  designTokens?: DesignTokens | null;
}): DeterministicTokenStyleIntent | null => {
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  if (!designTokens?.tokens || wordCount > 5 || complexStyleRequestPattern.test(prompt)) {
    return null;
  }

  const tokenReferences = getDrawgleTokenReferences(designTokens);
  const tokenByPath = new Map(tokenReferences.map((reference) => [reference.path, reference]));
  const operations: DeterministicEditOperation[] = [];
  const tokenPaths: string[] = [];

  const addTokenStyle = (
    property: Extract<DeterministicEditOperation, { type: "setStyle" }>["property"],
    path: string,
  ) => {
    const reference = tokenByPath.get(path);
    if (!reference) {
      return;
    }

    operations.push({
      type: "setStyle",
      property,
      value: `var(${reference.name})`,
    });
    tokenPaths.push(path);
  };

  const mentionsColor = /\b(colou?r|bg|background|surface|brand|primary|secondary)\b/i.test(prompt);
  const mentionsText = /\b(text|label|font)\b/i.test(prompt);
  const mentionsBackground = /\b(bg|background|surface|fill)\b/i.test(prompt);

  if (/\b(primary|brand|action)\b/i.test(prompt) && mentionsColor) {
    if (mentionsText && !mentionsBackground) {
      addTokenStyle("color", "color.action.primary");
    } else {
      addTokenStyle("background-color", "color.action.primary");
      addTokenStyle("color", "color.action.on_primary_text");
    }
  } else if (/\bsecondary\b/i.test(prompt) && mentionsColor) {
    addTokenStyle(mentionsText && !mentionsBackground ? "color" : "background-color", "color.action.secondary");
  } else if (/\b(card|surface)\b/i.test(prompt) && mentionsColor) {
    addTokenStyle("background-color", "color.surface.card");
  } else if (/\b(app background|primary background|project background|background token)\b/i.test(prompt) && mentionsBackground) {
    addTokenStyle("background-color", "color.background.primary");
  }

  if (/\bhigh[-\s]?emphasis|strong text|primary text\b/i.test(prompt)) {
    addTokenStyle("color", "color.text.high_emphasis");
  } else if (/\bmedium[-\s]?emphasis|secondary text\b/i.test(prompt)) {
    addTokenStyle("color", "color.text.medium_emphasis");
  } else if (/\blow[-\s]?emphasis|muted text|caption color\b/i.test(prompt)) {
    addTokenStyle("color", "color.text.low_emphasis");
  }

  if (/\b(radius|rounded|corner|corners)\b/i.test(prompt)) {
    addTokenStyle("border-radius", /\b(pill|capsule|fully rounded)\b/i.test(prompt) ? "radii.pill" : "radii.app");
  }

  if (/\b(shadow|elevation)\b/i.test(prompt)) {
    addTokenStyle("box-shadow", "shadows.surface");
  }

  if (/\bborder\b/i.test(prompt)) {
    addTokenStyle("border-color", /\bfocus|focused\b/i.test(prompt) ? "color.border.focused" : "color.border.divider");
    addTokenStyle("border-width", "border_widths.standard");
  }

  if (/\b(gap|spacing)\b/i.test(prompt)) {
    addTokenStyle("gap", /\b(section|large|bigger|more)\b/i.test(prompt) ? "mobile_layout.section_gap" : "mobile_layout.element_gap");
  }

  if (operations.length === 0) {
    return null;
  }

  return {
    kind: "deterministic_token_style",
    operations,
    tokenPaths: Array.from(new Set(tokenPaths)),
    reason: "Simple selected-element token style request.",
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countDrawgleIdOccurrences = (code: string, drawgleId: string) => {
  const escapedId = escapeRegExp(drawgleId);
  const regex = new RegExp(`\\sdata-drawgle-id\\s*=\\s*(?:"${escapedId}"|'${escapedId}'|${escapedId})(?=\\s|>|/)`, "gi");
  return Array.from(code.matchAll(regex)).length;
};

type SelectedElementVerification =
  | {
      ok: true;
      html: string;
      sourceName: string;
    }
  | {
      ok: false;
      reason: string;
      message: string;
    };

async function verifySelectedElementSource({
  admin,
  projectId,
  screenId,
  targetType,
  drawgleId,
}: {
  admin: ReturnType<typeof createAdminClient>;
  projectId: string;
  screenId?: string | null;
  targetType: "screen" | "navigation";
  drawgleId?: string | null;
}): Promise<SelectedElementVerification> {
  if (!drawgleId?.trim()) {
    return {
      ok: false,
      reason: "missing_drawgle_id",
      message: "I lost the selected section identity. Please reselect the exact element and try again.",
    };
  }

  if (targetType === "navigation") {
    const { data: navigation, error } = await admin
      .from("project_navigation")
      .select("shell_code")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error || !navigation?.shell_code) {
      return {
        ok: false,
        reason: "navigation_source_missing",
        message: "I could not verify that selected navigation item. Please reselect it and try again.",
      };
    }

    const sourceCode = ensureDrawgleIds(navigation.shell_code ?? "", "dg-nav").code;
    const occurrenceCount = countDrawgleIdOccurrences(sourceCode, drawgleId);
    if (occurrenceCount !== 1) {
      return {
        ok: false,
        reason: occurrenceCount === 0 ? "stale_drawgle_id" : "duplicate_drawgle_id",
        message: "That selected navigation item is stale or ambiguous. Please reselect the exact item and try again.",
      };
    }

    const sourceRegion = findRepairTarget({ code: sourceCode, drawgleId, allowFallback: false });
    if (!sourceRegion) {
      return {
        ok: false,
        reason: "source_region_not_found",
        message: "I could not locate that selected navigation item in the saved source. Please reselect it and try again.",
      };
    }

    return { ok: true, html: sourceRegion.snippet, sourceName: "Navigation" };
  }

  if (!screenId) {
    return {
      ok: false,
      reason: "screen_missing_for_selection",
      message: "I can edit the selected element, but I lost which screen it belongs to. Please reselect it.",
    };
  }

  const { data: screen, error } = await admin
    .from("screens")
    .select("id, name, code")
    .eq("id", screenId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !screen) {
    return {
      ok: false,
      reason: "screen_source_missing",
      message: "I could not verify the selected section because its screen was not found. Please reselect it.",
    };
  }

  const sourceCode = ensureDrawgleIds(screen.code ?? "").code;
  const occurrenceCount = countDrawgleIdOccurrences(sourceCode, drawgleId);
  if (occurrenceCount !== 1) {
    return {
      ok: false,
      reason: occurrenceCount === 0 ? "stale_drawgle_id" : "duplicate_drawgle_id",
      message: "That selected section is stale or ambiguous. Please reselect the exact element and try again.",
    };
  }

  const sourceRegion = findRepairTarget({ code: sourceCode, drawgleId, allowFallback: false });
  if (!sourceRegion) {
    return {
      ok: false,
      reason: "source_region_not_found",
      message: "I could not locate that selected section in the saved source. Please reselect it and try again.",
    };
  }

  return { ok: true, html: sourceRegion.snippet, sourceName: screen.name };
}

async function findActiveGenerationRun(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data, error } = await admin
    .from("generation_runs")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", [...ACTIVE_GENERATION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: string; status: GenerationStatus } | null;
}

const uploadPromptImage = async ({
  admin,
  ownerId,
  image,
}: {
  admin: ReturnType<typeof createAdminClient>;
  ownerId: string;
  image?: PromptImagePayload | null;
}) => {
  if (!image) {
    return null;
  }

  const extension = image.mimeType.split("/")[1] ?? "bin";
  const imagePath = `${ownerId}/prompt-images/${crypto.randomUUID()}.${extension}`;

  const { error } = await admin.storage
    .from("generation-assets")
    .upload(imagePath, Buffer.from(image.data, "base64"), {
      contentType: image.mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return imagePath;
};

export async function POST(request: Request) {
  let markAgentTurnFailed: ((message: string) => Promise<void>) | null = null;

  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const prompt = payload.prompt.trim();

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id, name, prompt, design_tokens, project_charter")
      .eq("id", payload.projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [{ data: screens, error: screensError }, { data: projectNavigation }, activeGeneration, projectMessages] = await Promise.all([
      admin
        .from("screens")
        .select("id, name, prompt, status, summary, chrome_policy, navigation_item_id")
        .eq("project_id", payload.projectId)
        .order("sort_index", { ascending: true }),
      admin
        .from("project_navigation")
        .select("plan")
        .eq("project_id", payload.projectId)
        .maybeSingle(),
      findActiveGenerationRun(admin, payload.projectId),
      fetchProjectMessages(admin, payload.projectId, 24),
    ]);

    if (screensError) {
      throw screensError;
    }

    const screenContext = (screens ?? []).map((screen: any) => {
      const chromePolicy = screen.chrome_policy &&
        typeof screen.chrome_policy === "object" &&
        !Array.isArray(screen.chrome_policy)
        ? screen.chrome_policy as { chrome?: unknown }
        : null;

      return {
        id: screen.id,
        name: screen.name,
        prompt: screen.prompt,
        status: screen.status,
        summary: screen.summary,
        chrome: typeof chromePolicy?.chrome === "string" ? chromePolicy.chrome : null,
        navigationItemId: screen.navigation_item_id,
      };
    });
    const selectedScreenId = payload.activeSelection?.present && payload.activeSelection.targetType !== "navigation"
      ? payload.activeSelection.screenId ?? payload.selectedScreenId ?? payload.focusedScreenId ?? null
      : payload.selectedScreenId ?? payload.focusedScreenId ?? null;
    const navigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;
    const agentState = latestUsableAgentState(projectMessages);
    const hasActiveSelection = Boolean(
      payload.activeSelection?.present ||
      payload.selectedElementDrawgleId ||
      payload.selectedElementHtml,
    );
    const historyNeed = classifyHistoryNeed({
      prompt,
      hasImage: Boolean(payload.image),
      hasSelectedElement: hasActiveSelection,
      agentState,
    });
    const recentMessages = buildCompactRecentMessages(projectMessages, screenContext, HISTORY_LIMITS[historyNeed]);
    const promptApprovalProposal = latestPendingScreenPlanProposal(projectMessages);
    const selectedScreen = selectedScreenId
      ? screenContext.find((screen: any) => screen.id === selectedScreenId) ?? null
      : null;
    const activeSelectionDrawgleId = payload.activeSelection?.drawgleId ?? payload.selectedElementDrawgleId ?? null;
    const activeSelectionTargetType = payload.activeSelection?.targetType ?? payload.selectedElementTarget ?? null;
    const activeSelection = hasActiveSelection
      ? {
          present: true,
          screenId: activeSelectionTargetType === "navigation" ? null : selectedScreenId,
          drawgleId: activeSelectionDrawgleId,
          targetType: activeSelectionTargetType,
          targetLabel: payload.activeSelection?.targetLabel ?? (
            activeSelectionTargetType === "navigation"
              ? "Navigation"
              : selectedScreen?.name ?? null
          ),
          textPreview: payload.activeSelection?.textPreview ?? payload.selectedElementPreview ?? null,
          outerHTML: payload.activeSelection?.outerHTML ?? payload.selectedElementHtml ?? null,
          selectionVersion: payload.activeSelection?.selectionVersion ?? payload.selectedElementSelectionVersion ?? null,
          freshness: payload.activeSelection?.freshness ?? "fresh",
        }
      : {
          present: false,
          screenId: null,
          drawgleId: null,
          targetType: null,
          targetLabel: null,
          textPreview: null,
          outerHTML: null,
          selectionVersion: null,
          freshness: null,
        };
    const activeSelectionForContext = {
      ...activeSelection,
      outerHTML: activeSelection.outerHTML ? compactMessageContent(activeSelection.outerHTML) : null,
    };
    const agentContextVersion = "agent-lightweight-v1";
    const lightweightAgentContext: Record<string, unknown> = {
      version: agentContextVersion,
      project: {
        id: project.id,
        name: project.name,
        hasDesignTokens: Boolean(project.design_tokens),
      },
      selectedTarget: {
        activeScreenId: selectedScreenId,
        activeScreenName: selectedScreen?.name ?? null,
        activeSelection: activeSelectionForContext,
        selectedElement: {
          targetType: activeSelection.targetType,
          drawgleId: activeSelection.drawgleId,
          textPreview: activeSelection.textPreview,
          imageTargets: payload.selectedElementImageTargets ?? [],
          selectionVersion: activeSelection.selectionVersion,
        },
      },
      screens: screenContext.map((screen: any) => ({
        id: screen.id,
        name: screen.name,
        status: screen.status,
        summary: screen.summary,
        chrome: screen.chrome,
        navigationItemId: screen.navigationItemId,
      })),
      navigation: navigationPlan
        ? {
            enabled: navigationPlan.enabled,
            kind: navigationPlan.kind,
            itemLabels: navigationPlan.items.map((item) => item.label),
          }
        : null,
      activeGeneration: activeGeneration ? { id: activeGeneration.id, status: activeGeneration.status } : null,
      pendingProposal: promptApprovalProposal
        ? {
            messageId: promptApprovalProposal.messageId,
            screenName: promptApprovalProposal.proposal.screenPlan.name,
            screenType: promptApprovalProposal.proposal.screenPlan.type,
            description: promptApprovalProposal.proposal.screenPlan.description,
            status: promptApprovalProposal.proposal.status,
            expiresAt: promptApprovalProposal.proposal.expiresAt,
          }
        : null,
      agentState,
      recentMessages,
    };

    const agentTurnId = crypto.randomUUID();
    const clientTurnId = payload.clientTurnId?.trim() || crypto.randomUUID();
    const turnBaseMetadata = {
      agentTurnId,
      clientTurnId,
      agentContextVersion,
    };
    const userMessage = await insertProjectMessage(admin, {
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: null,
      role: "user",
      content: prompt || "[image]",
      messageType: "chat",
      metadata: {
        ...turnBaseMetadata,
        action: "agent_turn_user",
        image: payload.image ?? null,
      },
    });
    let progressStep: AgentStepMetadata | null = null;
    let progressMetadata: Record<string, unknown> = {
      ...turnBaseMetadata,
      userMessageId: userMessage.id,
    };
    let progressMessage: ProjectMessage | null = null;
    const progressLines = () => progressStep?.processLines ?? [];

    const updateAgentProgress = async ({
      step,
      metadata,
      messageType = "chat",
    }: {
      step: AgentStepMetadata;
      metadata?: Record<string, unknown>;
      messageType?: "chat" | "error";
    }) => {
      progressStep = step;
      progressMetadata = {
        ...progressMetadata,
        ...metadata,
        action: "agent_turn_progress",
        ui: { variant: "action_card" },
        userMessageId: userMessage.id,
        agentStep: progressStep,
      };
      progressMessage = progressMessage
        ? await updateProjectMessage(admin, {
            messageId: progressMessage.id,
            content: step.title,
            messageType,
            metadata: progressMetadata,
          })
        : await insertProjectMessage(admin, {
            projectId: payload.projectId,
            ownerId: user.id,
            screenId: null,
            role: "system",
            content: step.title,
            messageType,
            metadata: progressMetadata,
          });
      return progressMessage;
    };
    markAgentTurnFailed = async (message: string) => {
      await updateAgentProgress({
        step: buildAgentProgressStep({
          status: "failed",
          title: "Needs review",
          detail: message,
          processLines: [...progressLines(), message],
        }),
        messageType: "error",
      });
    };

    const routerDecision = await routeAgentPrompt({
      prompt,
      hasImage: Boolean(payload.image),
      activeScreenId: selectedScreenId,
      selectedElement: {
        targetType: activeSelection.targetType,
        drawgleId: activeSelection.drawgleId,
        textPreview: activeSelection.textPreview,
        imageTargets: payload.selectedElementImageTargets ?? [],
      },
      activeSelection,
      screens: screenContext,
      navigation: navigationPlan
        ? {
            enabled: navigationPlan.enabled,
            kind: navigationPlan.kind,
            itemLabels: navigationPlan.items.map((item) => item.label),
          }
        : null,
      activeGeneration: activeGeneration ? { id: activeGeneration.id, status: activeGeneration.status } : null,
      recentMessages,
      agentState,
      agentContext: lightweightAgentContext,
      loadProjectContext: () => assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: prompt,
      }),
    });
    const routerSelectedElementUsed =
      routerDecision.targetType === "selected_element" ||
      routerDecision.scope === "selected_element";
    const activeSelectionDiagnostics = hasActiveSelection
      ? {
          present: true,
          screenId: activeSelection.screenId,
          drawgleId: activeSelection.drawgleId,
          targetType: activeSelection.targetType,
          targetLabel: activeSelection.targetLabel,
          freshness: activeSelection.freshness,
          selectionVersion: activeSelection.selectionVersion,
          routerAction: routerDecision.action,
          routerTargetType: routerDecision.targetType,
          routerScope: routerDecision.scope,
          routerSelectedElementUsed,
        }
      : null;
    const routerMetadata = {
      ...makeRouterMetadata(routerDecision),
      agentContextVersion,
      agentTurnId,
      clientTurnId,
      activeSelectionDiagnostics,
    };

    if (routerDecision.action !== "answer_or_discuss" && routerDecision.action !== "out_of_scope") {
      await updateAgentProgress({
        step: buildAgentProgressStep({
          title: "Interpreting your request",
          detail: buildVisibleThinkingText({
            action: routerDecision.action,
            targetLabel: selectedScreen?.name ?? null,
            hasImage: Boolean(payload.image),
          }),
          processLines: ["Interpreting your request.", "Matched the next agent step."],
        }),
        metadata: routerMetadata,
      });
    }

    const saveClarification = async ({
      message,
      instruction,
      missingFields,
      lastKnownTarget,
      status = 200,
      metadata,
    }: {
      message: string;
      instruction: string;
      missingFields: string[];
      lastKnownTarget?: AgentStateTarget | null;
      status?: number;
      metadata?: Record<string, unknown>;
    }) => {
      const agentStateMetadata = makeAgentState({
        kind: "pending_clarification",
        instruction,
        missingFields,
        targetCandidates: buildScreenTargetCandidates(screenContext, selectedScreenId, activeSelection.drawgleId),
        lastKnownTarget: lastKnownTarget ?? buildDecisionTarget(routerDecision),
        message,
      });
      const messageMetadata = {
        ...routerMetadata,
        ...metadata,
        agentState: agentStateMetadata,
      };

      await updateAgentProgress({
        step: buildAgentProgressStep({
          status: "completed",
          title: "One detail needed",
          detail: message,
          processLines: [...progressLines(), "Asked for the missing detail."],
        }),
        metadata: messageMetadata,
      });

      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: messageMetadata,
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: message,
      }).catch((error) => {
        console.error("Failed to persist clarification memory", error);
      });

      return NextResponse.json({
        intent: "chat_response",
        message,
        routerDecision,
      }, { status });
    };

    const approvePendingProposalTurn = async (pendingProposal: NonNullable<ReturnType<typeof latestPendingScreenPlanProposal>>) => {
      try {
        await updateAgentProgress({
          step: buildAgentProgressStep({
            title: "Approving the plan",
            detail: "Turning the approved screen plan into a build job.",
            processLines: [...progressLines(), "Approving the pending screen plan."],
          }),
          metadata: routerMetadata,
        });

        const result = await approveScreenPlanProposal({
          admin,
          ownerId: user.id,
          projectId: payload.projectId,
          proposalMessageId: pendingProposal.messageId,
          approvalContent: prompt || "Build this screen.",
          approvalUserMessageId: userMessage.id,
        });

        await updateAgentProgress({
          step: buildAgentProgressStep({
            status: "completed",
            title: "Build queued",
            detail: "Queued the approved screen for generation.",
            processLines: [...progressLines(), "Queued the screen build."],
          }),
          metadata: {
            ...routerMetadata,
            generationRunId: result.generationRunId,
          },
        });

        return NextResponse.json(
          {
            intent: "create_new_screen",
            ...result,
            routerDecision,
          },
          { status: 202 },
        );
      } catch (error) {
        if (!(error instanceof ScreenPlanApprovalError)) {
          throw error;
        }

        await updateAgentProgress({
          step: buildAgentProgressStep({
            status: "failed",
            title: "Could not approve",
            detail: error.message,
            processLines: [...progressLines(), error.message],
          }),
          metadata: {
            ...routerMetadata,
            activeGenerationRunId: error.activeGenerationRunId,
          },
          messageType: error.status >= 500 ? "error" : "chat",
        });
        const modelMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: null,
          role: "model",
          content: error.message,
          messageType: error.status >= 500 ? "error" : "chat",
          metadata: {
            ...routerMetadata,
            activeGenerationRunId: error.activeGenerationRunId,
          },
        });

        await persistProjectMessageMemoryPair({
          admin,
          userMessageId: userMessage.id,
          userContent: prompt || "[image]",
          modelMessageId: modelMessage.id,
          modelContent: error.message,
        }).catch((memoryError) => {
          console.error("Failed to persist screen approval error memory", memoryError);
        });

        return NextResponse.json(
          {
            intent: "chat_response",
            message: error.message,
            activeGenerationRunId: error.activeGenerationRunId,
            routerDecision,
          },
          { status: error.status },
        );
      }
    };

    if (routerDecision.action === "approve_pending_plan") {
      if (promptApprovalProposal) {
        return approvePendingProposalTurn(promptApprovalProposal);
      }

      return saveClarification({
        message: "I can build it after I draft a screen plan. What kind of screen should I plan?",
        instruction: routerDecision.instruction?.trim() || prompt,
        missingFields: ["screen_requirements"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "approval_without_pending_proposal",
          },
        },
      });
    }

    if (routerDecision.action === "ask_clarification") {
      const retainedInstruction = routerDecision.instruction?.trim() || agentState?.instruction || prompt;
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.clarificationQuestion?.trim() ||
          routerDecision.responseMessage?.trim() ||
          "I can make that change. Which screen or element should I update?",
      );

      return saveClarification({
        message,
        instruction: retainedInstruction,
        missingFields: ["target"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "router_requested_clarification",
          },
        },
      });
    }

    if (routerDecision.action === "out_of_scope") {
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.responseMessage || "I can help with this app canvas: screens, UI edits, product flows, and design decisions.",
      );
      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: {
          ...routerMetadata,
          ui: { variant: "chat" },
          userMessageId: userMessage.id,
        },
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: message,
      }).catch((error) => {
        console.error("Failed to persist out-of-scope chat memory", error);
      });

      return NextResponse.json({
        intent: "out_of_scope",
        message,
        routerDecision,
      });
    }

    if (routerDecision.action === "answer_or_discuss") {
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.responseMessage || routerDecision.clarificationQuestion ||
          "I can help with that. Tell me what direction you want to explore on this project.",
      );

      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: {
          ...routerMetadata,
          ui: { variant: "chat" },
          userMessageId: userMessage.id,
        },
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: message,
      }).catch((error) => {
        console.error("Failed to persist agent chat memory", error);
      });

      return NextResponse.json({
        intent: "chat_response",
        message,
        routerDecision,
      });
    }

    if (routerDecision.action === "draft_new_screen_plan") {
      const generationPrompt = routerDecision.instruction?.trim() || prompt;

      if (activeGeneration) {
        const message = "A screen generation is already running. Let that finish, then ask me for the next screen.";

        await updateAgentProgress({
          step: buildAgentProgressStep({
            status: "failed",
            title: "Already building",
            detail: message,
            processLines: [...progressLines(), message],
          }),
          metadata: {
            ...routerMetadata,
            activeGenerationRunId: activeGeneration.id,
          },
        });
        const modelMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: null,
          role: "model",
          content: message,
          messageType: "chat",
          metadata: {
            ...routerMetadata,
            activeGenerationRunId: activeGeneration.id,
          },
        });

        await persistProjectMessageMemoryPair({
          admin,
          userMessageId: userMessage.id,
          userContent: prompt || "[image]",
          modelMessageId: modelMessage.id,
          modelContent: message,
        }).catch((error) => {
          console.error("Failed to persist active-generation chat memory", error);
        });

        return NextResponse.json({ intent: "chat_response", message, routerDecision }, { status: 409 });
      }

      const designTokens = project.design_tokens
        ? normalizeDesignTokens(project.design_tokens as DesignTokens)
        : null;
      const projectCharter = (project.project_charter as ProjectCharter | null) ?? null;
      const planningAck = whiteLabelAgentMessage(
        prompt,
        "Got it. I'm turning that into a brand-fit screen plan now.",
      );
      const ackMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: planningAck,
        messageType: "chat",
        metadata: {
          ...routerMetadata,
          ui: { variant: "chat" },
          action: "screen_plan_acknowledgement",
          userMessageId: userMessage.id,
        },
      });
      await updateAgentProgress({
        step: buildAgentProgressStep({
          title: "Drafting the screen plan",
          detail: "Choosing the screen role, layout hierarchy, and brand-fit details.",
          processLines: [...progressLines(), "Drafting the screen plan."],
        }),
        metadata: routerMetadata,
      });
      const planningContext = await assembleProjectContext({
        admin,
        projectId: payload.projectId,
        userPrompt: generationPrompt,
      });
      let referenceImage = payload.image ?? null;
      let referenceMode: ReferenceMode | null = referenceImage
        ? payload.imageReferenceMode === "style"
          ? "user_style"
          : "user_recreate"
        : null;
      let referenceId: string | null = null;

      const hasExistingProjectVisualMemory = Boolean(
        designTokens?.tokens
        || projectCharter
        || navigationPlan?.items?.length
        || planningContext.includes("RELEVANT EXISTING SCREENS"),
      );

      if (!referenceImage && hasExistingProjectVisualMemory) {
        referenceMode = "user_style";
      } else if (!referenceImage) {
        const match = matchCuratedStyleReference({
          prompt: generationPrompt,
          planningMode: "single-screen",
          existingCharter: projectCharter,
        });

        if (!match) {
          throw new Error("No curated style reference is available for no-image planning.");
        }

        const curatedImage = await loadCuratedStyleReferenceImage(match.reference);
        if (!curatedImage) {
          throw new Error(`Selected curated style reference could not be loaded: ${match.reference.id}`);
        }

        referenceImage = curatedImage;
        referenceMode = "curated_style";
        referenceId = match.reference.id;
      }
      const plan = await planUiFlow({
        prompt: generationPrompt,
        image: referenceImage,
        referenceMode,
        referenceId,
        designTokens,
        projectContext: planningContext,
        existingCharter: projectCharter,
        existingNavigationPlan: navigationPlan,
        planningMode: "single-screen",
      });
      const screenPlan = plan.screens[0] ?? {
        name: "New Screen",
        type: "root" as const,
        description: generationPrompt,
      };
      const imagePath = await uploadPromptImage({
        admin,
        ownerId: user.id,
        image: payload.image ?? null,
      });
      const proposalMetadata = {
        prompt: generationPrompt,
        screenPlan,
        requiresBottomNav: plan.requiresBottomNav,
        navigationArchitecture: plan.navigationArchitecture,
        navigationPlan: plan.navigationPlan,
        imagePath,
        imageReferenceMode: payload.imageReferenceMode,
        status: "pending",
        expiresAt: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
      };
      const proposalText = `I drafted a plan for ${screenPlan.name}. Review it, then I can build it on the canvas.`;
      const proposalBaseMetadata = {
        ...routerMetadata,
        serverReconciliation: {
          finalAction: "draft_screen_plan",
          finalScope: "new_screen",
        },
      };

      await updateAgentProgress({
        step: buildAgentProgressStep({
          status: "completed",
          title: "Plan ready for review",
          detail: `Prepared ${screenPlan.name} for approval.`,
          processLines: [...progressLines(), "Prepared the approval card."],
        }),
        metadata: proposalBaseMetadata,
      });
      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: proposalText,
        messageType: "chat",
        metadata: {
          ...proposalBaseMetadata,
          ui: { variant: "chat" },
          action: "screen_plan_proposed_intro",
          userMessageId: userMessage.id,
        },
      });
      const proposalMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "system",
        content: `Screen plan: ${screenPlan.name}`,
        messageType: "chat",
        metadata: {
          ...proposalBaseMetadata,
          ui: { variant: "action_card" },
          action: "screen_plan_proposed",
          userMessageId: userMessage.id,
          screenPlanProposal: proposalMetadata,
          agentStep: buildProposalStep(screenPlan),
          agentState: makeAgentState({
            kind: "pending_clarification",
            instruction: generationPrompt,
            missingFields: ["approval"],
            targetCandidates: null,
            lastKnownTarget: {
              targetType: "none",
              scope: "new_screen",
              screenId: null,
              screenName: screenPlan.name,
              selectedElementDrawgleId: null,
            },
            message: proposalText,
          }),
        },
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: ackMessage.id,
        modelContent: `${planningAck}\n\n${proposalText}`,
      }).catch((error) => {
        console.error("Failed to persist screen proposal memory", error);
      });

      return NextResponse.json({
        intent: "screen_plan_proposed",
        proposalMessageId: proposalMessage.id,
        screenPlan,
        routerDecision,
      });
    }

    const designTokens = project.design_tokens
      ? normalizeDesignTokens(project.design_tokens as DesignTokens)
      : null;
    const resolvedInstruction = routerDecision.instruction?.trim() || agentState?.instruction || prompt;
    const hasSelectedElementPayload = Boolean(activeSelection.drawgleId && activeSelection.targetType);
    const routerTargetsNavigation = routerDecision.targetType === "navigation" || routerDecision.scope === "navigation";
    const selectedElementRequested = routerSelectedElementUsed;
    const requestTargetsNavigation =
      routerTargetsNavigation ||
      (activeSelection.targetType === "navigation" && selectedElementRequested);
    const selectedImageUrl = extractSingleImageUrl(prompt);
    const selectedImageTargets = normalizeImageTargetsFromPayload({
      payloadTargets: payload.selectedElementImageTargets as DrawgleImageTargetMeta[],
      selectedHtml: activeSelection.outerHTML,
      drawgleId: activeSelection.drawgleId,
    });
    const shouldRunDeterministicImageReplacement =
      Boolean(selectedImageUrl) &&
      imageReplacementIntentPattern.test(prompt) &&
      selectedElementRequested &&
      hasSelectedElementPayload &&
      activeSelection.targetType !== "navigation";

    if (shouldRunDeterministicImageReplacement) {
      const targetScreenId = selectedScreenId;
      const targetScreen = targetScreenId ? screenContext.find((screen: any) => screen.id === targetScreenId) ?? null : null;
      const targetsToReplace = pickImageTargetsForPrompt(selectedImageTargets, prompt);

      if (!targetScreenId || !targetScreen) {
        return saveClarification({
          message: whiteLabelAgentMessage(prompt, "I can replace that image, but I lost which screen it belongs to. Please reselect the image or placeholder and try again."),
          instruction: resolvedInstruction,
          missingFields: ["screen"],
          metadata: {
            serverReconciliation: {
              finalAction: "ask_clarification",
              reason: "image_replacement_screen_missing",
            },
          },
        });
      }

      if (targetsToReplace.length === 0) {
        return saveClarification({
          message: whiteLabelAgentMessage(prompt, "The selected element does not expose an image, background image, SVG placeholder, or visual placeholder I can replace yet. Select the visual object or its card and try again."),
          instruction: resolvedInstruction,
          missingFields: ["selected_image_target"],
          lastKnownTarget: {
            targetType: "selected_element",
            scope: "selected_element",
            screenId: targetScreenId,
            screenName: targetScreen.name,
            selectedElementDrawgleId: activeSelectionDrawgleId,
          },
          metadata: {
            serverReconciliation: {
              finalAction: "ask_clarification",
              reason: "selected_image_target_missing",
            },
          },
        });
      }

      const verification = await verifySelectedElementSource({
        admin,
        projectId: payload.projectId,
        screenId: targetScreenId,
        targetType: "screen",
        drawgleId: activeSelectionDrawgleId,
      });

      if (!verification.ok) {
        return saveClarification({
          message: whiteLabelAgentMessage(prompt, verification.message),
          instruction: resolvedInstruction,
          missingFields: ["selected_element"],
          lastKnownTarget: {
            targetType: "selected_element",
            scope: "selected_element",
            screenId: targetScreenId,
            screenName: targetScreen.name,
            selectedElementDrawgleId: activeSelectionDrawgleId,
          },
          status: 409,
          metadata: {
            serverReconciliation: {
              finalAction: "ask_clarification",
              reason: verification.reason,
            },
          },
        });
      }

      const targetLabel = targetScreen.name ? `selected visual in ${targetScreen.name}` : "selected visual";
      await updateAgentProgress({
        step: buildAgentProgressStep({
          title: "Replacing selected image",
          detail: `Importing the image and updating ${targetLabel}.`,
          targetLabel,
          processLines: [...progressLines(), "Detected a direct image replacement request.", "Importing the supplied image URL into this project."],
        }),
        metadata: {
          action: "deterministic_image_replacement",
          imageReplacement: {
            targetCount: targetsToReplace.length,
            targetKinds: targetsToReplace.map((target) => target.kind),
          },
        },
      });

      const storedImage = await storeUserImageAssetFromRemoteUrl({
        admin,
        ownerId: user.id,
        projectId: payload.projectId,
        screenId: targetScreenId,
        targetKind: targetsToReplace[0]?.kind ?? "img",
        targetDrawgleId: activeSelectionDrawgleId,
        imageUrl: selectedImageUrl!,
      });

      const operations: DeterministicEditOperation[] = targetsToReplace.map((target) => ({
        type: "replaceImage",
        drawgleId: target.drawgleId,
        mode: modeForImageTarget(target.kind),
        src: storedImage.url,
        alt: target.alt || target.label || "Replacement image",
        targetIndex: target.targetIndex ?? null,
      }));

      const { data: screen, error: screenError } = await admin
        .from("screens")
        .select("id, name, code")
        .eq("id", targetScreenId)
        .eq("project_id", payload.projectId)
        .maybeSingle();

      if (screenError || !screen) {
        throw screenError ?? new Error("Screen not found for image replacement.");
      }

      const currentCode = ensureDrawgleIds(screen.code ?? "").code;
      const editedCode = applyDeterministicEdits({
        code: currentCode,
        drawgleId: activeSelectionDrawgleId ?? "",
        operations,
      });
      const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;
      const changed = nextCode !== currentCode;

      await admin
        .from("screens")
        .update({
          code: nextCode,
          block_index: indexScreenCode(nextCode) as never,
          status: "ready",
          error: null,
          updated_at: now(),
        })
        .eq("id", screen.id);

      const completionContent = changed
        ? `Done - Replaced ${targetsToReplace.length === 1 ? "the selected image" : `${targetsToReplace.length} selected image placeholders`} in ${screen.name}. What do you think?`
        : `I imported the image, but ${screen.name} already matched the selected image replacement.`;

      await updateAgentProgress({
        step: buildAgentProgressStep({
          status: changed ? "completed" : "failed",
          title: changed ? "Image replaced" : "No image change needed",
          detail: completionContent,
          targetLabel,
          processLines: [
            ...progressLines(),
            "Saved the image into project storage.",
            changed ? "Updated the selected visual target." : "No material source change was needed.",
          ],
        }),
        metadata: {
          action: "deterministic_image_replacement",
          imageReplacement: {
            storedImageId: storedImage.id,
            targetCount: targetsToReplace.length,
            targetKinds: targetsToReplace.map((target) => target.kind),
          },
          editJob: {
            status: "completed",
            targetType: "screen",
            screenId: targetScreenId,
            drawgleId: activeSelectionDrawgleId,
          },
        },
        messageType: changed ? "chat" : "error",
      });

      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: targetScreenId,
        role: "model",
        content: completionContent,
        messageType: changed ? "edit_applied" : "chat",
        metadata: {
          action: "deterministic_image_replacement_applied",
          ui: { variant: "action_card" },
          userMessageId: userMessage.id,
          screenName: screen.name,
          imageReplacement: {
            storedImageId: storedImage.id,
            targetCount: targetsToReplace.length,
            targetKinds: targetsToReplace.map((target) => target.kind),
          },
          agentState: makeAgentState({
            kind: "last_actionable_request",
            instruction: resolvedInstruction,
            missingFields: null,
            targetCandidates: null,
            lastKnownTarget: {
              targetType: "selected_element",
              scope: "selected_element",
              screenId: targetScreenId,
              screenName: screen.name,
              selectedElementDrawgleId: activeSelectionDrawgleId,
            },
            message: null,
          }),
        },
      });

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent: completionContent,
      }).catch((error) => {
        console.error("Failed to persist deterministic image replacement memory", error);
      });

      return NextResponse.json({
        intent: "modify_screen",
        deterministic: true,
        targetType: "screen",
        screenId: targetScreenId,
      });
    }

    if (routerDecision.targetType === "project") {
      const message = whiteLabelAgentMessage(
        prompt,
        "That sounds like a project-wide change. In this version, choose a specific screen or use the Design System tokens for global visual changes.",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["supported_scope"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "project_scope_not_supported",
          },
        },
      });
    }

    if (routerDecision.scope === "new_screen") {
      const message = whiteLabelAgentMessage(
        prompt,
        "Do you want me to create this as a new screen, or modify one of the existing screens?",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["action"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "modify_action_with_new_screen_scope",
          },
        },
      });
    }

    if (routerDecision.targetType === "none" && routerDecision.scope === "none") {
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.clarificationQuestion ||
          "I can help, but I need to know whether you want to edit a selected element, a screen, or the navigation.",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["target", "scope"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "modify_action_missing_target_and_scope",
          },
        },
      });
    }

    if (selectedElementRequested && !activeSelectionDrawgleId) {
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.clarificationQuestion || "I can make that selected-element change, but no element is currently selected. Which element should I update?",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["selected_element"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "selected_element_missing",
          },
        },
      });
    }

    if (
      selectedElementRequested &&
      routerDecision.selectedElementDrawgleId &&
      activeSelectionDrawgleId &&
      routerDecision.selectedElementDrawgleId !== activeSelectionDrawgleId
    ) {
      const message = whiteLabelAgentMessage(
        prompt,
        "The selected element changed while I was reading that request. Please reselect the exact element and try again.",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["selected_element"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        status: 409,
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "selected_element_router_client_mismatch",
            routerSelectedElementDrawgleId: routerDecision.selectedElementDrawgleId,
            activeSelectionDrawgleId,
          },
        },
      });
    }

    const routerScreenId = routerDecision.targetScreenId ?? null;
    const routerScreenExists = routerScreenId
      ? screenContext.some((screen: any) => screen.id === routerScreenId)
      : false;

    if (routerScreenId && !routerScreenExists) {
      const message = whiteLabelAgentMessage(
        prompt,
        "I could not find that screen in this project. Which screen should I update?",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["screen"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "target_screen_id_not_found",
            targetScreenId: routerScreenId,
          },
        },
      });
    }

    const stateScreenId = agentState?.lastKnownTarget?.screenId && screenContext.some((screen: any) => screen.id === agentState.lastKnownTarget?.screenId)
      ? agentState.lastKnownTarget.screenId
      : null;
    const targetScreenId = requestTargetsNavigation
      ? null
      : routerScreenId || selectedScreenId || stateScreenId;
    const targetScreen = targetScreenId ? screenContext.find((screen: any) => screen.id === targetScreenId) : null;

    if (!requestTargetsNavigation && !targetScreenId) {
      const message = whiteLabelAgentMessage(
        prompt,
        routerDecision.clarificationQuestion ||
          `I can make that change: "${resolvedInstruction.slice(0, 160)}". Which screen should I update?`,
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["screen"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "screen_target_missing",
          },
        },
      });
    }

    const resolvedScope: AgentScope = requestTargetsNavigation
      ? "navigation"
      : selectedElementRequested
        ? "selected_element"
        : routerDecision.scope === "screen_region" || routerDecision.scope === "whole_screen"
          ? routerDecision.scope
          : "screen_region";
    const shouldUseSelectedElement = resolvedScope === "selected_element";
    const editOperation: AgentEditOperation = routerDecision.editOperation ?? "none";
    const editStrategy = requestTargetsNavigation
      ? "navigation_replace"
      : shouldUseSelectedElement
        ? "selected_element_region_replace"
        : resolvedScope === "whole_screen" || editOperation === "rewrite_screen"
          ? "screen_root_region_replace"
          : resolvedScope === "screen_region" || editOperation === "append_content" || editOperation === "replace_region" || editOperation === "restyle_region"
            ? "block_region_replace"
          : "legacy_patch_then_region_replace";
    const executionRouterMetadata = {
      agentRouter: {
        ...routerMetadata.agentRouter,
        targetScreenId,
        targetType: requestTargetsNavigation ? "navigation" : shouldUseSelectedElement ? "selected_element" : "screen",
        targetScope: resolvedScope,
        scope: resolvedScope,
        selectedElementDrawgleId: shouldUseSelectedElement ? activeSelectionDrawgleId : null,
        editOperation,
      },
      serverReconciliation: {
        finalAction: "modify_ui",
        finalTargetType: requestTargetsNavigation ? "navigation" : shouldUseSelectedElement ? "selected_element" : "screen",
        finalScope: resolvedScope,
        selectedScreenId,
        focusedScreenId: payload.focusedScreenId ?? null,
        targetScreenId,
        selectedElementDrawgleId: shouldUseSelectedElement ? activeSelectionDrawgleId : null,
        activeSelection: hasActiveSelection ? activeSelection : null,
        filledTargetScreenFromSelection: !routerScreenId && Boolean(selectedScreenId && targetScreenId === selectedScreenId),
        filledTargetScreenFromAgentState: !routerScreenId && !selectedScreenId && Boolean(stateScreenId && targetScreenId === stateScreenId),
      },
      editStrategy,
      editOperation,
    };
    const executionRouterDecision: AgentRouterDecision = {
      ...routerDecision,
      targetScreenId,
      targetType: executionRouterMetadata.agentRouter.targetType as AgentTargetType,
      scope: resolvedScope,
      selectedElementDrawgleId: executionRouterMetadata.agentRouter.selectedElementDrawgleId,
      editOperation,
    };
    let verifiedSelectedElementHtml = shouldUseSelectedElement
      ? activeSelection.outerHTML ?? null
      : null;


    if (shouldUseSelectedElement) {
      const verification = await verifySelectedElementSource({
        admin,
        projectId: payload.projectId,
        screenId: targetScreenId,
        targetType: requestTargetsNavigation ? "navigation" : "screen",
        drawgleId: activeSelectionDrawgleId,
      });

      if (!verification.ok) {
        return saveClarification({
          message: whiteLabelAgentMessage(prompt, verification.message),
          instruction: resolvedInstruction,
          missingFields: ["selected_element"],
          lastKnownTarget: {
            targetType: requestTargetsNavigation ? "navigation" : "selected_element",
            scope: requestTargetsNavigation ? "navigation" : "selected_element",
            screenId: targetScreenId,
            screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
            selectedElementDrawgleId: activeSelectionDrawgleId,
          },
          status: 409,
          metadata: {
            serverReconciliation: {
              ...executionRouterMetadata.serverReconciliation,
              finalAction: "ask_clarification",
              reason: verification.reason,
            },
            editStrategy,
            editOperation,
          },
        });
      }

      verifiedSelectedElementHtml = verification.html;
    }

    const deterministicStyleIntent = shouldUseSelectedElement
      ? classifyDeterministicTokenStyleIntent({
          prompt: resolvedInstruction,
          designTokens,
        })
      : null;

    if (deterministicStyleIntent && activeSelectionDrawgleId) {
      const deterministicTargetLabel = targetLabelFromContext({
        requestTargetsNavigation,
        shouldUseSelectedElement,
        targetScreenName: targetScreen?.name ?? null,
      });

      await updateAgentProgress({
        step: buildAgentProgressStep({
          title: "Applying selected edit",
          detail: `Updating ${deterministicTargetLabel} with project tokens.`,
          targetLabel: deterministicTargetLabel,
          processLines: [...progressLines(), "Matched the request to deterministic token edits."],
        }),
        metadata: {
          ...executionRouterMetadata,
          deterministicStyleEdit: {
            kind: deterministicStyleIntent.kind,
            tokenPaths: deterministicStyleIntent.tokenPaths,
            operationCount: deterministicStyleIntent.operations.length,
          },
        },
      });

      const preActionMessage = await insertPreActionMessage({
        admin,
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: targetScreenId,
        prompt,
        routerDecision: executionRouterDecision,
        routerMetadata: executionRouterMetadata,
        targetLabel: deterministicTargetLabel,
      });

      let changed = false;
      let modelContent = "";
      let screenName = targetScreen?.name ?? null;

      if (requestTargetsNavigation) {
        const { data: navigation, error: navigationError } = await admin
          .from("project_navigation")
          .select("id, shell_code")
          .eq("project_id", payload.projectId)
          .maybeSingle();

        if (navigationError || !navigation) {
          throw navigationError ?? new Error("Shared navigation not found.");
        }

        const currentCode = ensureDrawgleIds(navigation.shell_code ?? "", "dg-nav").code;
        const editedCode = applyDeterministicEdits({
          code: currentCode,
          drawgleId: activeSelectionDrawgleId,
          operations: deterministicStyleIntent.operations,
          prefix: "dg-nav",
        });
        const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;
        changed = nextCode !== currentCode;
        modelContent = changed
          ? "Updated selected navigation element with project tokens."
          : "No material token style changes were applied to Navigation.";

        if (changed) {
          await admin
            .from("project_navigation")
            .update({
              shell_code: nextCode,
              block_index: indexScreenCode(nextCode) as never,
              status: "ready",
              error: null,
              updated_at: now(),
            })
            .eq("id", navigation.id);
        }
      } else {
        if (!targetScreenId) {
          throw new Error("No screen target was provided for the token style edit.");
        }

        const { data: screen, error: screenError } = await admin
          .from("screens")
          .select("id, name, code")
          .eq("id", targetScreenId)
          .eq("project_id", payload.projectId)
          .maybeSingle();

        if (screenError || !screen) {
          throw screenError ?? new Error("Screen not found for token style edit.");
        }

        screenName = screen.name;
        const currentCode = ensureDrawgleIds(screen.code ?? "").code;
        const editedCode = applyDeterministicEdits({
          code: currentCode,
          drawgleId: activeSelectionDrawgleId,
          operations: deterministicStyleIntent.operations,
        });
        const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;
        changed = nextCode !== currentCode;
        modelContent = changed
          ? `Updated selected element in ${screen.name} with project tokens.`
          : `No material token style changes were applied to ${screen.name}.`;

        if (changed) {
          await admin
            .from("screens")
            .update({
              code: nextCode,
              block_index: indexScreenCode(nextCode) as never,
              status: "ready",
              error: null,
              updated_at: now(),
            })
            .eq("id", screen.id);
        }
      }
      if (changed) {
        const lastKnownTarget: AgentStateTarget = {
          targetType: requestTargetsNavigation ? "navigation" : "selected_element",
          scope: requestTargetsNavigation ? "navigation" : "selected_element",
          screenId: targetScreenId,
          screenName,
          selectedElementDrawgleId: activeSelectionDrawgleId,
        };
        await updateAgentProgress({
          step: buildAgentProgressStep({
            status: "completed",
            title: "Edit applied",
            detail: modelContent,
            targetLabel: deterministicTargetLabel,
            processLines: [
              ...progressLines(),
              "Saved the updated target.",
            ],
          }),
          metadata: executionRouterMetadata,
          messageType: "chat",
        });
        const modelMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: targetScreenId,
          role: "model",
          content: modelContent,
          messageType: "edit_applied",
          metadata: {
            ...executionRouterMetadata,
            ui: { variant: "action_card" },
            action: "deterministic_token_style_applied",
            screenName: requestTargetsNavigation ? "Navigation" : screenName,
            userMessageId: userMessage.id,
            deterministicStyleEdit: {
              kind: deterministicStyleIntent.kind,
              tokenPaths: deterministicStyleIntent.tokenPaths,
              operationCount: deterministicStyleIntent.operations.length,
              reason: deterministicStyleIntent.reason,
            },
            editJob: {
              status: "completed",
              targetType: requestTargetsNavigation ? "navigation" : "screen",
              screenId: targetScreenId,
              drawgleId: activeSelectionDrawgleId,
            },
            agentStep: buildQueuedAgentStep({
              kind: requestTargetsNavigation ? "navigation" : "edit",
              status: "completed",
              title: `Updated ${deterministicTargetLabel}`,
              detail: modelContent,
              targetLabel: deterministicTargetLabel,
              processLines: [
                "Matched your request to deterministic project-token edits.",
                "Saved the updated target.",
              ],
            }),
            agentState: makeAgentState({
              kind: "last_actionable_request",
              instruction: resolvedInstruction,
              missingFields: null,
              targetCandidates: null,
              lastKnownTarget,
              message: null,
            }),
          },
        });

        const completionContent = `Done - I updated ${deterministicTargetLabel}. What do you think?`;
        const completionMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: targetScreenId,
          role: "model",
          content: completionContent,
          messageType: "chat",
          metadata: {
            ...executionRouterMetadata,
            ui: { variant: "chat" },
            action: "edit_completion",
            userMessageId: userMessage.id,
            completionForMessageId: modelMessage.id,
            screenName: requestTargetsNavigation ? "Navigation" : screenName,
          },
        });

        await persistProjectMessageMemoryPair({
          admin,
          userMessageId: userMessage.id,
          userContent: prompt || "[image]",
          modelMessageId: preActionMessage?.id ?? completionMessage.id,
          modelContent: preActionMessage?.content ?? completionContent,
        }).catch((error) => {
          console.error("Failed to persist deterministic token edit memory", error);
        });

        return NextResponse.json({
          intent: "modify_screen",
          deterministic: true,
          targetType: requestTargetsNavigation ? "navigation" : "screen",
          screenId: targetScreenId,
          routerDecision: executionRouterDecision,
        });
      } else {
        await updateAgentProgress({
          step: buildAgentProgressStep({
            title: "Transitioning to AI Editor",
            detail: `Direct style edits matched no tokens on ${deterministicTargetLabel}. Falling back to deep AI generation.`,
            targetLabel: deterministicTargetLabel,
            processLines: [
              ...progressLines(),
              "Deterministic style rules did not result in a state change.",
              "Transitioning style change to creative AI generation...",
            ],
          }),
          metadata: executionRouterMetadata,
        });
      }
    }

    const activityKey = `edit:${userMessage.id}`;
    const lastKnownTarget: AgentStateTarget = {
      targetType: executionRouterMetadata.agentRouter.targetType as AgentTargetType,
      scope: resolvedScope,
      screenId: targetScreenId,
      screenName: targetScreen?.name ?? null,
      selectedElementDrawgleId: shouldUseSelectedElement ? activeSelectionDrawgleId : null,
    };
    const targetLabel = targetLabelFromContext({
      requestTargetsNavigation,
      shouldUseSelectedElement,
      targetScreenName: targetScreen?.name ?? null,
    });

    await updateAgentProgress({
      step: buildAgentProgressStep({
        title: "Resolving the edit target",
        detail: `Targeting ${targetLabel}.`,
        targetLabel,
        processLines: [
          ...progressLines(),
          shouldUseSelectedElement ? "Using the selected element as the edit boundary." : "Using canvas context to choose the safest editable region.",
        ],
      }),
      metadata: executionRouterMetadata,
    });

    const preActionMessage = await insertPreActionMessage({
      admin,
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: targetScreenId,
      prompt,
      routerDecision: executionRouterDecision,
      routerMetadata: executionRouterMetadata,
      targetLabel,
    });

    const queuedMessage = await insertProjectMessage(admin, {
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: targetScreenId,
      role: "system",
      content: requestTargetsNavigation
        ? "Queued edit for shared project navigation..."
        : `Queued edit for ${targetScreen?.name ?? "selected screen"}...`,
      messageType: "chat",
      metadata: {
        ...executionRouterMetadata,
        activityKey,
        ui: { variant: "action_card" },
        action: requestTargetsNavigation ? "navigation_edit_queued" : "edit_queued",
        screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
        userMessageId: userMessage.id,
        editJob: {
          status: "queued",
          targetType: requestTargetsNavigation ? "navigation" : "screen",
          screenId: targetScreenId,
          drawgleId: shouldUseSelectedElement ? activeSelectionDrawgleId : null,
        },
        agentStep: buildQueuedAgentStep({
          kind: requestTargetsNavigation ? "navigation" : "edit",
          status: "queued",
          title: requestTargetsNavigation ? "Edit project navigation" : `Edit ${targetLabel}`,
          detail: resolvedInstruction,
          targetLabel,
          processLines: [
            "Queued the edit request.",
            shouldUseSelectedElement ? "Using the selected element as the edit boundary." : "Using canvas context to choose the safest editable region.",
          ],
        }),
        agentState: makeAgentState({
          kind: "last_actionable_request",
          instruction: resolvedInstruction,
          missingFields: null,
          targetCandidates: null,
          lastKnownTarget,
          message: null,
        }),
      },
    });

    await updateAgentProgress({
      step: buildAgentProgressStep({
        status: "queued",
        title: requestTargetsNavigation ? "Navigation edit queued" : "Edit queued",
        detail: requestTargetsNavigation
          ? "Queued the shared navigation edit."
          : `Queued the edit for ${targetScreen?.name ?? "the selected screen"}.`,
        targetLabel,
        processLines: [...progressLines(), "Queued the edit request."],
      }),
      metadata: {
        ...executionRouterMetadata,
        activityKey,
        queuedMessageId: queuedMessage.id,
      },
    });

    const handle = await tasks.trigger<typeof modifyScreenTask>(
      "modify-screen",
      {
        projectId: payload.projectId,
        ownerId: user.id,
        prompt,
        resolvedInstruction,
        userMessageId: userMessage.id,
        screenId: targetScreenId,
        selectedElementHtml: shouldUseSelectedElement ? verifiedSelectedElementHtml : null,
        selectedElementDrawgleId: shouldUseSelectedElement ? activeSelectionDrawgleId : null,
        selectedElementTarget: requestTargetsNavigation ? "navigation" : "screen",
        requestTargetsNavigation,
        targetScope: resolvedScope,
        editStrategy,
        editOperation,
        conversationContext: shouldUseSelectedElement ? null : recentMessages,
        recoveryContext: shouldUseSelectedElement ? null : agentState as Record<string, unknown> | null,
        routerDecision: executionRouterMetadata.agentRouter,
      },
      {
        concurrencyKey: `edit:${payload.projectId}:${requestTargetsNavigation ? "navigation" : targetScreenId}`,
        ttl: "10m",
      },
    );

    const { data: currentQueuedMessage } = await admin
      .from("project_messages")
      .select("metadata")
      .eq("id", queuedMessage.id)
      .maybeSingle();
    const currentQueuedMetadata = metadataRecord(currentQueuedMessage?.metadata);

    await admin
      .from("project_messages")
      .update({
        metadata: {
          ...(Object.keys(currentQueuedMetadata).length > 0 ? currentQueuedMetadata : queuedMessage.metadata),
          triggerRunId: handle.id,
        } as never,
      })
      .eq("id", queuedMessage.id);

    await updateAgentProgress({
      step: buildAgentProgressStep({
        status: "queued",
        title: requestTargetsNavigation ? "Navigation edit queued" : "Edit queued",
        detail: "The edit worker is now running in the background.",
        targetLabel,
        processLines: [...progressLines(), "Started the edit worker."],
      }),
      metadata: {
        ...executionRouterMetadata,
        activityKey,
        queuedMessageId: queuedMessage.id,
        triggerRunId: handle.id,
      },
    });

    if (preActionMessage) {
      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: preActionMessage.id,
        modelContent: preActionMessage.content,
      }).catch((error) => {
        console.error("Failed to persist edit pre-action memory", error);
      });
    } else {
      await persistProjectMessageMemory({
        admin,
        messageId: userMessage.id,
        role: "user",
        content: prompt || "[image]",
      }).catch((error) => {
        console.error("Failed to persist edit-request memory", error);
      });
    }

    return NextResponse.json(
      {
        intent: "modify_screen",
        triggerRunId: handle.id,
        targetType: requestTargetsNavigation ? "navigation" : "screen",
        screenId: targetScreenId,
        routerDecision: executionRouterDecision,
      },
      { status: 202 },
    );
  } catch (error: unknown) {
    console.error("Agent route error", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    if (markAgentTurnFailed) {
      await markAgentTurnFailed(message).catch((progressError) => {
        console.error("Failed to mark agent turn as failed", progressError);
      });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid agent request.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
