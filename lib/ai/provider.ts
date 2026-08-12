import "server-only";

import { createGeminiClient } from "./gemini";
import {
  getOpenRouterAllowFallbacks,
  getOpenRouterApiKey,
  getOpenRouterFallbackModels,
  getOpenRouterMaxTokens,
  getOpenRouterProviders,
  getOpenRouterScreenBuildModel,
  getOpenRouterScreenBuildReasoning,
  getOpenRouterScreenEditorReasoning,
  getOpenRouterSort,
  getOpenRouterStreamTimeouts,
  getScreenBuilderProvider,
  getScreenEditorModel,
} from "@/lib/env/server";
import { geminiPolicyForTask, type GeminiTaskType } from "./model-policy";
import {
  OpenRouterStreamError,
  streamOpenRouterChatCompletion,
  type OpenRouterChatMessage,
  type OpenRouterContentPart,
  type OpenRouterProviderPreferences,
  type OpenRouterStreamChunk,
} from "./openrouter-stream";
import type { LlmProviderEvent } from "@/lib/types";
import type { GenerateContentConfig } from "@google/genai";

export interface ScreenBuilderStreamInput {
  task: GeminiTaskType;
  contents: any;
  history?: Array<{ role: string; parts: Array<any> }>;
  configOverride?: GenerateContentConfig;
  onResponseChunk?: (chunk: any) => void;
  onProviderEvent?: (event: LlmProviderEvent) => void;
}

const normalizeOpenRouterRole = (role: string): OpenRouterChatMessage["role"] => {
  if (role === "model" || role === "assistant") {
    return "assistant";
  }

  if (role === "system") {
    return "system";
  }

  return "user";
};

