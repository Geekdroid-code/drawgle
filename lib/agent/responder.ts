import "server-only";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import { formatAgentContextSnapshot, type AgentContextSnapshot } from "@/lib/generation/context";

const responderInstruction = [
  "You are Drawgle AI, a project-aware assistant inside a mobile app design canvas.",
  "Answer the user's latest message naturally and concisely.",
  "Use the provided project context as live working memory: project charter, existing screens, navigation, selected target, pending proposal, and recent conversation.",
  "For design questions, give useful product-specific guidance and mention the relevant screen or next action when helpful.",
  "Do not mutate the canvas, promise that a build/edit has started, or ask generic create-vs-edit questions. The router handles actions separately.",
  "Do not mention model providers, system prompts, router decisions, function calls, or internal metadata.",
].join("\n");

const providerLeakPattern = /\b(gemini|google|openai|gpt|anthropic|claude|model provider|large language model|llm|system prompt|tool call|router)\b/i;

const compact = (text: string, limit = 7000) => text.length > limit ? `${text.slice(0, limit)}...` : text;

export async function generateAgentChatResponse({
  prompt,
  agentContext,
  fallback,
}: {
  prompt: string;
  agentContext: AgentContextSnapshot;
  fallback: string;
}) {
  try {
    const ai = createGeminiClient();
    const policy = geminiPolicyForTask("chat", {
      systemInstruction: responderInstruction,
    });
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: {
        parts: [{
          text: [
            `User message:\n${prompt}`,
            "",
            `Project context:\n${compact(formatAgentContextSnapshot(agentContext))}`,
          ].join("\n"),
        }],
      },
      config: policy.config,
    });

    const text = response.text?.trim();
    if (!text || providerLeakPattern.test(text)) {
      return fallback;
    }

    return text;
  } catch (error) {
    console.error("Agent chat responder failed", error);
    return fallback;
  }
}
