import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const rpc = vi.fn();
const admin = { rpc } as never;
const rules = [
  { bucket: "demo:hour", limit: 3, windowSeconds: 3600 },
  { bucket: "demo:day", limit: 9, windowSeconds: 86400 },
];
const allowed = { data: { allowed: true, remaining: 1, retryAfterSeconds: 0 }, error: null };
const denied = (retryAfterSeconds: number) => ({ data: { allowed: false, remaining: 0, retryAfterSeconds }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue(allowed);
});

describe("enforceRateLimit", () => {
  it("lets a request through when every window has room", async () => {
    expect(await enforceRateLimit(admin, "user-1", rules)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_rate_limit", {
      input_owner_id: "user-1",
      input_bucket: "demo:hour",
      input_limit: 3,
      input_window_seconds: 3600,
    });
  });

  it("answers 429 with the wait in both the body and Retry-After", async () => {
    rpc.mockResolvedValueOnce(denied(1500));
    const response = await enforceRateLimit(admin, "user-1", rules);

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("1500");
    expect(await response?.json()).toEqual({
      error: "You've reached the limit for now. Try again in 25 minutes.",
      code: "rate_limited",
      retryAfterSeconds: 1500,
    });
    // The first refusal ends the check; later windows are not charged for a refused request.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    [30, "a minute"],
    [3600, "60 minutes"],
    [7200, "2 hours"],
    [0, "a minute"],
  ])("phrases a %i second wait as %s", async (seconds, phrase) => {
    rpc.mockResolvedValueOnce(denied(seconds));
    const response = await enforceRateLimit(admin, "user-1", rules);
    expect((await response?.json()).error).toContain(phrase);
  });

  it("fails open, and logs, when the limiter cannot be reached", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    expect(await enforceRateLimit(admin, "user-1", rules)).toBeNull();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("keeps the shipped ceilings above honest use and below a script's reach", () => {
    for (const rule of [...RATE_LIMITS.plan, ...RATE_LIMITS.agent]) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeLessThanOrEqual(86400);
    }
    expect(new Set([...RATE_LIMITS.plan, ...RATE_LIMITS.agent].map((rule) => rule.bucket)).size).toBe(4);
  });
});
