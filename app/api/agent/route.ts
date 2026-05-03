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
import { applyDeterministicEdits, ensureDrawgleIds, type DeterministicEditOperation } from "@/lib/drawgle-dom";
import { indexScreenCode } from "@/lib/generation/block-index";
import { persistProjectMessageMemory, persistProjectMessageMemoryPair } from "@/lib/generation/message-memory";
import { findRepairTarget } from "@/lib/generation/screen-repair";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchProjectMessages, insertProjectMessage } from "@/lib/supabase/queries";
import { getDrawgleTokenReferences, tokenizeStaticDrawgleHtml } from "@/lib/token-runtime";
import {
  ACTIVE_GENERATION_STATUSES,
  type DesignTokens,
  type GenerationStatus,
  type NavigationPlan,
  type ProjectCharter,
  type ProjectMessage,
  type PromptImagePayload,
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
  selectedScreenId: z.string().uuid().nullable().optional(),
  focusedScreenId: z.string().uuid().nullable().optional(),
  selectedElementHtml: z.string().nullable().optional(),
  selectedElementDrawgleId: z.string().nullable().optional(),
  selectedElementTarget: z.enum(["screen", "navigation"]).nullable().optional(),
  selectedElementPreview: z.string().nullable().optional(),
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
const LOW_CONFIDENCE_CONFLICT_THRESHOLD = 0.74;

type AgentState = AgentTurnState;
type AgentStateTarget = NonNullable<AgentTurnState["lastKnownTarget"]>;
type AgentStateCandidate = NonNullable<AgentTurnState["targetCandidates"]>[number];

const whiteLabelAgentMessage = (prompt: string, message?: string | null) => {
  const fallback = "I am Drawgle AI, your mobile app design assistant. I can help you create new screens, edit existing designs, and refine UI details on this canvas.";
  const cleanMessage = message?.trim() || fallback;

  if (identityQuestionPattern.test(prompt) || providerLeakPattern.test(cleanMessage)) {
    return fallback;
  }

  return cleanMessage;
};

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
  action === "modify_ui" ? "modify_screen" : action;

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
  return trimmed.length > 1800 ? `${trimmed.slice(0, 1800)}...` : trimmed;
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
) => {
  const screenNames = new Map(screens.map((screen) => [screen.id, screen.name]));

  return messages.slice(-12).map((message) => {
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
  if (!designTokens?.tokens || complexStyleRequestPattern.test(prompt)) {
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

    const sourceCode = ensureDrawgleIds(navigation.shell_code ?? "").code;
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
      .select("id, owner_id, design_tokens, project_charter")
      .eq("id", payload.projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [{ data: screens, error: screensError }, { data: projectNavigation }, activeGeneration, projectMessages] = await Promise.all([
      admin
        .from("screens")
        .select("id, name, status, summary, chrome_policy, navigation_item_id")
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

    const screenContext = (screens ?? []).map((screen) => {
      const chromePolicy = screen.chrome_policy &&
        typeof screen.chrome_policy === "object" &&
        !Array.isArray(screen.chrome_policy)
        ? screen.chrome_policy as { chrome?: unknown }
        : null;

      return {
        id: screen.id,
        name: screen.name,
        status: screen.status,
        summary: screen.summary,
        chrome: typeof chromePolicy?.chrome === "string" ? chromePolicy.chrome : null,
        navigationItemId: screen.navigation_item_id,
      };
    });
    const selectedScreenId = payload.selectedScreenId ?? payload.focusedScreenId ?? null;
    const navigationPlan = (projectNavigation?.plan as NavigationPlan | null) ?? null;
    const recentMessages = buildCompactRecentMessages(projectMessages, screenContext);
    const agentState = latestUsableAgentState(projectMessages);
    const routerDecision = await routeAgentPrompt({
      prompt,
      hasImage: Boolean(payload.image),
      activeScreenId: selectedScreenId,
      selectedElement: {
        targetType: payload.selectedElementTarget ?? null,
        drawgleId: payload.selectedElementDrawgleId ?? null,
        textPreview: payload.selectedElementPreview ?? null,
      },
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
    });
    const routerMetadata = makeRouterMetadata(routerDecision);

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
        targetCandidates: buildScreenTargetCandidates(screenContext, selectedScreenId, payload.selectedElementDrawgleId),
        lastKnownTarget: lastKnownTarget ?? buildDecisionTarget(routerDecision),
        message,
      });
      const messageMetadata = {
        ...routerMetadata,
        ...metadata,
        agentState: agentStateMetadata,
      };

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
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

    if (routerDecision.action === "chat_response") {
      const message = whiteLabelAgentMessage(prompt, routerDecision.responseMessage || routerDecision.clarificationQuestion);
      const chatMetadata = {
        ...routerMetadata,
        ...(routerDecision.executionIntent === "draft_plan" || routerDecision.executionIntent === "discuss"
          ? {
              agentState: makeAgentState({
                kind: "pending_clarification",
                instruction: routerDecision.instruction?.trim() || prompt,
                missingFields: ["confirmation"],
                targetCandidates: buildScreenTargetCandidates(screenContext, selectedScreenId, payload.selectedElementDrawgleId),
                lastKnownTarget: buildDecisionTarget(routerDecision),
                message,
              }),
            }
          : {}),
      };

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: chatMetadata,
      });

      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "model",
        content: message,
        messageType: "chat",
        metadata: chatMetadata,
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

    if (routerDecision.action === "create_new_screen") {
      if (routerDecision.executionIntent !== "create") {
        const message = whiteLabelAgentMessage(
          prompt,
          routerDecision.responseMessage ||
            "I can help plan that first. Tell me when you want me to build it on the canvas.",
        );

        return saveClarification({
          message,
          instruction: routerDecision.instruction?.trim() || prompt,
          missingFields: ["confirmation"],
          lastKnownTarget: buildDecisionTarget(routerDecision),
          metadata: {
            serverReconciliation: {
              finalAction: "chat_response",
              reason: "create_blocked_without_create_execution_intent",
            },
          },
        });
      }

      if (activeGeneration) {
        const message = "A screen generation is already running. Let that finish, then ask me for the next screen.";

        const userMessage = await insertProjectMessage(admin, {
          projectId: payload.projectId,
          ownerId: user.id,
          screenId: null,
          role: "user",
          content: prompt || "[image]",
          messageType: "chat",
          metadata: routerMetadata,
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
      const imagePath = await uploadPromptImage({
        admin,
        ownerId: user.id,
        image: payload.image ?? null,
      });
      const generationPrompt = routerDecision.instruction?.trim() || prompt;

      await admin
        .from("projects")
        .update({
          status: "queued",
          updated_at: now(),
        })
        .eq("id", payload.projectId);

      const { data: generationRun, error: generationRunError } = await admin
        .from("generation_runs")
        .insert({
          project_id: payload.projectId,
          owner_id: user.id,
          prompt: generationPrompt,
          image_path: imagePath,
          status: "queued",
          metadata: {
            requestedFrom: "agent-router",
            planningMode: "single-screen",
            routerDecision,
          } as never,
          created_at: now(),
          updated_at: now(),
        })
        .select("id")
        .single();

      if (generationRunError || !generationRun) {
        throw generationRunError ?? new Error("Failed to create generation run.");
      }

      const handle = await tasks.trigger<typeof generateUiFlowTask>(
        "generate-ui-flow",
        {
          generationRunId: generationRun.id,
          projectId: payload.projectId,
          ownerId: user.id,
          prompt: generationPrompt,
          imagePath,
          designTokens,
          plannedScreens: null,
          requiresBottomNav: navigationPlan?.enabled || projectCharter?.navigationArchitecture?.primaryNavigation === "bottom-tabs",
          navigationArchitecture: projectCharter?.navigationArchitecture ?? null,
          navigationPlan,
          projectCharter,
          planningMode: "single-screen",
        },
        {
          concurrencyKey: user.id,
          ttl: "30m",
        },
      );

      await admin
        .from("generation_runs")
        .update({
          trigger_run_id: handle.id,
          updated_at: now(),
        })
        .eq("id", generationRun.id);

      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: null,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: {
          ...routerMetadata,
          generationRunId: generationRun.id,
          serverReconciliation: {
            finalAction: "create_new_screen",
            finalScope: "new_screen",
          },
        },
      });

      await persistProjectMessageMemory({
        admin,
        messageId: userMessage.id,
        role: "user",
        content: prompt || "[image]",
      }).catch((error) => {
        console.error("Failed to persist create-request memory", error);
      });

      return NextResponse.json(
        {
          intent: "create_new_screen",
          generationRunId: generationRun.id,
          triggerRunId: handle.id,
          routerDecision,
        },
        { status: 202 },
      );
    }

    const designTokens = project.design_tokens
      ? normalizeDesignTokens(project.design_tokens as DesignTokens)
      : null;
    const resolvedInstruction = routerDecision.instruction?.trim() || agentState?.instruction || prompt;
    const hasSelectedElementPayload = Boolean(payload.selectedElementDrawgleId && payload.selectedElementTarget);
    const routerTargetsNavigation = routerDecision.targetType === "navigation" || routerDecision.scope === "navigation";
    const routerExplicitWholeScreen = routerDecision.scope === "whole_screen" || routerDecision.editOperation === "rewrite_screen";
    const selectedElementRequested =
      routerDecision.targetType === "selected_element" ||
      routerDecision.scope === "selected_element" ||
      (
        hasSelectedElementPayload &&
        !routerTargetsNavigation &&
        !routerExplicitWholeScreen &&
        routerDecision.targetType !== "project" &&
        routerDecision.scope !== "new_screen"
      );
    const requestTargetsNavigation =
      routerTargetsNavigation ||
      (payload.selectedElementTarget === "navigation" && selectedElementRequested);

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

    if (selectedElementRequested && !payload.selectedElementDrawgleId) {
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
      payload.selectedElementDrawgleId &&
      routerDecision.selectedElementDrawgleId !== payload.selectedElementDrawgleId
    ) {
      const message = whiteLabelAgentMessage(
        prompt,
        "I see a selected element, but the target is not clear. Please reselect the exact element you want me to change.",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["selected_element"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "selected_element_id_conflict",
            selectedElementDrawgleId: payload.selectedElementDrawgleId,
            routerSelectedElementDrawgleId: routerDecision.selectedElementDrawgleId,
          },
        },
      });
    }

    if (
      payload.selectedElementDrawgleId &&
      routerDecision.scope === "whole_screen" &&
      routerDecision.confidence < LOW_CONFIDENCE_CONFLICT_THRESHOLD
    ) {
      const message = whiteLabelAgentMessage(
        prompt,
        "Do you mean the selected element, or the whole screen?",
      );

      return saveClarification({
        message,
        instruction: resolvedInstruction,
        missingFields: ["target_scope"],
        lastKnownTarget: buildDecisionTarget(routerDecision),
        metadata: {
          serverReconciliation: {
            finalAction: "ask_clarification",
            reason: "low_confidence_selected_element_vs_whole_screen",
          },
        },
      });
    }

    const routerScreenId = routerDecision.targetScreenId ?? null;
    const routerScreenExists = routerScreenId
      ? screenContext.some((screen) => screen.id === routerScreenId)
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

    const stateScreenId = agentState?.lastKnownTarget?.screenId && screenContext.some((screen) => screen.id === agentState.lastKnownTarget?.screenId)
      ? agentState.lastKnownTarget.screenId
      : null;
    const targetScreenId = requestTargetsNavigation
      ? null
      : routerScreenId || selectedScreenId || stateScreenId;
    const targetScreen = targetScreenId ? screenContext.find((screen) => screen.id === targetScreenId) : null;

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
        selectedElementDrawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
        editOperation,
      },
      serverReconciliation: {
        finalAction: "modify_ui",
        finalTargetType: requestTargetsNavigation ? "navigation" : shouldUseSelectedElement ? "selected_element" : "screen",
        finalScope: resolvedScope,
        selectedScreenId,
        focusedScreenId: payload.focusedScreenId ?? null,
        targetScreenId,
        selectedElementDrawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
        filledTargetScreenFromSelection: !routerScreenId && Boolean(selectedScreenId && targetScreenId === selectedScreenId),
        filledTargetScreenFromAgentState: !routerScreenId && !selectedScreenId && Boolean(stateScreenId && targetScreenId === stateScreenId),
      },
      editStrategy,
      editOperation,
    };
    const executionRouterDecision = {
      ...routerDecision,
      targetScreenId,
      targetType: executionRouterMetadata.agentRouter.targetType,
      scope: resolvedScope,
      selectedElementDrawgleId: executionRouterMetadata.agentRouter.selectedElementDrawgleId,
      editOperation,
    };
    let verifiedSelectedElementHtml = shouldUseSelectedElement
      ? payload.selectedElementHtml ?? null
      : null;

    if (shouldUseSelectedElement) {
      const verification = await verifySelectedElementSource({
        admin,
        projectId: payload.projectId,
        screenId: targetScreenId,
        targetType: requestTargetsNavigation ? "navigation" : "screen",
        drawgleId: payload.selectedElementDrawgleId,
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
            selectedElementDrawgleId: payload.selectedElementDrawgleId ?? null,
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

    if (deterministicStyleIntent && payload.selectedElementDrawgleId) {
      const userMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: targetScreenId,
        role: "user",
        content: prompt || "[image]",
        messageType: "chat",
        metadata: {
          ...executionRouterMetadata,
          deterministicStyleEdit: {
            kind: deterministicStyleIntent.kind,
            tokenPaths: deterministicStyleIntent.tokenPaths,
            operationCount: deterministicStyleIntent.operations.length,
          },
        },
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

        const currentCode = ensureDrawgleIds(navigation.shell_code ?? "").code;
        const editedCode = applyDeterministicEdits({
          code: currentCode,
          drawgleId: payload.selectedElementDrawgleId,
          operations: deterministicStyleIntent.operations,
        });
        const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;
        changed = nextCode !== currentCode;
        modelContent = changed
          ? "Updated selected navigation element with project tokens."
          : "No material token style changes were applied to Navigation.";

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
          drawgleId: payload.selectedElementDrawgleId,
          operations: deterministicStyleIntent.operations,
        });
        const nextCode = tokenizeStaticDrawgleHtml(editedCode, designTokens).code;
        changed = nextCode !== currentCode;
        modelContent = changed
          ? `Updated selected element in ${screen.name} with project tokens.`
          : `No material token style changes were applied to ${screen.name}.`;

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

      const lastKnownTarget: AgentStateTarget = {
        targetType: requestTargetsNavigation ? "navigation" : "selected_element",
        scope: requestTargetsNavigation ? "navigation" : "selected_element",
        screenId: targetScreenId,
        screenName,
        selectedElementDrawgleId: payload.selectedElementDrawgleId,
      };
      const modelMessage = await insertProjectMessage(admin, {
        projectId: payload.projectId,
        ownerId: user.id,
        screenId: targetScreenId,
        role: "model",
        content: modelContent,
        messageType: changed ? "edit_applied" : "chat",
        metadata: {
          ...executionRouterMetadata,
          action: changed ? "deterministic_token_style_applied" : "deterministic_token_style_noop",
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
            drawgleId: payload.selectedElementDrawgleId,
          },
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

      await persistProjectMessageMemoryPair({
        admin,
        userMessageId: userMessage.id,
        userContent: prompt || "[image]",
        modelMessageId: modelMessage.id,
        modelContent,
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
    }

    const userMessage = await insertProjectMessage(admin, {
      projectId: payload.projectId,
      ownerId: user.id,
      screenId: targetScreenId,
      role: "user",
      content: prompt || "[image]",
      messageType: "chat",
      metadata: executionRouterMetadata,
    });
    const activityKey = `edit:${userMessage.id}`;
    const lastKnownTarget: AgentStateTarget = {
      targetType: executionRouterMetadata.agentRouter.targetType as AgentTargetType,
      scope: resolvedScope,
      screenId: targetScreenId,
      screenName: targetScreen?.name ?? null,
      selectedElementDrawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
    };
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
        action: requestTargetsNavigation ? "navigation_edit_queued" : "edit_queued",
        screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
        userMessageId: userMessage.id,
        editJob: {
          status: "queued",
          targetType: requestTargetsNavigation ? "navigation" : "screen",
          screenId: targetScreenId,
          drawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
        },
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
        selectedElementDrawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
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

    await admin
      .from("project_messages")
      .update({
        metadata: {
          ...executionRouterMetadata,
          activityKey,
          action: requestTargetsNavigation ? "navigation_edit_queued" : "edit_queued",
          screenName: requestTargetsNavigation ? "Navigation" : targetScreen?.name ?? null,
          userMessageId: userMessage.id,
          triggerRunId: handle.id,
          editJob: {
            status: "queued",
            targetType: requestTargetsNavigation ? "navigation" : "screen",
            screenId: targetScreenId,
            drawgleId: shouldUseSelectedElement ? payload.selectedElementDrawgleId ?? null : null,
          },
          agentState: makeAgentState({
            kind: "last_actionable_request",
            instruction: resolvedInstruction,
            missingFields: null,
            targetCandidates: null,
            lastKnownTarget,
            message: null,
          }),
        } as never,
      })
      .eq("id", queuedMessage.id);

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
