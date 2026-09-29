import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const presets = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/generation/curated-style-presets", () => ({ resolveCuratedStylePreset: () => presets.current }));
import { designerFixture } from "./test-fixtures";
import { earlyDesignMode, mayPrepareProjectDesign, projectDesignPreparationKey, projectDesignPrompt } from "./project-design-preparation";

describe("project-wide design preparation", () => {
  it("prepares by default while preserving explicit shadow and off modes", () => {
    const previous = process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE;
    try {
      delete process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE;
      expect(earlyDesignMode()).toBe("on");
      process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE = "shadow";
      expect(earlyDesignMode()).toBe("shadow");
      process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE = "off";
      expect(earlyDesignMode()).toBe("off");
    } finally {
      if (previous === undefined) delete process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE;
      else process.env.DRAWGLE_EARLY_PROJECT_DESIGN_MODE = previous;
    }
  });
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

  it("expires when a curated reference gains an approved preset or its preset is rebuilt", () => {
    const state = designerFixture();
    const curated = { ...state, experience: { ...state.experience!, referenceId: "mindfulness-meditation-beige-light" } };
    try {
      presets.current = null;
      const without = projectDesignPreparationKey(curated, null);
      presets.current = { tokens: { version: "first build" } };
      const first = projectDesignPreparationKey(curated, null);
      presets.current = { tokens: { version: "rebuilt" } };
      const rebuilt = projectDesignPreparationKey(curated, null);
      presets.current = { tokens: { version: "first build" } };
      expect(first).not.toBe(without);
      expect(rebuilt).not.toBe(first);
      // the same preset, the same key
      expect(projectDesignPreparationKey(curated, null)).toBe(first);
      // an uploaded reference is never designed from a preset
      presets.current = null;
      const upload = projectDesignPreparationKey(state, null);
      presets.current = { tokens: { version: "first build" } };
      expect(projectDesignPreparationKey(state, null)).toBe(upload);
    } finally {
      presets.current = null;
    }
  });

  it("does not prepare exact recreations or request-local screen references", () => {
    const state = designerFixture();
    expect(mayPrepareProjectDesign(state)).toBe(true);
    expect(mayPrepareProjectDesign({ ...state, input: { ...state.input, imageReferenceMode: "recreate" } })).toBe(false);
    expect(mayPrepareProjectDesign({ ...state, screenReference: { imagePath: "one", hash: "two" } })).toBe(false);
  });
});
