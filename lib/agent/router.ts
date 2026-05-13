import "server-only";

import { FunctionCallingConfigMode, Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";

export type AgentScreenContext = {
  id: string;
  name: string;
  prompt?: string | null;
  status?: string | null;
  summary?: string | null;
  chrome?: string | null;
  navigationItemId?: string | null;
};

export type AgentTargetType = "none" | "screen" | "selected_element" | "navigation" | "project";
export type AgentScope = "none" | "selected_element" | "screen_region" | "whole_screen" | "navigation" | "new_screen";
export type AgentAction =
  | "answer_or_discuss"
  | "draft_new_screen_plan"
  | "approve_pending_plan"
  | "modify_existing_ui"
  | "ask_clarification"
  | "out_of_scope";
export type AgentEditOperation = "none" | "append_content" | "replace_region" | "restyle_region" | "rewrite_screen" | "repair_screen";
export type AgentExecutionIntent = "chat" | "discuss" | "draft_plan" | "create" | "approve" | "modify" | "repair" | "out_of_scope";

export type AgentTurnState = {
  kind: "pending_clarification" | "failed_edit_recovery" | "last_actionable_request";
  instruction?: string | null;
  missingFields?: string[] | null;
  targetCandidates?: Array<{
    targetType?: AgentTargetType | null;
    screenId?: string | null;
    screenName?: string | null;
    selectedElementDrawgleId?: string | null;
    label?: string | null;
  }> | null;
  lastKnownTarget?: {
    targetType?: AgentTargetType | null;
    scope?: AgentScope | null;
    screenId?: string | null;
    screenName?: string | null;
    selectedElementDrawgleId?: string | null;
  } | null;
  message?: string | null;
  expiresAt?: string | null;
};

export type AgentRouterInput = {
  prompt: string;
  hasImage: boolean;
  activeScreenId?: string | null;
  selectedElement?: {
    targetType?: "screen" | "navigation" | null;
    drawgleId?: string | null;
    textPreview?: string | null;
  } | null;
  screens: AgentScreenContext[];
  navigation?: {
    enabled: boolean;
    kind?: string | null;
    itemLabels: string[];
  } | null;
  activeGeneration?: {
    id: string;
    status: string;
  } | null;
  recentMessages?: Array<{
    role: "user" | "model" | "system";
    content: string;
    screenId?: string | null;
    screenName?: string | null;
    event?: string | null;
  }>;
  agentState?: AgentTurnState | null;
  agentContext?: Record<string, unknown> | null;
};

const AgentActionSchema = z.enum([
  "answer_or_discuss",
  "draft_new_screen_plan",
  "approve_pending_plan",
  "modify_existing_ui",
  "ask_clarification",
  "out_of_scope",
]);

const AgentExecutionIntentSchema = z.enum(["chat", "discuss", "draft_plan", "create", "approve", "modify", "repair", "out_of_scope"]);

const RouterDecisionSchema = z.object({
  action: AgentActionSchema,
  executionIntent: AgentExecutionIntentSchema.default("chat"),
  confidence: z.number().min(0).max(1).default(0.5),
  reason: z.string().trim().min(1).max(800),
  responseMessage: z.string().trim().max(1600).optional().nullable(),
  clarificationQuestion: z.string().trim().max(1600).optional().nullable(),
  instruction: z.string().trim().max(10000).optional().nullable(),
  targetType: z.enum(["none", "screen", "selected_element", "navigation", "project"]).default("none"),
  targetScreenId: z.string().trim().max(120).optional().nullable(),
  selectedElementDrawgleId: z.string().trim().max(160).optional().nullable(),
  scope: z.enum(["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"]).default("none"),
  editOperation: z.enum(["none", "append_content", "replace_region", "restyle_region", "rewrite_screen", "repair_screen"]).default("none"),
  routerSource: z.enum(["llm_function", "fallback"]).default("llm_function"),
  routerFailureReason: z.string().trim().max(800).optional().nullable(),
});

export type AgentRouterDecision = z.infer<typeof RouterDecisionSchema>;

const routerInstruction = [
  "You are Drawgle AI's decision router for a mobile app design canvas.",
  "Always call decide_drawgle_action exactly once. Do not answer the user directly.",
  "Your job is only to choose the next agent intent and target metadata. A separate responder, planner, or editor will speak/build/edit.",
  "Use the full agent context: project charter, existing screens, navigation, pending proposal, selected target, recent turns, and active jobs.",
  "Treat phrases like 'for this app', 'same app', or 'welcome screen' as meaningful when project context exists.",
  "Choose draft_new_screen_plan when the user wants a new screen, view, page, flow step, onboarding/welcome/auth/detail/etc. The planner can infer missing app details from project context.",
  "Choose ask_clarification for new-screen creation only when the user gives no screen role at all, e.g. just 'create a new screen'.",
  "Choose answer_or_discuss when the user is asking advice, brainstorming, evaluation, explanation, or a non-mutating plan.",
  "Choose modify_existing_ui only when the user asks to change an existing screen, selected element, region, or shared navigation.",
  "Selection is context, not a command. A selected screen/element should not turn discussion into an edit unless the user's wording asks to modify existing UI.",
  "Choose approve_pending_plan only for approval language when a pending screenPlanProposal exists in context.",
  "Choose out_of_scope only for substantive non-canvas requests. Greetings and thanks are answer_or_discuss.",
  "Do not invent screen ids or element ids; use ids from context only.",
  "Keep reason short and internal. responseMessage is optional diagnostic guidance, not final prose.",
].join("\n");

const confidenceSchema = {
  type: Type.NUMBER,
  minimum: 0,
  maximum: 1,
  description: "Confidence from 0 to 1 that the selected action and target are correct.",
};

const reasonSchema = {
  type: Type.STRING,
  description: "Short internal reason for the decision. Do not mention model providers or implementation details.",
};

const decisionFunctionDeclaration: FunctionDeclaration = {
  name: "decide_drawgle_action",
  description:
    "Choose the single next Drawgle agent intent for the user's latest message. Return decision metadata only; do not answer the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        format: "enum",
        enum: [
          "answer_or_discuss",
          "draft_new_screen_plan",
          "approve_pending_plan",
          "modify_existing_ui",
          "ask_clarification",
          "out_of_scope",
        ],
        description: "The next high-level agent intent.",
      },
      executionIntent: {
        type: Type.STRING,
        format: "enum",
        enum: ["chat", "discuss", "draft_plan", "create", "approve", "modify", "repair", "out_of_scope"],
        description: "The user's real execution intent.",
      },
      instruction: {
        type: Type.STRING,
        description: "The natural user instruction to execute or retain. Keep it faithful to the latest message and live context.",
      },
      targetType: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "screen", "selected_element", "navigation", "project"],
        description: "The intended target for modification, or none for new-screen creation/discussion.",
      },
      targetScreenId: {
        type: Type.STRING,
        description: "Existing screen id from context only when modifying or discussing a specific existing screen.",
      },
      selectedElementDrawgleId: {
        type: Type.STRING,
        description: "Selected element id from context only when targetType is selected_element.",
      },
      scope: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"],
        description: "Execution scope. Use new_screen only with draft_new_screen_plan.",
      },
      editOperation: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "append_content", "replace_region", "restyle_region", "rewrite_screen", "repair_screen"],
        description: "The edit shape when action is modify_existing_ui.",
      },
      responseMessage: {
        type: Type.STRING,
        description: "Optional short diagnostic guidance for the server. This is not the final user-facing answer.",
      },
      clarificationQuestion: {
        type: Type.STRING,
        description: "Short clarification question only when action is ask_clarification.",
      },
      confidence: confidenceSchema,
      reason: reasonSchema,
    },
    required: ["action", "executionIntent", "instruction", "targetType", "scope", "editOperation", "confidence", "reason"],
  },
};

