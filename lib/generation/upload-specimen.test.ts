// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { presetAnalysis, presetTokens } from "@/lib/generation/curated-style-preset-fixtures";
import { formatStyleComponents, styleComponentsOf } from "@/lib/generation/style-components";
import type { BuildScreenInput, ProjectCharter, ProjectReferenceDna, PromptImagePayload, ReferenceAnalysis } from "@/lib/types";

import {
  buildUploadSpecimen,
  shouldBuildUploadSpecimen,
  startUploadSpecimen,
  withReferenceSpecimen,
} from "./upload-specimen";

/** A 600x400 upload of two phones side by side. */
const collage = async (): Promise<PromptImagePayload> => {
  const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#E7E2D0" } }).png().toBuffer();
  return { data: png.toString("base64"), mimeType: "image/png" };
};
const dimensions = async (image: PromptImagePayload) => {
  const { width, height } = await sharp(Buffer.from(image.data, "base64")).metadata();
  return { width, height };
};

const screen = (index: number, components: string[], box: { x: number; y: number; width: number; height: number } | null) => ({
  index, suggestedRole: `Screen ${index}`, layoutSummary: `Layout ${index}`, visualHierarchy: `Hierarchy ${index}`, components,
  stylingCues: ["cream cards"], interactionCues: [], copyPatterns: [], implementationNotes: [], ...(box ? { boundingBox: box } : {}),
});
const analysisOf = (screens: ReturnType<typeof screen>[]): ReferenceAnalysis => ({
  ...(presetAnalysis() as unknown as ReferenceAnalysis),
  overallVisualStyle: "Warm, tonal wellness UI with soft cards",
  screenCountEstimate: screens.length,
  screenReferences: screens as unknown as ReferenceAnalysis["screenReferences"],
});
const tokens = presetTokens();

const SENTINEL = "<!-- DRAWGLE_GENERATION_COMPLETE -->";
/** A build that finished ends with the completion sentinel. */
const done = (html: string) => `${html}
${SENTINEL}`;
const marked = (...names: string[]) => `<div class="dg-bg-primary" data-drawgle-id="root">${names.map((name) =>
  `<div data-dg-component="${name}" data-dg-use="use for ${name}" class="dg-surface-card dg-radius-app p-4"><p>${name} sample</p></div>`).join("")}</div>`;

const applies = (overrides: Partial<Parameters<typeof shouldBuildUploadSpecimen>[0]> = {}): Parameters<typeof shouldBuildUploadSpecimen>[0] => ({
  referencePolicy: "user_upload", referenceMode: "user_style", isNewProject: true, screenScoped: false,
  image: { data: "AAAA", mimeType: "image/png" }, analysis: analysisOf([screen(1, ["Cards"], null)]), tokens, existing: null, ...overrides,
});

describe("when an uploaded reference gets a specimen", () => {
  it("does at the project's first generation, for an uploaded style reference that was analysed and has tokens", () => {
    expect(shouldBuildUploadSpecimen(applies())).toBe(true);
  });

  it.each<[string, Partial<Parameters<typeof shouldBuildUploadSpecimen>[0]>]>([
    ["a later generation of the project", { isNewProject: false }],
    ["a generation whose start is not known", { isNewProject: undefined }],
    ["an attachment to a single screen", { screenScoped: true }],
    ["Image to UI, which rebuilds its source instead", { referenceMode: "user_recreate" }],
    ["a curated reference, which has its preset", { referencePolicy: "curated_evidence", referenceMode: "curated_style" }],
    ["a prompt-only project", { referencePolicy: "no_reference", referenceMode: "internal_style", image: null }],
    ["the project's saved upload, reused", { referencePolicy: "project_reference" }],
    ["an upload that was never analysed", { analysis: null }],
    ["an analysis that found no screen", { analysis: analysisOf([]) }],
    ["a project without tokens", { tokens: null }],
    ["a project that already has a specimen", { existing: { source: "upload", components: [{ name: "a", use: "b", html: "<i></i>" }] } }],
    ["a plan prepared ahead, whose preparation owns the specimen", { plannedAhead: true }],
  ])("does not for %s", (_reason, overrides) => {
    expect(shouldBuildUploadSpecimen(applies(overrides))).toBe(false);
  });
});

