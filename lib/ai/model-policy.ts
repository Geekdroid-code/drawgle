import "server-only";

import type { GenerateContentConfig } from "@google/genai";

export type GeminiTaskType =
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

const ROUTER_MODEL = env("DRAWGLE_GEMINI_ROUTER_MODEL", "gemini-2.5-flash");
const SELECTED_EDIT_MODEL = env("DRAWGLE_GEMINI_SELECTED_EDIT_MODEL", "gemini-3.1-flash-lite");
const FULL_BUILD_MODEL = env("DRAWGLE_GEMINI_FULL_BUILD_MODEL", "gemini-3.1-flash-lite");
const SCREEN_BUILD_MAX_OUTPUT_TOKENS = envInt("DRAWGLE_GEMINI_SCREEN_BUILD_MAX_OUTPUT_TOKENS", 32768);
const FULL_REBUILD_MAX_OUTPUT_TOKENS = envInt("DRAWGLE_GEMINI_FULL_REBUILD_MAX_OUTPUT_TOKENS", 32768);

const gemini25FlashConfig = (maxOutputTokens = 2048): GenerateContentConfig => ({
  thinkingConfig: {
    thinkingBudget: 500,
  },
  maxOutputTokens,
  candidateCount: 1,
});

// Gemini 3 series uses thinkingLevel, not thinkingBudget.
// minimal — code generation (screen build, repair, edits, nav build): minimal overhead, maximum output budget
// low     — planning/reasoning (project planning, design tokens): light reasoning without blowing the output cap
const gemini3Config = (
  thinkingLevel: "minimal" | "low" ,
  maxOutputTokens: number,
): GenerateContentConfig => ({
  thinkingConfig: {
    thinkingLevel: thinkingLevel as NonNullable<GenerateContentConfig["thinkingConfig"]>["thinkingLevel"],
  },
  maxOutputTokens,
  candidateCount: 1,
});

const policyByTask: Record<GeminiTaskType, GeminiModelPolicy> = {
  router: {
    model: ROUTER_MODEL,
    config: gemini25FlashConfig(2048),
  },
  chat: {
    model: ROUTER_MODEL,
    config: gemini25FlashConfig(2048),
  },
  draft_plan: {
    model: ROUTER_MODEL,
    config: gemini25FlashConfig(4096),
  },
  project_planning: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("low", 12000),
  },
  design_tokens: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("low", 8192),
  },
  navigation_build: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("minimal", 12000),
  },
  screen_build: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("minimal", SCREEN_BUILD_MAX_OUTPUT_TOKENS),
  },
  selected_region_edit: {
    model: SELECTED_EDIT_MODEL,
    config: gemini3Config("minimal", 12000),
  },
  full_rebuild: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("minimal", FULL_REBUILD_MAX_OUTPUT_TOKENS),
  },
  repair: {
    model: FULL_BUILD_MODEL,
    config: gemini3Config("minimal", 18000),
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
