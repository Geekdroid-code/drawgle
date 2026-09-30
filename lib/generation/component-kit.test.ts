// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { presetTokens } from "@/lib/generation/curated-style-preset-fixtures";
import { formatStyleComponents } from "@/lib/generation/style-components";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import type { BuildScreenInput, ProjectCharter, ProjectReferenceDna, ReferenceSpecimen } from "@/lib/types";

import {
  buildComponentKit,
  COMPONENT_KIT_BUILD_WAIT_MS,
  COMPONENT_KIT_MARKING_INSTRUCTION,
  COMPONENT_KIT_WAIT_MS,
  componentKitBasis,
  componentKitBuildInput,
  componentKitPromptOf,
  existingProjectComponents,
  kitScreensOf,
  projectComponents,
  projectComponentSummaries,
  shouldBuildComponentKit,
  startComponentKit,
  type ComponentKitInput,
  withComponentKit,
  withinComponentKitWait,
} from "./component-kit";

const tokens = presetTokens();
const screens = [
  { name: "Dashboard", purpose: "Outstanding total and recent invoices" },
  { name: "Clients", purpose: "Every client with what they owe" },
  { name: "Invoice Detail", purpose: "One invoice with its client and line items" },
];
const input = (overrides: Partial<ComponentKitInput> = {}): ComponentKitInput => ({
  prompt: "An invoice tracker for freelancers", screens, tokens, referenceMode: "internal_style", ...overrides,
});

const SENTINEL = "<!-- DRAWGLE_GENERATION_COMPLETE -->";
/** A build that finished ends with the completion sentinel. */
const done = (html: string) => `${html}\n${SENTINEL}`;
const marked = (...names: string[]) => `<div class="dg-bg-primary" data-drawgle-id="root">${names.map((name) =>
  `<div data-dg-component="${name}" data-dg-use="use for ${name}" class="dg-surface-card dg-radius-app p-4"><p>${name} sample</p></div>`).join("")}</div>`;
const fullKit = done(marked("main-header", "detail-top-bar", "invoice-row", "client-row", "summary-tile"));

const applies = (overrides: Partial<Parameters<typeof shouldBuildComponentKit>[0]> = {}): Parameters<typeof shouldBuildComponentKit>[0] => ({
  referenceMode: "internal_style", isNewProject: true, screenScoped: false, tokens, existing: [], screenCount: 3, ...overrides,
});

const charter = (extra: Partial<ProjectCharter> = {}): ProjectCharter => ({
  originalPrompt: "An invoice tracker", appType: "Invoices", targetAudience: "Freelancers", navigationModel: "Tabs",
  keyFeatures: ["Invoices"], designRationale: "Calm", ...extra,
});
const component = (name: string) => ({ name, use: `use for ${name}`, html: `<div class="dg-surface-card">${name}</div>` });
const kit = (names: string[], basis?: string): ReferenceSpecimen => ({ source: "kit", components: names.map(component), ...(basis ? { basis } : {}) });

describe("when a project gets a component kit", () => {
  it.each([
    ["a prompt-only project", "internal_style"],
    ["a project styled from an upload", "user_style"],
    ["a project styled from a curated reference", "curated_style"],
  ] as const)("does at the first generation of %s with two screens or more", (_reason, referenceMode) => {
    expect(shouldBuildComponentKit(applies({ referenceMode }))).toBe(true);
    expect(shouldBuildComponentKit(applies({ referenceMode, screenCount: 2 }))).toBe(true);
  });

  it.each<[string, Partial<Parameters<typeof shouldBuildComponentKit>[0]>]>([
    ["a later generation of the project, which reuses the kit on its charter", { isNewProject: false }],
    ["a generation whose start is not known", { isNewProject: undefined }],
    ["an attachment to a single screen", { screenScoped: true }],
    ["Image to UI, which rebuilds its source instead", { referenceMode: "user_recreate" }],
    ["a project without tokens", { tokens: null }],
    ["a project that already has components (a kit, or an approved preset's)", { existing: [component("kept")] }],
    ["a flow of one screen, which has nothing to be consistent with", { screenCount: 1 }],
    ["a plan prepared ahead, whose preparation owns the kit", { plannedAhead: true }],
  ])("does not for %s", (_reason, overrides) => {
    expect(shouldBuildComponentKit(applies(overrides))).toBe(false);
  });
});

