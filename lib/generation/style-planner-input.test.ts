import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { normalizeReferenceAnalysis, resolveGenerationScopeContract } from "@/lib/generation/scope-contract";
import { planUiFlow, stripScreenBriefValues } from "@/lib/generation/service";
import { approveProductScope, proposeProductScope } from "@/lib/product-planning/model";
import { designerFixture, functionalFixture } from "@/lib/product-planning/test-fixtures";
import type { NavigationPlan, ProjectCharter, ScreenPlan } from "@/lib/types";

/** A px, pt, hex or opacity value: what must never reach a style-mode planner. */
const VALUE = /\d+(?:\.\d+)?\s?(?:px|pt)\b|#[0-9a-f]{3,8}\b|\d+\s?%\s?opacity/i;

/** An analysis stored before the shape classes existed: every cue carries a value. */
const numericAnalysisResult = () => normalizeReferenceAnalysis({
  overallVisualStyle: "Warm cream background (#FDFBF0) with 32px cards and a 4% opacity soft shadow",
  screenCountEstimate: 1,
  screenReferences: [{
    index: 1,
    suggestedRole: "Home dashboard",
    layoutSummary: "Greeting, a calendar strip, two stat tiles and a donut card with 16px gutters",
    visualHierarchy: "The greeting leads, then the calendar strip, then the tiles",
    components: ["Calendar strip", "Stat tile pair", "Donut card with a 24pt+ radius"],
    stylingCues: ["Warm cream background (#FDFBF0)", "High corner radius (24pt+)", "Soft shadow 0 4px 20px rgba(0,0,0,0.04)", "Peach accent #F5B25A"],
    interactionCues: ["Tap a day to select it"],
    copyPatterns: ["Friendly first-name greeting"],
    implementationNotes: ["Radius should be at least 24px", "Card padding 20px"],
    compositionRules: ["16px screen margin", "Cards sit on a 8px grid"],
    spacingRules: ["24px between sections"],
    componentRules: ["Cards use a 24px radius and a #FFFFFF fill"],
    antiPatterns: [],
  }],
  designSystemSignals: {
    palette: "Warm cream (#FDFBF0) with peach (#F5B25A)",
    typography: "Rounded grotesk",
    surfaces: "High corner radius (24pt+), 4% opacity shadow",
    iconography: "Line icons",
    density: "Airy",
    motionTone: "Calm",
  },
  radiusClass: "very-rounded",
  surfaceElevation: "flat-tone",
});
const numericAnalysis = () => numericAnalysisResult().analysis!;

const approvedTokens = () => normalizeDesignTokens({
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#F2EADC", secondary: "#EDE4D2" },
      surface: { card: "#F7F4E8", bottom_sheet: "#F7F4E8", modal: "#F7F4E8" },
      text: { high_emphasis: "#211E1E", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
      action: { primary: "#FEC068", secondary: "#A8B89A", on_primary_text: "#211E1E" },
      border: { divider: "#E4DCCB", focused: "#FEC068" },
    },
    typography: { heading_font_family: "'Plus Jakarta Sans', sans-serif", body_font_family: "Inter, sans-serif" },
    radii: { app: "20px", inner: "12px", pill: "9999px" },
    shadows: { surface: "none", overlay: "0 -8px 40px rgba(33,30,30,0.16)" },
  },
});

const scopeFor = (prompt: string, referenceMode: "user_style" | "internal_style", referenceAnalysisResult = normalizeReferenceAnalysis(null)) =>
  resolveGenerationScopeContract({ prompt, image: null, referenceMode, planningMode: "project", referenceAnalysisResult });

const requestParts = (request: { contents: { parts: Array<{ text?: string }> } }) =>
  request.contents.parts.map((part) => part.text ?? "");
const systemInstruction = (request: { config: { systemInstruction?: string } }) => String(request.config.systemInstruction ?? "");

const isArtDirector = (request: { config?: { systemInstruction?: string } }) =>
  String(request.config?.systemInstruction ?? "").includes("elite mobile product Art Director");

