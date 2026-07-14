import "server-only";

import { createGeminiClient } from "@/lib/ai/gemini";
import { indexScreenCode } from "@/lib/generation/block-index";
import { extractScreenStyleMemory } from "@/lib/generation/screen-style-memory";
import type { ScreenBlockIndex } from "@/lib/types";

export const SCREEN_EMBEDDING_DIMENSIONS = 768;

const EMBEDDING_MODEL = "gemini-embedding-001";
const MAX_EMBEDDING_INPUT_CHARS = 12000;

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

const summarizeBlocks = (blockIndex: ScreenBlockIndex) => blockIndex.blocks
  .filter((block) => block.id !== blockIndex.rootId)
  .slice(0, 16)
  .map((block) => {
    const preview = block.preview ? `: ${truncate(block.preview, 90)}` : "";
    return `${block.name} [${block.kind}]${preview}`;
  })
  .join("; ");

const summarizeControls = (screenCode: string) => {
  const controls = Array.from(screenCode.matchAll(/<(button|input|select|textarea|a)\b([^>]*)>(?:([\s\S]*?)<\/\1>)?/gi))
    .map((match) => {
      const attributes = match[2] ?? "";
      const accessibleLabel = attributes.match(/(?:aria-label|placeholder|title)=["']([^"']+)["']/i)?.[1];
      return collapseWhitespace(accessibleLabel || stripHtml(match[3] || "") || match[1] || "");
    })
    .filter(Boolean);
  return Array.from(new Set(controls)).slice(0, 12).join(", ");
};

export const buildScreenSummaryLocally = (
  screenName: string,
  screenCode: string,
  screenPrompt = "",
  providedBlockIndex?: ScreenBlockIndex | null,
) => {
  const blockIndex = providedBlockIndex?.blocks?.length ? providedBlockIndex : indexScreenCode(screenCode);
  const visibleCopy = truncate(stripHtml(screenCode), 480);
  const regions = truncate(summarizeBlocks(blockIndex), 720);
  const controls = truncate(summarizeControls(screenCode), 320);
  const styleMemory = extractScreenStyleMemory({ name: screenName, code: screenCode });
  return [
    `Screen: ${screenName}.`,
    screenPrompt.trim() ? `Purpose/request: ${truncate(collapseWhitespace(screenPrompt), 360)}.` : null,
    visibleCopy ? `Visible interface copy: ${visibleCopy}.` : null,
    regions ? `UI regions: ${regions}.` : null,
    controls ? `Interactive controls: ${controls}.` : null,
    styleMemory ? `Visual and token evidence: ${truncate(styleMemory, 420)}.` : null,
  ].filter(Boolean).join(" ");
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
