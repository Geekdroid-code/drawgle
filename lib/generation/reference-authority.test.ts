import { describe, expect, it } from "vitest";
import { resolveReferenceScope } from "./reference-authority";
import { shouldAttachReferenceImage } from "./reference-image";
import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { createProductPlanning } from "@/lib/product-planning/model";

describe("reference authority", () => {
  it("protects legacy and current canvas projects but preserves initial recreation batches", () => {
    expect(resolveReferenceScope({ hasProjectDesign: true })).toBe("screen");
    expect(resolveReferenceScope({ productPhase: "canvas" })).toBe("screen");
    expect(resolveReferenceScope({ productPhase: "discovery", hasProjectDesign: true, isNewProject: false })).toBe("project");
    expect(resolveReferenceScope({ referenceScope: "screen", isNewProject: true })).toBe("screen");
  });
  it("uses the attachment only for its scope, never for future inherited references", () => {
    const state = createProductPlanning({ imagePath: "project.webp", imageReferenceMode: "style", stylePresetSlug: null });
    state.phase = "canvas";
    state.screenReference = { imagePath: "chat.webp", hash: "hash" };
    expect(productReferenceExecution(state).imagePath).toBe("chat.webp");
    expect(productReferenceExecution(state, false).imagePath).toBe("project.webp");
    expect(productReferenceExecution(state, false).policy).toBe("project_reference");
    expect(state.input.imagePath).toBe("project.webp");
  });
  it("does not treat a later product scope's inherited source as a fresh canvas attachment", () => {
    const state = createProductPlanning({ imagePath: "original.webp", imageReferenceMode: "recreate", stylePresetSlug: null });
    state.phase = "canvas";
    expect(productReferenceExecution(state)).toMatchObject({ policy: "project_reference", mode: "user_style", source: "project_upload" });
  });
  it("only passes style pixels to the builder when they are explicit local guidance", () => {
    const input = { engineVersion: "v2" as const, referenceMode: "user_style" as const, image: { data: "pixels", mimeType: "image/png" } };
    expect(shouldAttachReferenceImage(input)).toBe(false);
    expect(shouldAttachReferenceImage({ ...input, screenGuidance: true })).toBe(true);
    expect(shouldAttachReferenceImage({ ...input, referenceMode: "user_recreate" })).toBe(true);
  });
});
