import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));

import { planUiFlow } from "@/lib/generation/service";
import { approveProductScope, proposeProductScope, type ScopeNavigation } from "@/lib/product-planning/model";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import type { NavigationPlan, ProjectCharter } from "@/lib/types";

/**
 * Whether a product has persistent navigation is decided in the flow the person approves. These run the
 * real planner with a model that answers the way the old heuristics did (no bar for two peer areas, a
 * bar the person never approved) and check that the approved decision is what comes out.
 */

const brief = (name: string, type: "root" | "detail", chrome: "bottom-tabs" | "top-bar" | "top-bar-back") => ({
  name, type, roadmap_stable_key: `screen:${name.toLowerCase().replace(/\s+/g, "-")}`,
  description: [`SCREEN PURPOSE: ${name} for a household with pets.`, "INFORMATION HIERARCHY: The day's key facts, then the details.",
    "LAYOUT ANATOMY: A header, a summary card and a list below it.", "KEY COMPONENTS: Summary card and list rows.",
    "PREMIUM DESIGN DECISIONS: One large summary that leads the screen.", "INTERACTION: Tap a row to open its details.",
    "MUST PRESERVE: The summary leads the screen."].join("\n"),
  layout_contract: { viewport_plan: "Scrolling list", focal_hierarchy: "Summary first", section_rhythm: "Generous",
    component_density: "Comfortable", cta_policy: "One primary action", anti_patterns: [] },
  reference_transfer: { layout_source: "screen-purpose", preserve: [], adapt: [], reject: [], rationale: "Prompt-only screen." },
  chrome_policy: { chrome, show_primary_navigation: chrome === "bottom-tabs", shows_back_button: chrome === "top-bar-back" },
  asset_needs: [], state_variants: [],
});
const screenBriefs = { screens: [brief("Today", "root", "bottom-tabs"), brief("Pet Library", "detail", "top-bar-back"), brief("Add Pet", "detail", "top-bar-back")] };

const design = { anatomy: "fixed-tab-rail", width: "full", labels: "hidden", active_treatment: "icon-fill", surface: "solid", radius_px: 0,
  safe_area_offset_px: 4, item_gap_px: 0, icon_size_px: 20, border: true, elevation: "none", center_action_item_id: null, inactive_treatment: "plain" };
const item = (id: string, label: string, icon: string, linked: string | null) => ({ id, label, icon, role: `${label} area of the pet app`,
  availability: linked ? "generated" : "planned", linked_screen_name: linked });
const architecture = (bar: boolean) => bar
  ? { kind: "bottom-tabs-app", primary_navigation: "bottom-tabs", root_chrome: "bottom-tabs", detail_chrome: "top-bar-back", consistency_rules: ["Keep the bar on root screens."], rationale: "Peer areas." }
  : { kind: "hierarchical", primary_navigation: "none", root_chrome: "top-bar", detail_chrome: "top-bar-back", consistency_rules: ["Use top chrome."], rationale: "A focused flow." };

/** The planner's blueprint. `navigation` is what its own reasoning drew; the person may have decided otherwise. */
const blueprint = (navigation: "none" | "bar of four") => ({
  requires_bottom_nav: navigation !== "none",
  navigation_architecture: architecture(navigation !== "none"),
  navigation_plan: navigation === "none"
    ? { version: 2, decision: "none", evidence: { source: null, reason: "Three screens are not enough evidence for a bar." }, enabled: false, kind: "none",
      items: [], design: null, visual_brief: "No persistent navigation.", screen_chrome: [] }
    : { version: 2, decision: "project-native", evidence: { source: "product-architecture", reason: "Four peer areas." }, enabled: true, kind: "bottom-tabs",
      items: [item("today", "Today", "sun", "Today"), item("pets", "Pets", "paw-print", "Pet Library"), item("routines", "Routines", "list-checks", null), item("family", "Family", "users", null)],
      design, visual_brief: "An attached, icon-only bar.",
      screen_chrome: [{ screen_name: "Today", chrome: "bottom-tabs", navigation_item_id: "today" }, { screen_name: "Pet Library", chrome: "bottom-tabs", navigation_item_id: "pets" }] },
  roadmap: { requested_parent_count: 3, initial_batch_keys: ["screen:today", "screen:pet-library", "screen:add-pet"], items: [
    { stable_key: "screen:today", name: "Today", type: "root", summary: "The day's pet care at a glance for the household.", priority: "core", explicitly_requested: true, dependency_keys: [] },
    { stable_key: "screen:pet-library", name: "Pet Library", type: "detail", summary: "Every pet in the household with their care details.", priority: "core", explicitly_requested: true, dependency_keys: [] },
    { stable_key: "screen:add-pet", name: "Add Pet", type: "detail", summary: "Add a new pet to the household with its profile.", priority: "core", explicitly_requested: true, dependency_keys: [] },
  ] },
  charter: { originalPrompt: "A family pet care app", imageReferenceSummary: null, appType: "Pet care", targetAudience: "Families with pets",
    navigationModel: "A guess", keyFeatures: ["Daily care", "Pet profiles"], designRationale: "One calm, tonal system across every screen.", creativeDirection: null },
});

