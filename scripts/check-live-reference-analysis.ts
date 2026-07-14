import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { analyzeReferenceImageForScope } from "@/lib/generation/scope-contract";

const main = async () => {
  const imagePath = process.argv[2];
  if (!imagePath) throw new Error("Pass a reference image path.");
  const image = await readFile(imagePath);
  const result = await analyzeReferenceImageForScope({
    prompt: "Use this visual style for a premium photo restoration app.",
    image: { data: image.toString("base64"), mimeType: "image/png" },
    referenceMode: "user_style",
  });

  assert.equal(result.screenCountEstimate, 3);
  assert.equal(result.screenReferenceCount, 3);
  assert.equal(result.confidence, "high");
  assert.equal(result.validationIssues?.length ?? 0, 0);
  console.log(JSON.stringify({
    screenCountEstimate: result.screenCountEstimate,
    screenReferenceCount: result.screenReferenceCount,
    confidence: result.confidence,
    source: result.source,
    boundingBoxes: result.analysis?.screenReferences.map((screen) => screen.boundingBox),
  }, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
