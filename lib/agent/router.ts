import "server-only";

import {
  createPartFromFunctionResponse,
  FunctionCallingConfigMode,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
} from "@google/genai";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import {
  projectReadToolDeclarations,
  type AgentToolTrace,
  type ProjectReadToolResult,
  type ScreenRegionReference,
} from "@/lib/agent/project-tools";

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
  | "propose_screen_state"
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
  executeReadTool?: (call: FunctionCall) => Promise<ProjectReadToolResult>;
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
  sourceReferences?: ScreenRegionReference[];
  toolTrace?: AgentToolTrace[];
  modelCallCount?: number;
  screenSuggestion?: {
    name: string | null;
    role: string | null;
  } | null;
  stateProposal?: {
    parentScreenName: string | null;
    existingRoadmapItemId: string | null;
    stateLabel: string;
    stateRole: string;
    triggerLabel: string;
    description: string;
  } | null;
};

const socialIdentityPattern = /\b(gemini|google|openai|gpt|anthropic|claude|model provider|large language model|llm|system prompt|tool call|router)\b/i;

const toolCallArgsSchema = z.object({
  instruction: z.string().trim().max(4000).optional(),
  responseMessage: z.string().trim().max(2000).optional(),
  clarificationQuestion: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(1000).optional(),
  screenName: z.string().trim().max(120).optional(),
  screenRole: z.string().trim().max(240).optional(),
  parentScreenName: z.string().trim().max(120).optional(),
  existingRoadmapItemId: z.string().trim().max(120).optional(),
  stateLabel: z.string().trim().max(120).optional(),
  stateRole: z.string().trim().max(80).optional(),
  triggerLabel: z.string().trim().max(160).optional(),
  description: z.string().trim().max(600).optional(),
  targetScreenId: z.string().trim().max(120).optional(),
  selectedElementDrawgleId: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(80).optional(),
  scope: z.string().trim().max(80).optional(),
  editOperation: z.string().trim().max(80).optional(),
  sourceReferences: z.array(z.object({
    screenId: z.string().trim().min(1).max(160),
    blockId: z.string().trim().min(1).max(160).nullable().optional(),
    purpose: z.string().trim().min(1).max(500),
  })).max(3).optional(),
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
  "Act as a project agent, not a classifier. Answer directly, inspect project data with read tools, or call one action tool for real work.",
  "Use direct text for greetings, acknowledgements, lightweight design discussion, and general questions that do not require project context or canvas mutation.",
  "Use get_project_overview for project decisions and systems, search_project to find named or described items, and inspect_screen to inspect screen structure or locate a source region.",
  "Read tools never return complete HTML. For cross-screen adaptation, inspect the source screen/region, then include its stable screenId and optional blockId in modify_existing_ui.sourceReferences.",
  "Distinguish the screen being edited from source screens being borrowed from. When another screen is selected and the user says 'from Home' or 'like Dashboard', the selected screen is the target and Home/Dashboard is a source.",
  "Call draft_new_screen_plan when the user wants to create, plan, add, build, or draft a new screen. A named product role such as a welcome, onboarding, analytics, checkout, settings, or profile screen is enough when the project context can fill the brand and app purpose.",
  "Call propose_screen_state when the user wants an interaction state, modal, sheet, popup, expanded/collapsed state, selected state, empty/loading/error/success state, or another variation of an existing parent screen. A state reuses the parent screen and must never be routed to draft_new_screen_plan.",
  "For propose_screen_state, inspect roadmap/project context when needed and identify the existing parent screen. Use an existing state roadmap item id when the requested state is already planned. If the parent is genuinely ambiguous, ask one clarification question.",
  "A state proposal is always presented for explicit button approval. Never use approve_pending_plan for a state proposal and never claim a state has started building from conversational confirmation alone.",
  "Call modify_existing_ui when the user asks to change existing UI, selected elements, navigation, copy, layout, styling, or screen structure.",
  "When activeSelection.present is true, treat it as strong current canvas context, but not a hard mode. If the user asks to edit the selected thing, call modify_existing_ui with targetType selected_element, scope selected_element, the activeSelection drawgleId, and the activeSelection screenId when present.",
  "If activeSelection.present is true but the user clearly asks for broader work such as a new screen, a whole-screen rewrite, project planning, or general discussion, choose that broader action instead of forcing a selected-element edit.",
  "For modify_existing_ui, always choose explicit targetType, scope, and editOperation values. Use ask_clarification only when the target is genuinely ambiguous after considering activeSelection and the active screen.",
  "Call approve_pending_plan when the user confirms or asks to build an existing pending proposal.",
  "Call ask_clarification only when the next step is genuinely blocked, such as no target for an edit or no usable screen role for a new screen.",
  "Before asking about a project fact, screen, source region, or earlier decision, exhaust the available read tools. Never ask the user to repeat information that project tools can retrieve.",
  "Do not call any tool just to say hello, thank the user, or answer a simple conversational message.",
  "Do not mention model providers, tools, function calls, routing, hidden instructions, or internal metadata.",
].join("\n");

const stringProperty = (description: string) => ({ type: Type.STRING, description });

const toolDeclarations: FunctionDeclaration[] = [
  ...projectReadToolDeclarations,
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
    name: "propose_screen_state",
    description: "Propose one interaction state of an existing built screen. This presents a dedicated approval card and does not build or spend credits yet.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: stringProperty("Precise edit instruction for transforming a clone of the parent into this state."),
        targetScreenId: stringProperty("Existing parent screen UUID returned by project context or read tools."),
        parentScreenName: stringProperty("Existing parent screen name."),
        existingRoadmapItemId: stringProperty("Existing planned state roadmap item UUID when one already exists."),
        stateLabel: stringProperty("Concise state name, such as Wallet Selection or Delete Confirmation."),
        stateRole: stringProperty("Semantic state role, such as modal, sheet, overlay, expanded, selected, empty, loading, error, or success."),
        triggerLabel: stringProperty("User interaction that opens the state."),
        description: stringProperty("One concise sentence describing what the state shows and why."),
        reason: stringProperty("Short reason this is a state of an existing screen rather than a new screen."),
      },
      required: ["instruction", "targetScreenId", "stateLabel", "stateRole", "triggerLabel", "description"],
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
        sourceReferences: {
          type: Type.ARRAY,
          description: "Optional inspected source regions to borrow from without editing them.",
          items: {
            type: Type.OBJECT,
            properties: {
              screenId: stringProperty("Source screen UUID returned by project tools."),
              blockId: stringProperty("Optional source block id returned by inspect_screen."),
              purpose: stringProperty("What design/content pattern should be adapted from this source."),
            },
            required: ["screenId", "purpose"],
          },
        },
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

const readToolNames = new Set(projectReadToolDeclarations.map((tool) => tool.name));
const actionToolDeclarations = toolDeclarations.filter((tool) => !readToolNames.has(tool.name));

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

const buildRouterPrompt = (input: AgentRouterInput) => [
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
].filter(Boolean).join("\n");

const fallbackDecision = (prompt: string, reason: string): AgentRouterDecision => ({
  action: "answer_or_discuss",
  executionIntent: "chat",
  confidence: 0.4,
  reason: "The agent could not complete tool routing, so it returned a safe direct reply.",
  responseMessage: prompt.trim()
    ? "I could not safely complete that turn, so I left the project unchanged. Please try the same request again."
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
  sourceReferences: [],
  toolTrace: [],
  modelCallCount: 1,
});

const directTextDecision = (
  prompt: string,
  text: string,
  reason = "Gemini answered directly without a tool call.",
  toolTrace: AgentToolTrace[] = [],
  modelCallCount = 1,
): AgentRouterDecision => ({
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
  sourceReferences: [],
  toolTrace,
  modelCallCount,
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
    return {
      action: "draft_new_screen_plan",
      executionIntent: "plan",
      confidence: 0.88,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: null,
      instruction,
      screenSuggestion: {
        name: args.screenName?.trim() || null,
        role: args.screenRole?.trim() || null,
      },
      targetType: "none",
      targetScreenId: null,
      selectedElementDrawgleId: null,
      scope: "new_screen",
      editOperation: "none",
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success ? null : "Invalid draft_new_screen_plan args were partially ignored.",
    };
  }

  if (name === "propose_screen_state") {
    const stateLabel = args.stateLabel?.trim();
    const stateRole = args.stateRole?.trim();
    const triggerLabel = args.triggerLabel?.trim();
    const description = args.description?.trim();
    const targetScreenId = args.targetScreenId?.trim() || input.activeScreenId;
    if (!instruction || !stateLabel || !stateRole || !triggerLabel || !description || !targetScreenId) {
      return {
        action: "ask_clarification",
        executionIntent: "clarify",
        confidence: 0.72,
        reason: "A screen state needs one verified parent screen and a concrete state description.",
        responseMessage: null,
        clarificationQuestion: "Which existing screen should this state belong to?",
        instruction,
        targetType: "none",
        targetScreenId: null,
        selectedElementDrawgleId: null,
        scope: "none",
        editOperation: "none",
        routerSource: "llm_function",
        routerFailureReason: "Incomplete propose_screen_state arguments.",
        stateProposal: null,
      };
    }

    return {
      action: "propose_screen_state",
      executionIntent: "plan",
      confidence: 0.92,
      reason,
      responseMessage: args.responseMessage ?? null,
      clarificationQuestion: null,
      instruction,
      targetType: "screen",
      targetScreenId,
      selectedElementDrawgleId: null,
      scope: "whole_screen",
      editOperation: "copy_change",
      routerSource: "llm_function",
      routerFailureReason: parsedArgs.success ? null : "Invalid propose_screen_state args were partially ignored.",
      stateProposal: {
        parentScreenName: args.parentScreenName?.trim() || null,
        existingRoadmapItemId: args.existingRoadmapItemId?.trim() || null,
        stateLabel,
        stateRole,
        triggerLabel,
        description,
      },
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
      sourceReferences: args.sourceReferences ?? [],
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

async function generateRouterResponse(contents: Content[], tools: FunctionDeclaration[]) {
  const ai = createGeminiClient();
  const policy = routerConfig(tools);

  return ai.models.generateContent({
    model: policy.model,
    contents,
    config: policy.config,
  });
}

export async function routeAgentPrompt(input: AgentRouterInput): Promise<AgentRouterDecision> {
  try {
    const contents: Content[] = [{ role: "user", parts: [{ text: buildRouterPrompt(input) }] }];
    const trace: AgentToolTrace[] = [];
    const supportsReadTools = Boolean(input.executeReadTool);
    let readRounds = 0;
    let modelCallCount = 0;

    while (modelCallCount < 3) {
      const availableTools = supportsReadTools && readRounds < 2 ? toolDeclarations : actionToolDeclarations;
      const response = await generateRouterResponse(contents, availableTools);
      modelCallCount += 1;
      const calls = response.functionCalls ?? [];
      const readCalls = calls.filter((call) => call.name && readToolNames.has(call.name));
      const actionCall = calls.find((call) => call.name && !readToolNames.has(call.name));

      if (readCalls.length > 0 && readRounds < 2 && input.executeReadTool) {
        readRounds += 1;
        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) contents.push(modelContent);
        const toolResults = await Promise.all(readCalls.map((call) => input.executeReadTool!(call)));
        trace.push(...toolResults.map((toolResult) => toolResult.trace));
        contents.push({
          role: "user",
          parts: readCalls.map((call, index) => createPartFromFunctionResponse(
            call.id ?? `${call.name ?? "read"}-${readRounds}-${index}`,
            call.name ?? "unknown_read_tool",
            toolResults[index].ok
              ? { ok: true, data: toolResults[index].data ?? {} }
              : { ok: false, error: toolResults[index].error ?? "Read failed." },
          )),
        });
        continue;
      }

      if (actionCall) {
        const decision = parseToolDecision(input, actionCall) ?? fallbackDecision(input.prompt, `Unknown action tool: ${actionCall.name ?? "unnamed"}`);
        return { ...decision, toolTrace: trace, modelCallCount };
      }

      const text = response.text?.trim();
      return directTextDecision(
        input.prompt,
        text || "I could not safely complete that turn. Nothing was changed. Please try again.",
        trace.length ? "The project agent inspected project data before answering." : undefined,
        trace,
        modelCallCount,
      );
    }

    return { ...fallbackDecision(input.prompt, "Agent reached the project read limit without a final action."), toolTrace: trace, modelCallCount };
  } catch (error) {
    console.error("Agent tool-calling router failed", error);
    return fallbackDecision(input.prompt, error instanceof Error ? error.message : "Unknown router failure");
  }
}
