import { describe, expect, it } from "vitest";
import { createProductPlanning } from "./model";
import { productReferenceExecution } from "./reference-execution";
import { experienceFixture } from "./test-fixtures";

describe("product reference execution provenance", () => {
  it("resolves curated evidence with curated policy, mode, source, and catalog metadata", () => {
    const base = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
    const experience = {
      ...experienceFixture(),
      referenceId: "fintech-minimalist-grain-cream",
      referencePath: "owner/prompt-images/curated.webp",
      catalogHash: "catalog-hash-123",
    };
    const state = {
      ...base,
      input: { ...base.input, imagePath: experience.referencePath, referenceSource: "curated" as const },
      experience,
    };
    const execution = productReferenceExecution(state);
    expect(execution).toEqual({
      policy: "curated_evidence",
      mode: "curated_style",
      source: "curated",
      imagePath: "owner/prompt-images/curated.webp",
      referenceId: "fintech-minimalist-grain-cream",
      catalogHash: "catalog-hash-123",
    });
  });

  it("resolves user upload in style mode to user_upload policy and user_style mode", () => {
    const base = createProductPlanning({ imagePath: "owner/prompt-images/upload.webp", imageReferenceMode: "style", stylePresetSlug: null });
    const execution = productReferenceExecution(base);
    expect(execution).toEqual({
      policy: "user_upload",
      mode: "user_style",
      source: "user_upload",
      imagePath: "owner/prompt-images/upload.webp",
      referenceId: null,
      catalogHash: null,
    });
  });

  it("resolves user upload in recreate mode to user_upload policy and user_recreate mode", () => {
    const base = createProductPlanning({ imagePath: "owner/prompt-images/upload.webp", imageReferenceMode: "recreate", stylePresetSlug: null });
    const execution = productReferenceExecution(base);
    expect(execution).toEqual({
      policy: "user_upload",
      mode: "user_recreate",
      source: "user_upload",
      imagePath: "owner/prompt-images/upload.webp",
      referenceId: null,
      catalogHash: null,
    });
  });

  it("resolves explicit no-reference preference to no_reference policy and internal_style mode", () => {
    const base = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
    const state = {
      ...base,
      input: {
        ...base.input,
        referencePreference: {
          mode: "none" as const,
          evidence: "User requested prompt-only generation without reference images",
          messageId: "00000000-0000-0000-0000-000000000001",
        },
      },
    };
    const execution = productReferenceExecution(state);
    expect(execution).toEqual({
      policy: "no_reference",
      mode: "internal_style",
      source: null,
      imagePath: null,
      referenceId: null,
      catalogHash: null,
    });
  });

  it("falls back to curated_fallback when no image or preference is provided", () => {
    const base = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
    const execution = productReferenceExecution(base);
    expect(execution).toEqual({
      policy: "curated_fallback",
      mode: "internal_style",
      source: null,
      imagePath: null,
      referenceId: null,
      catalogHash: null,
    });
  });
});