describe("what the kit build is asked for", () => {
  it("is one page of the product's shared components, drawn with the project's tokens and reference, and marked", () => {
    const image = { data: "AAAA", mimeType: "image/png" };
    const built = componentKitBuildInput(input({ image, referenceMode: "user_style", referenceId: "ref", productContent: "Invoices have a number and a due date" }));
    expect(built).toMatchObject({
      screenPlan: { name: "Component kit", type: "root" },
      prompt: "An invoice tracker for freelancers",
      designTokens: tokens,
      image,
      referenceMode: "user_style",
      referenceId: "ref",
      referenceScope: "project",
      productContent: "Invoices have a number and a due date",
      requiresBottomNav: false,
      specimenMarking: "kit",
    });
    const brief = built.screenPlan.description;
    // every screen, with what it is for, so that the kit holds what they need
    for (const screen of screens) expect(brief).toContain(`${screen.name} (${screen.purpose})`);
    expect(brief).toContain("the one card or row that shows it on every screen");
    expect(brief).toContain("the header of a main screen, and the top bar of a detail screen");
    expect(brief).toContain("A person is shown the same way everywhere");
  });

  it("asks for marked, composed components and leaves the navigation to the renderer", () => {
    expect(COMPONENT_KIT_MARKING_INSTRUCTION).toContain('data-dg-component="<kebab-name>"');
    expect(COMPONENT_KIT_MARKING_INSTRUCTION).toContain("Mark ten at most");
    expect(COMPONENT_KIT_MARKING_INSTRUCTION).toContain("a whole card or row with its avatar, badge and buttons inside it is one component");
    expect(COMPONENT_KIT_MARKING_INSTRUCTION).toContain("Do not draw a status bar or a bottom navigation");
  });

  it("is not written for any one kind of product: nothing in it names a product the input did not", () => {
    const brief = componentKitBuildInput(input({ prompt: "A plant watering reminder", screens: [{ name: "Today", purpose: "" }, { name: "Plants", purpose: "" }] })).screenPlan.description;
    expect(brief).not.toMatch(/invoice|freelanc|client/i);
    expect(brief).toContain("Today; Plants.");
  });
});

describe("the screens and the product a kit is made for", () => {
  it("are the approved flow's screens, with what each shows", () => {
    const state = designerFixture();
    const second = { ...functionalFixture("screen:shop", "Shop", 1), information: "", description: "Browse   the\nproducts" };
    const stateItem = { ...functionalFixture("state:empty", "Empty shop", 2), kind: "state" as const, parentStableKey: "screen:shop" };
    expect(kitScreensOf([...state.scope!.manifest!, second, stateItem])).toEqual([
      { name: "Welcome", purpose: "Brand identity and start-shopping action" },
      { name: "Shop", purpose: "Browse the products" },
    ]);
    expect(kitScreensOf(null)).toEqual([]);
  });

  it("describes the product by its identity and the approved goal, or by the prompt when there is no plan", () => {
    expect(componentKitPromptOf(designerFixture())).toBe("Sell T-shirts Design onboarding first");
    expect(componentKitPromptOf(null, "A habit tracker")).toBe("A habit tracker");
  });
});

describe("what a kit is made from", () => {
  it("is the same for the same screens, in any order, tokens, reference and style", () => {
    const basis = componentKitBasis(input());
    expect(componentKitBasis(input({ screens: [...screens].reverse() }))).toBe(basis);
    expect(componentKitBasis(input({ prompt: "worded differently" }))).toBe(basis);
  });

  it("changes with any of them, so that a changed project never reuses an old kit", () => {
    const basis = componentKitBasis(input());
    expect(componentKitBasis(input({ screens: screens.slice(0, 2) }))).not.toBe(basis);
    expect(componentKitBasis(input({ screens: [{ ...screens[0], purpose: "Something else" }, ...screens.slice(1)] }))).not.toBe(basis);
    expect(componentKitBasis(input({ tokens: { ...tokens, tokens: { ...tokens.tokens!, radii: { app: "4px", inner: "2px", pill: "9999px" } } } }))).not.toBe(basis);
    expect(componentKitBasis(input({ referenceMode: "user_style", referenceKey: "owner/project/upload.png" }))).not.toBe(basis);
    expect(componentKitBasis(input({ referenceMode: "user_style", referenceKey: "owner/project/other.png" })))
      .not.toBe(componentKitBasis(input({ referenceMode: "user_style", referenceKey: "owner/project/upload.png" })));
    expect(componentKitBasis(input({ designStyle: { id: "editorial" } as never }))).not.toBe(basis);
  });
});

