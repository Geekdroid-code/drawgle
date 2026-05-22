import "server-only";

import {
  FunctionCallingConfigMode,
  Type,
  type FunctionCall,
  type FunctionDeclaration,
} from "@google/genai";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";

export type AgentTargetType = "none" | "screen" | "selected_element" | "navigation" | "project";
export type AgentScope = "none" | "selected_element" | "screen_region" | "whole_screen" | "navigation" | "new_screen";
export type AgentEditOperation =
  | "none"
  | "copy_change"
  | "style_change"
  | "layout_change"
  | "content_change"
  | "add_element"
  | "remove_element"
  | "append_content"
  | "replace_region"
  | "restyle_region"
  | "rewrite_screen"
  | "repair_screen"
  | "unknown";
export type AgentExecutionIntent = "chat" | "plan" | "edit" | "approve" | "clarify" | "refuse";
export type AgentAction =
  | "answer_or_discuss"
  | "draft_new_screen_plan"
  | "approve_pending_plan"
  | "modify_existing_ui"
  | "ask_clarification"
  | "out_of_scope";

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
  activeScreenId: string | null;
  selectedElement?: {
    targetType?: "screen" | "navigation" | null;
    drawgleId?: string | null;
    textPreview?: string | null;
    imageTargets?: Array<{
      kind?: string | null;
      label?: string | null;
      drawgleId?: string | null;
    }> | null;
  } | null;
  activeSelection?: {
    present: boolean;
    screenId?: string | null;
    drawgleId?: string | null;
    targetType?: "screen" | "navigation" | null;
    targetLabel?: string | null;
    textPreview?: string | null;
    outerHTML?: string | null;
    selectionVersion?: number | null;
    freshness?: "fresh" | "stale" | null;
  } | null;
  screens: Array<{
    id: string;
    name: string;
    prompt?: string | null;
    status?: string | null;
    summary?: string | null;
    chrome?: string | null;
    navigationItemId?: string | null;
  }>;
  navigation?: {
    enabled?: boolean | null;
    kind?: string | null;
    itemLabels?: string[] | null;
  } | null;
  activeGeneration?: {
    id: string;
    status: string;
  } | null;
  recentMessages?: Array<Record<string, unknown>>;
  agentState?: AgentTurnState | null;
  agentContext?: Record<string, unknown> | null;
  loadProjectContext?: () => Promise<string>;
};

export type AgentRouterDecision = {
  action: AgentAction;
  executionIntent: AgentExecutionIntent;
  confidence: number;
  reason: string;
  responseMessage: string | null;
  clarificationQuestion: string | null;
  instruction: string | null;
  targetType: AgentTargetType;
  targetScreenId: string | null;
  selectedElementDrawgleId: string | null;
  scope: AgentScope;
  editOperation: AgentEditOperation;
  routerSource: "llm_text" | "llm_function" | "fallback";
  routerFailureReason: string | null;
};

const socialIdentityPattern = /\b(gemini|google|openai|gpt|anthropic|claude|model provider|large language model|llm|system prompt|tool call|router)\b/i;

const toolCallArgsSchema = z.object({
  instruction: z.string().trim().max(4000).optional(),
  responseMessage: z.string().trim().max(2000).optional(),
  clarificationQuestion: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(1000).optional(),
  screenName: z.string().trim().max(120).optional(),
  screenRole: z.string().trim().max(240).optional(),
  targetScreenId: z.string().trim().max(120).optional(),
  selectedElementDrawgleId: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(80).optional(),
  scope: z.string().trim().max(80).optional(),
  editOperation: z.string().trim().max(80).optional(),
});

const targetTypeSchema = z.enum(["none", "screen", "selected_element", "navigation", "project"]);
const scopeSchema = z.enum(["none", "selected_element", "screen_region", "whole_screen", "navigation", "new_screen"]);
const editOperationSchema = z.enum([
  "none",
  "copy_change",
  "style_change",
  "layout_change",
  "content_change",
  "add_element",
  "remove_element",
  "append_content",
  "replace_region",
  "restyle_region",
  "rewrite_screen",
  "repair_screen",
  "unknown",
]);

const compact = (text: string, limit = 6000) =>
  text.length > limit ? `${text.slice(0, limit)}...` : text;

