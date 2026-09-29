import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const KEYS = ["DRAWGLE_GEMINI_SCREEN_BUILD_THINKING", "DRAWGLE_GEMINI_FULL_BUILD_MODEL", "DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL"];
const saved = new Map(KEYS.map((key) => [key, process.env[key]]));

/** The policy reads its settings from the environment when it is first imported, so each test imports it afresh. */
const policy = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) if (value !== undefined) process.env[key] = value;
  return import("./model-policy");
};

const thinking = (config: { thinkingConfig?: { thinkingLevel?: unknown } }) => config.thinkingConfig?.thinkingLevel;

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("the design-token call", () => {
  it("thinks a little and runs at the model's own temperature", async () => {
    const { geminiPolicyForTask } = await policy();
    const tokens = geminiPolicyForTask("design_tokens");
    expect(thinking(tokens.config)).toBe("low");
    expect(tokens.config.maxOutputTokens).toBe(8192);
    // no temperature is set for the call: Gemini 3 is tuned for its default
    expect(tokens.config.temperature).toBeUndefined();
  });

  it("is the same thinking level as the planning it follows from", async () => {
    const { geminiPolicyForTask } = await policy();
    expect(thinking(geminiPolicyForTask("design_tokens").config)).toBe(thinking(geminiPolicyForTask("project_planning").config));
  });
});

describe("how hard a screen build thinks", () => {
  it("is low unless the environment says otherwise, so a build is unchanged until an A/B has decided", async () => {
    const { geminiPolicyForTask } = await policy();
    expect(thinking(geminiPolicyForTask("screen_build").config)).toBe("low");
  });

  it.each(["minimal", "low", "medium", "high", " HIGH ", "Medium"])("takes %s from DRAWGLE_GEMINI_SCREEN_BUILD_THINKING", async (value) => {
    const { geminiPolicyForTask } = await policy({ DRAWGLE_GEMINI_SCREEN_BUILD_THINKING: value });
    expect(thinking(geminiPolicyForTask("screen_build").config)).toBe(value.trim().toLowerCase());
  });

  it("falls back to low for a value that is not a level, rather than change a build over a typo", async () => {
    for (const value of ["extreme", "", "  ", "3"]) {
      const { geminiPolicyForTask } = await policy({ DRAWGLE_GEMINI_SCREEN_BUILD_THINKING: value });
      expect(thinking(geminiPolicyForTask("screen_build").config)).toBe("low");
    }
  });

  it("changes screen builds only: every other task keeps its own level", async () => {
    const { geminiPolicyForTask } = await policy({ DRAWGLE_GEMINI_SCREEN_BUILD_THINKING: "high" });
    const levels = Object.fromEntries((["router", "greeting", "chat", "draft_plan", "project_planning", "design_tokens", "navigation_build", "selected_region_edit", "full_rebuild", "repair"] as const)
      .map((task) => [task, thinking(geminiPolicyForTask(task).config)]));
    expect(levels).toEqual({
      router: "minimal", greeting: "minimal", chat: "low", draft_plan: "low", project_planning: "low", design_tokens: "low",
      navigation_build: "low", selected_region_edit: "minimal", full_rebuild: "low", repair: "minimal",
    });
  });

  it("does not touch the build's temperature or its output budget", async () => {
    const { geminiPolicyForTask } = await policy({ DRAWGLE_GEMINI_SCREEN_BUILD_THINKING: "high" });
    const build = geminiPolicyForTask("screen_build");
    expect(build.config.temperature).toBeUndefined();
    expect(build.config.maxOutputTokens).toBe(40000);
  });
});

describe("which model builds a screen", () => {
  it("is Flash by default and the one in DRAWGLE_GEMINI_FULL_BUILD_MODEL when it is set", async () => {
    expect((await policy()).geminiModelForTask("screen_build")).toBe("gemini-3-flash-preview");
    const set = await policy({ DRAWGLE_GEMINI_FULL_BUILD_MODEL: "gemini-3-pro-preview" });
    expect(set.geminiModelForTask("screen_build")).toBe("gemini-3-pro-preview");
    // the planner is its own setting
    expect(set.geminiModelForTask("design_tokens")).toBe("gemini-3-flash-preview");
  });
});
