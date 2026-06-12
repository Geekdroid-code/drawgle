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
    const openRouter = new OpenRouter({
      apiKey: getOpenRouterApiKey(),
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

    const stream = await openRouter.chat.send({
      chatRequest: {
        model,
        messages,
        temperature: temperature ?? undefined,
        maxCompletionTokens: maxOutputTokens ?? undefined,
        provider: {
          allowFallbacks: getOpenRouterAllowFallbacks(),
          sort: getOpenRouterSort(),
          ...(only ? { only } : {}),
        },
        stream: true,
      },
    }, {
      timeoutMs: getOpenRouterTimeoutMs(),
    });

    for await (const chunk of stream) {
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
        yield text;
      }
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
