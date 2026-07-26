import { describe, expect, it } from "vitest";

import {
  analyzePromptScreenIntent,
  resolveGenerationScopeContract,
} from "@/lib/generation/scope-contract";

describe("generation scope reference provenance", () => {
  it("keeps explicit screen counts on the deterministic path", async () => {
    let llmCalls = 0;
    const intent = await analyzePromptScreenIntent({
      prompt: "Create exactly 2 screens: Home and Product Details.",
      llmLog: () => {
        llmCalls += 1;
      },
    });

    expect(intent.promptScreenCount).toBe(2);
    expect(intent.screens).toHaveLength(2);
    expect(llmCalls).toBe(0);
  });

  it("keeps single-screen mode deterministic without semantic interpretation", async () => {
    let llmCalls = 0;
    const intent = await analyzePromptScreenIntent({
      prompt: "Create the account workspace.",
      planningMode: "single-screen",
      llmLog: () => {
        llmCalls += 1;
      },
    });

    expect(intent.promptScreenCount).toBe(1);
    expect(llmCalls).toBe(0);
  });

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
