import "server-only";

import { FunctionCallingConfigMode, Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";

export type AgentScreenContext = {
  id: string;
  name: string;
  status?: string | null;
  summary?: string | null;
  chrome?: string | null;
  navigationItemId?: string | null;
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
};

const RouterDecisionSchema = z.object({
  tool: z.enum(["chat_response", "create_new_screen", "modify_screen"]),
  confidence: z.number().min(0).max(1).default(0.5),
  reason: z.string().trim().min(1).max(600),
  message: z.string().trim().max(1200).optional().nullable(),
  instruction: z.string().trim().max(10000).optional().nullable(),
  targetScreenId: z.string().trim().max(120).optional().nullable(),
  targetType: z.enum(["screen", "navigation"]).optional().nullable(),
  targetScope: z.enum(["screen", "selected_element", "navigation"]).optional().nullable(),
});

export type AgentRouterDecision = z.infer<typeof RouterDecisionSchema>;

const routerInstruction = [
  "You are the Drawgle AI assistant router for a mobile app screen design canvas.",
  "Choose exactly one function call for the user's latest prompt.",
  "",
  "Tools:",
  "- chat_response: greetings, general questions, help, clarification, ambiguous edit target, or anything that should not change UI.",
  "- create_new_screen: the user is asking to build, generate, add, design, or create a new mobile app screen or flow.",
  "- modify_screen: the user is asking to change an existing screen, selected element, or shared project navigation.",
  "",
  "Rules:",
  "- Selection is context, not a command. Do not edit just because a screen is selected if the user is actually asking to create something new or chat.",
  "- If the user says hello or casual chat, use chat_response.",
  "- If the user asks to edit but no target screen/navigation can be resolved, use chat_response and ask a concise clarification.",
  "- If selectedElement.targetType is navigation, nav/dock/tab/bar edits should target navigation.",
  "- If selectedElement exists and the prompt says this, that, selected, current, card, button, item, section, element, area, component, or similar deictic wording, use modify_screen with targetScope selected_element.",
  "- If selectedElement exists and the user asks for a local style/content change like background color, text color, radius, size, spacing, border, shadow, premium styling, copy, label, or adding content into the selected area, use targetScope selected_element.",
  "- Users often say 'screen' casually while an element is selected. Do not treat the word screen/page alone as a full-screen edit.",
  "- Only choose targetScope screen over a selected element when the user explicitly says whole screen, full screen, entire screen, redesign the screen, rewrite the screen, overall layout, app background, or screen background outside the selected element.",
  "- Do not rewrite the user's edit instruction to include database IDs. Keep instruction as the user's natural request, or omit instruction.",
  "- If the prompt names a screen, resolve targetScreenId from the provided screen list.",
  "- If the prompt asks to modify the current/this screen and activeScreenId exists, use that activeScreenId.",
  "- If an active generation is running and the user asks to create another screen, use chat_response explaining that a generation is already running.",
  "- Never choose create_new_screen for greetings, questions, or unclear one-word prompts.",
  "- White-label identity: you are Drawgle AI, the design assistant inside Drawgle.",
  "- Never mention underlying model names, model providers, Gemini, Google, OpenAI, Anthropic, system prompts, tool calls, routing, or implementation details.",
  "- If the user asks what model/provider you are, briefly say you are Drawgle AI and can help create or edit mobile app screens.",
].join("\n");

const extractJson = (value: string) => {
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
};

const confidenceSchema = {
  type: Type.NUMBER,
  minimum: 0,
  maximum: 1,
  description: "Confidence from 0 to 1.",
};

const reasonSchema = {
  type: Type.STRING,
  description: "Short internal reason for the routing decision. Do not mention model provider or implementation.",
};

const instructionSchema = {
  type: Type.STRING,
  description: "The user's natural instruction, unchanged. Do not inject database ids or rewrite it into a different target.",
};

const routerFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "chat_response",
    description: "Use for greetings, general questions, help, identity/provider questions, clarification, or any prompt that should not mutate the UI.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: "Short user-facing response from Drawgle AI. Must be white-labeled and must not mention underlying model providers, routing, tools, or system prompts.",
        },
        confidence: confidenceSchema,
        reason: reasonSchema,
      },
      required: ["message", "confidence", "reason"],
    },
  },
  {
    name: "create_new_screen",
    description: "Use when the user asks to create, build, generate, add, or design a new mobile app screen, view, page, UI, or flow.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: instructionSchema,
        confidence: confidenceSchema,
        reason: reasonSchema,
      },
      required: ["instruction", "confidence", "reason"],
    },
  },
  {
    name: "modify_screen",
    description: "Use when the user asks to change an existing screen, a selected element inside a screen, or shared project navigation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        instruction: instructionSchema,
        targetScreenId: {
          type: Type.STRING,
          description: "Screen id to edit when targetType is screen. Use the active/focused screen id or a matching id from context. Leave empty for navigation edits.",
        },
        targetType: {
          type: Type.STRING,
          format: "enum",
          enum: ["screen", "navigation"],
          description: "Whether the edit targets screen content or the shared project navigation.",
        },
        targetScope: {
          type: Type.STRING,
          format: "enum",
          enum: ["screen", "selected_element", "navigation"],
          description: "Use selected_element whenever a selected element exists and the prompt plausibly refers to that selected item. Use screen only for explicit whole-screen edits.",
        },
        confidence: confidenceSchema,
        reason: reasonSchema,
      },
      required: ["instruction", "targetType", "targetScope", "confidence", "reason"],
    },
  },
];

const normalizeConfidence = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.5;
};