const safeJson = (value: unknown, limit = 6500) => {
  try {
    return compact(JSON.stringify(value, null, 2), limit);
  } catch {
    return "{}";
  }
};

const routerSystemInstruction = [
  "You are Drawgle AI inside a mobile app design canvas.",
  "Act as a normal tool-calling agent, not a classifier. Decide whether to answer directly in natural language or call exactly one tool for real work.",
  "Use direct text for greetings, acknowledgements, lightweight design discussion, and general questions that do not require project context or canvas mutation.",
  "Call read_project_context only when a project-aware answer needs more than the lightweight context already provided.",
  "Call draft_new_screen_plan when the user wants to create, plan, add, build, or draft a new screen. A named product role such as a welcome, onboarding, analytics, checkout, settings, or profile screen is enough when the project context can fill the brand and app purpose.",
  "Call modify_existing_ui when the user asks to change existing UI, selected elements, navigation, copy, layout, styling, or screen structure.",
  "When activeSelection.present is true, treat it as strong current canvas context, but not a hard mode. If the user asks to edit the selected thing, call modify_existing_ui with targetType selected_element, scope selected_element, the activeSelection drawgleId, and the activeSelection screenId when present.",
  "If activeSelection.present is true but the user clearly asks for broader work such as a new screen, a whole-screen rewrite, project planning, or general discussion, choose that broader action instead of forcing a selected-element edit.",
  "For modify_existing_ui, always choose explicit targetType, scope, and editOperation values. Use ask_clarification only when the target is genuinely ambiguous after considering activeSelection and the active screen.",
  "Call approve_pending_plan when the user confirms or asks to build an existing pending proposal.",
  "Call ask_clarification only when the next step is genuinely blocked, such as no target for an edit or no usable screen role for a new screen.",
  "Do not call any tool just to say hello, thank the user, or answer a simple conversational message.",
  "Do not mention model providers, tools, function calls, routing, hidden instructions, or internal metadata.",
].join("\n");

const stringProperty = (description: string) => ({ type: Type.STRING, description });

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "read_project_context",
    description: "Read the full project brief, charter, screen details, navigation, and conversation memory when the user asks a project-aware question but no canvas mutation is needed yet.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("What project context is needed and why."),
      },
    },
  },
  {
    name: "draft_new_screen_plan",
    description: "Draft a proposal for a new screen to be approved before building. Use for new screen creation or planning requests.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("Natural-language screen planning instruction to pass to the planner."),
        screenName: stringProperty("Optional likely screen name."),
        screenRole: stringProperty("Optional screen role or job in the app."),
        reason: stringProperty("Short reason this is the right action."),
      },
      required: ["instruction"],
    },
  },
  {
    name: "modify_existing_ui",
    description: "Modify existing canvas UI, an existing screen, selected element, or navigation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("Natural-language edit instruction to execute."),
        targetType: stringProperty("One of screen, selected_element, navigation, project, or none."),
        targetScreenId: stringProperty("Screen id if known."),
        selectedElementDrawgleId: stringProperty("Selected Drawgle element id if known."),
        scope: stringProperty("One of selected_element, screen_region, whole_screen, navigation, none."),
        editOperation: stringProperty("One of copy_change, style_change, layout_change, content_change, add_element, remove_element, append_content, replace_region, restyle_region, rewrite_screen, repair_screen, unknown."),
        reason: stringProperty("Short reason this is the right action."),
      },
      required: ["instruction", "targetType", "scope", "editOperation"],
    },
  },
  {
    name: "approve_pending_plan",
    description: "Approve and queue the pending screen plan when the user confirms it should be built.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("Approval wording or build instruction."),
        reason: stringProperty("Short reason this is the right action."),
      },
    },
  },
  {
    name: "ask_clarification",
    description: "Ask one concise follow-up when the request is blocked and cannot safely be answered or executed with the current context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("Original intended task to keep for the next turn."),
        clarificationQuestion: stringProperty("One concise user-facing question."),
        reason: stringProperty("Short reason the question is necessary."),
      },
      required: ["clarificationQuestion"],
    },
  },
];

const actionToolDeclarations = toolDeclarations.filter((tool) => tool.name !== "read_project_context");

