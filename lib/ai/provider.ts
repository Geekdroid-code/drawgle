import "server-only";

import { createGeminiClient } from "./gemini";
import { OpenRouter } from "@openrouter/sdk";
import {
  getScreenBuilderProvider,
  getScreenBuilderModel,
  getScreenEditorModel,
  getOpenRouterApiKey,
  getOpenRouterSort,
  getOpenRouterProviders,
  getOpenRouterAllowFallbacks,
  getOpenRouterTimeoutMs,
} from "@/lib/env/server";
import { geminiPolicyForTask, type GeminiTaskType } from "./model-policy";
import type { GenerateContentConfig } from "@google/genai";

const summarizeOpenRouterError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: String(error) };
};

const messageHasImagePart = (message: any) => {
  const content = message?.content;
  return Array.isArray(content) && content.some((part) => part?.type === "image_url");
};

export interface ScreenBuilderStreamInput {
  task: GeminiTaskType;
  contents: any;
  history?: Array<{ role: string; parts: Array<any> }>;
  configOverride?: GenerateContentConfig;
  onResponseChunk?: (chunk: any) => void;
}

export async function* generateScreenBuilderContentStream({
  task,
  contents,
  history,
  configOverride = {},
  onResponseChunk,
}: ScreenBuilderStreamInput): AsyncGenerator<string, void, void> {
  const provider = getScreenBuilderProvider();

  if (provider === "openrouter") {
    const model = task === "selected_region_edit" ? getScreenEditorModel() : getScreenBuilderModel();
    const timeoutMs = getOpenRouterTimeoutMs();
    const openRouter = new OpenRouter({
      apiKey: getOpenRouterApiKey(),
      retryConfig: { strategy: "none" },
      timeoutMs,
    });

    const policy = geminiPolicyForTask(task, configOverride);
    const temperature = policy.config.temperature;
    const maxOutputTokens = policy.config.maxOutputTokens;
    const systemInstruction = typeof policy.config.systemInstruction === "string"
      ? policy.config.systemInstruction
      : undefined;

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({
        role: "system",
        content: systemInstruction,
      });
    }

    if (history && history.length > 0) {
      for (const h of history) {
        const role = h.role === "model" ? "assistant" : h.role;
        const mappedContent = h.parts.map((p: any) => {
          if (typeof p === "string") {
            return { type: "text" as const, text: p };
          }
          if (p && typeof p === "object" && "text" in p && typeof p.text === "string") {
            return { type: "text" as const, text: p.text };
          }
          if (p && typeof p === "object" && "inlineData" in p && p.inlineData) {
            return {
              type: "image_url" as const,
              imageUrl: {
                url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
              },
            };
          }
          return null;
        }).filter(Boolean);

        messages.push({
          role,
          content: mappedContent.length === 1 && mappedContent[0]?.type === "text"
            ? (mappedContent[0] as any).text
            : mappedContent,
        });
      }
    }

    let latestParts: any[] = [];
    if (typeof contents === "string") {
      latestParts = [{ text: contents }];
    } else if (Array.isArray(contents)) {
      latestParts = contents;
    } else if (contents && typeof contents === "object" && "parts" in contents && Array.isArray(contents.parts)) {
      latestParts = contents.parts;
    } else if (contents && typeof contents === "object" && "text" in contents) {
      latestParts = [contents];
    }

    if (latestParts.length > 0) {
      const mappedContent = latestParts.map((p: any) => {
        if (typeof p === "string") {
          return { type: "text" as const, text: p };
        }
        if (p && typeof p === "object" && "text" in p && typeof p.text === "string") {
          return { type: "text" as const, text: p.text };
        }
        if (p && typeof p === "object" && "inlineData" in p && p.inlineData) {
          return {
            type: "image_url" as const,
            imageUrl: {
              url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
            },
          };
        }
        return null;
      }).filter(Boolean);

      messages.push({
        role: "user",
        content: mappedContent.length === 1 && mappedContent[0]?.type === "text"
          ? (mappedContent[0] as any).text
          : mappedContent,
      });
    }

    const allowedProviders = getOpenRouterProviders();
    const only = allowedProviders
      ? allowedProviders.split(",").map((p) => p.trim()).filter(Boolean)
      : undefined;
    const sort = getOpenRouterSort();
    const providerPreferences = {
      allowFallbacks: getOpenRouterAllowFallbacks(),
      ...(sort ? { sort } : {}),
      ...(only ? { only } : {}),
    };

    const requestStartedAt = Date.now();
    console.info("[OpenRouter] requesting chat completion", {
      task,
      model,
      messageCount: messages.length,
      hasImage: messages.some(messageHasImagePart),
      maxCompletionTokens: maxOutputTokens ?? null,
      temperature: temperature ?? null,
      provider: providerPreferences,
      timeoutMs,
    });

    let stream;
    try {
      stream = await openRouter.chat.send({
        chatRequest: {
          model,
          messages,
          temperature: temperature ?? undefined,
          maxCompletionTokens: maxOutputTokens ?? undefined,
          provider: providerPreferences,
          stream: true,
        },
      }, {
        headers: {
          "X-OpenRouter-Metadata": "enabled",
        },
        timeoutMs,
      });
    } catch (error) {
      console.error("[OpenRouter] request failed before stream opened", {
        task,
        model,
        elapsedMs: Date.now() - requestStartedAt,
        error: summarizeOpenRouterError(error),
      });
      throw error;
    }

    console.info("[OpenRouter] stream opened", {
      task,
      model,
      elapsedMs: Date.now() - requestStartedAt,
    });
    let chunkCount = 0;
    let textCharCount = 0;
    let firstTokenLogged = false;

    try {
      for await (const chunk of stream) {
        chunkCount += 1;
        const adaptedChunk = {
          ...chunk,
          candidates: chunk.choices?.map((choice) => ({
            finishReason: choice.finishReason || undefined,
            content: {
              parts: [{ text: choice.delta?.content || "" }],
            },
          })),
          usageMetadata: chunk.usage ? {
            promptTokenCount: chunk.usage.promptTokens,
            candidatesTokenCount: chunk.usage.completionTokens,
            totalTokenCount: chunk.usage.totalTokens,
          } : undefined,
        };

        onResponseChunk?.(adaptedChunk);

        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          textCharCount += text.length;
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            console.info("[OpenRouter] first token received", {
              task,
              model,
              elapsedMs: Date.now() - requestStartedAt,
            });
          }
          yield text;
        }
      }

      console.info("[OpenRouter] stream completed", {
        task,
        model,
        elapsedMs: Date.now() - requestStartedAt,
        chunkCount,
        textCharCount,
      });
    } catch (error) {
      console.error("[OpenRouter] stream failed", {
        task,
        model,
        elapsedMs: Date.now() - requestStartedAt,
        chunkCount,
        textCharCount,
        error: summarizeOpenRouterError(error),
      });
      throw error;
    }
  } else {
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
