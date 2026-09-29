import { describe, expect, it } from "vitest";

import type { NavigationPlan } from "@/lib/types";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";

import {
  applyApprovedNavigation,
  approvedNavigationLinkedScreens,
  approvedNavigationScreenNames,
  blueprintNavigationDesign,
  formatApprovedNavigation,
  navigationMatchesApproved,
} from "./approved-navigation";

const names = new Map([["screen:today", "Today"], ["screen:pets", "Pet Library"]]);
const approved = {
  persistent: true,
  rationale: "People switch between Today and Pets all day.",
  destinations: [{ label: "Today", screenKey: "screen:today" }, { label: "Pets", screenKey: "screen:pets" }],
};
const none = { persistent: false, rationale: "One task, done in one flow.", destinations: [] };

type PlannerItem = { id: string; label: string; icon: string; role: string; availability?: "generated" | "planned"; linked_screen_name?: string | null };
type PlannerDesign = ReturnType<typeof blueprintNavigationDesign>;

/** What a planner drew when its own heuristics said two peer areas were not enough for a bar. */
const blueprint = () => ({
  requires_bottom_nav: false,
  navigation_architecture: {
    kind: "hierarchical" as const, primary_navigation: "none" as const, root_chrome: "top-bar" as const,
    detail_chrome: "top-bar-back" as const, consistency_rules: ["Use top chrome."], rationale: "A focused flow.",
  },
  navigation_plan: {
    version: 2 as const, decision: "none" as const, evidence: { source: null, reason: "Two screens are not enough evidence." },
    enabled: false, kind: "none" as const, items: [] as PlannerItem[], design: null as PlannerDesign | null, visual_brief: "No persistent navigation.",
    screen_chrome: [
      { screen_name: "Today", chrome: "top-bar" as const, navigation_item_id: null },
      { screen_name: "Pet Library", chrome: "top-bar" as const, navigation_item_id: null },
    ],
  },
  roadmap: { items: [
    { name: "Today", type: "detail" as const }, { name: "Pet Library", type: "detail" as const }, { name: "Add Pet", type: "detail" as const },
  ] },
  charter: { navigationModel: "Hierarchical screen-specific chrome" },
});

/** What a planner drew when it chose a bar: four destinations, with icons, and its own construction. */
const plannerBar = () => {
  const base = blueprint();
  return {
    ...base,
    requires_bottom_nav: true,
    navigation_plan: {
      ...base.navigation_plan, decision: "project-native" as const, evidence: { source: "product-architecture" as const, reason: "Peer areas." },
      enabled: true, kind: "bottom-tabs" as const, visual_brief: "An attached bar, icon-only.",
      design: { anatomy: "fixed-tab-rail" as const, width: "full" as const, labels: "hidden" as const, active_treatment: "icon-fill" as const,
        surface: "solid" as const, radius_px: 0, safe_area_offset_px: 4, item_gap_px: 0, icon_size_px: 20, border: true,
        elevation: "none" as const, center_action_item_id: null, inactive_treatment: "plain" as const },
      items: [
        { id: "home", label: "Today", icon: "sun", role: "See the day's care", availability: "generated" as const, linked_screen_name: "Today" },
        { id: "library", label: "Pet Library", icon: "paw-print", role: "Every pet in the household", availability: "generated" as const, linked_screen_name: "Pet Library" },
        { id: "shop", label: "Shop", icon: "store", role: "Buy pet supplies", availability: "planned" as const, linked_screen_name: null },
        { id: "family", label: "Family", icon: "users", role: "Who cares for whom", availability: "planned" as const, linked_screen_name: null },
      ],
      screen_chrome: [{ screen_name: "Today", chrome: "bottom-tabs" as const, navigation_item_id: "home" },
        { screen_name: "Pet Library", chrome: "bottom-tabs" as const, navigation_item_id: "library" }],
    },
    navigation_architecture: { ...base.navigation_architecture, kind: "bottom-tabs-app" as const, primary_navigation: "bottom-tabs" as const,
      root_chrome: "bottom-tabs" as const },
  };
};

