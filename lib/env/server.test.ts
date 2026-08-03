import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenRouterScreenBuildReasoning } from "./server";

const reasoningEnvNames = [
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_ENABLED",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_MAX_TOKENS",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EXCLUDE",
] as const;

const originalEnv = Object.fromEntries(reasoningEnvNames.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of reasoningEnvNames) {
    const value = originalEnv[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("getOpenRouterScreenBuildReasoning", () => {
  it("uses medium effort by default", () => {
    for (const name of reasoningEnvNames) {
      delete process.env[name];
    }

    expect(getOpenRouterScreenBuildReasoning()).toEqual({ effort: "medium" });
  });

  it("uses a configured supported effort", () => {
    process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT = "high";

    expect(getOpenRouterScreenBuildReasoning()).toMatchObject({ effort: "high" });
  });
});
