import { describe, expect, it } from "vitest";

import {
  dominantCardColor,
  evaluateScreen,
  formatCheckTable,
  hasCastShadow,
  isSurface,
  parseShadowLayers,
  scanBriefValues,
  type CheckContext,
  type ProbeElement,
  type ProbeFacts,
  type ProbeRgba,
} from "./checks";

const rgba = (hex: string, a = 1): ProbeRgba => {
  const value = hex.replace("#", "");
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16), a };
};

const element = (overrides: Partial<ProbeElement> = {}): ProbeElement => ({
  tag: "div",
  label: "div.card",
  text: "",
  x: 16,
  y: 120,
  width: 358,
  height: 160,
  radius: 20,
  pill: false,
  bg: rgba("#F7F5E9"),
  gradient: false,
  image: false,
  border: 0,
  shadow: "none",
  clips: false,
  inNav: false,
  ...overrides,
});

const facts = (elements: ProbeElement[], overrides: Partial<ProbeFacts> = {}): ProbeFacts => ({
  viewport: { width: 390, height: 844 },
  scrollHeight: 1200,
  pageBackground: rgba("#ECE9D6"),
  elements,
  localNavigation: [],
  sharedNavigation: { present: false, itemCount: 0 },
  assets: { slots: 0, placeholders: 0, images: 0, brokenImages: 0 },
  ...overrides,
});

const context = (overrides: Partial<CheckContext> = {}): CheckContext => ({
  screenName: "Daily Care Dashboard",
  brief: "SCREEN PURPOSE: Show today's care tasks for every pet in the household.",
  elevation: "flat-tone",
  expected: null,
  sharedNavigationEnabled: false,
  flowHasNavigation: null,
  isRoot: true,
  showsSharedNavigation: false,
  ...overrides,
});

describe("shadow parsing", () => {
  it("reads computed Chromium shadows with the colour first", () => {
    expect(parseShadowLayers("rgba(45, 41, 38, 0.04) 0px 4px 20px 0px")).toEqual([
      { inset: false, x: 0, y: 4, blur: 20, spread: 0, alpha: 0.04, rgb: [45, 41, 38] },
    ]);
    expect(parseShadowLayers("rgb(0 0 0 / 8%) 0px 8px 24px -4px")[0]).toMatchObject({ alpha: 0.08, spread: -4 });
    expect(parseShadowLayers("none")).toEqual([]);
    expect(parseShadowLayers(null)).toEqual([]);
  });

  it("counts only shadows that lift a surface off the page", () => {
    expect(hasCastShadow("rgba(45, 41, 38, 0.04) 0px 4px 20px 0px")).toBe(true);
    expect(hasCastShadow("none")).toBe(false);
    // a 1px ring is a hairline, not elevation
    expect(hasCastShadow("rgba(0, 0, 0, 0.08) 0px 0px 0px 1px")).toBe(false);
    // inset shadows are inner strokes
    expect(hasCastShadow("rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset")).toBe(false);
    // an invisible shadow is no shadow
    expect(hasCastShadow("rgba(0, 0, 0, 0) 0px 12px 32px 0px")).toBe(false);
    // any cast layer is enough
    expect(hasCastShadow("rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.14) 0px 12px 32px 0px")).toBe(true);
  });
});

describe("brief value scan", () => {
  it("finds the raw values the founder saw copied into every brief", () => {
    const scan = scanBriefValues(
      "Each card uses a 32px radius. Off-white cards sit on a #F9F6F0 cream base with a 4% opacity soft shadow. MUST PRESERVE: The 32px corner radius on all cards.",
    );
    expect(scan).toMatchObject({ px: 2, hex: 1, opacity: 1, total: 4 });
    expect(scan.samples.length).toBeGreaterThan(0);
  });

  it("does not count prose, step numbers or ordinary percentages", () => {
    expect(scanBriefValues("Step #2 of 3: a calm list with 60% of the width for the label.").total).toBe(0);
    expect(scanBriefValues(null).total).toBe(0);
    expect(scanBriefValues("rgba(0,0,0,0.04) glow").opacity).toBe(1);
  });
});

