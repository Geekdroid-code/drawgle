import "server-only";

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

  // 4. Default fallback for generic internal errors
  return "Something went wrong while designing your screen. Please try rephrasing your description or try again.";
}