describe("building the kit", () => {
  it("reads the marked components out, as the project's kit, with what it was made from", async () => {
    const seen: BuildScreenInput[] = [];
    const result = await buildComponentKit({ ...input(), buildScreen: async (request) => { seen.push(request); return { code: fullKit }; } });
    expect(seen).toHaveLength(1);
    expect(seen[0].specimenMarking).toBe("kit");
    expect(result.kit?.source).toBe("kit");
    expect(result.kit?.components.map((item) => item.name)).toEqual(["main-header", "detail-top-bar", "invoice-row", "client-row", "summary-tile"]);
    expect(result.kit?.components[2]).toMatchObject({ use: "use for invoice-row" });
    expect(result.kit?.basis).toBe(componentKitBasis(input()));
    expect(result.notes).toEqual([]);
  });

  it("keeps an avatar or badge inside a row as part of that row", async () => {
    const row = '<div data-dg-component="client-row" data-dg-use="one client in any list" class="flex"><span data-dg-component="avatar" class="dg-radius-pill">AB</span><p>Client</p></div>';
    const result = await buildComponentKit({ ...input(), buildScreen: async () => ({ code: done(`<div>${row}${marked("a-card", "b-card", "c-card", "d-card")}</div>`) }) });
    expect(result.kit?.components.map((item) => item.name)).toEqual(["client-row", "a-card", "b-card", "c-card", "d-card"]);
    expect(result.kit?.components[0].html).toContain("AB");
    expect(result.notes).toEqual(["skipped avatar: part of client-row, which is kept whole"]);
  });

  it("gives no kit, and says why, when the build marked nothing usable", async () => {
    const result = await buildComponentKit({ ...input(), buildScreen: async () => ({ code: done('<div class="dg-bg-primary"><p>No markers</p></div>') }) });
    expect(result.kit).toBeNull();
    expect(result.notes.join(" ")).toContain("marked no usable component");
  });

  it("keeps a thin kit but says it is thin, and never keeps the status bar or the navigation", async () => {
    const result = await buildComponentKit({
      ...input(),
      buildScreen: async () => ({ code: done(`${marked("invoice-row")}<nav data-dg-component="bottom-tab-bar" class="fixed bottom-0"><a>Home</a></nav>`) }),
    });
    expect(result.kit?.components.map((item) => item.name)).toEqual(["invoice-row"]);
    expect(result.notes).toEqual(expect.arrayContaining([expect.stringContaining("skipped bottom-tab-bar"), "only 1 component was marked"]));
  });

  it("asks once more when the build stops before it finishes", async () => {
    const cutShort = `${marked("invoice-row")}<div data-dg-component="client-row" class="p-4"><div class="flex"></`;
    const codes = [cutShort, fullKit];
    const buildScreen = vi.fn(async () => ({ code: codes.shift()! }));
    const result = await buildComponentKit({ ...input(), buildScreen });
    expect(buildScreen).toHaveBeenCalledTimes(2);
    expect(result.kit?.components).toHaveLength(5);
  });
});

describe("starting the kit beside planning", () => {
  it("answers null without reading its input or building when it does not apply", async () => {
    const buildScreen = vi.fn();
    const settled = vi.fn();
    const result = await startComponentKit({ applies: applies({ isNewProject: false }), input: () => { throw new Error("not read"); }, buildScreen, onSettled: settled });
    expect(result).toBeNull();
    expect(buildScreen).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it("waits for an input that has to be prepared, answers the kit, and reports what it found", async () => {
    const settled = vi.fn();
    const result = await startComponentKit({
      applies: applies(), input: async () => input(), onSettled: settled, buildScreen: async () => ({ code: fullKit }),
    });
    expect(result?.components).toHaveLength(5);
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ kit: result, notes: [] }));
  });

  it("answers null when the build fails, and does not throw: the project is built as it was before kits", async () => {
    const settled = vi.fn();
    const failure = new Error("model overloaded");
    const result = await startComponentKit({ applies: applies(), input: () => input(), onSettled: settled, buildScreen: async () => { throw failure; } });
    expect(result).toBeNull();
    expect(settled).toHaveBeenCalledWith({ kit: null, notes: [], error: failure });
    // nor when preparing its input fails, or the report itself throws
    await expect(startComponentKit({ applies: applies(), input: async () => { throw failure; }, buildScreen: vi.fn() })).resolves.toBeNull();
    await expect(startComponentKit({ applies: applies(), input: () => input(), buildScreen: async () => ({ code: fullKit }),
      onSettled: () => { throw new Error("logger down"); } })).resolves.toMatchObject({ source: "kit" });
  });

  it("reuses a kit made earlier from the same basis, instead of paying for the build again", async () => {
    const earlier = kit(["invoice-row"], componentKitBasis(input()));
    const buildScreen = vi.fn();
    const settled = vi.fn();
    const reuse = vi.fn(async () => earlier);
    const result = await startComponentKit({ applies: applies(), input: () => input(), buildScreen, reuse, onSettled: settled });
    expect(result).toBe(earlier);
    expect(reuse).toHaveBeenCalledWith(componentKitBasis(input()));
    expect(buildScreen).not.toHaveBeenCalled();
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ kit: earlier, reused: true }));
  });

  it("builds when there is nothing to reuse, the lookup fails, or what it found was made from something else", async () => {
    for (const reuse of [
      async () => null,
      async () => { throw new Error("database unavailable"); },
      async () => kit([], componentKitBasis(input())),
      async () => kit(["invoice-row"], "another-basis"),
    ]) {
      const buildScreen = vi.fn(async () => ({ code: fullKit }));
      const result = await startComponentKit({ applies: applies(), input: () => input(), buildScreen, reuse });
      expect(buildScreen).toHaveBeenCalledTimes(1);
      expect(result?.components).toHaveLength(5);
    }
  });

  it("runs beside whatever the caller does meanwhile", async () => {
    const events: string[] = [];
    const pending = startComponentKit({
      applies: applies(), input: () => input(),
      buildScreen: async () => { events.push("kit build started"); await new Promise((resolve) => setTimeout(resolve, 5)); events.push("kit build finished"); return { code: fullKit }; },
    });
    events.push("planning");
    await pending;
    expect(events).toEqual(["planning", "kit build started", "kit build finished"]);
  });
});

