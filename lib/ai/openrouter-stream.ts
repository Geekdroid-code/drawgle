export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
};

export type OpenRouterProviderPreferences = {
  allow_fallbacks?: boolean;
  allowFallbacks?: boolean;
  sort?: string;
  only?: string[];
};

export type OpenRouterReasoningConfig = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  max_tokens?: number;
  exclude?: boolean;
  enabled?: boolean;
};

export type OpenRouterStreamTimeouts = {
  headerTimeoutMs: number;
  firstContentTimeoutMs: number;
  idleTimeoutMs: number;
  hardTimeoutMs: number;
};

export type OpenRouterStreamEvent = {
  event: string;
  level: "info" | "warn" | "error";
  task: string;
  model: string;
  attempt: number;
  elapsedMs: number;
  status?: number;
  generationId?: string | null;
  provider?: string | null;
  timeoutMs?: number;
  errorType?: string | null;
  errorCode?: string | number | null;
  retryable?: boolean;
  emittedContent?: boolean;
  chunkCount?: number;
  textCharCount?: number;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type OpenRouterStreamChunk = Record<string, any>;

export type OpenRouterStreamErrorCode =
  | "network_error"
  | "header_timeout"
  | "first_content_timeout"
  | "idle_timeout"
  | "hard_timeout"
  | "pre_stream_error"
  | "mid_stream_error"
  | "invalid_response"
  | "empty_stream";

export class OpenRouterStreamError extends Error {
  readonly code: OpenRouterStreamErrorCode;
  readonly retryable: boolean;
  readonly emittedContent: boolean;
  readonly status?: number;
  readonly errorType?: string | null;
  readonly errorCode?: string | number | null;
  readonly generationId?: string | null;
  readonly provider?: string | null;
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, options: {
    code: OpenRouterStreamErrorCode;
    retryable: boolean;
    emittedContent: boolean;
    status?: number;
    errorType?: string | null;
    errorCode?: string | number | null;
    generationId?: string | null;
    provider?: string | null;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause: options.cause });
    this.name = "OpenRouterStreamError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.emittedContent = options.emittedContent;
    this.status = options.status;
    this.errorType = options.errorType;
    this.errorCode = options.errorCode;
    this.generationId = options.generationId;
    this.provider = options.provider;
    this.metadata = options.metadata;
  }
}

export type StreamOpenRouterChatCompletionInput = {
  apiKey: string;
  model: string;
  messages: OpenRouterChatMessage[];
  task: string;
  attempt?: number;
  temperature?: number | null;
  maxTokens?: number | null;
  provider?: OpenRouterProviderPreferences | null;
  reasoning?: OpenRouterReasoningConfig | null;
  timeouts: OpenRouterStreamTimeouts;
  onEvent?: (event: OpenRouterStreamEvent) => void;
  onChunk?: (chunk: OpenRouterStreamChunk) => void;
};

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

const now = () => Date.now();

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const errorTypeFromMetadata = (metadata: unknown) =>
  isRecord(metadata) && typeof metadata.error_type === "string" ? metadata.error_type : null;

const isRetryableStatus = (status?: number) =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 524 || status === 529;

const isRetryableErrorType = (errorType?: string | null) =>
  errorType === "provider_unavailable" ||
  errorType === "provider_overloaded" ||
  errorType === "timeout" ||
  errorType === "rate_limit_exceeded" ||
  errorType === "server";

const emit = (
  input: StreamOpenRouterChatCompletionInput,
  event: Omit<OpenRouterStreamEvent, "task" | "model" | "attempt" | "elapsedMs"> & { elapsedMs?: number },
  startedAt: number,
) => {
  input.onEvent?.({
    task: input.task,
    model: input.model,
    attempt: input.attempt ?? 1,
    elapsedMs: event.elapsedMs ?? now() - startedAt,
    ...event,
  });
};

const normalizeProviderPreferences = (provider?: OpenRouterProviderPreferences | null) => {
  if (!provider) {
    return undefined;
  }

  return {
    ...(typeof provider.allow_fallbacks === "boolean" ? { allow_fallbacks: provider.allow_fallbacks } : {}),
    ...(typeof provider.allowFallbacks === "boolean" ? { allow_fallbacks: provider.allowFallbacks } : {}),
    ...(provider.sort ? { sort: provider.sort } : {}),
    ...(provider.only && provider.only.length > 0 ? { only: provider.only } : {}),
  };
};