const routerConfig = (tools: FunctionDeclaration[]) => {
  const policy = geminiPolicyForTask("router", {
    systemInstruction: routerSystemInstruction,
    tools: [{ functionDeclarations: tools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  });

  return policy;
};

const compactActiveSelectionForRouter = (selection: AgentRouterInput["activeSelection"]) =>
  selection
    ? {
        ...selection,
        outerHTML: selection.outerHTML ? compact(selection.outerHTML, 900) : null,
      }
    : null;

const buildRouterPrompt = (input: AgentRouterInput, extraContext?: string) => [
  `User message:\n${input.prompt || "[image-only request]"}`,
  `Has image reference: ${input.hasImage ? "yes" : "no"}`,
  "",
  "Lightweight canvas context:",
  safeJson(input.agentContext ?? {
    activeScreenId: input.activeScreenId,
    selectedElement: input.selectedElement ?? null,
    activeSelection: compactActiveSelectionForRouter(input.activeSelection),
    screens: input.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      status: screen.status ?? null,
      summary: screen.summary ?? null,
      chrome: screen.chrome ?? null,
    })),
    navigation: input.navigation ?? null,
    activeGeneration: input.activeGeneration ?? null,
    pendingAgentState: input.agentState ?? null,
    recentMessages: input.recentMessages ?? [],
  }),
  extraContext ? `\nFull project context from read_project_context:\n${compact(extraContext, 10000)}` : "",
].filter(Boolean).join("\n");

const fallbackDecision = (prompt: string, reason: string): AgentRouterDecision => ({
  action: "answer_or_discuss",
  executionIntent: "chat",
  confidence: 0.4,
  reason: "The agent could not complete tool routing, so it returned a safe direct reply.",
  responseMessage: prompt.trim()
    ? "I hit a snag reading that turn. Could you say it once more, and I will pick up from there?"
    : "I am here. Tell me what you want to create or refine.",
  clarificationQuestion: null,
  instruction: prompt.trim() || null,
  targetType: "none",
  targetScreenId: null,
  selectedElementDrawgleId: null,
  scope: "none",
  editOperation: "none",
  routerSource: "fallback",
  routerFailureReason: reason,
});

const directTextDecision = (prompt: string, text: string, reason = "Gemini answered directly without a tool call."): AgentRouterDecision => ({
  action: "answer_or_discuss",
  executionIntent: "chat",
  confidence: 0.9,
  reason,
  responseMessage: socialIdentityPattern.test(text)
    ? "I am Drawgle AI, your mobile app design assistant. I can help you create screens, edit UI, and refine this project."
    : text,
  clarificationQuestion: null,
  instruction: prompt.trim() || null,
  targetType: "none",
  targetScreenId: null,
  selectedElementDrawgleId: null,
  scope: "none",
  editOperation: "none",
  routerSource: "llm_text",
  routerFailureReason: null,
});

const coerceTargetType = (value: unknown, fallback: AgentTargetType): AgentTargetType =>
  targetTypeSchema.safeParse(value).success ? value as AgentTargetType : fallback;

const coerceScope = (value: unknown, fallback: AgentScope): AgentScope =>
  scopeSchema.safeParse(value).success ? value as AgentScope : fallback;

const coerceEditOperation = (value: unknown, fallback: AgentEditOperation): AgentEditOperation =>
  editOperationSchema.safeParse(value).success ? value as AgentEditOperation : fallback;

