// A transient provider fault (rate limit, overload, dropped connection) says
// nothing about the user's request or the model's plan. Retry it where it
// happens instead of discarding a whole planning turn. Every other error
// surfaces unchanged so real problems stay visible.
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "EPIPE",
  "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
]);

const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

export function providerErrorStatus(error: unknown): number | null {
  const status = record(error).status;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}

export function isTransientProviderError(error: unknown): boolean {
  const status = providerErrorStatus(error);
  if (status !== null) return TRANSIENT_STATUS.has(status);
  const code = record(error).code ?? record(record(error).cause).code;
  if (typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code)) return true;
  return error instanceof TypeError && /fetch failed|network|socket|terminated/i.test(error.message);
}

/** Loggable summary without prompts, payloads or credentials. */
export function describeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof record(error).message === "string" ? String(record(error).message) : "";
  return { status: providerErrorStatus(error), name: error instanceof Error ? error.name : typeof error,
    message: message.replace(/\s+/g, " ").slice(0, 300) };
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withProviderRetry<T>(call: () => Promise<T>, options: { attempts?: number; delaysMs?: number[] } = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delays = options.delaysMs ?? [600, 1800];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= attempts - 1 || !isTransientProviderError(error)) throw error;
      const base = delays[Math.min(attempt, delays.length - 1)] ?? 0;
      await wait(base + Math.floor(Math.random() * base * 0.25));
    }
  }
}
