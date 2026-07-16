import { describe, expect, it } from "vitest";

import { resolveGenerationScopeContract } from "@/lib/generation/scope-contract";

describe("generation scope reference provenance", () => {
  it("preserves prompt-only internal style instead of labeling it as curated style", () => {
    const contract = resolveGenerationScopeContract({
      prompt: "Create a luxury skincare routine app.",
      image: null,
      referenceMode: "internal_style",
      planningMode: "project",
      referenceAnalysisResult: null,
    });

    expect(contract.referenceMode).toBe("internal_style");
    expect(contract.requiresConfirmation).toBe(false);
  });

  it("preserves an accepted curated reference as curated style", () => {
    const contract = resolveGenerationScopeContract({
      prompt: "Create a luxury skincare routine app.",
      image: {
        data: "image-data",
        mimeType: "image/jpeg",
      },
      referenceMode: "curated_style",
      planningMode: "project",
      referenceAnalysisResult: null,
    });

    expect(contract.referenceMode).toBe("curated_style");
  });
});
