import { describe, expect, it } from "vitest";
import { createProductPlanning } from "./model";
import { normalizePlanningInput, planningReferenceContext } from "./reference-context";
import { experienceFixture } from "./test-fixtures";

describe("authoritative product reference context", () => {
  it("normalizes the lobby's no-image recreation default at creation", () => {
    const state = createProductPlanning({ imagePath: null, imageReferenceMode: "recreate", stylePresetSlug: null });
    expect(state.input).toMatchObject({ referenceSource: "none", imageReferenceMode: "style" });
    expect(planningReferenceContext(state)).toMatchObject({ mode: "prompt", hasUserUpload: false, assessmentMode: "product" });
  });
  it("repairs existing invalid input without treating a style preset as an upload", () => {
    const input = { imagePath: null, imageReferenceMode: "recreate" as const, stylePresetSlug: "editorial" };
    expect(normalizePlanningInput({ input })).toMatchObject({ imageReferenceMode: "style", referenceSource: "none" });
  });
  it.each(["style", "recreate"] as const)("preserves a real upload's %s selection", mode => {
    const state = createProductPlanning({ imagePath: "owner/prompt-images/user.webp", imageReferenceMode: mode, stylePresetSlug: null });
    expect(planningReferenceContext(state)).toMatchObject({ source: "user", mode, hasUserUpload: true });
  });
  it("identifies older library references from inspected provenance and prevents recreation", () => {
    const experience = { ...experienceFixture(), referenceId: "curated-design" };
    const state = { input: { imagePath: experience.referencePath, imageReferenceMode: "recreate" as const, stylePresetSlug: null }, experience };
    expect(planningReferenceContext(state)).toMatchObject({ source: "curated", mode: "prompt", hasUserUpload: false });
    expect(normalizePlanningInput(state).imageReferenceMode).toBe("style");
    expect(planningReferenceContext({ input: { ...state.input, referenceSource: "curated" } }).source).toBe("curated");
  });
});