const approved: ScopeNavigation = {
  persistent: true, rationale: "People switch between Today and Pets all day.",
  destinations: [{ label: "Today", screenKey: "screen:today" }, { label: "Pets", screenKey: "screen:pet-library" }],
};
const declined: ScopeNavigation = { persistent: false, rationale: "One flow, one task at a time.", destinations: [] };

const manifest = () => [functionalFixture("screen:today", "Today", 0), functionalFixture("screen:pet-library", "Pet Library", 1), functionalFixture("screen:add-pet", "Add Pet", 2)];
const keys = manifest().map((entry) => entry.stableKey);
const flow = (navigation?: ScopeNavigation) => {
  const base = designerFixture();
  base.scope = { ...base.scope!, outputKeys: keys, manifest: manifest(), ...(navigation ? { navigation } : {}) };
  return approveProductScope(proposeProductScope(base), base.revision);
};

const respondWith = (navigation: "none" | "bar of four") => mocks.generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) => {
  const instruction = String(request.config?.systemInstruction ?? "");
  if (instruction.includes("STEP: PROJECT BLUEPRINT ONLY")) return { text: JSON.stringify(blueprint(navigation)) };
  if (instruction.includes("STEP: SCREEN BRIEFS ONLY")) return { text: JSON.stringify(screenBriefs) };
  throw new Error(`Unexpected model call: ${instruction.slice(0, 80)}`);
});
const plan = (productPlanning: ReturnType<typeof flow>, extra: Record<string, unknown> = {}) => planUiFlow({
  prompt: "A family pet care app", productPlanning, productExecutionKeys: keys, referenceMode: "internal_style", ...extra,
});
const instructions = () => mocks.generate.mock.calls.map(([request]) => String(request.config?.systemInstruction ?? ""));

beforeEach(() => { mocks.generate.mockReset(); });

