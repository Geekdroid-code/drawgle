import "server-only";

import { NextResponse } from "next/server";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

// Per-user ceilings on the model calls Drawgle offers without charging credits.
// They sit well above what a person designing by hand reaches and well below
// what a script can burn. Raise them here; every route reads them from this file.
export const RATE_LIMITS = {
  plan: [
    { bucket: "plan:hour", limit: 10, windowSeconds: HOUR },
    { bucket: "plan:day", limit: 30, windowSeconds: DAY },
  ],
  agent: [
    { bucket: "agent:hour", limit: 150, windowSeconds: HOUR },
    { bucket: "agent:day", limit: 600, windowSeconds: DAY },
  ],
} satisfies Record<string, RateLimitRule[]>;

type ConsumeResult = {
  allowed?: boolean;
  retryAfterSeconds?: number;
};

const describeWait = (seconds: number) => {
  if (seconds < 90) return "a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 120) return `${minutes} minutes`;
  return `${Math.ceil(minutes / 60)} hours`;
};

/**
 * Counts one request against each rule and returns a 429 response when the user is
 * over any of them, or null when the request may go ahead.
 *
 * A failing limiter lets the request through and logs the failure: a database hiccup
 * should not take chat down for paying users.
 */
export async function enforceRateLimit(
  admin: AdminClient,
  userId: string,
  rules: readonly RateLimitRule[],
): Promise<NextResponse | null> {
  for (const rule of rules) {
    const { data, error } = await admin.rpc("consume_rate_limit", {
      input_owner_id: userId,
      input_bucket: rule.bucket,
      input_limit: rule.limit,
      input_window_seconds: rule.windowSeconds,
    });

    if (error) {
      console.error("Rate limit check failed; letting the request through", { bucket: rule.bucket, error });
      return null;
    }

    const result = (data ?? {}) as ConsumeResult;
    if (result.allowed === false) {
      const retryAfterSeconds = Math.max(1, Math.round(Number(result.retryAfterSeconds) || 60));
      return NextResponse.json(
        {
          error: `You've reached the limit for now. Try again in ${describeWait(retryAfterSeconds)}.`,
          code: "rate_limited",
          retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

  return null;
}
