import { describe, expect, it } from "vitest";

import {
  resolveFoundationPromptMode,
  resolvePlannerPromptMode,
} from "@/lib/generation/prompt-routing";

describe("generation prompt mode resolution", () => {
  it.each([
    [{ referenceMode: "user_recreate", hasImage: true, hasDesignStyle: false }, "recreate"],
    [{ referenceMode: "curated_style", hasImage: true, hasDesignStyle: false }, "style"],
    [{ referenceMode: null, hasImage: true, hasDesignStyle: false }, "style"],
    [{ referenceMode: null, hasImage: false, hasDesignStyle: true }, "preset"],
    [{ referenceMode: null, hasImage: false, hasDesignStyle: false }, "prompt"],
  ] as const)("resolves foundation evidence %o to %s", (input, expected) => {
    expect(resolveFoundationPromptMode(input)).toBe(expected);
  });

  it.each([
    [
      {
        referenceMode: "user_recreate",
        hasImage: true,
        hasDesignStyle: false,
        hasExistingProject: true,
      },
      "recreate",
    ],
    [
      {
        referenceMode: "curated_style",
        hasImage: true,
        hasDesignStyle: false,
        hasExistingProject: true,
      },
      "style",
    ],
    [
      {
        referenceMode: null,
        hasImage: false,
        hasDesignStyle: true,
        hasExistingProject: true,
      },
      "preset",
    ],
    [
      {
        referenceMode: null,
        hasImage: false,
        hasDesignStyle: false,
        hasExistingProject: true,
      },
      "project",
    ],
    [
      {
        referenceMode: null,
        hasImage: false,
        hasDesignStyle: false,
        hasExistingProject: false,
      },
      "prompt",
    ],
  ] as const)("resolves planner evidence %o to %s", (input, expected) => {
    expect(resolvePlannerPromptMode(input)).toBe(expected);
  });
});