describe("what a style-mode planner is given", () => {
  // a block body: a returned mock would be run by the test runner as a cleanup hook
  beforeEach(() => {
    mocks.generate.mockReset();
  });

  it("makes no creative-direction call for a style reference, and no value reaches the blueprint planner", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const analysis = numericAnalysis();
    // the stored analysis really does carry values: this is the older data the scrub exists for
    expect(JSON.stringify(analysis)).toMatch(VALUE);

    await expect(planUiFlow({
      prompt: "An app for families with multiple pets",
      referenceMode: "user_style",
      referenceAnalysis: analysis,
      designTokens: approvedTokens(),
      scopeContract: scopeFor("An app for families with multiple pets", "user_style", numericAnalysisResult()),
    })).rejects.toThrow("Captured planner request");

    // the only model call is the blueprint itself: no art-director call came first
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    const request = mocks.generate.mock.calls[0][0];
    expect(systemInstruction(request)).toContain("STEP: PROJECT BLUEPRINT ONLY");
    expect(systemInstruction(request)).not.toContain('"creativeDirection"');

    const parts = requestParts(request);
    for (const text of parts) expect(text).not.toMatch(VALUE);
    const prompt = parts.join("\n");
    // the analysis, the family contract and the tokens all speak in categories
    expect(prompt).toContain("generously rounded cards");
    expect(prompt).toContain("no cast shadow");
    expect(prompt).toContain("Approved Token Language (words only");
    expect(prompt).toContain("Fonts: Plus Jakarta Sans for headings and Inter for everything else.");
    expect(prompt).not.toContain("Approved Token Context");
    expect(prompt).not.toContain("Creative Direction:");
    // the reference still arrives, as invariants without its source anatomy
    expect(prompt).toContain("PORTABLE REFERENCE INVARIANTS");
    expect(prompt).toContain("Warm cream");
  });

  it("keeps a creative direction for a prompt-only project, where it is the only art direction", async () => {
    mocks.generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) => {
      if (isArtDirector(request)) return { text: "{}" };
      throw new Error("Captured planner request");
    });
    await expect(planUiFlow({
      prompt: "A recipe app",
      referenceMode: "internal_style",
      scopeContract: scopeFor("A recipe app", "internal_style"),
    })).rejects.toThrow("Captured planner request");

    expect(mocks.generate.mock.calls.filter(([request]) => isArtDirector(request))).toHaveLength(1);
    const blueprint = mocks.generate.mock.calls.map(([request]) => request).find((request) => systemInstruction(request).includes("STEP: PROJECT BLUEPRINT ONLY"));
    expect(requestParts(blueprint).join("\n")).toContain("Creative Direction:");
    expect(systemInstruction(blueprint)).toContain('"creativeDirection"');
  });
});