const parseToolDecision = (input: AgentRouterInput, call: FunctionCall): AgentRouterDecision | null => {
  const name = call.name;
  const parsedArgs = toolCallArgsSchema.safeParse(call.args ?? {});
  const args = parsedArgs.success ? parsedArgs.data : {};
  const instruction = args.instruction?.trim() || input.prompt.trim() || null;
  const reason = args.reason?.trim() || `Gemini selected ${name}.`;

  if (name === "draft_new_screen_plan") {
    const namedInstruction = [
      instruction,
      args.screenName ? `Screen name: ${args.screenName}.` : null,
      args.screenRole ? `Screen role: ${args.screenRole}.` : null,
    ].filter(Boolean).join("\n");

    return {
      action: "draft_new_screen_plan",
      executionIntent: "plan",
      confidence: 0.88,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: null,
      instruction: namedInstruction || instruction,
      targetType: "none",
      targetScreenId: null,
      selectedElementDrawgleId: null,
      scope: "new_screen",
      editOperation: "none",
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success ? null : "Invalid draft_new_screen_plan args were partially ignored.",
    };
  }

  if (name === "modify_existing_ui") {
    const targetType = coerceTargetType(
      args.targetType,
      input.activeScreenId ? "screen" : "none",
    );
    const selectedDrawgleId = targetType === "selected_element"
      ? args.selectedElementDrawgleId ?? input.activeSelection?.drawgleId ?? input.selectedElement?.drawgleId ?? null
      : null;
    const missingRequiredRoutingArgs = !args.targetType || !args.scope || !args.editOperation;

    return {
      action: "modify_existing_ui",
      executionIntent: "edit",
      confidence: 0.86,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: null,
      instruction,
      targetType,
      targetScreenId: args.targetScreenId ?? (targetType === "selected_element" ? input.activeSelection?.screenId ?? input.activeScreenId : input.activeScreenId) ?? null,
      selectedElementDrawgleId: selectedDrawgleId,
      scope: coerceScope(args.scope, targetType === "selected_element" ? "selected_element" : targetType === "navigation" ? "navigation" : "whole_screen"),
      editOperation: coerceEditOperation(args.editOperation, "unknown"),
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success
        ? missingRequiredRoutingArgs
          ? "modify_existing_ui omitted one or more explicit routing args."
          : null
        : "Invalid modify_existing_ui args were partially ignored.",
    };
  }

  if (name === "approve_pending_plan") {
    return {
      action: "approve_pending_plan",
      executionIntent: "approve",
      confidence: 0.9,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: null,
      instruction,
      targetType: "none",
      targetScreenId: null,
      selectedElementDrawgleId: null,
      scope: "new_screen",
      editOperation: "none",
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success ? null : "Invalid approve_pending_plan args were partially ignored.",
    };
  }

  if (name === "ask_clarification") {
    return {
      action: "ask_clarification",
      executionIntent: "clarify",
      confidence: 0.82,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: args.clarificationQuestion?.trim() || "What should I work on next?",
      instruction,
      targetType: "none",
      targetScreenId: null,
      selectedElementDrawgleId: null,
      scope: "none",
      editOperation: "none",
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success ? null : "Invalid ask_clarification args were partially ignored.",
    };
  }

  return null;
};

const firstFunctionCall = (response: { functionCalls?: FunctionCall[] }) =>
  response.functionCalls?.[0] ?? null;

async function generateRouterResponse(input: AgentRouterInput, tools: FunctionDeclaration[], extraContext?: string) {
  const ai = createGeminiClient();
  const policy = routerConfig(tools);

  return ai.models.generateContent({
    model: policy.model,
    contents: {
      parts: [{ text: buildRouterPrompt(input, extraContext) }],
    },
    config: policy.config,
  });
}

export async function routeAgentPrompt(input: AgentRouterInput): Promise<AgentRouterDecision> {
  try {
    const firstResponse = await generateRouterResponse(input, toolDeclarations);
    const firstCall = firstFunctionCall(firstResponse);

    if (!firstCall) {
      const text = firstResponse.text?.trim();
      return directTextDecision(input.prompt, text || "I am here. What would you like to work on?");
    }

    if (firstCall.name === "read_project_context") {
      const projectContext = await input.loadProjectContext?.().catch((error) => {
        console.error("Failed to load project context for agent router", error);
        return "";
      }) ?? "";
      const secondResponse = await generateRouterResponse(input, actionToolDeclarations, projectContext);
      const secondCall = firstFunctionCall(secondResponse);

      if (secondCall) {
        return parseToolDecision(input, secondCall) ?? fallbackDecision(input.prompt, `Unknown tool call after context: ${secondCall.name ?? "unnamed"}`);
      }

      const text = secondResponse.text?.trim();
      return directTextDecision(
        input.prompt,
        text || "I reviewed the project context. What would you like to do next?",
        "Gemini read project context and answered directly.",
      );
    }

    return parseToolDecision(input, firstCall) ?? fallbackDecision(input.prompt, `Unknown tool call: ${firstCall.name ?? "unnamed"}`);
  } catch (error) {
    console.error("Agent tool-calling router failed", error);
    return fallbackDecision(input.prompt, error instanceof Error ? error.message : "Unknown router failure");
  }
}