const normalizeConfidence = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.5;
};

const asTrimmedString = (value: unknown) => typeof value === "string" ? value.trim() : "";

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const parseEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const text = asTrimmedString(value);
  return allowed.includes(text as T) ? text as T : fallback;
};

const parseFunctionDecision = (input: AgentRouterInput, functionCall: { name?: string; args?: Record<string, unknown> | null }): AgentRouterDecision => {
  if (functionCall.name !== "decide_drawgle_action") {
    throw new Error(`Unknown agent router function call: ${functionCall.name ?? "missing"}`);
  }

  const args = functionCall.args ?? {};
  const action = parseEnum(args.action, AgentActionSchema.options, "ask_clarification");
  const executionIntent = parseEnum(args.executionIntent, AgentExecutionIntentSchema.options, "chat");
  const targetType = parseEnum(args.targetType, ["none", "screen", "selected_element", "navigation", "project"] as const, "none");
  const scope = parseEnum(args.scope, ["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"] as const, action === "draft_new_screen_plan" ? "new_screen" : "none");
  const editOperation = parseEnum(args.editOperation, ["none", "append_content", "replace_region", "restyle_region", "rewrite_screen", "repair_screen"] as const, "none");

  return RouterDecisionSchema.parse({
    action,
    executionIntent,
    confidence: normalizeConfidence(args.confidence),
    reason: asTrimmedString(args.reason) || "Router returned a structured decision.",
    responseMessage: asTrimmedString(args.responseMessage) || null,
    clarificationQuestion: asTrimmedString(args.clarificationQuestion) || null,
    instruction: asTrimmedString(args.instruction) || input.agentState?.instruction || input.prompt.trim(),
    targetType,
    targetScreenId: asTrimmedString(args.targetScreenId) || null,
    selectedElementDrawgleId: asTrimmedString(args.selectedElementDrawgleId) || null,
    scope,
    editOperation,
    routerSource: "llm_function",
    routerFailureReason: null,
  });
};

