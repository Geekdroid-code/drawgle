import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOpenRouterScreenBuildReasoning,
  getOpenRouterScreenEditorReasoning,
} from "./server";

const reasoningEnvNames = [
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_ENABLED",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_MAX_TOKENS",
  "DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EXCLUDE",
  "DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_ENABLED",
  "DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_EFFORT",
  "DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_MAX_TOKENS",
  "DRAWGLE_OPENROUTER_SCREEN_EDITOR_REASONING_EXCLUDE",
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

describe("OpenRouter screen reasoning", () => {
  it("uses medium effort and excludes the trace for screen builds by default", () => {
    for (const name of reasoningEnvNames) {
      delete process.env[name];
    }

    expect(getOpenRouterScreenBuildReasoning()).toEqual({ effort: "medium", exclude: true });
  });

  it("uses low effort and excludes the trace for selected-region edits by default", () => {
    for (const name of reasoningEnvNames) {
      delete process.env[name];
    }

    expect(getOpenRouterScreenEditorReasoning()).toEqual({ effort: "low", exclude: true });
  });

  it("uses a configured supported build effort", () => {
    process.env.DRAWGLE_OPENROUTER_SCREEN_BUILD_REASONING_EFFORT = "high";

    expect(getOpenRouterScreenBuildReasoning()).toMatchObject({ effort: "high" });
  });
});
