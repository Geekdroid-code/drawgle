import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
// the presets file as it will ship once a founder has approved the mindfulness preset
vi.mock("@/lib/generation/generated/curated-style-presets.json", async () => {
  const { PRESET_REFERENCE_ID, presetFixture } = await import("@/lib/generation/curated-style-preset-fixtures");
  return { default: { [PRESET_REFERENCE_ID]: JSON.parse(JSON.stringify(presetFixture())) } };
});

import { referenceAnalysisStyleInstruction } from "@/lib/generation/prompts";
import { applyReferenceNavigationStyle } from "@/lib/project-navigation";
import {
  PRESET_REFERENCE_ID,
  presetAnalysis,
  presetComponents,
  presetFixture,
} from "@/lib/generation/curated-style-preset-fixtures";
import { presetReferenceAnalysis } from "@/lib/generation/curated-style-presets";
import { analyzeReferenceImageForScope } from "@/lib/generation/scope-contract";
import { generateDesignTokens, planUiFlow } from "@/lib/generation/service";
import { generateProjectDesign } from "@/lib/product-planning/generate-project-design";
import { approveProductScope, proposeProductScope } from "@/lib/product-planning/model";
import { designerFixture, functionalFixture, productFixture } from "@/lib/product-planning/test-fixtures";
import type { NavigationPlan, ProjectCharter } from "@/lib/types";

const image = { data: "dGVzdA==", mimeType: "image/png" };
const prompt = "An app for families with multiple pets";