const approvalPromptPattern = /^(yes|yeah|yep|ok|okay|sure|do it|build it|build this|approve|approved|go ahead|looks good|ship it|create it)(\s|[.!?,]|$)/i;
const explicitScreenSurfacePattern = /\b(screen|page|view)\b/i;
const bareNewScreenPattern = /^(please\s+)?(?:(create|make|build|generate|plan|draft|add)\s+)?(?:(a|an|one|another)\s+)?(?:new\s+)?(screen|page|view)(?:\s+(for|in)\s+(this|the)\s+app)?\s*(please)?$/i;
const editIntentPattern = /\b(edit|change|modify|update|replace|remove|delete|redesign|restyle|rewrite|repair|fix|make|move|resize|align|polish|improve|tighten|add)\b/i;
const discussPromptPattern = /\b(what|how|why|should|could|can|idea|ideas|suggest|recommend|plan|review|critique|explain|include|contain)\b/i;

const hasPendingProposal = (input: AgentRouterInput) =>
  Boolean(asRecord(input.agentContext).pendingProposal);

const fallbackDecision = (
  input: AgentRouterInput,
  patch: Partial<AgentRouterDecision> & Pick<AgentRouterDecision, "action" | "executionIntent" | "reason">,
): AgentRouterDecision => RouterDecisionSchema.parse({
  confidence: 0.35,
  responseMessage: null,
  clarificationQuestion: null,
  instruction: input.agentState?.instruction || input.prompt.trim(),
  targetType: "none",
  targetScreenId: null,
  selectedElementDrawgleId: null,
  scope: "none",
  editOperation: "none",
  ...patch,
  routerSource: "fallback",
  routerFailureReason: patch.routerFailureReason ?? "Router function call failed or returned invalid output.",
});

const safeFallbackDecision = (input: AgentRouterInput, failureReason?: string): AgentRouterDecision => {
  const text = input.prompt.trim();

  if (hasPendingProposal(input) && approvalPromptPattern.test(text)) {
    return fallbackDecision(input, {
      action: "approve_pending_plan",
      executionIntent: "approve",
      reason: "Fallback detected approval for a pending screen plan.",
      routerFailureReason: failureReason,
    });
  }

  if (input.hasImage) {
    return fallbackDecision(input, {
      action: "draft_new_screen_plan",
      executionIntent: "create",
      scope: "new_screen",
      reason: "Fallback treated an image-backed request as new-screen planning.",
      routerFailureReason: failureReason,
    });
  }

  if (bareNewScreenPattern.test(text)) {
    return fallbackDecision(input, {
      action: "ask_clarification",
      executionIntent: "create",
      clarificationQuestion: "What kind of screen should I add to this app?",
      scope: "new_screen",
      reason: "Fallback found a bare new-screen request without a role.",
      routerFailureReason: failureReason,
    });
  }

  if (explicitScreenSurfacePattern.test(text) && /\b(create|build|generate|add|plan|draft|make)\b/i.test(text)) {
    return fallbackDecision(input, {
      action: "draft_new_screen_plan",
      executionIntent: "create",
      scope: "new_screen",
      reason: "Fallback detected a named new-screen request.",
      routerFailureReason: failureReason,
    });
  }

  if ((input.selectedElement?.drawgleId || input.activeScreenId) && editIntentPattern.test(text)) {
    return fallbackDecision(input, {
      action: "modify_existing_ui",
      executionIntent: "modify",
      targetType: input.selectedElement?.drawgleId ? "selected_element" : "screen",
      targetScreenId: input.activeScreenId ?? null,
      selectedElementDrawgleId: input.selectedElement?.drawgleId ?? null,
      scope: input.selectedElement?.drawgleId ? "selected_element" : "screen_region",
      editOperation: "replace_region",
      reason: "Fallback used the selected canvas context for an edit request.",
      routerFailureReason: failureReason,
    });
  }

  return fallbackDecision(input, {
    action: "answer_or_discuss",
    executionIntent: discussPromptPattern.test(text) ? "discuss" : "chat",
    reason: "Fallback chose a non-mutating project-aware response.",
    routerFailureReason: failureReason,
  });
};

export async function routeAgentPrompt(input: AgentRouterInput): Promise<AgentRouterDecision> {
  try {
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("router", {
      systemInstruction: routerInstruction,
      tools: [{ functionDeclarations: [decisionFunctionDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["decide_drawgle_action"],
        },
      },
    });
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: {
        parts: [{
          text: [
            `User prompt:\n${input.prompt}`,
            "",
            `Current turn:\n${JSON.stringify({
              hasImage: input.hasImage,
              activeScreenId: input.activeScreenId ?? null,
              selectedElement: input.selectedElement ?? null,
            }, null, 2)}`,
            "",
            `Agent project context:\n${JSON.stringify(input.agentContext ?? {
              screens: input.screens,
              navigation: input.navigation ?? null,
              activeGeneration: input.activeGeneration ?? null,
              agentState: input.agentState ?? null,
              recentMessages: (input.recentMessages ?? []).slice(-12),
            }, null, 2)}`,
          ].join("\n"),
        }],
      },
      config: policy.config,
    });

    const functionCall = response.functionCalls?.[0];
    if (!functionCall) {
      return safeFallbackDecision(input, "Router returned no function call.");
    }

    return parseFunctionDecision(input, functionCall);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Agent router failed; using context-aware fallback", error);
    return safeFallbackDecision(input, message);
  }
}
