import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { designerFixture } from "./test-fixtures";
import { mayPrepareProjectDesign, projectDesignPreparationKey, projectDesignPrompt } from "./project-design-preparation";

describe("project-wide design preparation", () => {
  it("uses project context without selecting an output batch", () => {
    const state = designerFixture();
    state.input.originalRequest = "A store for T-shirts";
    const prompt = projectDesignPrompt(state);
    expect(prompt).toContain("A store for T-shirts");
    expect(prompt).toContain("Product-led restrained shopping");
    expect(prompt).not.toContain("screen:onboarding");
    expect(prompt).not.toContain("Design exactly");
  });

  it("survives screen scope and approval changes but expires on visual inputs", () => {
    const state = designerFixture();
    const key = projectDesignPreparationKey(state, null);
    expect(projectDesignPreparationKey({ ...state, experience: Object.fromEntries(
      Object.entries(state.experience!).reverse()) as typeof state.experience }, null)).toBe(key);
    expect(projectDesignPreparationKey({ ...state, phase: "canvas",
      contentRevision: (state.contentRevision ?? 0) + 1,
      scope: { ...state.scope!, status: "approved", manifest: [] } }, null)).toBe(key);
    expect(projectDesignPreparationKey({ ...state, experience: { ...state.experience!, direction: "New direction" } }, null)).not.toBe(key);
    expect(projectDesignPreparationKey(state, 2)).not.toBe(key);
    expect(projectDesignPreparationKey({ ...state, input: { ...state.input, originalRequest: "Different product" } }, null)).not.toBe(key);
  });

  it("does not prepare exact recreations or request-local screen references", () => {
    const state = designerFixture();
    expect(mayPrepareProjectDesign(state)).toBe(true);
    expect(mayPrepareProjectDesign({ ...state, input: { ...state.input, imageReferenceMode: "recreate" } })).toBe(false);
    expect(mayPrepareProjectDesign({ ...state, screenReference: { imagePath: "one", hash: "two" } })).toBe(false);
  });
});