describe("card detection", () => {
  it("treats sizeable rounded opaque fills outside the navigation as surfaces", () => {
    expect(isSurface(element())).toBe(true);
    expect(isSurface(element({ inNav: true }))).toBe(false);
    expect(isSurface(element({ width: 60 }))).toBe(false);
    expect(isSurface(element({ radius: 0 }))).toBe(false);
    expect(isSurface(element({ image: true }))).toBe(false);
    expect(isSurface(element({ bg: null }))).toBe(false);
    expect(isSurface(element({ bg: rgba("#F7F5E9", 0.2) }))).toBe(false);
  });

  it("picks the neutral light fill with the most area and skips accents, dark controls and the page colour", () => {
    const elements = [
      element({ bg: rgba("#F7F5E9"), width: 358, height: 200 }),
      element({ bg: rgba("#F7F5E9"), width: 358, height: 120 }),
      element({ bg: rgba("#FFC068"), width: 358, height: 400 }),
      element({ bg: rgba("#010C19"), width: 358, height: 400 }),
      element({ bg: rgba("#ECE9D6"), width: 358, height: 400 }),
      element({ bg: rgba("#EFE9D9"), width: 150, height: 90 }),
    ];
    expect(dominantCardColor(elements, rgba("#ECE9D6"))).toBe("#F7F5E9");
    expect(dominantCardColor([], rgba("#ECE9D6"))).toBeNull();
  });
});

