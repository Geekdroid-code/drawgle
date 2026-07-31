/**
 * Shared user-facing error formatting.
 * Safe for client and server — never expose raw SDK/PostgREST payloads in the UI.
 */

const DEFAULT_GENERATION_ERROR =
  "Something went wrong while designing your screen. Please try again.";

const PERSIST_FAILED_ERROR =
  "This screen was generated but could not be saved. Please retry.";

const looksLikeSerializedJson = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

const extractMessageFromUnknown = (value: unknown, depth = 0): string | null => {
  if (depth > 4 || value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (looksLikeSerializedJson(trimmed)) {
      try {
        return extractMessageFromUnknown(JSON.parse(trimmed), depth + 1);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (value instanceof Error) {
    return extractMessageFromUnknown(value.message, depth + 1);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested =
      extractMessageFromUnknown(record.message, depth + 1) ??
      extractMessageFromUnknown(record.error, depth + 1) ??
      extractMessageFromUnknown(record.details, depth + 1);
    if (nested) return nested;

    // PostgREST / Supabase shaped errors often only have code+message.
    if (typeof record.code === "string" && typeof record.message === "string") {
      return record.message;
    }
  }

  return null;
};

const isTechnicalInternalError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    /pgrst\d+/i.test(message) ||
    lower.includes("empty or invalid json") ||
    lower.includes("invalid json") ||
    lower.includes("postgrest") ||
    lower.includes("json object requested, multiple (or no) rows returned") ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("duplicate key value") ||
    lower.includes("violates foreign key") ||
    lower.includes("violates not-null") ||
    lower.includes("failed to persist") ||
    lower.includes("supabase") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("unexpected token") ||
    /at\s+\S+\s+\(/.test(message) || // stack-ish
    looksLikeSerializedJson(message)
  );
};

/**
 * Clean up raw internal/SDK error messages into clean, friendly, professional user-facing errors.
 * Still preserves user-facing billing or custom check errors.
 */
export function cleanErrorMessage(message: string): string {
  let processedMessage = message;

  // Try to parse if it is a serialized JSON error
  try {
    if (message && typeof message === "string" && message.trim().startsWith("{")) {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) {
        processedMessage = parsed.error.message;
        // Sometimes the inner message is also a serialized JSON string
        if (typeof processedMessage === "string" && processedMessage.trim().startsWith("{")) {
          const innerParsed = JSON.parse(processedMessage);
          if (innerParsed?.error?.message) {
            processedMessage = innerParsed.error.message;
          }
        }
      } else if (parsed?.message) {
        processedMessage = parsed.message;
      } else if (parsed?.code || parsed?.details) {
        // Raw PostgREST object stringified into the error column.
        processedMessage = typeof parsed.message === "string" ? parsed.message : message;
      }
    }
  } catch {
    // Ignore JSON parsing errors and use raw message
  }

  const cleaned = typeof processedMessage === "string" ? processedMessage.trim() : String(processedMessage);

  if (!cleaned) {
    return "An unexpected error occurred during generation. Please try again.";
  }

  const lower = cleaned.toLowerCase();

  // 1. Credit / Billing errors (already user-friendly, preserve them)
  if (lower.includes("credits") || lower.includes("insufficient") || lower.includes("plan")) {
    return cleaned;
  }

  // Persist / PostgREST payload failures — never show PGRST codes on canvas
  if (
    /pgrst102/i.test(cleaned) ||
    lower.includes("empty or invalid json") ||
    lower.includes("invalid json body") ||
    lower.includes("failed to persist screen")
  ) {
    return PERSIST_FAILED_ERROR;
  }

  if (isTechnicalInternalError(cleaned)) {
    return DEFAULT_GENERATION_ERROR;
  }

  // 2. Google Gemini specific model and parameter errors (mapped to simple non-technical text)
  if (lower.includes("thinking level") || lower.includes("minimal") || lower.includes("not found for api version") || lower.includes("is not found") || lower.includes("listmodels") || lower.includes("api key") || lower.includes("unauthorized") || lower.includes("api_key")) {
    return "The design agent is currently unavailable. Please try again later or contact support.";
  }
  if (lower.includes("blocked") || lower.includes("safety")) {
    return "Your description could not be processed. Please try rephrasing your request.";
  }
  if (lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("429")) {
    return "The design agent is busy. Please try again in a few moments.";
  }

  // 3. Network or connection errors
  if (lower.includes("fetch failed") || lower.includes("network error") || lower.includes("econnrefused") || lower.includes("timeout") || lower.includes("deadline")) {
    return "Connection lost. Please check your network and try again.";
  }

  // Keep already-friendly screen generation diagnostics short and readable.
  if (cleaned.startsWith("[screen_generation:") || cleaned.startsWith("[screen_health:")) {
    if (/incomplete|sentinel|max_tokens|trailing_open_tag|unclosed/i.test(cleaned)) {
      return "This screen could not be finished because the generated layout was incomplete. Please retry.";
    }
    if (/invalid_static_html|structurally|jsx|script|duplicate|tag_imbalance/i.test(cleaned)) {
      return "This screen could not be finalized because the generated layout was invalid. Please retry.";
    }
    if (/invalid_image_url|asset/i.test(cleaned)) {
      return "This screen was generated but did not satisfy the required visual assets. Please retry.";
    }
    return "This screen could not be finalized. Please retry.";
  }

  // 4. Default fallback for generic internal errors
  if (cleaned.length > 220 || /[{}\[\]\\]{2,}/.test(cleaned)) {
    return DEFAULT_GENERATION_ERROR;
  }

  return cleaned;
}

/** Normalize any thrown/unknown error into a user-facing string. */
export function cleanUnknownError(error: unknown, fallback = DEFAULT_GENERATION_ERROR): string {
  const extracted = extractMessageFromUnknown(error);
  if (!extracted) return fallback;
  return cleanErrorMessage(extracted);
}

export function isPersistJsonError(error: unknown): boolean {
  const raw = extractMessageFromUnknown(error) ?? "";
  const lower = raw.toLowerCase();
  return (
    /pgrst102/i.test(raw) ||
    lower.includes("empty or invalid json") ||
    lower.includes("invalid json")
  );
}

export const USER_FACING_PERSIST_FAILED_ERROR = PERSIST_FAILED_ERROR;
