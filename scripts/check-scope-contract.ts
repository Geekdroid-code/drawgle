import assert from "node:assert/strict";

import {
  parsePromptScreenIntent,
  resolveGenerationScopeContract,
} from "@/lib/generation/scope-contract";
import type { ReferenceAnalysisResult } from "@/lib/types";

const countOnly = (count: number): ReferenceAnalysisResult => ({
  analysis: null,
  screenCountEstimate: count,
  screenReferenceCount: null,
  confidence: "high",
  source: "count_only",
  diagnostics: [`test count ${count}`],
});

const noAnalysis: ReferenceAnalysisResult = {
  analysis: null,
  screenCountEstimate: null,
  screenReferenceCount: null,
  confidence: "low",
  source: "none",
  diagnostics: ["test no analysis"],
};

const resolve = (prompt: string, result: ReferenceAnalysisResult | null, referenceMode = "user_recreate" as const) =>
  resolveGenerationScopeContract({
    prompt,
    image: { data: "test", mimeType: "image/png" },
    referenceMode,
    planningMode: "project",
    referenceAnalysisResult: result,
  });

assert.equal(parsePromptScreenIntent("build all three screens").promptScreenCount, 3);
assert.equal(parsePromptScreenIntent("recreate all three").promptScreenCount, 3);
assert.equal(parsePromptScreenIntent("build these 3 views").promptScreenCount, 3);
assert.equal(parsePromptScreenIntent("3-panel app screenshot, recreate all panels").promptScreenCount, 3);

assert.equal(resolve("build all screens in this image", countOnly(3)).finalScreenCount, 3);

const conflict = resolve("build two screens from this image", countOnly(3));
assert.equal(conflict.finalScreenCount, 2);
assert.equal(conflict.countSource, "prompt_count");
assert.equal(conflict.conflictResolution?.policy, "user_wins");

const countFallback = resolve("recreate all screens", countOnly(3));
assert.equal(countFallback.finalScreenCount, 3);
assert.equal(countFallback.countSource, "reference_image");

const totalFailure = resolve("recreate this image", noAnalysis);
assert.equal(totalFailure.finalScreenCount, 1);
assert.equal(totalFailure.countSource, "default_single");
assert.equal(totalFailure.confidence, "low");

const styleReference = resolve("use this style for a fitness app", countOnly(3), "user_style");
assert.equal(styleReference.finalScreenCount, null);
assert.equal(styleReference.countSource, "open_project");

console.log("scope-contract checks passed");