const readErrorResponse = async (response: Response) => {
  const body = await response.text().catch(() => "");
  const parsed = safeJsonParse(body);
  const error = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : null;
  const metadata = error?.metadata;

  return {
    body,
    message: typeof error?.message === "string" ? error.message : response.statusText || "OpenRouter request failed.",
    errorCode: typeof error?.code === "number" || typeof error?.code === "string" ? error.code : response.status,
    errorType: errorTypeFromMetadata(metadata),
    metadata: isRecord(metadata) ? metadata : undefined,
  };
};

const nextSseEvent = (buffer: string): { raw: string; rest: string } | null => {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  return {
    raw: buffer.slice(0, match.index),
    rest: buffer.slice(match.index + match[0].length),
  };
};

const dataFromSseEvent = (raw: string) => {
  const dataLines: string[] = [];

  for (const line of raw.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0
      ? line.slice(separator + (line[separator + 1] === " " ? 2 : 1))
      : "";

    if (field === "data") {
      dataLines.push(value);
    }
  }

  return dataLines.length > 0 ? dataLines.join("\n") : null;
};

const contentFromChunk = (chunk: OpenRouterStreamChunk) => {
  const content = chunk.choices?.[0]?.delta?.content;

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

const topLevelErrorFromChunk = (chunk: OpenRouterStreamChunk) => {
  const error = isRecord(chunk.error) ? chunk.error : null;
  if (!error) {
    return null;
  }

  return {
    message: typeof error.message === "string" ? error.message : "OpenRouter stream failed.",
    status: typeof error.code === "number" ? error.code : undefined,
    errorCode: typeof error.code === "number" || typeof error.code === "string" ? error.code : null,
    errorType: errorTypeFromMetadata(error.metadata),
    metadata: isRecord(error.metadata) ? error.metadata : undefined,
  };
};

const createTimeoutError = ({
  code,
  input,
  generationId,
  emittedContent,
  timeoutMs,
}: {
  code: Extract<OpenRouterStreamErrorCode, "header_timeout" | "first_content_timeout" | "idle_timeout" | "hard_timeout">;
  input: StreamOpenRouterChatCompletionInput;
  generationId?: string | null;
  emittedContent: boolean;
  timeoutMs: number;
}) => new OpenRouterStreamError(`OpenRouter ${code.replaceAll("_", " ")} after ${timeoutMs}ms.`, {
  code,
  retryable: !emittedContent,
  emittedContent,
  generationId,
  metadata: { timeoutMs, model: input.model, task: input.task },
});

const readWithTimeout = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  onTimeout: () => OpenRouterStreamError,
) => {
  if (timeoutMs <= 0) {
    throw onTimeout();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        timeoutId = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export async function* streamOpenRouterChatCompletion(
  input: StreamOpenRouterChatCompletionInput,
): AsyncGenerator<string, void, void> {
  const startedAt = now();
  const attempt = input.attempt ?? 1;
  const timeouts = input.timeouts;
  const abortController = new AbortController();
  let abortCode: OpenRouterStreamErrorCode | null = null;
  let generationId: string | null = null;
  let emittedContent = false;
  let chunkCount = 0;
  let textCharCount = 0;
  let sawDone = false;

  const abortWith = (code: OpenRouterStreamErrorCode) => {
    abortCode = code;
    abortController.abort();
  };

  const hardTimeoutId = setTimeout(() => abortWith("hard_timeout"), timeouts.hardTimeoutMs);
  const headerTimeoutId = setTimeout(() => abortWith("header_timeout"), timeouts.headerTimeoutMs);

  // Strip undefined values from reasoning so OpenRouter does not see a "reasoning: null" body.
  const reasoningPayload = input.reasoning
    ? Object.fromEntries(
        Object.entries(input.reasoning).filter(([, v]) => v !== undefined && v !== null),
      )
    : undefined;

  const body = JSON.stringify({
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? undefined,
    max_tokens: input.maxTokens ?? undefined,
    provider: normalizeProviderPreferences(input.provider),
    reasoning: reasoningPayload,
    stream: true,
  });

  // region debug-point openrouter-reasoning-snapshot
  // Instrumentation: surface the exact reasoning config in the next emit so we can
  // confirm in the Trigger.dev trace that the `reasoning` field is actually in the
  // outgoing body (H2). Pairs with the `before_fetch` event below.
  emit(input, {
    event: "openrouter:reasoning_configured",
    level: "info",
    metadata: {
      reasoning: reasoningPayload ?? null,
      hasReasoningInBody: body.includes('"reasoning"'),
    },
  }, startedAt);
  // endregion debug-point openrouter-reasoning-snapshot

  emit(input, {
    event: "openrouter:before_fetch",
    level: "info",
    timeoutMs: timeouts.headerTimeoutMs,
    metadata: {
      bodyBytes: new TextEncoder().encode(body).byteLength,
      messageCount: input.messages.length,
      maxTokens: input.maxTokens ?? null,
      attempt,
    },
  }, startedAt);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-OpenRouter-Metadata": "enabled",
      },
      body,
      signal: abortController.signal,
    });
  } catch (error) {
    clearTimeout(headerTimeoutId);
    clearTimeout(hardTimeoutId);

    const code = abortCode === "header_timeout" || abortCode === "hard_timeout" ? abortCode : "network_error";
    const streamError = code === "network_error"
      ? new OpenRouterStreamError("OpenRouter fetch failed before response headers were received.", {
          code,
          retryable: true,
          emittedContent: false,
          cause: error,
          metadata: { model: input.model, task: input.task },
        })
      : createTimeoutError({
          code,
          input,
          emittedContent: false,
          timeoutMs: code === "header_timeout" ? timeouts.headerTimeoutMs : timeouts.hardTimeoutMs,
        });

    emit(input, {
      event: code === "network_error" ? "openrouter:network_error" : `openrouter:${code}`,
      level: "error",
      retryable: streamError.retryable,
      emittedContent: false,
      errorType: streamError.errorType ?? null,
      message: streamError.message,
    }, startedAt);
    throw streamError;
  }

  clearTimeout(headerTimeoutId);
  generationId = response.headers.get("x-generation-id");

  emit(input, {
    event: "openrouter:headers_received",
    level: response.ok ? "info" : "error",
    status: response.status,
    generationId,
    metadata: {
      contentType: response.headers.get("content-type"),
      retryAfter: response.headers.get("retry-after"),
    },
  }, startedAt);

  if (!response.ok) {
    clearTimeout(hardTimeoutId);
    const errorBody = await readErrorResponse(response);
    const streamError = new OpenRouterStreamError(errorBody.message, {
      code: "pre_stream_error",
      retryable: isRetryableStatus(response.status) || isRetryableErrorType(errorBody.errorType),
      emittedContent: false,
      status: response.status,
      errorCode: errorBody.errorCode,
      errorType: errorBody.errorType,
      generationId,
      metadata: {
        ...errorBody.metadata,
        bodyPreview: errorBody.body.slice(0, 1200),
      },
    });

    emit(input, {
      event: "openrouter:pre_stream_error",
      level: "error",
      status: response.status,
      generationId,
      retryable: streamError.retryable,
      emittedContent: false,
      errorCode: streamError.errorCode ?? null,
      errorType: streamError.errorType ?? null,
      message: streamError.message,
      metadata: streamError.metadata,
    }, startedAt);
    throw streamError;
  }

  if (!response.body) {
    clearTimeout(hardTimeoutId);
    const streamError = new OpenRouterStreamError("OpenRouter response did not include a stream body.", {
      code: "invalid_response",
      retryable: true,
      emittedContent: false,
      status: response.status,
      generationId,
    });
    emit(input, {
      event: "openrouter:invalid_response",
      level: "error",
      status: response.status,
      generationId,
      retryable: true,
      emittedContent: false,
      message: streamError.message,
    }, startedAt);
    throw streamError;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!sawDone) {
      const timeoutCode = emittedContent ? "idle_timeout" : "first_content_timeout";
      const timeoutMs = emittedContent ? timeouts.idleTimeoutMs : timeouts.firstContentTimeoutMs;

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await readWithTimeout(reader, timeoutMs, () => {
          abortWith(timeoutCode);
          return createTimeoutError({
            code: timeoutCode,
            input,
            generationId,
            emittedContent,
            timeoutMs,
          });
        });
      } catch (error) {
        const streamError = error instanceof OpenRouterStreamError
          ? error
          : abortCode === "hard_timeout"
            ? createTimeoutError({
                code: "hard_timeout",
                input,
                generationId,
                emittedContent,
                timeoutMs: timeouts.hardTimeoutMs,
              })
            : new OpenRouterStreamError("OpenRouter stream read failed.", {
                code: "network_error",
                retryable: !emittedContent,
                emittedContent,
                generationId,
                cause: error,
              });

        emit(input, {
          event: `openrouter:${streamError.code}`,
          level: "error",
          generationId,
          retryable: streamError.retryable,
          emittedContent,
          chunkCount,
          textCharCount,
          message: streamError.message,
        }, startedAt);
        throw streamError;
      }

      if (readResult.done) {
        break;
      }

      buffer += decoder.decode(readResult.value, { stream: true });

      while (true) {
        const event = nextSseEvent(buffer);
        if (!event) {
          break;
        }

        buffer = event.rest;
        const data = dataFromSseEvent(event.raw);
        if (!data) {
          continue;
        }

        if (data.trim() === "[DONE]") {
          sawDone = true;
          break;
        }

        const parsed = safeJsonParse(data);
        if (!isRecord(parsed)) {
          const streamError = new OpenRouterStreamError("OpenRouter returned a non-JSON SSE data event.", {
            code: "invalid_response",
            retryable: !emittedContent,
            emittedContent,
            generationId,
            metadata: { dataPreview: data.slice(0, 500) },
          });
          emit(input, {
            event: "openrouter:invalid_response",
            level: "error",
            generationId,
            retryable: streamError.retryable,
            emittedContent,
            message: streamError.message,
            metadata: streamError.metadata,
          }, startedAt);
          throw streamError;
        }

        chunkCount += 1;
        input.onChunk?.(parsed);

        const chunkError = topLevelErrorFromChunk(parsed);
        if (chunkError) {
          const streamError = new OpenRouterStreamError(chunkError.message, {
            code: "mid_stream_error",
            retryable: !emittedContent && (isRetryableStatus(chunkError.status) || isRetryableErrorType(chunkError.errorType)),
            emittedContent,
            status: chunkError.status,
            errorCode: chunkError.errorCode,
            errorType: chunkError.errorType,
            generationId,
            provider: typeof parsed.provider === "string" ? parsed.provider : null,
            metadata: chunkError.metadata,
          });
          emit(input, {
            event: "openrouter:mid_stream_error",
            level: "error",
            status: streamError.status,
            generationId,
            provider: streamError.provider,
            retryable: streamError.retryable,
            emittedContent,
            chunkCount,
            textCharCount,
            errorCode: streamError.errorCode ?? null,
            errorType: streamError.errorType ?? null,
            message: streamError.message,
            metadata: streamError.metadata,
          }, startedAt);
          throw streamError;
        }

        const text = contentFromChunk(parsed);
        if (!text) {
          continue;
        }

        textCharCount += text.length;
        if (!emittedContent) {
          emittedContent = true;
          emit(input, {
            event: "openrouter:first_content_token",
            level: "info",
            generationId,
            provider: typeof parsed.provider === "string" ? parsed.provider : null,
            chunkCount,
            textCharCount,
          }, startedAt);
        }

        yield text;
      }
    }

    if (!emittedContent) {
      const streamError = new OpenRouterStreamError("OpenRouter stream ended without any content tokens.", {
        code: "empty_stream",
        retryable: true,
        emittedContent: false,
        generationId,
        metadata: { chunkCount, sawDone },
      });
      emit(input, {
        event: "openrouter:empty_stream",
        level: "error",
        generationId,
        retryable: true,
        emittedContent: false,
        chunkCount,
        textCharCount,
        message: streamError.message,
        metadata: streamError.metadata,
      }, startedAt);
      throw streamError;
    }

    emit(input, {
      event: "openrouter:done",
      level: "info",
      generationId,
      emittedContent: true,
      chunkCount,
      textCharCount,
      metadata: { sawDone },
    }, startedAt);
  } finally {
    clearTimeout(hardTimeoutId);
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed or errored; keep the original result.
    }
    try {
      reader.releaseLock();
    } catch {
      // Release can throw if the runtime is still settling an aborted read.
    }
  }
}