describe("applying the navigation the person approved to the planner's blueprint", () => {
  it("draws a bar for two approved peer areas, though the planner's own rules drew none", () => {
    const result = applyApprovedNavigation(blueprint(), approved, names);
    expect(result.requires_bottom_nav).toBe(true);
    expect(result.navigation_plan).toMatchObject({
      version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
      evidence: { source: "approved-scope", reason: "People switch between Today and Pets all day." },
    });
    expect(result.navigation_plan.items).toMatchObject([
      { id: "today", label: "Today", availability: "generated", linked_screen_name: "Today" },
      { id: "pets", label: "Pets", availability: "generated", linked_screen_name: "Pet Library" },
    ]);
    // a design is always there: the bar is drawn, and the renderer reads it
    expect(result.navigation_plan.design).toMatchObject({ anatomy: expect.any(String), radius_px: expect.any(Number) });
    expect(result.navigation_architecture).toMatchObject({ kind: "bottom-tabs-app", primary_navigation: "bottom-tabs", root_chrome: "bottom-tabs" });
    expect(result.charter.navigationModel).toBe("Shared bottom navigation between Today, Pets.");
  });

  it("makes the screens the bar opens root screens and the bar's screens their active items", () => {
    const result = applyApprovedNavigation(blueprint(), approved, names);
    expect(result.roadmap.items.map((item) => [item.name, item.type])).toEqual([["Today", "root"], ["Pet Library", "root"], ["Add Pet", "detail"]]);
    expect(result.navigation_plan.screen_chrome).toEqual([
      { screen_name: "Today", chrome: "bottom-tabs", navigation_item_id: "today" },
      { screen_name: "Pet Library", chrome: "bottom-tabs", navigation_item_id: "pets" },
    ]);
  });

  it("keeps exactly the approved destinations, in order, and the planner's icon, role and id for those it named", () => {
    const result = applyApprovedNavigation(plannerBar(), {
      persistent: true, rationale: "Four peer areas.",
      destinations: [{ label: "Family", screenKey: null }, { label: "Today", screenKey: "screen:today" }, { label: "Routines", screenKey: null }],
    }, names);
    expect(result.navigation_plan.items).toEqual([
      { id: "family", label: "Family", icon: "users", role: "Who cares for whom", availability: "planned", linked_screen_name: null },
      { id: "home", label: "Today", icon: "sun", role: "See the day's care", availability: "generated", linked_screen_name: "Today" },
      { id: "routines", label: "Routines", icon: "circle", role: "Routines area of the product", availability: "planned", linked_screen_name: null },
    ]);
    // the planner's construction stands; it is the destinations that were decided
    expect(result.navigation_plan.design).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden" });
    expect(result.navigation_plan.visual_brief).toBe("An attached bar, icon-only.");
    // the screen the planner drew as a tab but the bar no longer opens is an ordinary screen
    expect(result.navigation_plan.screen_chrome).toEqual([
      { screen_name: "Today", chrome: "bottom-tabs", navigation_item_id: "home" },
      { screen_name: "Pet Library", chrome: "top-bar", navigation_item_id: null },
    ]);
  });

  it("finds a destination's planner item by the screen it opens when it was renamed", () => {
    const result = applyApprovedNavigation(plannerBar(), {
      persistent: true, rationale: "", destinations: [{ label: "Pets", screenKey: "screen:pets" }, { label: "Today", screenKey: "screen:today" }],
    }, names);
    expect(result.navigation_plan.items.map((item) => [item.label, item.icon, item.id])).toEqual([["Pets", "paw-print", "library"], ["Today", "sun", "home"]]);
    expect(result.navigation_plan.evidence.reason).toBe("The person approved this navigation with the screen flow.");
  });

  it("plans a destination whose screen is not in this flow, without a link, and never links a screen it cannot name", () => {
    const result = applyApprovedNavigation(blueprint(), {
      persistent: true, rationale: "", destinations: [{ label: "Today", screenKey: "screen:today" }, { label: "Family", screenKey: null }, { label: "Lost", screenKey: "screen:gone" }],
    }, names);
    expect(result.navigation_plan.items.map((item) => [item.label, item.availability, item.linked_screen_name])).toEqual([
      ["Today", "generated", "Today"], ["Family", "planned", null], ["Lost", "planned", null]]);
  });

  it("leaves an approved flow without navigation as none, and turns the planner's tabs back into top chrome", () => {
    const result = applyApprovedNavigation(plannerBar(), none, names);
    expect(result.requires_bottom_nav).toBe(false);
    expect(result.navigation_plan).toMatchObject({
      decision: "none", enabled: false, kind: "none", items: [], design: null,
      evidence: { source: "approved-scope", reason: "One task, done in one flow." },
    });
    expect(result.navigation_plan.screen_chrome).toEqual([
      { screen_name: "Today", chrome: "top-bar", navigation_item_id: null },
      { screen_name: "Pet Library", chrome: "top-bar", navigation_item_id: null },
    ]);
    expect(result.navigation_architecture).toMatchObject({ kind: "hierarchical", primary_navigation: "none" });
    expect(result.charter.navigationModel).toMatch(/without persistent primary navigation/);
  });

  it("treats a bar of fewer than two destinations as no bar", () => {
    const result = applyApprovedNavigation(plannerBar(), { persistent: true, rationale: "", destinations: [{ label: "Today", screenKey: "screen:today" }] }, names);
    expect(result.navigation_plan).toMatchObject({ decision: "none", enabled: false, items: [] });
  });
});