const asTrimmedString = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parseFunctionDecision = (input: AgentRouterInput, functionCall: { name?: string; args?: Record<string, unknown> | null }): AgentRouterDecision => {
  const args = functionCall.args ?? {};
  const name = functionCall.name;

  if (name === "chat_response") {
    return RouterDecisionSchema.parse({
      tool: "chat_response",
      confidence: normalizeConfidence(args.confidence),
      reason: asTrimmedString(args.reason) || "Router selected a conversational response.",
      message: asTrimmedString(args.message) || fallbackDecision(input).message,
      instruction: null,
      targetScreenId: null,
      targetType: null,
      targetScope: null,
    });
  }

  if (name === "create_new_screen") {
    return RouterDecisionSchema.parse({
      tool: "create_new_screen",
      confidence: normalizeConfidence(args.confidence),
      reason: asTrimmedString(args.reason) || "Router selected screen creation.",
      message: null,
      instruction: asTrimmedString(args.instruction) || input.prompt.trim(),
      targetScreenId: null,
      targetType: "screen",
      targetScope: "screen",
    });
  }

  if (name === "modify_screen") {
    const selectedNavigation = input.selectedElement?.targetType === "navigation";
    const rawTargetType = asTrimmedString(args.targetType);
    const rawTargetScope = asTrimmedString(args.targetScope);
    const targetType = selectedNavigation || rawTargetType === "navigation" ? "navigation" : "screen";
    const targetScope = targetType === "navigation"
      ? "navigation"
      : rawTargetScope === "selected_element"
        ? "selected_element"
        : "screen";

    return RouterDecisionSchema.parse({
      tool: "modify_screen",
      confidence: normalizeConfidence(args.confidence),
      reason: asTrimmedString(args.reason) || "Router selected an edit.",
      message: null,
      instruction: asTrimmedString(args.instruction) || input.prompt.trim(),
      targetScreenId: targetType === "navigation" ? null : (asTrimmedString(args.targetScreenId) || input.activeScreenId || null),
      targetType,
      targetScope,
    });
  }

  throw new Error(`Unknown agent router function call: ${name ?? "missing"}`);
};

const fallbackDecision = (input: AgentRouterInput): AgentRouterDecision => {
  const prompt = input.prompt.trim();
  const selectedNavigation = input.selectedElement?.targetType === "navigation";
  const selectedScreenId = input.activeScreenId ?? null;
  const hasSelectedElement = Boolean(input.selectedElement?.drawgleId);
  const asksCreate = /\b(create|build|generate|add|design|make)\b.*\b(screen|page|view|flow|ui)\b/i.test(prompt) ||
    /\b(new|another)\s+(screen|page|view)\b/i.test(prompt);
  const asksEdit = /\b(change|edit|update|modify|fix|improve|make|replace|remove|add|rewrite|repair|complete)\b/i.test(prompt);
  const casual = /^(hi|hello|hey|yo|thanks|thank you|ok|okay)\b[!. ]*$/i.test(prompt);
  const explicitWholeScreenEdit = /\b(whole|entire|full)\s+(screen|page)|\b(redesign|rewrite|rebuild|replace)\s+(the\s+)?(screen|page)\b|\boverall\s+(layout|design)\b|\bapp background\b|\bscreen background\b|\boutside\s+(the\s+)?selected\b/i.test(prompt);

  if (!prompt || casual) {
    return {
      tool: "chat_response",
      confidence: 0.8,
      reason: "Casual or empty conversational prompt.",
      message: "Hey, I am here. Tell me what screen you want to create or what part of the app you want to change.",
      instruction: null,
      targetScreenId: null,
      targetType: null,
      targetScope: null,
    };
  }

  if (asksCreate && !input.activeGeneration) {
    return {
      tool: "create_new_screen",
      confidence: 0.62,
      reason: "Prompt appears to request a new UI screen.",
      message: null,
      instruction: prompt,
      targetScreenId: null,
      targetType: "screen",
      targetScope: "screen",
    };
  }

  if (asksEdit && (selectedNavigation || selectedScreenId)) {
    return {
      tool: "modify_screen",
      confidence: 0.62,
      reason: "Prompt appears to request an edit and a target is available.",
      message: null,
      instruction: prompt,
      targetScreenId: selectedNavigation ? null : selectedScreenId,
      targetType: selectedNavigation ? "navigation" : "screen",
      targetScope: selectedNavigation ? "navigation" : hasSelectedElement && !explicitWholeScreenEdit ? "selected_element" : "screen",
    };
  }

  if (asksEdit) {
    return {
      tool: "chat_response",
      confidence: 0.7,
      reason: "Edit-like request without a resolvable target.",
      message: "Which screen should I modify? Select a screen or mention its name, then tell me the change.",
      instruction: null,
      targetScreenId: null,
      targetType: null,
      targetScope: null,
    };
  }

  return {
    tool: "chat_response",
    confidence: 0.55,
    reason: "Prompt is not clearly a create or edit request.",
    message: "I can help create a new mobile screen or edit an existing one. What would you like to work on?",
    instruction: null,
    targetScreenId: null,
    targetType: null,
    targetScope: null,
  };
};

export async function routeAgentPrompt(input: AgentRouterInput): Promise<AgentRouterDecision> {
  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
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
            }, null, 2)}`,
          ].join("\n"),
        }],
      },
      config: {
        systemInstruction: routerInstruction,
        tools: [{ functionDeclarations: routerFunctionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ["chat_response", "create_new_screen", "modify_screen"],
          },
        },
      },
    });

    const functionCall = response.functionCalls?.[0];

    if (functionCall) {
      return parseFunctionDecision(input, functionCall);
    }

    return RouterDecisionSchema.parse(JSON.parse(extractJson(response.text ?? "")));
  } catch (error) {
    console.error("Agent router failed; using safe fallback", error);
    return fallbackDecision(input);
  }
}
