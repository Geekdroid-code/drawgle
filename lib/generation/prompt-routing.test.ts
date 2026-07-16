import { describe, expect, it } from "vitest";

import { resolveGenerationPromptMode } from "@/lib/generation/prompt-routing";

const resolve = (overrides: Partial<Parameters<typeof resolveGenerationPromptMode>[0]> = {}) =>
  resolveGenerationPromptMode({
    referenceMode: "internal_style",
    hasImage: false,
    hasDesignStyle: false,
    hasReferenceAnalysis: false,
    ...overrides,
  });

describe("resolveGenerationPromptMode", () => {
  it("selects recreate only when structural image evidence actually exists", () => {
    expect(resolve({ referenceMode: "user_recreate", hasImage: true })).toBe("recreate");
    expect(resolve({ referenceMode: "user_recreate", hasImage: false })).toBe("prompt");
  });

  it("selects style for actual reusable visual evidence", () => {
    expect(resolve({ referenceMode: "user_style", hasImage: true })).toBe("style");
    expect(resolve({ referenceMode: "curated_style", hasImage: true })).toBe("style");
    expect(resolve({ hasDesignStyle: true })).toBe("style");
    expect(resolve({ hasReferenceAnalysis: true })).toBe("style");
    expect(resolve({ hasProjectVisualMemory: true })).toBe("style");
  });

  it("keeps a no-evidence internal fallback in prompt-only mode", () => {
    expect(resolve({ referenceMode: "internal_style" })).toBe("prompt");
    expect(resolve({ referenceMode: "curated_style" })).toBe("prompt");
  });
});