describe("screen evaluation", () => {
  const baselineLike = () => facts([
    element({ label: "div.dg-surface-card", bg: rgba("#FFFFFF"), radius: 32, shadow: "rgba(45, 41, 38, 0.04) 0px 4px 20px 0px" }),
    element({ label: "div.dg-surface-card", bg: rgba("#FFFFFF"), radius: 32, y: 320, shadow: "rgba(45, 41, 38, 0.04) 0px 4px 20px 0px" }),
    element({ label: "button.chip", bg: rgba("#FFC068"), width: 96, height: 40, radius: 9999, pill: true }),
  ], { pageBackground: rgba("#F9F6F0") });

  it("flags the founder's complaints: 32px radius, cast shadows, stark cards and raw values in the brief", () => {
    const result = evaluateScreen(baselineLike(), context({
      brief: "Each card uses a 32px radius on a #F9F6F0 base with a 4% opacity shadow.",
      expected: { background: "#ECE9D6", card: "#F7F5E9" },
    }));
    expect(result.radius.offenders).toBe(2);
    expect(result.radius.max).toBe(32);
    expect(result.shadows).toMatchObject({ applicable: true, count: 2 });
    expect(result.tone.card).toBe("#FFFFFF");
    expect(result.tone.cardVsExpected).toBeGreaterThan(4);
    expect(result.flags).toEqual(expect.arrayContaining(["radius", "shadow", "tone", "brief-values"]));
  });

  it("passes a tone-on-tone screen that follows the reference", () => {
    const result = evaluateScreen(
      facts([
        element({ label: "div.card", bg: rgba("#F7F5E9"), radius: 20 }),
        element({ label: "div.tile", bg: rgba("#EFE9D9"), radius: 12, width: 150, height: 90 }),
        element({ label: "button.chip", bg: rgba("#FFC068"), width: 96, height: 40, radius: 9999, pill: true }),
        element({ label: "div.avatar", bg: rgba("#EFE9D9"), width: 44, height: 44, radius: 50, pill: true }),
      ]),
      context({ expected: { background: "#ECE9D6", card: "#F7F5E9" } }),
    );
    expect(result.flags).toEqual([]);
    expect(result.tone).toMatchObject({ card: "#F7F5E9", page: "#ECE9D6", applicable: true });
    expect(result.tone.cardVsExpected).toBe(0);
  });

  it("takes a card at the project's own radius above 24px for what was asked, and flags one above it", () => {
    const rounded = { ...baselineLike(), elements: [element({ label: "div.dg-surface-card", bg: rgba("#FFFFFF"), radius: 28 })] };
    expect(evaluateScreen(rounded, context({ cardRadiusPx: 28 })).flags).not.toContain("radius");
    expect(evaluateScreen(rounded, context()).flags).toContain("radius");
    expect(evaluateScreen(rounded, context({ cardRadiusPx: 20 })).flags).toContain("radius");
  });

  it("does not treat pills, circles or the navigation as radius offenders", () => {
    const result = evaluateScreen(
      facts([
        element({ radius: 9999, pill: true, width: 120, height: 44 }),
        element({ radius: 60, pill: true, width: 120, height: 120 }),
        element({ radius: 36, inNav: true, width: 390, height: 68 }),
        // rounding that paints nothing is not visible rounding
        element({ radius: 40, bg: null, width: 200, height: 200 }),
      ]),
      context(),
    );
    expect(result.radius.offenders).toBe(0);
    expect(result.flags).not.toContain("radius");
  });

  it("counts rounded photo clips and bordered boxes over the limit", () => {
    const result = evaluateScreen(
      facts([
        element({ bg: null, clips: true, radius: 28, width: 200, height: 200 }),
        element({ bg: null, border: 1, radius: 30, width: 200, height: 120 }),
      ]),
      context(),
    );
    expect(result.radius.offenders).toBe(2);
  });

  it("only checks cast shadows against flat references", () => {
    const shadowed = facts([element({ shadow: "rgba(0, 0, 0, 0.12) 0px 10px 30px 0px" })]);
    expect(evaluateScreen(shadowed, context({ elevation: "flat-tone" })).flags).toContain("shadow");
    expect(evaluateScreen(shadowed, context({ elevation: "hairline" })).flags).toContain("shadow");
    const soft = evaluateScreen(shadowed, context({ elevation: "soft-shadow" }));
    expect(soft.flags).not.toContain("shadow");
    expect(soft.shadows.applicable).toBe(false);
    expect(evaluateScreen(shadowed, context({ elevation: "unknown" })).flags).not.toContain("shadow");
  });

  it("flags a screen-local tab bar only while shared navigation is disabled", () => {
    const withLocalNav = facts([element()], {
      localNavigation: [{ label: "nav.fixed.bottom-0", reason: "nav element", itemCount: 4 }],
    });
    const disabled = evaluateScreen(withLocalNav, context({ sharedNavigationEnabled: false }));
    expect(disabled.flags).toContain("local-nav");
    expect(disabled.localNavigation.samples[0]).toContain("nav element");
    const enabled = evaluateScreen(withLocalNav, context({ sharedNavigationEnabled: true }));
    expect(enabled.flags).not.toContain("local-nav");
    expect(enabled.localNavigation.applicable).toBe(false);
  });

  it("flags root screens missing the shared navigation the approved flow describes", () => {
    const plain = facts([element()]);
    expect(evaluateScreen(plain, context({ flowHasNavigation: true, isRoot: true })).flags).toContain("no-shared-nav");
    expect(evaluateScreen(plain, context({ flowHasNavigation: true, isRoot: false })).flags).not.toContain("no-shared-nav");
    expect(evaluateScreen(plain, context({ flowHasNavigation: false, isRoot: true })).flags).not.toContain("no-shared-nav");
    expect(evaluateScreen(plain, context({ flowHasNavigation: null, isRoot: true })).flags).not.toContain("no-shared-nav");

    const withNav = facts([element()], { sharedNavigation: { present: true, itemCount: 5 } });
    expect(evaluateScreen(withNav, context({
      flowHasNavigation: true, isRoot: true, sharedNavigationEnabled: true, showsSharedNavigation: true,
    })).flags).not.toContain("no-shared-nav");
  });

  it("flags bitmap placeholders and remembers whether the brief asked for imagery", () => {
    const result = evaluateScreen(
      facts([element()], { assets: { slots: 5, placeholders: 5, images: 0, brokenImages: 0 } }),
      context({ brief: "A row of pet avatar portraits above the task list." }),
    );
    expect(result.flags).toContain("placeholders");
    expect(result.assets).toMatchObject({ placeholders: 5, imageryInBrief: true });
  });

  it("formats a per-screen table with failures marked", () => {
    const failing = evaluateScreen(baselineLike(), context({ brief: "A 32px radius." }));
    const passing = evaluateScreen(facts([element()]), context({ screenName: "Pet Library" }));
    const table = formatCheckTable([failing, passing]);
    expect(table).toContain("screen");
    expect(table).toContain("Daily Care Dashboard");
    expect(table).toMatch(/2!/);
    expect(table).toContain("1 of 2 screens pass every applicable check.");
    expect(table).toContain("Daily Care Dashboard: radius, shadow, brief-values");
  });
});
