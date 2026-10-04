import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const presets = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/generation/curated-style-presets", () => ({ resolveCuratedStylePreset: () => presets.current }));
import { designerFixture } from "./test-fixtures";
import { designRequirementsKey } from "./design-requirements";
import { earlyDesignMode, mayPrepareProjectDesign, preparedAnalysisMayApply, preparedReadingForFirstBatch,
  projectDesignPreparationKey, projectDesignPrompt, reusablePreparedAnalysis,
  type ProjectDesignPreparation } from "./project-design-preparation";
import type { DesignTokens, ReferenceAnalysis } from "@/lib/types";

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
    // the token model reads which colours the person's own words name; the reading is not their words
    expect(prompt).toContain("Drawgle's reading of the style reference (not the person's words; their own words are the request above and the requirements below):");
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

  describe("reusing the preparation's reference analysis", () => {
    const screen = (index: number, layoutSummary = `Screen ${index} layout`) => ({ index, suggestedRole: `Role ${index}`,
      layoutSummary, visualHierarchy: "", components: [], stylingCues: [], interactionCues: [], copyPatterns: [], implementationNotes: [] });
    const analysis = (count: number, screens = Array.from({ length: count }, (_, index) => screen(index + 1))) =>
      ({ overallVisualStyle: "Soft tone-on-tone", screenCountEstimate: count, screenReferences: screens }) as unknown as ReferenceAnalysis;
    const tokens = { tokens: { color: { background: { primary: "#ECE9D6" } } } } as unknown as DesignTokens;
    const setup = () => {
      const state = designerFixture();
      const prepared: ProjectDesignPreparation = { designTokens: tokens, referenceAnalysis: analysis(3),
        requirementsKey: designRequirementsKey(state), preparedAt: "2026-10-03T00:00:00.000Z", queuedAt: null };
      const build = { referenceMode: "user_style" as const, referenceId: null, imagePath: state.input.imagePath, hasImage: true };
      return { state, prepared, build };
    };

    it("reuses a complete analysis of the reference the build resolved", () => {
      const { state, prepared, build } = setup();
      expect(preparedAnalysisMayApply(state, build)).toBe(true);
      expect(reusablePreparedAnalysis(prepared, state, build)).toBe(prepared.referenceAnalysis);
    });

    it("analyses again when there is nothing usable to reuse", () => {
      const { state, prepared, build } = setup();
      expect(reusablePreparedAnalysis(null, state, build)).toBeNull();
      expect(reusablePreparedAnalysis({ ...prepared, referenceAnalysis: null }, state, build)).toBeNull();
      // its tokens were made for other design requirements, so the build does not take them either
      expect(reusablePreparedAnalysis({ ...prepared, requirementsKey: "older requirements" }, state, build)).toBeNull();
      // it counted three screens and described one
      expect(reusablePreparedAnalysis({ ...prepared, referenceAnalysis: analysis(3, [screen(1)]) }, state, build)).toBeNull();
      // a salvage filled in placeholders for the screens it could not describe
      const placeholders = analysis(2, [screen(1), screen(2, "Visible screen count was detected, but detailed layout analysis was not available.")]);
      expect(reusablePreparedAnalysis({ ...prepared, referenceAnalysis: placeholders }, state, build)).toBeNull();
    });

    it("never reuses an analysis of another reference or for another mode", () => {
      const { state, prepared, build } = setup();
      for (const other of [
        { ...build, imagePath: "owner/prompt-images/another.webp" },
        { ...build, referenceMode: "curated_style" as const },
        { ...build, referenceMode: "user_recreate" as const },
        { ...build, referenceMode: "internal_style" as const, imagePath: null, hasImage: false },
        { ...build, hasImage: false },
      ]) {
        expect(preparedAnalysisMayApply(state, other)).toBe(false);
        expect(reusablePreparedAnalysis(prepared, state, other)).toBeNull();
      }
      const curated = { ...state, input: { ...state.input, referenceSource: "curated" as const },
        experience: { ...state.experience!, referenceId: "mindfulness-meditation-beige-light" } };
      const curatedBuild = { ...build, referenceMode: "curated_style" as const, referenceId: "mindfulness-meditation-beige-light" };
      expect(preparedAnalysisMayApply(curated, curatedBuild)).toBe(true);
      expect(preparedAnalysisMayApply(curated, { ...curatedBuild, referenceId: "creator-dashboard-airy-light" })).toBe(false);
    });

    it("on a retry, reuses it only when the project's tokens are the ones made from it", () => {
      const { state, prepared, build } = setup();
      expect(reusablePreparedAnalysis(prepared, state, { ...build, projectTokens: structuredClone(tokens) }))
        .toBe(prepared.referenceAnalysis);
      const edited = { tokens: { color: { background: { primary: "#FFFFFF" } } } } as unknown as DesignTokens;
      expect(reusablePreparedAnalysis(prepared, state, { ...build, projectTokens: edited })).toBeNull();
    });

    it("a first batch plans from the prepared reading, waiting for it only when it takes its tokens from it", async () => {
      const { state, prepared, build } = setup();
      const lookups = { awaited: 0, read: 0 };
      const reading = (input: Partial<Parameters<typeof preparedReadingForFirstBatch>[0]>) => preparedReadingForFirstBatch({
        state, build, analyses: true, designTokens: null, projectTokens: null,
        awaitPrepared: async () => { lookups.awaited += 1; return prepared; },
        readPrepared: async () => { lookups.read += 1; return prepared; },
        ...input,
      });

      // the first batch, before any tokens: it waits for the preparation and plans from its reading
      await expect(reading({})).resolves.toBe(prepared.referenceAnalysis);
      expect(lookups).toEqual({ awaited: 1, read: 0 });

      // a retry after the prepared tokens were saved reads the saved preparation, without waiting
      await expect(reading({ designTokens: tokens, projectTokens: tokens })).resolves.toBe(prepared.referenceAnalysis);
      expect(lookups).toEqual({ awaited: 1, read: 1 });

      // nothing is looked up when the batch would not analyse (a charter, the project's DNA, a given analysis),
      // for another reference, or when its tokens did not come from the project
      await expect(reading({ analyses: false })).resolves.toBeNull();
      await expect(reading({ build: { ...build, imagePath: "owner/prompt-images/another.webp" } })).resolves.toBeNull();
      await expect(reading({ state: null })).resolves.toBeNull();
      await expect(reading({ designTokens: tokens, projectTokens: null })).resolves.toBeNull();
      expect(lookups).toEqual({ awaited: 1, read: 1 });

      // a preparation that is missing or unusable leaves the batch to analyse the image itself
      await expect(reading({ awaitPrepared: async () => null })).resolves.toBeNull();
      await expect(reading({ awaitPrepared: async () => ({ ...prepared, referenceAnalysis: analysis(3, [screen(1)]) }) }))
        .resolves.toBeNull();
    });
  });
});