const mapOpenRouterPart = (part: any): OpenRouterContentPart | null => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (!part || typeof part !== "object") {
    return null;
  }

  if (part.type === "text" && typeof part.text === "string") {
    return { type: "text", text: part.text };
  }

  if (typeof part.text === "string") {
    return { type: "text", text: part.text };
  }

  if (part.type === "image_url" && part.image_url && typeof part.image_url.url === "string") {
    return {
      type: "image_url",
      image_url: {
        url: part.image_url.url,
        ...(typeof part.image_url.detail === "string" ? { detail: part.image_url.detail } : {}),
      },
    };
  }

  const inlineData = part.inlineData;
  if (inlineData && typeof inlineData.data === "string") {
    const mimeType = typeof inlineData.mimeType === "string" && inlineData.mimeType.trim()
      ? inlineData.mimeType.trim()
      : "application/octet-stream";

    return {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${inlineData.data}`,
      },
    };
  }

  return null;
};

const openRouterContentFromParts = (
  parts: any[],
  role: OpenRouterChatMessage["role"],
): OpenRouterChatMessage["content"] => {
  const mappedParts = parts.map(mapOpenRouterPart).filter(Boolean) as OpenRouterContentPart[];

  if (role !== "user") {
    return mappedParts
      .filter((part): part is Extract<OpenRouterContentPart, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");
  }

  if (mappedParts.length === 1 && mappedParts[0].type === "text") {
    return mappedParts[0].text;
  }

  return mappedParts;
};

const latestPartsFromContents = (contents: any) => {
  if (typeof contents === "string") {
    return [{ text: contents }];
  }

  if (Array.isArray(contents)) {
    return contents;
  }

  if (contents && typeof contents === "object" && Array.isArray(contents.parts)) {
    return contents.parts;
  }

  if (contents && typeof contents === "object" && "text" in contents) {
    return [contents];
  }

  return [];
};

const hasImageContent = (content: OpenRouterChatMessage["content"]) =>
  Array.isArray(content) && content.some((part) => part.type === "image_url");

const buildOpenRouterMessages = ({
  systemInstruction,
  history,
  contents,
}: {
  systemInstruction?: string;
  history?: Array<{ role: string; parts: Array<any> }>;
  contents: any;
}) => {
  const messages: OpenRouterChatMessage[] = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  if (history && history.length > 0) {
    for (const h of history) {
      const role = normalizeOpenRouterRole(h.role);
      const content = openRouterContentFromParts(h.parts ?? [], role);
      if (typeof content === "string" ? content.trim() : content.length > 0) {
        messages.push({ role, content });
      }
    }
  }

  const latestParts = latestPartsFromContents(contents);
  if (latestParts.length > 0) {
    const content = openRouterContentFromParts(latestParts, "user");
    if (typeof content === "string" ? content.trim() : content.length > 0) {
      messages.push({ role: "user", content });
    }
  }

  return messages;
};

const openRouterProviderPreferences = (): OpenRouterProviderPreferences => {
  const allowedProviders = getOpenRouterProviders();
  const only = allowedProviders
    ? allowedProviders.split(",").map((provider) => provider.trim()).filter(Boolean)
    : undefined;
  const sort = getOpenRouterSort();

  return {
    allow_fallbacks: getOpenRouterAllowFallbacks(),
    ...(sort ? { sort } : {}),
    ...(only && only.length > 0 ? { only } : {}),
  };
};

const contentFromOpenRouterDelta = (content: unknown) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .join("");
  }

  return "";
};

const adaptOpenRouterChunk = (chunk: OpenRouterStreamChunk) => {
  const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
  const usage = chunk.usage && typeof chunk.usage === "object" ? chunk.usage : null;

  return {
    ...chunk,
    candidates: choices.map((choice: any) => ({
      finishReason: choice.finish_reason || choice.finishReason || undefined,
      content: {
        parts: [{ text: contentFromOpenRouterDelta(choice.delta?.content) }],
      },
    })),
    usageMetadata: usage ? {
      promptTokenCount: usage.prompt_tokens ?? usage.promptTokens,
      candidatesTokenCount: usage.completion_tokens ?? usage.completionTokens,
      totalTokenCount: usage.total_tokens ?? usage.totalTokens,
    } : undefined,
  };
};

const distinctModels = (primaryModel: string, fallbackModels: string[]) => {
  const seen = new Set<string>();
  const models: string[] = [];

  for (const model of [primaryModel, ...fallbackModels]) {
    const normalized = model.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      models.push(normalized);
    }
  }

  return models;
};

export async function* generateScreenBuilderContentStream({
  task,
  contents,
  history,
  configOverride = {},
  onResponseChunk,
  onProviderEvent,
}: ScreenBuilderStreamInput): AsyncGenerator<string, void, void> {
  const provider = getScreenBuilderProvider();

  if (provider === "openrouter") {
    const policy = geminiPolicyForTask(task, configOverride);
    const temperature = policy.config.temperature;
    const maxOutputTokens = policy.config.maxOutputTokens;
    const systemInstruction = typeof policy.config.systemInstruction === "string"
      ? policy.config.systemInstruction
      : undefined;

    const primaryModel = task === "selected_region_edit" ? getScreenEditorModel() : getOpenRouterScreenBuildModel();
    const models = distinctModels(primaryModel, getOpenRouterFallbackModels());
    const globalMaxTokens = getOpenRouterMaxTokens();
    const maxTokens = typeof maxOutputTokens === "number"
      ? Math.min(maxOutputTokens, globalMaxTokens)
      : globalMaxTokens;
    // A deployed DRAWGLE_OPENROUTER_MAX_TOKENS below the per-screen budget
    // silently cancels it, which is how the builder ended up truncating inside
    // normal operation. Surface it rather than letting it be invisible.
    const clampedByGlobalCeiling = typeof maxOutputTokens === "number" && maxOutputTokens > globalMaxTokens;
    const messages = buildOpenRouterMessages({ systemInstruction, history, contents });
    const providerPreferences = openRouterProviderPreferences();
    const timeouts = getOpenRouterStreamTimeouts();
    const apiKey = getOpenRouterApiKey();
    const reasoning = task === "selected_region_edit"
      ? getOpenRouterScreenEditorReasoning()
      : getOpenRouterScreenBuildReasoning();

    onProviderEvent?.({
      event: "openrouter:request_prepared",
      level: clampedByGlobalCeiling ? "warn" : "info",
      task,
      model: primaryModel,
      modelCount: models.length,
      messageCount: messages.length,
      hasImage: messages.some((message) => hasImageContent(message.content)),
      maxTokens,
      requestedMaxTokens: typeof maxOutputTokens === "number" ? maxOutputTokens : null,
      clampedByGlobalCeiling,
      temperature: temperature ?? null,
      provider: providerPreferences,
      timeouts,
    });

    let lastError: unknown;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      let emittedForAttempt = false;

      try {
        for await (const text of streamOpenRouterChatCompletion({
          apiKey,
          model,
          messages,
          task,
          attempt: index + 1,
          temperature: temperature ?? null,
          maxTokens,
          provider: providerPreferences,
          reasoning,
          timeouts,
          onEvent: onProviderEvent,
          onChunk: (chunk) => onResponseChunk?.(adaptOpenRouterChunk(chunk)),
        })) {
          emittedForAttempt = true;
          yield text;
        }

        return;
      } catch (error) {
        lastError = error;
        const canRetry = error instanceof OpenRouterStreamError
          && error.retryable
          && !error.emittedContent
          && !emittedForAttempt
          && index < models.length - 1;

        if (!canRetry) {
          throw error;
        }

        onProviderEvent?.({
          event: "openrouter:retrying_model",
          level: "warn",
          task,
          model,
          nextModel: models[index + 1],
          attempt: index + 1,
          errorCode: error.code,
          errorType: error.errorType ?? null,
          generationId: error.generationId ?? null,
          message: error.message,
        });
      }
    }

    if (lastError) {
      throw lastError;
    }

    return;
  }

  // Gemini route
  const ai = createGeminiClient();
  const policy = geminiPolicyForTask(task, configOverride);

  let resolvedContents: any = contents;
  if (history) {
    const latestParts: any[] = [];
    if (typeof contents === "string") {
      latestParts.push({ text: contents });
    } else if (Array.isArray(contents)) {
      latestParts.push(...contents);
    } else if (contents && typeof contents === "object" && "parts" in contents && Array.isArray(contents.parts)) {
      latestParts.push(...contents.parts);
    } else if (contents) {
      latestParts.push(contents);
    }

    resolvedContents = [];
    if (history && history.length > 0) {
      resolvedContents.push(...history);
    }
    resolvedContents.push({ role: "user", parts: latestParts });
  }

  const responseStream = await ai.models.generateContentStream({
    model: policy.model,
    contents: resolvedContents,
    config: policy.config,
  });

  for await (const chunk of responseStream) {
    onResponseChunk?.(chunk);
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function generateScreenBuilderContent(
  input: ScreenBuilderStreamInput
): Promise<string> {
  let text = "";
  for await (const chunk of generateScreenBuilderContentStream(input)) {
    text += chunk;
  }
  return text;
}