/** What the token model returns: a 32px card, a blurred shadow, and white cards on a cream page. */
const modelTokens = {
  system_schema: "mobile_universal_core",
  meta: { recommendedFonts: ["Fraunces", "Inter"] },
  tokens: {
    color: {
      background: { primary: "#F9F6F0", secondary: "#F1ECE3" },
      surface: { card: "#FFFFFF", bottom_sheet: "#FFFFFF", modal: "#FFFFFF" },
      text: { high_emphasis: "#2D2926", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
      action: { primary: "#A8B89A", secondary: "#C9B79C", on_primary_text: "#1F2A18" },
      border: { divider: "#EBE5DA", focused: "#A8B89A" },
    },
    typography: { heading_font_family: "Fraunces, serif", body_font_family: "Inter, sans-serif" },
    radii: { app: "32px", inner: "20px", pill: "9999px" },
    shadows: { surface: "0 4px 20px rgba(45,41,38,0.04)", overlay: "0 -8px 40px rgba(45,41,38,0.30)" },
  },
};

const requirements = (detail: string) => [
  "EXPLICIT USER DESIGN REQUIREMENTS",
  "Preserve these evidenced choices.",
  JSON.stringify([{ id: "palette", label: "Design", detail, evidence: "the user said so" }]),
].join("\n");

const tokenCall = () => mocks.generate.mock.calls.map(([request]) => request)
  .find((request) => String(request.config?.systemInstruction ?? "").includes("Design Token System"));

beforeEach(() => {
  mocks.generate.mockReset();
  mocks.generate.mockImplementation(async () => ({ text: JSON.stringify(modelTokens) }));
});

describe("an approved preset stands in for the run-time analysis", () => {
  it("makes no model call for a curated reference, and answers as a complete analysis", async () => {
    const result = await analyzeReferenceImageForScope({ prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ source: "full_analysis", confidence: "high", screenCountEstimate: 3, screenReferenceCount: 3 });
    expect(result.analysis?.screenReferences).toHaveLength(3);
    expect(result.analysis?.radiusClass).toBe("very-rounded");
    // the reference's own navigation
    expect(result.analysis?.primaryNavigation).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden" });
  });

  it("does not need the image", async () => {
    const result = await analyzeReferenceImageForScope({ prompt, image: null, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID });
    expect(result.analysis?.screenReferences).toHaveLength(3);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("analyses as before a reference that has no preset, and anything that is not a curated reference", async () => {
    mocks.generate.mockImplementation(async () => ({ text: JSON.stringify(presetAnalysis()) }));
    await analyzeReferenceImageForScope({ prompt, image, referenceMode: "curated_style", referenceId: "crypto-wallet-glowing-dark" });
    await analyzeReferenceImageForScope({ prompt, image, referenceMode: "curated_style", referenceId: null });
    await analyzeReferenceImageForScope({ prompt, image, referenceMode: "user_style", referenceId: PRESET_REFERENCE_ID });
    await analyzeReferenceImageForScope({ prompt, image, referenceMode: "user_recreate", referenceId: PRESET_REFERENCE_ID });
    expect(mocks.generate).toHaveBeenCalledTimes(4);
  });
});

describe("an approved preset stands in for the token model", () => {
  it("makes no model call for a curated reference when the user named no colours or fonts", async () => {
    const tokens = await generateDesignTokens({ prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID });
    // no analysis, no creative direction, no token call
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(tokens.tokens?.radii).toMatchObject({ app: "20px", inner: "12px" });
    expect(tokens.tokens?.shadows?.surface).toBe("none");
    expect(tokens.tokens?.color?.background?.primary).toBe("#F2EADC");
    expect(tokens.tokens?.color?.surface?.card).toBe("#F7F4E8");
    expect(tokens.tokens?.color?.surface?.inset).toBe("#EDEAD7");
    expect(tokens.tokens?.typography?.heading_font_family).toContain("Plus Jakarta Sans");
  });

  it("leaves requirements that name no colour or font to the preset", async () => {
    await generateDesignTokens({ prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID, designRequirements: requirements("Keep it minimal and calm") });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("asks the token model once when the user named colours, and takes only those roles from its answer", async () => {
    const tokens = await generateDesignTokens({
      prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID,
      designRequirements: requirements("Soft Sage and Warm Cream"),
    });
    // one call, and it is the token call: the preset's analysis and measured palette were the evidence
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    const text = (tokenCall()!.contents.parts as Array<{ text?: string }>).map((part) => part.text ?? "").join("\n");
    expect(text).toContain("MEASURED COLORS");
    expect(text).toContain("#F2EADC");
    expect(text).not.toContain("Creative Direction:");
    // the user's accent and page
    expect(tokens.tokens?.color?.action?.primary).toBe("#A8B89A");
    expect(tokens.tokens?.color?.background?.primary).toBe("#F9F6F0");
    // the reference's geometry and depth, not the model's 32px and blurred shadow
    expect(tokens.tokens?.radii).toMatchObject({ app: "20px", inner: "12px" });
    expect(tokens.tokens?.shadows?.surface).toBe("none");
    // and its type, since no font was named
    expect(tokens.tokens?.typography?.heading_font_family).toContain("Plus Jakarta Sans");
  });

  it("takes the fonts from the model when the user named them", async () => {
    const tokens = await generateDesignTokens({
      prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID,
      designRequirements: requirements("Use a serif font for headings"),
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(tokens.tokens?.typography?.heading_font_family).toBe("Fraunces, serif");
    expect(tokens.tokens?.radii?.app).toBe("20px");
    // no colour was named, so the colours are the preset's
    expect(tokens.tokens?.color?.background?.primary).toBe("#F2EADC");
  });

  it("makes the model's tokens as before for every other reference, and for the preset builder", async () => {
    const other = await generateDesignTokens({ prompt, image, referenceMode: "curated_style", referenceId: "crypto-wallet-glowing-dark", referenceAnalysis: presetAnalysis() as never });
    expect(other.tokens?.color?.background?.primary).not.toBe("#F2EADC");
    mocks.generate.mockClear();

    await generateDesignTokens({ prompt, image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID, referenceAnalysis: presetAnalysis() as never, ignorePreset: true });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    mocks.generate.mockClear();

    // an uploaded reference is never a curated one, whatever its id
    await generateDesignTokens({ prompt, image, referenceMode: "user_style", referenceId: PRESET_REFERENCE_ID, referenceAnalysis: presetAnalysis() as never });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});

describe("the early project design", () => {
  it("makes no analysis, creative-direction, token or review call for an approved preset", async () => {
    const design = await generateProjectDesign(productFixture(), { image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID, designStyle: null });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(design.designTokens.tokens?.radii?.app).toBe("20px");
    expect(design.referenceAnalysis?.screenReferences).toHaveLength(3);
    expect(design.referenceAnalysis?.primaryNavigation).toMatchObject({ anatomy: "fixed-tab-rail" });
  });

  it("asks only for the token model's colours when the user named some", async () => {
    const state = designerFixture();
    state.blueprint.facts = state.blueprint.facts.map((fact) => fact.section === "preferences"
      ? { ...fact, source: "user" as const, evidence: "the user's own words", detail: "Soft Sage and Warm Cream" }
      : fact);
    mocks.generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) =>
      String(request.config?.systemInstruction ?? "").includes("Review tokens")
        ? { text: JSON.stringify({ edits: [] }) }
        : { text: JSON.stringify(modelTokens) });
    const design = await generateProjectDesign(state, { image, referenceMode: "curated_style", referenceId: PRESET_REFERENCE_ID, designStyle: null });
    const calls = mocks.generate.mock.calls.map(([request]) => String(request.config?.systemInstruction ?? ""));
    // the token call, and the review of the tokens against the user's words: never an analysis or a creative direction
    expect(calls.some((instruction) => instruction.includes("Design Token System"))).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls.some((instruction) => instruction.includes("elite mobile product Art Director"))).toBe(false);
    expect(calls.some((instruction) => instruction === referenceAnalysisStyleInstruction)).toBe(false);
    expect(design.designTokens.tokens?.radii?.app).toBe("20px");
  });
});

describe("the project's reference DNA", () => {
  const savedCharter: ProjectCharter = {
    originalPrompt: prompt, appType: "Pet care", targetAudience: "Families", navigationModel: "Peer destinations in a dock",
    navigationArchitecture: {
      kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs", detailChrome: "top-bar-back",
      consistencyRules: [], rationale: "Peer areas",
    },
    keyFeatures: ["Pets"], designRationale: "A calm, tonal product",
  };
  const savedNavigation: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "product-architecture", reason: "Peer areas" },
    items: [{ id: "shop", label: "Shop", icon: "store", role: "Browse", availability: "generated", linkedScreenName: "Shop" }],
    design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "solid",
      radiusPx: 32, safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: false, elevation: "low", centerActionItemId: null },
    visualBrief: "Saved dock",
    screenChrome: [{ screenName: "Shop", chrome: "bottom-tabs", navigationItemId: "shop" }],
  };
  const shopBrief = {
    name: "Shop", type: "root", roadmap_stable_key: "screen:shop",
    description: ["SCREEN PURPOSE: Browse the catalog.", "INFORMATION HIERARCHY: Featured item, then the grid.", "LAYOUT ANATOMY: Header, featured card, grid.",
      "KEY COMPONENTS: Size chips and product cards.", "PREMIUM DESIGN DECISIONS: One large featured item.", "INTERACTION: Tap a card to open it.",
      "MUST PRESERVE: The featured item leads."].join("\n"),
    layout_contract: { viewport_plan: "Scrolling catalog", focal_hierarchy: "Featured first", section_rhythm: "Generous", component_density: "Two columns", cta_policy: "None", anti_patterns: [] },
    reference_transfer: { layout_source: "screen-purpose", preserve: [], adapt: [], reject: [], rationale: "Prompt-only screen." },
    chrome_policy: { chrome: "bottom-tabs", show_primary_navigation: true, shows_back_button: false },
    asset_needs: [], state_variants: [],
  };
  const laterBatch = () => {
    const base = designerFixture();
    base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
    return approveProductScope(proposeProductScope(base), base.revision);
  };
  const plan = (referenceId: string | null) => planUiFlow({
    prompt: "Design Shop", productPlanning: laterBatch(), productExecutionKeys: ["screen:shop"], referenceMode: "curated_style", referenceId,
    referenceAnalysis: presetAnalysis() as never, existingCharter: savedCharter, existingNavigationPlan: savedNavigation,
  });

  it("carries the preset's components to every later batch of the project", async () => {
    mocks.generate.mockImplementation(async () => ({ text: JSON.stringify({ screens: [shopBrief] }) }));
    const { charter } = await plan(PRESET_REFERENCE_ID);
    expect(charter.referenceDna?.specimen).toEqual({ source: "preset", components: presetComponents() });
    expect(charter.referenceDna?.sourceReferenceId).toBe(PRESET_REFERENCE_ID);
  });

  it("carries none for a reference without a preset", async () => {
    mocks.generate.mockImplementation(async () => ({ text: JSON.stringify({ screens: [shopBrief] }) }));
    const { charter } = await plan("crypto-wallet-glowing-dark");
    expect(charter.referenceDna).toBeTruthy();
    expect(charter.referenceDna).not.toHaveProperty("specimen");
  });
});

describe("the reference's own navigation", () => {
  it("builds a new shared navigation the way the reference's bar is built", () => {
    const planned: NavigationPlan = {
      version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
      evidence: { source: "product-architecture", reason: "Four peer areas" },
      items: ["today", "pets", "routines", "family"].map((id) => ({ id, label: id, icon: "circle", role: id, availability: "planned" as const, linkedScreenName: null })),
      design: { anatomy: "floating-dock", width: "content", labels: "active-only", activeTreatment: "compact-chip", surface: "glass",
        radiusPx: 32, safeAreaOffsetPx: 16, itemGapPx: 8, iconSizePx: 22, border: true, elevation: "medium", centerActionItemId: null },
      visualBrief: "A floating glass dock",
      screenChrome: [],
    };
    const styled = applyReferenceNavigationStyle(planned, presetReferenceAnalysis(presetFixture()).primaryNavigation);
    expect(styled.design).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden", activeTreatment: "icon-fill", inactiveTreatment: "plain", width: "full", surface: "solid" });
    // the product still decides its destinations
    expect(styled.items.map((item) => item.id)).toEqual(["today", "pets", "routines", "family"]);
    expect(styled.visualBrief).toContain("attached to the bottom edge");
  });
});