describe("building the specimen of an upload", () => {
  it("rebuilds the phone with the most components, cropped out of the upload, with its components marked", async () => {
    const seen: BuildScreenInput[] = [];
    const image = await collage();
    const result = await buildUploadSpecimen({
      image, tokens,
      analysis: analysisOf([
        screen(1, ["Header"], { x: 0, y: 0, width: 0.5, height: 1 }),
        screen(2, ["Calendar strip", "Stat tiles", "Chips"], { x: 0.5, y: 0.1, width: 0.5, height: 0.8 }),
      ]),
      buildScreen: async (input) => { seen.push(input); return { code: done(marked("calendar-strip", "stat-tile-pair", "mood-chips", "donut-card")) }; },
    });

    expect(seen).toHaveLength(1);
    const [input] = seen;
    expect(input).toMatchObject({
      referenceMode: "user_recreate", referenceScope: "project", requiresBottomNav: false, specimenMarking: true,
      // the reference's own words, not the project's request
      prompt: "Warm, tonal wellness UI with soft cards",
      designTokens: tokens,
      screenPlan: { name: "Screen 2", type: "root" },
    });
    expect(input.screenPlan.description).toContain("Calendar strip, Stat tiles, Chips");
    // the second phone only: 300 of 600 pixels across, 320 of 400 down, and a hair of margin
    const cropped = await dimensions(input.image!);
    expect(cropped.width).toBeGreaterThanOrEqual(300);
    expect(cropped.width).toBeLessThan(320);
    expect(cropped.height).toBeGreaterThanOrEqual(320);
    expect(cropped.height).toBeLessThan(340);

    expect(result.specimen?.source).toBe("upload");
    expect(result.specimen?.components.map((component) => component.name)).toEqual(["calendar-strip", "stat-tile-pair", "mood-chips", "donut-card"]);
    expect(result.specimen?.components[0]).toMatchObject({ use: "use for calendar-strip" });
    expect(result.notes).toEqual([]);
  });

  it("uses the whole image for an upload of one screen with no box", async () => {
    const seen: BuildScreenInput[] = [];
    const image = await collage();
    const result = await buildUploadSpecimen({
      image, tokens, analysis: analysisOf([screen(1, ["Cards"], null)]),
      buildScreen: async (input) => { seen.push(input); return { code: done(marked("summary-card", "list-row", "chip-row", "stat-tile")) }; },
    });
    expect(seen[0].image).toBe(image);
    expect(result.specimen?.components).toHaveLength(4);
  });

  it("does not rebuild a collage: an upload of several screens with no box to crop one by", async () => {
    const buildScreen = vi.fn();
    const result = await buildUploadSpecimen({
      image: await collage(), tokens, analysis: analysisOf([screen(1, ["A"], null), screen(2, ["B"], null)]), buildScreen,
    });
    expect(buildScreen).not.toHaveBeenCalled();
    expect(result.specimen).toBeNull();
    expect(result.notes[0]).toContain("no box to crop");
  });

  it("gives no specimen, and says why, when the build marked nothing usable", async () => {
    const result = await buildUploadSpecimen({
      image: await collage(), tokens, analysis: analysisOf([screen(1, ["Cards"], null)]),
      buildScreen: async () => ({ code: done('<div class="dg-bg-primary"><p>No markers here</p></div>') }),
    });
    expect(result.specimen).toBeNull();
    expect(result.notes.join(" ")).toContain("marked no usable component");
  });

  it("keeps a thin specimen but says it is thin, and never keeps the status bar or the navigation", async () => {
    const result = await buildUploadSpecimen({
      image: await collage(), tokens, analysis: analysisOf([screen(1, ["Cards"], null)]),
      buildScreen: async () => ({ code: done(`${marked("summary-card")}<nav data-dg-component="bottom-tab-bar" class="fixed bottom-0"><a>Home</a><a>Me</a></nav>`) }),
    });
    expect(result.specimen?.components.map((component) => component.name)).toEqual(["summary-card"]);
    expect(result.notes).toEqual(expect.arrayContaining([expect.stringContaining("skipped bottom-tab-bar"), "only 1 component was marked"]));
  });
});

describe("a specimen build that stops before it finishes", () => {
  const cutShort = `${marked("summary-card")}<div data-dg-component="media-card" class="p-4"><div class="flex"><svg viewBox="0 0 24 24"><path d="M12 2"/></svg></`;

  it("is asked for once more, and the second build is the one used", async () => {
    const codes = [cutShort, done(marked("summary-card", "list-row", "chip-row", "stat-tile"))];
    const buildScreen = vi.fn(async () => ({ code: codes.shift()! }));
    const result = await buildUploadSpecimen({ image: await collage(), tokens, analysis: analysisOf([screen(1, ["Cards"], null)]), buildScreen });
    expect(buildScreen).toHaveBeenCalledTimes(2);
    expect(result.specimen?.components.map((component) => component.name)).toEqual(["summary-card", "list-row", "chip-row", "stat-tile"]);
  });

  it("is not used when the second build is cut short too: the error says so, and the generation goes on without one", async () => {
    const buildScreen = vi.fn(async () => ({ code: cutShort }));
    const settled = vi.fn();
    const ready = { image: await collage(), analysis: analysisOf([screen(1, ["Cards"], null)]), tokens };
    const specimen = await startUploadSpecimen({ applies: applies(), input: () => ready, buildScreen, onSettled: settled });
    expect(specimen).toBeNull();
    expect(buildScreen).toHaveBeenCalledTimes(2);
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ specimen: null, error: expect.objectContaining({ name: "SpecimenIncompleteError" }) }));
  });
});