describe("a flow approved with persistent navigation", () => {
  it("keeps its bar for two peer areas, though the planner's own rules drew none", async () => {
    respondWith("none");
    const result = await plan(flow(approved));
    expect(result.navigationPlan).toMatchObject({ enabled: true, kind: "bottom-tabs", decision: "project-native",
      evidence: { source: "approved-scope", reason: "People switch between Today and Pets all day." } });
    expect(result.navigationPlan.items.map((entry) => [entry.label, entry.availability, entry.linkedScreenName]))
      .toEqual([["Today", "generated", "Today"], ["Pets", "generated", "Pet Library"]]);
    expect(result.requiresBottomNav).toBe(true);
    expect(result.charter.navigationArchitecture).toMatchObject({ kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs" });
    expect(result.charter.navigationModel).toBe("Shared bottom navigation between Today, Pets.");
    // the bar is valid by construction: it did not cost a repair call, only the two planning calls
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("makes every screen the bar opens a root screen with the bar, and leaves the others without it", async () => {
    respondWith("none");
    const { screens } = await plan(flow(approved));
    // "Pet Library" was briefed as a detail screen; the bar opens it, so it is a root screen
    expect(screens.map((screen) => [screen.name, screen.type, screen.navigationItemId, screen.chromePolicy?.showPrimaryNavigation])).toEqual([
      ["Today", "root", "today", true], ["Pet Library", "root", "pets", true], ["Add Pet", "detail", null, false]]);
    expect(screens[1].chromePolicy?.chrome).toBe("bottom-tabs");
  });

  it("keeps only the destinations it approved, with the planner's icons for them", async () => {
    respondWith("bar of four");
    const result = await plan(flow(approved));
    expect(result.navigationPlan.items.map((entry) => [entry.id, entry.label, entry.icon])).toEqual([["today", "Today", "sun"], ["pets", "Pets", "paw-print"]]);
    // the construction is the planner's
    expect(result.navigationPlan.design).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden", activeTreatment: "icon-fill" });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("plans an approved destination that has no screen in this flow, without inventing one", async () => {
    respondWith("bar of four");
    const result = await plan(flow({ persistent: true, rationale: "Three areas.", destinations: [
      { label: "Today", screenKey: "screen:today" }, { label: "Pets", screenKey: "screen:pet-library" }, { label: "Family", screenKey: null }] }));
    expect(result.navigationPlan.items.map((entry) => [entry.label, entry.availability, entry.linkedScreenName])).toEqual([
      ["Today", "generated", "Today"], ["Pets", "generated", "Pet Library"], ["Family", "planned", null]]);
    expect(result.screens.map((screen) => screen.name)).toEqual(["Today", "Pet Library", "Add Pet"]);
  });

  it("tells the planner, as binding input, which destinations were approved", async () => {
    respondWith("none");
    await plan(flow(approved));
    const [blueprintCall] = mocks.generate.mock.calls.map(([request]) => request)
      .filter((request) => String(request.config?.systemInstruction).includes("STEP: PROJECT BLUEPRINT ONLY"));
    const input = JSON.stringify(blueprintCall.contents);
    expect(input).toContain("APPROVED NAVIGATION (binding)");
    expect(input).toContain('opens the screen \\"Pet Library\\"');
    expect(blueprintCall.config.systemInstruction).toContain("APPROVED NAVIGATION section");
  });
});

describe("a flow approved with persistent navigation whose planner drew an unusable bar", () => {
  /** The planner's navigation could not be read: a bar with no design, which the blueprint schema refuses. */
  const unreadable = () => {
    const base = blueprint("bar of four");
    return { ...base, navigation_plan: { ...base.navigation_plan, design: null } };
  };
  const respondWithRepair = (repair: unknown) => mocks.generate.mockImplementation(async (request: { config?: { systemInstruction?: string }; contents: { parts: Array<{ text?: string }> } }) => {
    const instruction = String(request.config?.systemInstruction ?? "");
    if (instruction.includes("STEP: PROJECT BLUEPRINT ONLY")) {
      const repairing = request.contents.parts.some((part) => part.text?.includes("NAVIGATION V2 REPAIR ONLY"));
      return { text: JSON.stringify(repairing ? repair : unreadable()) };
    }
    if (instruction.includes("STEP: SCREEN BRIEFS ONLY")) return { text: JSON.stringify(screenBriefs) };
    throw new Error(`Unexpected model call: ${instruction.slice(0, 80)}`);
  });

  it("lets the repair supply the icons, then applies the approved destinations to what it returns", async () => {
    respondWithRepair(blueprint("bar of four"));
    const result = await plan(flow(approved));
    // the blueprint, the repair the unreadable navigation still earns, and the briefs
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(result.navigationPlan).toMatchObject({ enabled: true, evidence: { source: "approved-scope" } });
    expect(result.navigationPlan.items.map((entry) => [entry.id, entry.label, entry.icon, entry.linkedScreenName])).toEqual([
      ["today", "Today", "sun", "Today"], ["pets", "Pets", "paw-print", "Pet Library"]]);
  });

  it("still draws the approved bar when the repair returns nothing usable, with the neutral icon", async () => {
    respondWithRepair({});
    const result = await plan(flow(approved));
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(result.navigationPlan).toMatchObject({ enabled: true, decision: "project-native", evidence: { source: "approved-scope" } });
    expect(result.navigationPlan.items.map((entry) => [entry.label, entry.icon, entry.linkedScreenName])).toEqual([
      ["Today", "circle", "Today"], ["Pets", "circle", "Pet Library"]]);
    expect(result.screens.map((screen) => screen.navigationItemId)).toEqual(["today", "pets", null]);
  });
});

describe("a flow approved without navigation", () => {
  it("stays without navigation, though the planner drew a bar", async () => {
    respondWith("bar of four");
    const result = await plan(flow(declined));
    expect(result.navigationPlan).toMatchObject({ enabled: false, kind: "none", decision: "none", items: [],
      evidence: { source: "approved-scope", reason: "One flow, one task at a time." } });
    expect(result.requiresBottomNav).toBe(false);
    expect(result.charter.navigationArchitecture).toMatchObject({ kind: "hierarchical", primaryNavigation: "none" });
    expect(result.screens.every((screen) => !screen.chromePolicy?.showPrimaryNavigation && !screen.navigationItemId)).toBe(true);
    expect(instructions().some((text) => text.includes("STEP: PROJECT BLUEPRINT ONLY"))).toBe(true);
  });
});

describe("a flow approved before navigation was decided in it", () => {
  it("keeps the planner's own decision and the older rules", async () => {
    respondWith("none");
    const none = await plan(flow());
    expect(none.navigationPlan).toMatchObject({ enabled: false, decision: "none" });
    expect(none.navigationPlan.evidence?.source).toBeNull();

    mocks.generate.mockReset();
    respondWith("bar of four");
    const bar = await plan(flow());
    expect(bar.navigationPlan).toMatchObject({ enabled: true, decision: "project-native", evidence: { source: "product-architecture" } });
    expect(bar.navigationPlan.items).toHaveLength(4);
    const blueprintCall = mocks.generate.mock.calls.map(([request]) => request)
      .find((request) => String(request.config?.systemInstruction).includes("STEP: PROJECT BLUEPRINT ONLY"));
    expect(JSON.stringify(blueprintCall.contents)).not.toContain("APPROVED NAVIGATION");
  });
});

describe("a later batch of a flow", () => {
  const savedCharter: ProjectCharter = {
    originalPrompt: "A family pet care app", appType: "Pet care", targetAudience: "Families with pets", navigationModel: "Shared bottom navigation between Today, Pets.",
    navigationArchitecture: { kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
      consistencyRules: ["Keep the bar on root screens."], rationale: "Peer areas." },
    keyFeatures: ["Daily care"], designRationale: "One calm, tonal system across every screen.",
  };
  const savedBar: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "approved-scope", reason: "People switch between Today and Pets all day." },
    items: [{ id: "today", label: "Today", icon: "sun", role: "See the day", availability: "generated", linkedScreenName: "Today" },
      { id: "pets", label: "Pets", icon: "paw-print", role: "Every pet", availability: "generated", linkedScreenName: "Pet Library" }],
    design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "solid", radiusPx: 32,
      safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: false, elevation: "low", centerActionItemId: null },
    visualBrief: "The bar the person has been looking at",
    screenChrome: [{ screenName: "Today", chrome: "bottom-tabs", navigationItemId: "today" }, { screenName: "Pet Library", chrome: "bottom-tabs", navigationItemId: "pets" }],
  };
  const later = (productPlanning: ReturnType<typeof flow>, navigation: NavigationPlan) => plan(productPlanning, {
    productExecutionKeys: ["screen:add-pet"], existingCharter: savedCharter, existingNavigationPlan: navigation });
  const respondWithBriefs = () => mocks.generate.mockImplementation(async () => ({ text: JSON.stringify({ screens: [screenBriefs.screens[2]] }) }));

  it("keeps the saved bar, and its design, while it is what the person approved", async () => {
    respondWithBriefs();
    const result = await later(flow(approved), savedBar);
    expect(result.navigationPlan.items.map((entry) => entry.id)).toEqual(["today", "pets"]);
    expect(result.navigationPlan.design).toMatchObject({ anatomy: "floating-dock", labels: "active-only", radiusPx: 32 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("follows a newer approval that decides it differently", async () => {
    respondWithBriefs();
    const result = await later(flow(declined), savedBar);
    expect(result.navigationPlan).toMatchObject({ enabled: false, decision: "none", evidence: { source: "approved-scope" } });
    expect(result.charter.navigationArchitecture).toMatchObject({ kind: "hierarchical", primaryNavigation: "none" });
  });

  it("adds a destination the person approved since, keeping the icons of those it already had", async () => {
    respondWithBriefs();
    const result = await later(flow({ ...approved, destinations: [...approved.destinations, { label: "Family", screenKey: null }] }), savedBar);
    expect(result.navigationPlan.items.map((entry) => [entry.id, entry.label, entry.icon])).toEqual([
      ["today", "Today", "sun"], ["pets", "Pets", "paw-print"], ["family", "Family", "circle"]]);
  });
});
