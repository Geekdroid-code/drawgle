import type { ScreenPlan } from "@/lib/types";

/**
 * Output ceiling for one screen build.
 *
 * This used to be a keyword lottery: a description mentioning "dashboard" or
 * "chart" got 26,000, a description under 2,800 characters got 12,000, and
 * everything else got 18,000. The builder's observed output range is roughly
 * 8,000–12,000+ tokens for an ordinary screen, so the 12,000 tier — the one most
 * screens landed in — sat *inside* normal operation. Screens did not degrade
 * when they crossed it; they were truncated mid-tag and thrown away. Two of four
 * screens were lost that way on 2026-08-11.
 *
 * Guessing a screen's eventual length from words in its description is the same
 * class of error as inferring design meaning from a hex value: a heuristic
 * standing in for information we do not have. So there is no tiering now. One
 * ceiling, set well above anything the builder has been observed to produce.
 *
 * Raising it is close to free. `max_tokens` is a limit, not an allocation —
 * output tokens are billed on what the model actually emits, so a screen that
 * finishes at 9,000 costs the same under either number. The ceiling exists only
 * to bound a runaway response.
 *
 * Note this is still clamped by `DRAWGLE_OPENROUTER_MAX_TOKENS` in
 * `lib/env/server.ts`. That variable must be at least this value in every
 * deployed environment or the clamp reintroduces the bug.
 */
export const SCREEN_BUILD_OUTPUT_TOKEN_BUDGET = 32000;

export const screenBuildOutputTokenBudget = (_screenPlan: ScreenPlan) => SCREEN_BUILD_OUTPUT_TOKEN_BUDGET;
