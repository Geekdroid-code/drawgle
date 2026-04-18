import "server-only";

import { createGeminiClient } from "@/lib/ai/gemini";

export const SCREEN_EMBEDDING_DIMENSIONS = 768;

const SUMMARY_MODEL = "gemini-3-flash-preview";
const EMBEDDING_MODEL = "gemini-embedding-001";
const MAX_EMBEDDING_INPUT_CHARS = 12000;
const MAX_SCREEN_CODE_CHARS = 18000;

type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const stripHtml = (value: string) =>
  collapseWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " "),
  );

const buildFallbackSummary = (screenName: string, screenCode: string) => {
  const visibleCopy = truncate(stripHtml(screenCode), 260);

  if (!visibleCopy) {
    return `${screenName} screen with a mobile-first layout, primary actions, and supporting content for the main workflow.`;
  }

  return `${screenName} screen with a mobile-first layout, primary actions, and supporting content. Visible interface copy includes: ${visibleCopy}`;
};

export async function generateEmbedding(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
  const content = truncate(collapseWhitespace(text), MAX_EMBEDDING_INPUT_CHARS);

  if (!content) {
    throw new Error("Embedding input cannot be empty.");
  }

  const ai = createGeminiClient();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [content],
    config: {
      taskType,
      outputDimensionality: SCREEN_EMBEDDING_DIMENSIONS,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || values.length !== SCREEN_EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected a ${SCREEN_EMBEDDING_DIMENSIONS}-dimension embedding response.`);
  }

  return values;
}

export async function generateScreenSummary(screenName: string, screenCode: string): Promise<string> {
  const fallback = buildFallbackSummary(screenName, screenCode);
  const ai = createGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: SUMMARY_MODEL,
      contents: {
        parts: [
          {
            text: [
              "Summarize this generated mobile app screen for retrieval.",
              "Return exactly 2 short sentences.",
              "Focus on the screen's purpose, hierarchy, main controls, and notable UI patterns.",
              "Do not mention HTML, Tailwind, CSS classes, or implementation details.",
              `Screen name: ${screenName}`,
              `Screen code:\n${truncate(screenCode, MAX_SCREEN_CODE_CHARS)}`,
            ].join("\n\n"),
          },
        ],
      },
      config: {
        temperature: 0.1,
      },
    });

    const summary = truncate(collapseWhitespace(response.text ?? ""), 500).replace(/^['\"]+|['\"]+$/g, "");

    return summary || fallback;
  } catch (error) {
    console.error("Failed to generate screen summary", error);
    return fallback;
  }
}