describe("the brief planner in style mode", () => {
  const savedCharter: ProjectCharter = {
    originalPrompt: "An app for families with multiple pets",
    appType: "Pet care",
    targetAudience: "Families with pets",
    navigationModel: "Three destinations in a bottom dock",
    navigationArchitecture: {
      kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
      consistencyRules: ["Keep the dock on root screens"], rationale: "Peer destinations",
    },
    keyFeatures: ["Pets", "Health"],
    designRationale: "A calm, tonal, pastel pet-care product",
  };
  const savedNavigation: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "product-architecture", reason: "Shop, orders and profile are peer areas" },
    items: [
      { id: "shop", label: "Shop", icon: "store", role: "Browse products", availability: "generated", linkedScreenName: "Shop" },
      { id: "orders", label: "Orders", icon: "package", role: "Track purchases", availability: "planned", linkedScreenName: null },
    ],
    design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "solid",
      radiusPx: 32, safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: false, elevation: "low", centerActionItemId: null },
    visualBrief: "Saved dock",
    screenChrome: [{ screenName: "Shop", chrome: "bottom-tabs", navigationItemId: "shop" }],
  };
  const laterBatch = () => {
    const base = designerFixture();
    base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
    return approveProductScope(proposeProductScope(base), base.revision);
  };
  const briefWithValues = {
    name: "Shop", type: "root", roadmap_stable_key: "screen:shop",
    description: ["SCREEN PURPOSE: Browse the T-shirt catalog.", "INFORMATION HIERARCHY: Featured shirt, then the grid.",
      "LAYOUT ANATOMY: Header, featured card, two-column grid.",
      "KEY COMPONENTS: Size chips and product cards with a 32px radius on a #FDFBF0 fill and a 4% opacity shadow.",
      "PREMIUM DESIGN DECISIONS: One large featured shirt.", "INTERACTION: Tap a card to open the product.",
      "MUST PRESERVE: The featured shirt leads the screen."].join("\n"),
    layout_contract: { viewport_plan: "Scrolling catalog", focal_hierarchy: "Featured shirt first", section_rhythm: "32px between sections",
      component_density: "Two columns", cta_policy: "No primary CTA", anti_patterns: [] },
    reference_transfer: { layout_source: "screen-purpose", preserve: ["Warm cream background (#FDFBF0)"], adapt: ["Radius should be at least 24px"], reject: [], rationale: "Prompt-only screen." },
    chrome_policy: { chrome: "bottom-tabs", show_primary_navigation: true, shows_back_button: false },
    asset_needs: [],
    state_variants: [],
  };
  const laterBatchInput = (referenceAnalysis: ReturnType<typeof numericAnalysis> | null) => ({
    prompt: "Design Shop",
    productPlanning: laterBatch(),
    productExecutionKeys: ["screen:shop"],
    referenceMode: "user_style" as const,
    referenceAnalysis,
    designTokens: approvedTokens(),
    existingCharter: savedCharter,
    existingNavigationPlan: savedNavigation,
  });

  // a block body: a returned mock would be run by the test runner as a cleanup hook
  beforeEach(() => {
    mocks.generate.mockReset();
  });

  it("is given the discovery designer's component mapping, and no token values", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    await expect(planUiFlow(laterBatchInput(numericAnalysis()))).rejects.toThrow("Captured planner request");

    const request = mocks.generate.mock.calls[0][0];
    expect(systemInstruction(request)).toContain("STEP: SCREEN BRIEFS ONLY");
    const prompt = requestParts(request).join("\n");
    expect(prompt).toContain("REFERENCE COMPONENT MAPPING");
    expect(prompt).toContain("Mapping: Use product data rather than editorial filler");
    expect(prompt).toContain("name that component in KEY COMPONENTS");
    expect(prompt).not.toContain("Approved Token Context");
    expect(prompt).not.toContain("Approved Token Language");
    // the reference arrives as invariants, and none of its values do
    expect(prompt).toContain("PORTABLE REFERENCE INVARIANTS");
    expect(prompt).not.toMatch(/#F5B25A|#FDFBF0|24pt|Radius should be at least/i);
    for (const text of requestParts(request)) expect(text).not.toMatch(VALUE);
  });

  it("gives no component mapping outside style mode", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    await expect(planUiFlow(laterBatchInput(null))).rejects.toThrow("Captured planner request");
    expect(requestParts(mocks.generate.mock.calls[0][0]).join("\n")).not.toContain("REFERENCE COMPONENT MAPPING");
  });

  it("removes a value a planner slipped into a style-mode brief and its contracts", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ screens: [briefWithValues] }) });
    const plan = await planUiFlow(laterBatchInput(numericAnalysis()));
    const [screen] = plan.screens;
    expect(screen.name).toBe("Shop");
    expect(screen.description).not.toMatch(VALUE);
    expect(screen.description).toContain("Size chips and product cards");
    expect(screen.layoutContract?.sectionRhythm).not.toMatch(VALUE);
    expect(JSON.stringify(screen.referenceTransfer)).not.toMatch(VALUE);
    // the charter saved with the project carries no value in its prose. Its reference DNA is the
    // analysis as recorded; every prompt reads it through the portable context, which is scrubbed.
    const { referenceDna, ...charterProse } = plan.charter;
    expect(referenceDna?.analysis).toBeTruthy();
    expect(JSON.stringify(charterProse)).not.toMatch(VALUE);
  });

  it("leaves a brief alone when the project has no style reference", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ screens: [briefWithValues] }) });
    const plan = await planUiFlow(laterBatchInput(null));
    expect(plan.screens[0].layoutContract?.sectionRhythm).toBe("32px between sections");
    expect(plan.screens[0].description).toContain("32px radius");
  });
});

describe("stripScreenBriefValues", () => {
  const screen: ScreenPlan = {
    name: "Home",
    type: "root",
    description: "KEY COMPONENTS: Cards with a 24px radius and a 0 4px 20px rgba(0,0,0,0.04) shadow.",
    layoutContract: {
      viewportPlan: "Scroll",
      focalHierarchy: "Greeting first",
      sectionRhythm: "24px between sections",
      componentDensity: "Two columns",
      ctaPolicy: "One primary action",
      antiPatterns: ["No 8px gutters"],
    },
    referenceTransfer: {
      layoutSource: "reference",
      preserve: ["Warm cream background (#FDFBF0)"],
      adapt: ["High corner radius (24pt+)"],
      reject: [],
      rationale: "Keep the tonal cards at 4% opacity",
      targetCapabilities: [],
      semanticDecisions: [],
      premiumQualityTargets: ["Radius should be at least 24px"],
    },
  };

  it("scrubs the description and both contracts without touching anything else", () => {
    const [clean] = stripScreenBriefValues([screen]);
    expect(JSON.stringify(clean)).not.toMatch(VALUE);
    expect(clean.name).toBe("Home");
    expect(clean.type).toBe("root");
    expect(clean.description).toContain("KEY COMPONENTS: Cards with a");
    expect(clean.layoutContract?.focalHierarchy).toBe("Greeting first");
    expect(clean.referenceTransfer?.layoutSource).toBe("reference");
  });

  it("handles a screen with no contracts", () => {
    const [clean] = stripScreenBriefValues([{ name: "Bare", type: "detail", description: "Padding of 16px." }]);
    expect(clean.description).not.toMatch(VALUE);
    expect(clean.layoutContract).toBeUndefined();
    expect(clean.referenceTransfer).toBeUndefined();
  });
});
