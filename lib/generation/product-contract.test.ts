import { describe, expect, it } from "vitest";

import {
  normalizeScreenProductContract,
  validateProductRequirementCoverage,
} from "@/lib/generation/product-contract";

const rawContract = {
  version: 1,
  user_job: "Prepare for and conduct a useful interview coaching session.",
  default_lifecycle: "in-progress",
  entry_condition: "The user opens the coach before beginning a session.",
  requirements: [
    { id: "session-context", kind: "context", purpose: "Explain the selected interview practice context." },
    { id: "session-guidance", kind: "content", purpose: "Provide useful preparation guidance before starting." },
    { id: "start-session", kind: "action", purpose: "Let the user deliberately begin the coaching session." },
  ],
  primary_action_id: "start-session",
  action_outcome: "The coaching session begins with the chosen context.",
  next_step: "Move into the active coaching experience.",
};

describe("screen product contract", () => {
  it("uses a generic lifecycle guard instead of treating premium language as state intent", () => {
    const contract = normalizeScreenProductContract(rawContract, "Build a premium interview coach");
    expect(contract?.defaultLifecycle).toBe("ready");
  });

  it("preserves an explicitly requested active lifecycle", () => {
    const contract = normalizeScreenProductContract(
      rawContract,
      "Show the live in-progress interview session state while it is listening",
    );
    expect(contract?.defaultLifecycle).toBe("in-progress");
  });

  it("rejects uncovered and unknown product-region mappings", () => {
    const productContract = normalizeScreenProductContract(rawContract, "Show the ready interview coach")!;
    expect(validateProductRequirementCoverage({
      productContract,
      layoutContract: {
        version: 3,
        viewportPlan: "Fit the screen.",
        focalHierarchy: "Guidance then action.",
        sectionRhythm: "Clear macro and micro rhythm.",
        componentDensity: "Compact.",
        ctaPolicy: "One start action.",
        antiPatterns: [],
        regions: [{
          id: "coach",
          purpose: "Coaching preparation",
          contentKind: "focal",
          productRequirementIds: ["session-context", "not-a-requirement"],
        }],
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("unknown product requirement"),
      expect.stringContaining("session-guidance"),
      expect.stringContaining("start-session"),
    ]));
  });
});