describe("waiting for the kit", () => {
  it("is bounded: past the limit, planning and building go on without it", async () => {
    vi.useFakeTimers();
    try {
      const timedOut = vi.fn();
      const slow = withinComponentKitWait(new Promise<ReferenceSpecimen | null>(() => undefined), COMPONENT_KIT_WAIT_MS, timedOut);
      await vi.advanceTimersByTimeAsync(COMPONENT_KIT_WAIT_MS);
      await expect(slow).resolves.toBeNull();
      expect(timedOut).toHaveBeenCalledTimes(1);
      // one that is ready in time is used, and nothing is left waiting
      const ready = kit(["invoice-row"]);
      await expect(withinComponentKitWait(Promise.resolve(ready), COMPONENT_KIT_BUILD_WAIT_MS, timedOut)).resolves.toBe(ready);
      await expect(withinComponentKitWait(ready)).resolves.toBe(ready);
      await expect(withinComponentKitWait(null)).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      expect(timedOut).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the kit on the project", () => {
  const presetDna = (names: string[]) => ({ specimen: { source: "preset", components: names.map(component) } }) as unknown as ProjectReferenceDna;

  it("goes on the charter once, with what it was made from, and is never replaced", () => {
    const first = withComponentKit(charter(), kit(["invoice-row", "client-row"], "basis-1"));
    expect(first.componentKit).toEqual(kit(["invoice-row", "client-row"], "basis-1"));
    expect(first.appType).toBe("Invoices");
    expect(withComponentKit(first, kit(["other-row"]))).toBe(first);
  });

  it("leaves a charter alone when there is nothing usable to add", () => {
    const bare = charter();
    expect(withComponentKit(bare, null)).toBe(bare);
    expect(withComponentKit(bare, { source: "kit", components: [{ name: "", use: "", html: "" }] })).toBe(bare);
  });

  it("is what every screen's builder is given, before a preset's components, and what the brief planner reads by name", () => {
    const withBoth = withComponentKit(charter({ referenceDna: presetDna(["preset-card"]) }), kit(["invoice-row"]));
    expect(projectComponents(withBoth).map((item) => item.name)).toEqual(["invoice-row"]);
    expect(formatStyleComponents(projectComponents(withBoth))).toContain('- invoice-row — use for invoice-row — <div class="dg-surface-card">invoice-row</div>');
    expect(projectComponentSummaries(withBoth)).toEqual(["invoice-row (use for invoice-row)"]);
    // a project with a preset's components and no kit is built from the preset's
    expect(projectComponents(charter({ referenceDna: presetDna(["preset-card"]) })).map((item) => item.name)).toEqual(["preset-card"]);
    expect(projectComponents(charter())).toEqual([]);
    expect(projectComponents(null)).toEqual([]);
  });

  it("counts as the components a project already has, so that it never gets a second kit", () => {
    const withKit = withComponentKit(charter(), kit(["invoice-row"]));
    expect(existingProjectComponents({ charter: withKit, referenceMode: "internal_style" }).map((item) => item.name)).toEqual(["invoice-row"]);
    expect(existingProjectComponents({ charter: null, referenceMode: "internal_style" })).toEqual([]);
    // a curated reference with no approved preset brings none
    expect(existingProjectComponents({ charter: null, referenceMode: "curated_style", referenceId: "no-such-reference" })).toEqual([]);
  });
});