describe("what the planner is told and what counts as already drawn", () => {
  it("tells the planner the destinations in order, which open a screen, and that they are binding", () => {
    const text = formatApprovedNavigation({ ...approved, destinations: [...approved.destinations, { label: "Family", screenKey: null }] }, names);
    expect(text).toContain("APPROVED NAVIGATION (binding)");
    expect(text).toContain('1. Today (opens the screen "Today")');
    expect(text).toContain('2. Pets (opens the screen "Pet Library")');
    expect(text).toContain("3. Family (a later screen, no screen in this flow yet)");
    expect(text).toContain('decision "project-native"');
    expect(text).toContain("Do not add, remove, rename or reorder");
    expect(formatApprovedNavigation(none, names)).toContain('decision "none"');
  });

  it("finds the screens the approved bar opens, in its order", () => {
    expect(approvedNavigationLinkedScreens(approved, names)).toEqual(["Today", "Pet Library"]);
    expect(approvedNavigationLinkedScreens({ ...approved, destinations: [{ label: "Family", screenKey: null }, ...approved.destinations] }, names))
      .toEqual(["Today", "Pet Library"]);
    expect(approvedNavigationLinkedScreens(none, names)).toEqual([]);
  });

  it("names the screens of the flow: those built now and those already built", () => {
    const state = designerFixture();
    const state2 = { ...functionalFixture("state:sheet", "Sheet", 3), kind: "state" as const, parentStableKey: "screen:today", stateKey: "sheet", triggerLabel: "Open", editInstruction: "Show it" };
    state.scope = { ...state.scope!, manifest: [functionalFixture("screen:today", "Today", 0), state2],
      existingOutputs: [{ item: functionalFixture("screen:pets", "Pet Library", 1), screenId: "33333333-3333-4333-8333-333333333333" }] };
    expect([...approvedNavigationScreenNames(state)]).toEqual([["screen:pets", "Pet Library"], ["screen:today", "Today"]]);
  });

  it("recognises a saved bar that is already what was approved, and one that is not", () => {
    const drawn = (labels: string[], enabled = true) => ({
      enabled, kind: enabled ? "bottom-tabs" : "none", visualBrief: "", screenChrome: [],
      items: labels.map((label) => ({ id: label, label, icon: "circle", role: label, linkedScreenName: null })),
    }) as NavigationPlan;
    expect(navigationMatchesApproved(drawn(["Today", "Pets"]), approved)).toBe(true);
    expect(navigationMatchesApproved(drawn(["today", "PETS"]), approved)).toBe(true);
    expect(navigationMatchesApproved(drawn(["Pets", "Today"]), approved)).toBe(false);
    expect(navigationMatchesApproved(drawn(["Today", "Pets", "Family"]), approved)).toBe(false);
    expect(navigationMatchesApproved(drawn([], false), none)).toBe(true);
    expect(navigationMatchesApproved(null, none)).toBe(true);
    expect(navigationMatchesApproved(drawn(["Today", "Pets"]), none)).toBe(false);
    expect(navigationMatchesApproved(null, approved)).toBe(false);
  });
});
