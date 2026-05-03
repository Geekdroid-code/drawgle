import "server-only";

import { FunctionCallingConfigMode, Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";

export type AgentScreenContext = {
  id: string;
  name: string;
  status?: string | null;
  summary?: string | null;
  chrome?: string | null;
  navigationItemId?: string | null;
};

export type AgentTargetType = "none" | "screen" | "selected_element" | "navigation" | "project";
export type AgentScope = "none" | "selected_element" | "screen_region" | "whole_screen" | "navigation" | "new_screen";
export type AgentAction = "chat_response" | "ask_clarification" | "create_new_screen" | "modify_ui";
export type AgentEditOperation = "none" | "append_content" | "replace_region" | "restyle_region" | "rewrite_screen" | "repair_screen";
export type AgentExecutionIntent = "chat" | "discuss" | "draft_plan" | "create" | "modify" | "repair";

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
};

const RouterDecisionSchema = z.object({
  action: z.enum(["chat_response", "ask_clarification", "create_new_screen", "modify_ui"]),
  executionIntent: z.enum(["chat", "discuss", "draft_plan", "create", "modify", "repair"]).default("chat"),
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
});

export type AgentRouterDecision = z.infer<typeof RouterDecisionSchema>;

const routerInstruction = [
  "You are Drawgle AI's action router for a mobile app design canvas.",
  "Always call decide_drawgle_action exactly once.",
  "Use the latest prompt, exact recent messages, pending agentState, selected canvas target, screen list, navigation state, and active jobs to choose the action.",
  "Classify executionIntent separately from action: users may ask to discuss, plan, brainstorm, or evaluate UI without asking Drawgle to build anything.",
  "Use chat_response with executionIntent discuss or draft_plan for planning/brainstorming/design advice. Do not trigger creation for discussion-only requests.",
  "Use create_new_screen only when the user clearly wants Drawgle to create/build/generate/add/apply a screen now, or confirms a prior draft plan.",
  "Selection is context, not a command: only edit when the user is asking to change existing UI.",
  "For follow-up replies, resolve intent from agentState and recent messages instead of treating the prompt as a brand-new request.",
  "Do not invent screen ids or element ids; use ids from the provided context only.",
  "For identity/provider questions, answer as Drawgle AI and do not mention model providers, routing, tools, or implementation.",
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
    "Choose the single next Drawgle action for the user's latest message. Use chat_response for conversation/help/identity. Use ask_clarification when an actionable request lacks a reliable target or required detail. Use create_new_screen only for requests to build a new screen/view/flow. Use modify_ui only for edits to an existing selected element, screen region, whole screen, or shared navigation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        format: "enum",
        enum: ["chat_response", "ask_clarification", "create_new_screen", "modify_ui"],
        description: "The next high-level action Drawgle should take.",
      },
      executionIntent: {
        type: Type.STRING,
        format: "enum",
        enum: ["chat", "discuss", "draft_plan", "create", "modify", "repair"],
        description:
          "The user's real execution intent. discuss/draft_plan means explain or propose without mutating the project. create means actually build a new screen now. modify means edit existing UI. repair means fix incomplete/broken source.",
      },
      instruction: {
        type: Type.STRING,
        description:
          "The natural user instruction to execute or retain. Keep it faithful to the user and recent/pending context. Do not inject database ids into prose.",
      },
      targetType: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "screen", "selected_element", "navigation", "project"],
        description:
          "The intended target. selected_element means the currently selected canvas element. project means broad all-screen/project-level changes that v1 may need to clarify or route to design tokens.",
      },
      targetScreenId: {
        type: Type.STRING,
        description:
          "Existing screen id from context when the action targets a screen or selected element. Leave empty for navigation, project-level, chat, clarification, or new-screen actions.",
      },
      selectedElementDrawgleId: {
        type: Type.STRING,
        description:
          "The selected element id from context when targetType is selected_element. Leave empty unless the provided selectedElement.drawgleId is the intended target.",
      },
      scope: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"],
        description:
          "Execution scope. Use selected_element for local card/button/text/area edits, screen_region for one section or screen background layer, whole_screen for full-screen rewrites/redesigns, navigation for shared nav, and new_screen for creation.",
      },
      editOperation: {
        type: Type.STRING,
        format: "enum",
        enum: ["none", "append_content", "replace_region", "restyle_region", "rewrite_screen", "repair_screen"],
        description:
          "The edit shape when action is modify_ui. append_content adds siblings such as more cards/items/messages without rewriting existing sections. restyle_region changes visual styling. replace_region changes one section. rewrite_screen is an explicit full-screen rebuild. repair_screen fixes broken/incomplete source.",
      },
      responseMessage: {
        type: Type.STRING,
        description:
          "Short user-facing message for chat_response. Must be white-labeled as Drawgle AI and must not mention model providers, tool calls, routing, or internals.",
      },
      clarificationQuestion: {
        type: Type.STRING,
        description:
          "Question to ask for ask_clarification. Include the retained intent so the user can answer naturally.",
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

const parseEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const text = asTrimmedString(value);
  return allowed.includes(text as T) ? text as T : fallback;
};

const parseFunctionDecision = (input: AgentRouterInput, functionCall: { name?: string; args?: Record<string, unknown> | null }): AgentRouterDecision => {
  if (functionCall.name !== "decide_drawgle_action") {
    throw new Error(`Unknown agent router function call: ${functionCall.name ?? "missing"}`);
  }

  const args = functionCall.args ?? {};
  const action = parseEnum(args.action, ["chat_response", "ask_clarification", "create_new_screen", "modify_ui"] as const, "ask_clarification");
  const executionIntent = parseEnum(args.executionIntent, ["chat", "discuss", "draft_plan", "create", "modify", "repair"] as const, "chat");
  const targetType = parseEnum(args.targetType, ["none", "screen", "selected_element", "navigation", "project"] as const, "none");
  const scope = parseEnum(args.scope, ["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"] as const, "none");
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
  });
};

const safeFallbackDecision = (input: AgentRouterInput): AgentRouterDecision => RouterDecisionSchema.parse({
  action: "ask_clarification",
  executionIntent: "chat",
  confidence: 0.25,
  reason: "Router failed, so the app chose a non-mutating clarification fallback.",
  responseMessage: null,
  clarificationQuestion: "I can help, but I could not confidently tell whether you want to create a new screen or edit an existing one. What should I work on?",
  instruction: input.agentState?.instruction || input.prompt.trim(),
  targetType: "none",
  targetScreenId: null,
  selectedElementDrawgleId: null,
  scope: "none",
  editOperation: "none",
});

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
            `Canvas context:\n${JSON.stringify({
              hasImage: input.hasImage,
              activeScreenId: input.activeScreenId ?? null,
              selectedElement: input.selectedElement ?? null,
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
      return safeFallbackDecision(input);
    }

    return parseFunctionDecision(input, functionCall);
  } catch (error) {
    console.error("Agent router failed; using safe fallback", error);
    return safeFallbackDecision(input);
  }
}
