/**
 * Thin client wrapper around the Ecompin (Open Analytics) tracker loaded in
 * app/layout.tsx. Every custom event goes through here so names stay
 * consistent and properties never carry prompts, emails or user ids.
 *
 * The tracker script loads async, so calls made before `window.oa` exists are
 * queued and flushed once it appears. If it never appears (ad blocker, DNT,
 * GPC) the queue is dropped silently.
 */

export type AnalyticsEvent =
  // Marketing / acquisition
  | "hero_prompt_submitted"
  // Auth
  | "login_started"
  | "login_completed"
  | "signup_completed"
  // Activation
  | "project_created"
  | "template_started"
  | "agent_prompt_sent"
  | "screen_plan_approved"
  | "screen_state_approved"
  | "generation_completed"
  | "generation_failed"
  | "screen_retried"
  | "element_edited"
  // Value delivered
  | "export_completed"
  | "preview_share_enabled"
  | "preview_link_copied"
  // Monetization
  | "pricing_opened"
  | "checkout_started"
  | "checkout_failed";

export type AnalyticsConversion = "subscription_started";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type OaTracker = {
  track?: (name: string, props?: Record<string, string | number | boolean>) => void;
  conversion?: (name: string, props?: Record<string, string | number | boolean>) => void;
};

declare global {
  interface Window {
    oa?: OaTracker;
  }
}

type QueuedCall = { kind: "track" | "conversion"; name: string; props?: Record<string, string | number | boolean> };

const FLUSH_INTERVAL_MS = 500;
const MAX_WAIT_MS = 15_000;

let queue: QueuedCall[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let waitStartedAt = 0;

function cleanProps(props?: AnalyticsProps) {
  if (!props) return undefined;
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    cleaned[key] = typeof value === "string" ? value.slice(0, 256) : value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function send(call: QueuedCall) {
  const fn = window.oa?.[call.kind];
  if (typeof fn !== "function") return false;
  try {
    fn.call(window.oa, call.name, call.props);
  } catch {
    // Analytics must never break the product.
  }
  return true;
}

function stopFlushing() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

function flush() {
  if (typeof window.oa?.track !== "function") {
    if (Date.now() - waitStartedAt > MAX_WAIT_MS) {
      queue = [];
      stopFlushing();
    }
    return;
  }
  const pending = queue;
  queue = [];
  stopFlushing();
  pending.forEach(send);
}

function enqueue(call: QueuedCall) {
  if (typeof window === "undefined") return;
  if (!queue.length && send(call)) return;
  queue.push(call);
  if (!flushTimer) {
    waitStartedAt = Date.now();
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  }
}

export function track(name: AnalyticsEvent, props?: AnalyticsProps) {
  enqueue({ kind: "track", name, props: cleanProps(props) });
}

export function trackConversion(name: AnalyticsConversion, props?: AnalyticsProps) {
  enqueue({ kind: "conversion", name, props: cleanProps(props) });
}

/**
 * Hosted Dodo checkout returns to `?subscribed=1` (plus Dodo's own
 * `status` / `subscription_id` / `payment_id`). Call this before the URL is
 * cleaned. A sessionStorage guard keeps refreshes from double counting.
 */
export function trackCheckoutReturn(params: URLSearchParams) {
  if (!params.has("subscribed")) return;
  const reference = params.get("subscription_id") ?? params.get("payment_id") ?? "unknown";
  const guardKey = `drawgle:checkout-return:${reference}`;
  try {
    if (reference !== "unknown" && sessionStorage.getItem(guardKey)) return;
    sessionStorage.setItem(guardKey, "1");
  } catch {
    // Storage can be blocked; counting twice is better than not counting.
  }

  const status = params.get("status")?.toLowerCase() ?? null;
  if (status && ["failed", "cancelled", "canceled", "expired"].includes(status)) {
    track("checkout_failed", { status });
    return;
  }
  trackConversion("subscription_started", { status: status ?? "returned" });
}

/** Test-only: reset module state between cases. */
export function __resetAnalyticsForTests() {
  queue = [];
  stopFlushing();
}
