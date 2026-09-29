// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { BuildScreenInput, ProjectCharter, ProjectNavigationData, ScreenData } from "@/lib/types";

import {
  bundleBuildInput,
  emptyUsage,
  formatArmMarkdown,
  formatComparison,
  mergeUsage,
  pickScreens,
  referencePayload,
  runBuilds,
  summarizeArm,
  usageOfChunk,
  type ArmFile,
  type BuildRecord,
} from "./ab-run";
import type { ProjectBundle } from "./bundle";
import { priceOf } from "./cost";

const screen = (name: string, order: number, extra: Partial<ScreenData> = {}): ScreenData => ({
  id: `id-${order}`, projectId: "p", userId: "u", name, code: `<div>old ${name}</div>`, prompt: `SCREEN PURPOSE: ${name} brief.`,
  chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false }, navigationItemId: `nav-${order}`,
  x: 0, y: 0, sortIndex: order, createdAt: `2026-09-29T00:00:0${order}Z`, updatedAt: `2026-09-29T00:00:0${order}Z`, ...extra,
});

const charter = {
  originalPrompt: "A family pet app", appType: "Pets", targetAudience: "Families", navigationModel: "Bar", keyFeatures: ["Pets"], designRationale: "Calm",
  navigationArchitecture: { kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back", consistencyRules: [], rationale: "Peers" },
  referenceDna: {
    schemaVersion: 1, source: "image_analysis", referenceMode: "curated_style", createdAt: "2026-09-29T00:00:00Z",
    analysis: { screenReferences: [] }, screenFamilyContract: { family: "tonal" },
    specimen: { source: "preset", components: [{ name: "summary-card", use: "a summary", html: '<div class="dg-surface-card"></div>' }] },
  },
} as unknown as ProjectCharter;

const navigation = { plan: { enabled: true, kind: "bottom-tabs", items: [], visualBrief: "", screenChrome: [] } } as unknown as ProjectNavigationData;

const bundle = (extra: Partial<ProjectBundle> = {}): ProjectBundle => ({
  version: 1, fetchedAt: "2026-09-29T00:00:00Z",
  project: { id: "0ce99a06-0000-4000-8000-000000000000", name: "Pets", prompt: "A family pet app", designTokens: { system_schema: "mobile_universal_core", tokens: {} } as never, charter, productPlanning: null },
  screens: [screen("Today", 1), screen("Pet Library", 2), screen("Add Pet", 3, { chromePolicy: { chrome: "top-bar-back", showPrimaryNavigation: false, showsBackButton: true }, navigationItemId: null }), screen("Routines", 4)],
  navigation,
  reference: { source: "curated", id: "mindfulness-meditation-beige-light", imageUrl: null, imagePath: null, file: null },
  ...extra,
});
const image = { bytes: Buffer.from("reference bytes"), extension: "jpg" };

describe("tokens from a provider chunk", () => {
  it("reads Gemini's usage and ignores what is not a count", () => {
    expect(usageOfChunk({ usageMetadata: { promptTokenCount: 9000, candidatesTokenCount: 3000, thoughtsTokenCount: 700, totalTokenCount: 12700 } }))
      .toEqual({ inputTokens: 9000, outputTokens: 3000, thinkingTokens: 700 });
    expect(usageOfChunk({ usageMetadata: { promptTokenCount: "9000", candidatesTokenCount: Number.NaN } })).toEqual({ inputTokens: undefined, outputTokens: undefined, thinkingTokens: undefined });
    expect(usageOfChunk({ text: "no usage here" })).toEqual({});
    expect(usageOfChunk(null)).toEqual({});
  });

  it("keeps the latest count of each kind, and what an earlier chunk had when a later one has none", () => {
    let usage = emptyUsage();
    usage = mergeUsage(usage, { inputTokens: 9000, outputTokens: 100 });
    usage = mergeUsage(usage, {});
    usage = mergeUsage(usage, { outputTokens: 3000, thinkingTokens: 500 });
    expect(usage).toEqual({ inputTokens: 9000, outputTokens: 3000, thinkingTokens: 500 });
  });
});

describe("the reference as the builder gets it", () => {
  it("is the image's bytes with its type, or nothing", () => {
    expect(referencePayload(image)).toEqual({ data: Buffer.from("reference bytes").toString("base64"), mimeType: "image/jpeg" });
    expect(referencePayload({ ...image, extension: "PNG" })?.mimeType).toBe("image/png");
    expect(referencePayload({ ...image, extension: "webp" })?.mimeType).toBe("image/webp");
    expect(referencePayload(null)).toBeNull();
  });
});

describe("the build input for a stored screen", () => {
  it("carries the screen's brief, the project's tokens, reference, family contract, components and navigation", () => {
    const b = bundle();
    const input = bundleBuildInput({ bundle: b, screen: b.screens[0], image });
    expect(input).toMatchObject({
      prompt: "A family pet app", referenceScope: "project", referenceMode: "curated_style", referenceSource: "curated",
      referenceId: "mindfulness-meditation-beige-light", requiresBottomNav: true,
      screenPlan: { name: "Today", type: "root", description: "SCREEN PURPOSE: Today brief.", navigationItemId: "nav-1" },
      screenFamilyContract: { family: "tonal" }, navigationArchitecture: { kind: "bottom-tabs-app" },
    });
    expect(input.designTokens).toBe(b.project.designTokens);
    expect(input.navigationPlan).toBe(navigation.plan);
    expect(input.image?.mimeType).toBe("image/jpeg");
    expect(input.styleComponents).toEqual([{ name: "summary-card", use: "a summary", html: '<div class="dg-surface-card"></div>' }]);
  });

  it("does not ask for the bar on a screen that has none, and calls a detail screen a detail screen", () => {
    const b = bundle();
    const input = bundleBuildInput({ bundle: b, screen: b.screens[2], image });
    expect(input.requiresBottomNav).toBe(false);
    expect(input.screenPlan).toMatchObject({ type: "detail", navigationItemId: null });
  });

  it("treats an uploaded reference as the user's, and a project without one as prompt-only", () => {
    const upload = bundle({ reference: { source: "upload", id: null, imageUrl: null, imagePath: "u/r.png", file: null } });
    expect(bundleBuildInput({ bundle: upload, screen: upload.screens[0], image })).toMatchObject({ referenceMode: "user_style", referenceSource: "user_upload", referenceId: null });
    const none = bundle({ reference: { source: "none", id: null, imageUrl: null, imagePath: null, file: null } });
    const input = bundleBuildInput({ bundle: none, screen: none.screens[0], image: null });
    expect(input).toMatchObject({ referenceMode: "internal_style", referenceSource: null, image: null });
  });

  it("asks for no bar when the project has none", () => {
    const b = bundle({ navigation: null });
    expect(bundleBuildInput({ bundle: b, screen: b.screens[0], image }).requiresBottomNav).toBe(false);
  });
});

describe("which screens are built", () => {
  it("is the first three parent screens that have a brief, in canvas order, unless told", () => {
    const b = bundle({ screens: [...bundle().screens.reverse(), screen("Sheet", 5, { stateKey: "sheet" }), screen("Empty", 6, { prompt: "  " })] });
    expect(pickScreens({ bundle: b }).map((entry) => entry.name)).toEqual(["Today", "Pet Library", "Add Pet"]);
    expect(pickScreens({ bundle: b, limit: 1 }).map((entry) => entry.name)).toEqual(["Today"]);
    expect(pickScreens({ bundle: b, limit: 99 }).map((entry) => entry.name)).toEqual(["Today", "Pet Library", "Add Pet", "Routines"]);
  });

  it("takes the ones named, by name or by the number the contact sheet gives them", () => {
    const b = bundle();
    expect(pickScreens({ bundle: b, only: ["routines", "1"] }).map((entry) => entry.name)).toEqual(["Routines", "Today"]);
    expect(pickScreens({ bundle: b, only: ["pet"] }).map((entry) => entry.name)).toEqual(["Pet Library"]);
    expect(pickScreens({ bundle: b, only: ["2", "Pet Library"] }).map((entry) => entry.name)).toEqual(["Pet Library"]);
  });

  it("says which screens there are when none of those asked for is one", () => {
    expect(() => pickScreens({ bundle: bundle(), only: ["Nowhere", "9"] })).toThrow(/None of Nowhere, 9 .*1\. Today; 2\. Pet Library/);
  });
});

describe("running the builds", () => {
  const flash = priceOf("gemini-3-flash-preview");
  /** A builder that streams two chunks, the second carrying the usage, as Gemini does. */
  const builder = (received: BuildScreenInput[] = []) => async function* (input: BuildScreenInput) {
    received.push(input);
    yield `<div>${input.screenPlan.name}`;
    input.onResponseChunk?.({ usageMetadata: { promptTokenCount: 9000, candidatesTokenCount: 100 } });
    yield "</div>";
    input.onResponseChunk?.({ usageMetadata: { promptTokenCount: 9000, candidatesTokenCount: 3000, thoughtsTokenCount: 500 } });
  };
  const clock = () => { let time = 0; return () => (time += 2000); };

  it("builds each screen from its input, records its tokens, time and cost, and rebuilds only those screens", async () => {
    const received: BuildScreenInput[] = [];
    const b = bundle();
    const screens = pickScreens({ bundle: b, limit: 2 });
    const { records, rebuilt } = await runBuilds({ bundle: b, image, screens, buildScreen: builder(received), finish: (raw) => raw.toUpperCase(), price: flash, now: clock() });

    expect(received.map((input) => input.screenPlan.name)).toEqual(["Today", "Pet Library"]);
    expect(records.map((record) => record.screen)).toEqual(["Today", "Pet Library"]);
    // the clock ticks 2s per reading, so a build that reads it twice took 2s
    expect(records[0]).toMatchObject({ seconds: 2, usage: { inputTokens: 9000, outputTokens: 3000, thinkingTokens: 500 }, codeChars: "<DIV>TODAY</DIV>".length });
    expect(records[0].costUsd).toBeCloseTo((9000 * 0.5 + 3500 * 3) / 1_000_000, 6);
    expect(records[0].error).toBeUndefined();

    expect(rebuilt.screens.map((entry) => [entry.name, entry.code])).toEqual([["Today", "<DIV>TODAY</DIV>"], ["Pet Library", "<DIV>PET LIBRARY</DIV>"]]);
    // what the harness renders is the rebuilt screens; the bundle it was made from is untouched
    expect(b.screens[0].code).toBe("<div>old Today</div>");
    expect(rebuilt.project).toBe(b.project);
    expect(rebuilt.navigation).toBe(b.navigation);
  });

  it("gives every screen the same input apart from the screen", async () => {
    const received: BuildScreenInput[] = [];
    const b = bundle();
    await runBuilds({ bundle: b, image, screens: pickScreens({ bundle: b, limit: 2 }), buildScreen: builder(received), finish: (raw) => raw, price: null, now: clock() });
    const [first, second] = received.map(({ screenPlan: _plan, onResponseChunk: _chunk, requiresBottomNav: _nav, ...rest }) => rest);
    expect(first).toEqual(second);
  });

  it("records a build that failed without its error, and goes on to the next", async () => {
    const boom = new Error("Bearer secret-token was rejected");
    const failing = async function* (input: BuildScreenInput): AsyncGenerator<string> {
      if (input.screenPlan.name === "Today") throw boom;
      yield "<div>ok</div>";
    };
    const b = bundle();
    const { records, rebuilt } = await runBuilds({ bundle: b, image, screens: pickScreens({ bundle: b, limit: 2 }), buildScreen: failing, finish: (raw) => raw, price: flash, now: clock() });
    expect(records[0]).toMatchObject({ screen: "Today", error: "The build failed; no error details were saved.", costUsd: null, codeChars: 0 });
    expect(JSON.stringify(records)).not.toContain("secret-token");
    expect(records[1].error).toBeUndefined();
    expect(rebuilt.screens.map((entry) => entry.name)).toEqual(["Pet Library"]);
  });

  it("has a build with no reported usage cost nothing it can name", async () => {
    const silent = async function* () { yield "<div>x</div>"; };
    const b = bundle();
    const { records } = await runBuilds({ bundle: b, image, screens: pickScreens({ bundle: b, limit: 1 }), buildScreen: silent, finish: (raw) => raw, price: flash, now: clock() });
    expect(records[0]).toMatchObject({ usage: { inputTokens: null, outputTokens: null, thinkingTokens: null }, costUsd: null });
  });

  it("does not read the environment or the network: the builder it is given is the only call", async () => {
    const buildScreen = vi.fn(builder());
    const b = bundle();
    await runBuilds({ bundle: b, image, screens: pickScreens({ bundle: b, limit: 3 }), buildScreen, finish: (raw) => raw, price: null, now: clock() });
    expect(buildScreen).toHaveBeenCalledTimes(3);
  });
});

describe("reading the arms", () => {
  const record = (screenName: string, seconds: number, cost: number | null, usage = { inputTokens: 9000, outputTokens: 3000, thinkingTokens: 0 }): BuildRecord =>
    ({ screen: screenName, seconds, usage, codeChars: 12000, costUsd: cost });
  const failed: BuildRecord = { screen: "Broken", seconds: 1, usage: emptyUsage(), codeChars: 0, costUsd: null, error: "The build failed; no error details were saved." };
  const arm = (label: string, model: string, thinking: string, records: BuildRecord[], price = priceOf(model)): ArmFile =>
    ({ version: 1, label, model, thinking, bundle: "scripts/design-eval/out/baseline/pets-family", price, records });

  it("averages the builds that finished, and totals what has a cost", () => {
    const summary = summarizeArm([record("A", 10, 0.01), record("B", 20, 0.03), failed]);
    expect(summary).toMatchObject({ builds: 2, failed: 1, seconds: 15, inputTokens: 9000, outputTokens: 3000, thinkingTokens: 0 });
    expect(summary.costUsd).toBeCloseTo(0.02, 6);
    expect(summary.totalCostUsd).toBeCloseTo(0.04, 6);
    // no price for the model: tokens are known and a cost is not
    expect(summarizeArm([record("A", 10, null)])).toMatchObject({ costUsd: null, totalCostUsd: null, inputTokens: 9000 });
    expect(summarizeArm([failed])).toMatchObject({ builds: 0, failed: 1, seconds: null, costUsd: null });
  });

  it("writes one arm's builds as a table", () => {
    const markdown = formatArmMarkdown(arm("pro-low", "gemini-3-pro-preview", "low", [record("Today", 41.26, 0.054), failed]));
    expect(markdown).toContain("# pro-low: gemini-3-pro-preview, thinking low");
    expect(markdown).toContain("| Today | 41.3s | 9,000 | 3,000 | 0 | 12,000 | $0.0540 |");
    expect(markdown).toContain("| Broken | failed | n/a | n/a | n/a | n/a | n/a |");
    expect(markdown).toContain("Mean per build: 41.3s, $0.0540; total $0.0540 over 1 build, 1 failed.");
    expect(markdown).toContain("Priced at $2/M in and $12/M out (thinking tokens as output).");
    expect(formatArmMarkdown(arm("x", "unknown", "low", [record("A", 1, null)], null))).toContain("No price is known for this model: pass --price to see a cost.");
  });

  it("puts the arms side by side", () => {
    const table = formatComparison([
      arm("flash-low", "gemini-3-flash-preview", "low", [record("A", 20, 0.0135), record("B", 24, 0.0135)]),
      arm("pro-low", "gemini-3-pro-preview", "low", [record("A", 40, 0.054), failed]),
    ]);
    const lines = table.split("\n");
    expect(lines[0]).toBe("| Arm | Model | Thinking | Builds | Time | In | Out | Thinking | Cost per build | Total |");
    expect(lines[2]).toBe("| flash-low | gemini-3-flash-preview | low | 2 | 22.0s | 9,000 | 3,000 | 0 | $0.0135 | $0.0270 |");
    expect(lines[3]).toBe("| pro-low | gemini-3-pro-preview | low | 1 (+1 failed) | 40.0s | 9,000 | 3,000 | 0 | $0.0540 | $0.0540 |");
  });
});