describe("starting the specimen beside planning", () => {
  const input = async () => ({ image: await collage(), analysis: analysisOf([screen(1, ["Cards"], null)]), tokens });

  it("answers null without building when it does not apply", async () => {
    const buildScreen = vi.fn();
    const settled = vi.fn();
    const specimen = await startUploadSpecimen({ applies: applies({ isNewProject: false }), input: () => { throw new Error("not read"); }, buildScreen, onSettled: settled });
    expect(specimen).toBeNull();
    expect(buildScreen).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it("answers the specimen, and reports what it found", async () => {
    const settled = vi.fn();
    const ready = await input();
    const specimen = await startUploadSpecimen({
      applies: applies(), input: () => ready, onSettled: settled,
      buildScreen: async () => ({ code: done(marked("summary-card", "list-row", "chip-row", "stat-tile")) }),
    });
    expect(specimen?.components).toHaveLength(4);
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ specimen, notes: [] }));
  });

  it("answers null when the build fails, and does not throw: the generation goes on without a specimen", async () => {
    const settled = vi.fn();
    const failure = new Error("model overloaded");
    const ready = await input();
    const specimen = await startUploadSpecimen({
      applies: applies(), input: () => ready, onSettled: settled, buildScreen: async () => { throw failure; },
    });
    expect(specimen).toBeNull();
    expect(settled).toHaveBeenCalledWith({ specimen: null, notes: [], error: failure });
  });

  it("runs beside whatever the caller does meanwhile", async () => {
    const events: string[] = [];
    const ready = await input();
    const pending = startUploadSpecimen({
      applies: applies(), input: () => ready,
      buildScreen: async () => { events.push("build started"); await Promise.resolve(); events.push("build finished"); return { code: done(marked("a-card", "b-card", "c-card", "d-card")) }; },
    });
    events.push("planning");
    await Promise.resolve();
    events.push("planning finished");
    await pending;
    expect(events.slice(0, 2)).toEqual(["build started", "planning"]);
  });
});

describe("putting the specimen on the project's reference DNA", () => {
  const dna = (specimen?: ProjectReferenceDna["specimen"]): ProjectReferenceDna => ({
    schemaVersion: 1, source: "image_analysis", referenceMode: "user_style", createdAt: "2026-09-29T00:00:00.000Z",
    analysis: analysisOf([screen(1, ["Cards"], null)]), screenFamilyContract: {} as never, ...(specimen ? { specimen } : {}),
  });
  const charter = (referenceDna?: ProjectReferenceDna | null): ProjectCharter => ({
    originalPrompt: "A pet app", appType: "Pets", targetAudience: "Families", navigationModel: "Tabs", keyFeatures: ["Pets"], designRationale: "Calm",
    ...(referenceDna === undefined ? {} : { referenceDna }),
  });
  const specimen = { source: "upload" as const, components: [{ name: "summary-card", use: "a summary at the top", html: '<div class="dg-surface-card"></div>' }] };

  it("adds it to the DNA the project's charter carries", () => {
    const next = withReferenceSpecimen(charter(dna()), specimen);
    expect(next.referenceDna?.specimen).toEqual(specimen);
    expect(next.referenceDna?.analysis).toEqual(dna().analysis);
    expect(next.appType).toBe("Pets");
  });

  it("is what every later screen's builder is given as its STYLE COMPONENTS", () => {
    const next = withReferenceSpecimen(charter(dna()), specimen);
    expect(styleComponentsOf(next.referenceDna)).toEqual(specimen.components);
    expect(formatStyleComponents(styleComponentsOf(next.referenceDna))).toContain('- summary-card — a summary at the top — <div class="dg-surface-card"></div>');
    // and a project without one gives its builder none
    expect(styleComponentsOf(charter(dna()).referenceDna)).toEqual([]);
  });

  it("leaves a charter alone when there is nothing to add it to or nothing to add", () => {
    const withoutDna = charter(null);
    expect(withReferenceSpecimen(withoutDna, specimen)).toBe(withoutDna);
    const bare = charter(dna());
    expect(withReferenceSpecimen(bare, null)).toBe(bare);
    expect(withReferenceSpecimen(bare, { source: "upload", components: [{ name: "", use: "", html: "" }] })).toBe(bare);
  });

  it("never replaces a specimen the DNA already has", () => {
    const existing = { source: "preset" as const, components: [{ name: "kept", use: "kept", html: "<i></i>" }] };
    const saved = charter(dna(existing));
    expect(withReferenceSpecimen(saved, specimen)).toBe(saved);
  });
});
