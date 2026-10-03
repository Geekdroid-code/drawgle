import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAnalyticsForTests, track, trackCheckoutReturn } from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    __resetAnalyticsForTests();
    delete window.oa;
    vi.useRealTimers();
  });

  it("sends immediately and drops empty props when the tracker is loaded", () => {
    const trackSpy = vi.fn();
    window.oa = { track: trackSpy };

    track("project_created", { source: "prompt", image_mode: null, style_preset: undefined });

    expect(trackSpy).toHaveBeenCalledWith("project_created", { source: "prompt" });
  });

  it("queues events until the async script loads, in order", () => {
    track("login_started", { method: "google" });
    track("pricing_opened", { reason: "upgrade" });

    const trackSpy = vi.fn();
    window.oa = { track: trackSpy };
    vi.advanceTimersByTime(500);

    expect(trackSpy.mock.calls.map(([name]) => name)).toEqual(["login_started", "pricing_opened"]);
  });

  it("drops the queue when the tracker never loads", () => {
    track("login_started", { method: "google" });
    vi.advanceTimersByTime(16_000);

    const trackSpy = vi.fn();
    window.oa = { track: trackSpy };
    vi.advanceTimersByTime(1_000);

    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("records a checkout return once per subscription", () => {
    const conversion = vi.fn();
    window.oa = { track: vi.fn(), conversion };
    const params = new URLSearchParams("subscribed=1&subscription_id=sub_123&status=active");

    trackCheckoutReturn(params);
    trackCheckoutReturn(params);

    expect(conversion).toHaveBeenCalledTimes(1);
    expect(conversion).toHaveBeenCalledWith("subscription_started", { status: "active" });
  });

  it("records a failed checkout return as checkout_failed", () => {
    const trackSpy = vi.fn();
    const conversion = vi.fn();
    window.oa = { track: trackSpy, conversion };

    trackCheckoutReturn(new URLSearchParams("subscribed=1&payment_id=pay_1&status=failed"));

    expect(conversion).not.toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalledWith("checkout_failed", { status: "failed" });
  });
});
