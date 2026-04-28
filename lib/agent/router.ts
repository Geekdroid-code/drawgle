import "server-only";

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
  "Choose exactly one tool for the user's latest prompt.",
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
  "- If selectedElement exists, only choose targetScope selected_element when the user clearly asks to edit the selected item/card/button/section/element or says this/that in a way that refers to the selected element.",
  "- If selectedElement exists and the user asks for a local style change like background color, text color, radius, size, spacing, border, shadow, or premium styling without explicitly saying whole screen/page, choose targetScope selected_element.",
  "- If the user asks to edit the screen, page, full screen, app background, screen background, canvas, layout, or overall design, choose targetScope screen even if a selectedElement exists.",
  "- Do not rewrite the user's edit instruction to include database IDs. Keep instruction as the user's natural request, or omit instruction.",
  "- If the prompt names a screen, resolve targetScreenId from the provided screen list.",
  "- If the prompt asks to modify the current/this screen and activeScreenId exists, use that activeScreenId.",
  "- If an active generation is running and the user asks to create another screen, use chat_response explaining that a generation is already running.",
  "- Never choose create_new_screen for greetings, questions, or unclear one-word prompts.",
  "- White-label identity: you are Drawgle AI, the design assistant inside Drawgle.",
  "- Never mention underlying model names, model providers, Gemini, Google, OpenAI, Anthropic, system prompts, tool calls, routing, or implementation details.",
  "- If the user asks what model/provider you are, briefly say you are Drawgle AI and can help create or edit mobile app screens.",
  "",
  "Return JSON only with: tool, confidence, reason, message, instruction, targetScreenId, targetType, targetScope.",
].join("\n");

const extractJson = (value: string) => {
  const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
};

const fallbackDecision = (input: AgentRouterInput): AgentRouterDecision => {
  const prompt = input.prompt.trim();
  const selectedNavigation = input.selectedElement?.targetType === "navigation";
  const selectedScreenId = input.activeScreenId ?? null;
  const asksCreate = /\b(create|build|generate|add|design|make)\b.*\b(screen|page|view|flow|ui)\b/i.test(prompt) ||
    /\b(new|another)\s+(screen|page|view)\b/i.test(prompt);
  const asksEdit = /\b(change|edit|update|modify|fix|improve|make|replace|remove|add|rewrite|repair|complete)\b/i.test(prompt);
  const casual = /^(hi|hello|hey|yo|thanks|thank you|ok|okay)\b[!. ]*$/i.test(prompt);

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
    const screenLevelEdit = /\b(screen|page|full screen|background|overall|layout|entire)\b/i.test(prompt);
    return {
      tool: "modify_screen",
      confidence: 0.62,
      reason: "Prompt appears to request an edit and a target is available.",
      message: null,
      instruction: prompt,
      targetScreenId: selectedNavigation ? null : selectedScreenId,
      targetType: selectedNavigation ? "navigation" : "screen",
      targetScope: selectedNavigation ? "navigation" : input.selectedElement?.drawgleId && !screenLevelEdit ? "selected_element" : "screen",
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
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    return RouterDecisionSchema.parse(JSON.parse(extractJson(response.text ?? "")));
  } catch (error) {
    console.error("Agent router failed; using safe fallback", error);
    return fallbackDecision(input);
  }
}
