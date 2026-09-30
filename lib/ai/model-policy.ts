import "server-only";

import type { GenerateContentConfig } from "@google/genai";

export type GeminiTaskType =
  | "greeting"
  | "router"
  | "chat"
  | "draft_plan"
  | "project_planning"
  | "design_tokens"
  | "navigation_build"
  | "screen_build"
  | "selected_region_edit"
  | "full_rebuild"
  | "repair";

type GeminiModelPolicy = {
  model: string;
  config: GenerateContentConfig;
};

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;
const envInt = (key: string, fallback: number) => {
  const value = Number.parseInt(process.env[key]?.trim() ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const GEMINI_FLASH_LITE_MODEL = "gemini-3.1-flash-lite";

const ROUTER_MODEL = env("DRAWGLE_GEMINI_ROUTER_MODEL", GEMINI_FLASH_LITE_MODEL);
const SELECTED_EDIT_MODEL = env("DRAWGLE_GEMINI_SELECTED_EDIT_MODEL", GEMINI_FLASH_LITE_MODEL);
const FULL_BUILD_MODEL = env("DRAWGLE_GEMINI_FULL_BUILD_MODEL", "gemini-3-flash-preview");
const PROJECT_PLANNER_MODEL = env("DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL", "gemini-3-flash-preview");
const SCREEN_BUILD_MAX_OUTPUT_TOKENS = envInt("DRAWGLE_GEMINI_SCREEN_BUILD_MAX_OUTPUT_TOKENS", 40000);
const FULL_REBUILD_MAX_OUTPUT_TOKENS = envInt("DRAWGLE_GEMINI_FULL_REBUILD_MAX_OUTPUT_TOKENS", 40000);

// Gemini 3 series uses thinkingLevel.
// minimal — repair, edits, nav build: minimal overhead, maximum output budget
// low     — planning/reasoning (project planning, design tokens) and screen builds: light reasoning without
//           blowing the output cap
// medium, high — only through DRAWGLE_GEMINI_SCREEN_BUILD_THINKING, to compare them on the eval set
type ThinkingLevel = "minimal" | "low" | "medium" | "high";
const THINKING_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high"];

/** A level from the environment; anything that is not one falls back, so a typo never changes a build. */
const envThinking = (key: string, fallback: ThinkingLevel): ThinkingLevel => {
  const value = process.env[key]?.trim().toLowerCase();
  return THINKING_LEVELS.find((level) => level === value) ?? fallback;
};

/**
 * How hard a screen build thinks. It is `low` until an A/B on the eval set says otherwise (scripts/design-eval/ab.ts);
 * the environment variable is what lets `low` and `high` be compared without a code change.
 */
const SCREEN_BUILD_THINKING = envThinking("DRAWGLE_GEMINI_SCREEN_BUILD_THINKING", "low");

const gemini3Config = (
  thinkingLevel: ThinkingLevel,
  maxOutputTokens: number,
): GenerateContentConfig => ({
  thinkingConfig: {
    thinkingLevel: thinkingLevel as NonNullable<GenerateContentConfig["thinkingConfig"]>["thinkingLevel"],
  },
  maxOutputTokens,
  candidateCount: 1,
});

const routerModelConfig = (maxOutputTokens = 2048, thinkingLevel: "minimal" | "low" = "low"): GenerateContentConfig =>
  gemini3Config(thinkingLevel, maxOutputTokens);

const buildModelConfig = (
  thinkingLevel: ThinkingLevel,
  maxOutputTokens: number,
): GenerateContentConfig =>
  gemini3Config(thinkingLevel, maxOutputTokens);

const policyByTask: Record<GeminiTaskType, GeminiModelPolicy> = {
  greeting: {
    model: ROUTER_MODEL,
    config: routerModelConfig(150, "minimal"),
  },
  router: {
    model: ROUTER_MODEL,
    config: routerModelConfig(2048, "minimal"),
  },
  chat: {
    model: ROUTER_MODEL,
    config: routerModelConfig(2048, "low"),
  },
  draft_plan: {
    model: ROUTER_MODEL,
    config: routerModelConfig(4096, "low"),
  },
  project_planning: {
    model: PROJECT_PLANNER_MODEL,
    config: buildModelConfig("low", 12000),
  },
  // One call per project, and it sets every screen's colours, radii and type: it thinks a little, at
  // Gemini's own default temperature (no override), instead of running with none.
  design_tokens: {
    model: PROJECT_PLANNER_MODEL,
    config: buildModelConfig("low", 8192),
  },
  navigation_build: {
    model: FULL_BUILD_MODEL,
    config: buildModelConfig("low", 12000),
  },
  screen_build: {
    model: FULL_BUILD_MODEL,
    config: buildModelConfig(SCREEN_BUILD_THINKING, SCREEN_BUILD_MAX_OUTPUT_TOKENS),
  },
  selected_region_edit: {
    model: SELECTED_EDIT_MODEL,
    config: buildModelConfig("minimal", 12000),
  },
  full_rebuild: {
    model: FULL_BUILD_MODEL,
    config: buildModelConfig("low", FULL_REBUILD_MAX_OUTPUT_TOKENS),
  },
  repair: {
    model: FULL_BUILD_MODEL,
    config: buildModelConfig("minimal", 18000),
  },
};

export function geminiModelForTask(task: GeminiTaskType) {
  return policyByTask[task].model;
}

export function geminiConfigForTask(
  task: GeminiTaskType,
  override: GenerateContentConfig = {},
): GenerateContentConfig {
  const base = policyByTask[task].config;

  return {
    ...base,
    ...override,
    thinkingConfig: {
      ...(base.thinkingConfig ?? {}),
      ...(override.thinkingConfig ?? {}),
    },
  };
}

export function geminiPolicyForTask(
  task: GeminiTaskType,
  override: GenerateContentConfig = {},
): GeminiModelPolicy {
  return {
    model: geminiModelForTask(task),
    config: geminiConfigForTask(task, override),
  };
}
