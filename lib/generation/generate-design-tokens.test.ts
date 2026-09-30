// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: generate } }) }));
// These tests are about the model path, so no preset is approved, whatever the presets file holds.
vi.mock("@/lib/generation/generated/curated-style-presets.json", () => ({ default: {} }));

import { hexDeltaE } from "@/lib/color-lab";
import { loadableFontFamily } from "@/lib/font-stack";
import { generateDesignTokens } from "@/lib/generation/service";
import { buildGoogleFontHref } from "@/lib/token-runtime";
import type { DesignStylePack, ReferenceAnalysis } from "@/lib/types";

/** What the token model returned for the pet project. */
const modelTokens = {
  system_schema: "mobile_universal_core",
  meta: { recommendedFonts: ["Plus Jakarta Sans", "Inter"] },
  tokens: {
    color: {
      background: { primary: "#F9F6F0", secondary: "#F1ECE3" },
      surface: { card: "#FFFFFF", bottom_sheet: "#FFFFFF", modal: "#FFFFFF" },
      text: { high_emphasis: "#2D2926", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
      action: { primary: "#F5B25A", secondary: "#A8B89A", on_primary_text: "#2D2926" },
      border: { divider: "#EBE5DA", focused: "#F5B25A" },
    },
    radii: { app: "32px", inner: "20px", pill: "9999px" },
    shadows: { surface: "0 4px 20px rgba(45,41,38,0.04)", overlay: "0 -8px 40px rgba(45,41,38,0.30)" },
  },
};

const analysis = {
  overallVisualStyle: "Tonal, warm, calm",
  screenCountEstimate: 1,
  screenReferences: [{
    index: 1, suggestedRole: "Dashboard", layoutSummary: "", visualHierarchy: "", components: [], stylingCues: [],
    interactionCues: [], copyPatterns: [], implementationNotes: [], boundingBox: { x: 0, y: 0, width: 1, height: 1 },
  }],
  designSystemSignals: { palette: "cream", typography: "grotesk", surfaces: "tonal", iconography: "line", density: "airy", motionTone: "calm" },
  radiusClass: "very-rounded",
  surfaceElevation: "flat-tone",
} as unknown as ReferenceAnalysis;

const referenceImage = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" shape-rendering="crispEdges">
    <rect width="400" height="800" fill="#ECE9D6"/>
    <rect x="16" y="120" width="368" height="240" rx="20" fill="#F7F5E9"/>
    <rect x="16" y="400" width="368" height="240" rx="20" fill="#F7F5E9"/>
    <rect x="32" y="440" width="140" height="44" rx="22" fill="#FFC068"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { data: png.toString("base64"), mimeType: "image/png" };
};

const tokenCall = () => generate.mock.calls.map(([request]) => request)
  .find((request) => String(request.config?.systemInstruction ?? "").includes("Design Token System"));
const tokenPromptText = () => (tokenCall()?.contents.parts as Array<{ text?: string }>).map((part) => part.text ?? "").join("\n");
const creativeDirectionCalls = () => generate.mock.calls.map(([request]) => request)
  .filter((request) => String(request.config?.systemInstruction ?? "").includes("elite mobile product Art Director"));

beforeEach(() => {
  generate.mockReset();
  generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) =>
    String(request.config?.systemInstruction ?? "").includes("elite mobile product Art Director")
      ? { text: "{}" }
      : { text: JSON.stringify(modelTokens) });
});

/** The token model answers with these labels beside its tokens (lib/generation/token-labels.ts). */
const answerWith = (meta: Record<string, unknown>) =>
  generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) =>
    String(request.config?.systemInstruction ?? "").includes("elite mobile product Art Director")
      ? { text: "{}" }
      : { text: JSON.stringify({ ...modelTokens, meta: { ...modelTokens.meta, ...meta } }) });

const userRequirements = (detail: string) => [
  "EXPLICIT USER DESIGN REQUIREMENTS",
  "Preserve these evidenced choices.",
  JSON.stringify([{ id: "f1", label: "Product", detail, evidence: "the user said so" }]),
].join("\n");

describe("generateDesignTokens measures and calibrates", () => {
  it("tells the token model the measured colours and calibrates a style reference's tokens", async () => {
    // the model says the reference uses tinted wells and chips
    answerWith({ tints: true });
    const tokens = await generateDesignTokens({
      prompt: "An app for families with multiple pets",
      image: await referenceImage(),
      referenceMode: "curated_style",
      referenceId: "mindfulness-meditation-beige-light",
      referenceAnalysis: analysis,
    });

    const prompt = tokenPromptText();
    expect(prompt).toContain("MEASURED COLORS (from the reference pixels; authoritative).");
    expect(prompt).toContain("generously rounded cards");
    expect(prompt).toContain("no cast shadow and no border");

    const values = tokens.tokens!;
    // radius: the class's own radius, never 32px
    expect(values.radii?.app).toBe("20px");
    expect(Number.parseFloat(values.radii!.inner!)).toBeLessThan(20);
    // elevation: flat reference, no cast shadow, and the navigation copy follows
    expect(values.shadows?.surface).toBe("none");
    expect(values.navigation?.shadow).toBe("none");
    // colours: the measured page and card, tone-on-tone, and the action colour near the apricot snapped
    expect(hexDeltaE(values.color!.background!.primary!, "#ECE9D6")).toBeLessThan(2);
    expect(hexDeltaE(values.color!.surface!.card!, "#F7F5E9")).toBeLessThan(2);
    expect(values.color?.surface?.inset).toBeTruthy();
    expect(hexDeltaE(values.color!.action!.primary!, "#FFC068")).toBeLessThan(3);
    // tints exist for the wells and chips, and the model's labels are not kept as tokens
    expect(Object.keys(values.color?.accent_tints ?? {}).length).toBeGreaterThan(0);
    expect(tokens.meta).not.toHaveProperty("tints");
    expect(tokens.meta).not.toHaveProperty("userAsked");
  });

  it("makes no tints when the model does not say the design uses them", async () => {
    const tokens = await generateDesignTokens({
      prompt: "A banking app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
    });
    expect(tokens.tokens?.color).not.toHaveProperty("accent_tints");
  });

  it("reads what the user asked for from the model's answer: a product's word is not a colour", async () => {
    answerWith({ userAsked: { colorRoles: [], fonts: false, corners: null, depth: null } });
    const jet = await generateDesignTokens({
      prompt: "A charter app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
      designRequirements: userRequirements("Book private jet charters in two taps"),
    });
    // the measured page, not the model's own: "jet" named no colour
    expect(hexDeltaE(jet.tokens!.color!.background!.primary!, "#ECE9D6")).toBeLessThan(2);

    answerWith({ userAsked: { colorRoles: ["background"], fonts: false, corners: null, depth: null } });
    const black = await generateDesignTokens({
      prompt: "A charter app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
      designRequirements: userRequirements("A jet black app"),
    });
    // the user's page stays: the measured one does not replace it
    expect(black.tokens?.color?.background?.primary).toBe("#F9F6F0");
    expect(black.meta).not.toHaveProperty("userAsked");
  });

  it("keeps an unreviewed reference's corners within 24px, and goes above only when the user asks", async () => {
    const extraRounded = { ...analysis, radiusClass: "extra-rounded" } as ReferenceAnalysis;
    const upload = await generateDesignTokens({ prompt: "A playful app", image: await referenceImage(), referenceMode: "user_style", referenceAnalysis: extraRounded });
    expect(upload.tokens?.radii?.app).toBe("24px");

    answerWith({ userAsked: { colorRoles: [], fonts: false, corners: "extra-rounded", depth: null } });
    const asked = await generateDesignTokens({
      prompt: "A playful app", image: await referenceImage(), referenceMode: "user_style", referenceAnalysis: analysis,
      designRequirements: userRequirements("Bubbly, very rounded cards"),
    });
    // the model's 32px is inside the extra-rounded class the user asked for
    expect(asked.tokens?.radii?.app).toBe("32px");
  });

  it("measures and calibrates an uploaded style reference the same way, with no catalogue id and no preset", async () => {
    const tokens = await generateDesignTokens({
      prompt: "An app for families with multiple pets",
      image: await referenceImage(),
      referenceMode: "user_style",
      referenceAnalysis: analysis,
    });
    expect(tokenPromptText()).toContain("MEASURED COLORS (from the reference pixels; authoritative).");
    const values = tokens.tokens!;
    expect(values.radii?.app).toBe("20px");
    expect(values.shadows?.surface).toBe("none");
    expect(hexDeltaE(values.color!.background!.primary!, "#ECE9D6")).toBeLessThan(2);
    expect(hexDeltaE(values.color!.surface!.card!, "#F7F5E9")).toBeLessThan(2);
  });

  it("asks the token model with a little thinking and at its own temperature", async () => {
    await generateDesignTokens({
      prompt: "An app for families with multiple pets",
      image: await referenceImage(),
      referenceMode: "user_style",
      referenceAnalysis: analysis,
    });
    const config = tokenCall()?.config;
    expect(config?.thinkingConfig?.thinkingLevel).toBe("low");
    expect(config?.temperature).toBeUndefined();
    expect(config?.responseMimeType).toBe("application/json");
  });

  it("guides prompt-only tokens too: a guessed radius stays within 24px, and the design's own depth is kept soft", async () => {
    const tokens = await generateDesignTokens({ prompt: "A recipe app", referenceMode: "internal_style", referenceAnalysis: null });
    expect(tokenPromptText()).not.toContain("MEASURED COLORS");
    expect(tokens.tokens?.radii?.app).toBe("24px");
    // nothing shows how cards separate, so the model's own shadow stays, softened, instead of being forced flat
    expect(tokens.tokens?.shadows?.surface).toBe("0px 4px 16px 0px rgba(45, 41, 38, 0.04)");
    // no palette: the model's colours stand
    expect(tokens.tokens?.color?.background?.primary).toBe("#F9F6F0");
    expect(tokens.tokens?.color?.surface?.card).toBe("#FFFFFF");
  });

  it("does not touch Image to UI tokens: the source is the authority", async () => {
    const tokens = await generateDesignTokens({
      prompt: "Recreate this screen",
      image: await referenceImage(),
      referenceMode: "user_recreate",
      referenceAnalysis: analysis,
    });
    expect(tokenPromptText()).not.toContain("MEASURED COLORS");
    expect(tokens.tokens?.radii?.app).toBe("32px");
    expect(tokens.tokens?.shadows?.surface).toBe("0 4px 20px rgba(45,41,38,0.04)");
    expect(tokens.tokens?.color?.surface?.card).toBe("#FFFFFF");
  });

  it("leaves an explicit design style's tokens alone", async () => {
    const stylePack = {
      id: "soft-clay", label: "Soft clay", version: 1, premiumIntent: "warm depth", bestFor: [],
      tokenSeed: {}, creativeDirectionSeed: {}, layoutGrammar: [], componentRecipes: [], navigationRecipes: [],
      assetAndImageryRules: [], densityRules: [], antiPatterns: [],
    } as unknown as DesignStylePack;
    const tokens = await generateDesignTokens({
      prompt: "A habit tracker",
      referenceMode: "internal_style",
      designStyle: stylePack,
      referenceAnalysis: null,
    });
    expect(tokens.tokens?.radii?.app).toBe("32px");
    expect(tokens.tokens?.shadows?.surface).toBe("0 4px 20px rgba(45,41,38,0.04)");
  });

  it("lets user-named colours win over the measured palette", async () => {
    const requirements = [
      "EXPLICIT USER DESIGN REQUIREMENTS",
      "Preserve these evidenced choices.",
      JSON.stringify([{ id: "palette", label: "Colour palette", detail: "Soft Sage and Warm Cream", evidence: "the user said so" }]),
    ].join("\n");
    const tokens = await generateDesignTokens({
      prompt: "An app for families with multiple pets",
      image: await referenceImage(),
      referenceMode: "curated_style",
      referenceAnalysis: analysis,
      designRequirements: requirements,
    });
    const color = tokens.tokens!.color!;
    // the user's page and accent stay; geometry still follows the reference
    expect(color.background?.primary).toBe("#F9F6F0");
    expect(color.action?.primary).toBe("#F5B25A");
    expect(tokens.tokens?.radii?.app).toBe("20px");
    expect(tokens.tokens?.shadows?.surface).toBe("none");
    // the card is a tone step above the user's cream, not white and not the reference's card
    const step = hexDeltaE(color.surface!.card!, "#F9F6F0")!;
    expect(step).toBeGreaterThan(1.5);
    expect(step).toBeLessThan(6);
  });

  it("carries on with the model's colours when the palette cannot be measured", async () => {
    const tokens = await generateDesignTokens({
      prompt: "An app for pets",
      image: { data: Buffer.from("not an image").toString("base64"), mimeType: "image/png" },
      referenceMode: "curated_style",
      referenceAnalysis: analysis,
    });
    expect(tokenPromptText()).not.toContain("MEASURED COLORS");
    expect(tokens.tokens?.color?.background?.primary).toBe("#F9F6F0");
    expect(tokens.tokens?.radii?.app).toBe("20px");
  });
});

describe("generateDesignTokens keeps the fonts the evidence chose", () => {
  const modelReturns = (typography: Record<string, string>, recommendedFonts: string[]) =>
    generate.mockImplementation(async (request: { config?: { systemInstruction?: string } }) =>
      String(request.config?.systemInstruction ?? "").includes("elite mobile product Art Director")
        ? { text: "{}" }
        : { text: JSON.stringify({ ...modelTokens, meta: { recommendedFonts }, tokens: { ...modelTokens.tokens, typography } }) });
  const generateFor = async () => generateDesignTokens({
    prompt: "A wellness app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
  });

  it("keeps one family for both roles when the model chose one, as a single-typeface reference has", async () => {
    modelReturns({ heading_font_family: '"Manrope", sans-serif', body_font_family: '"Manrope", sans-serif' }, ["Manrope"]);
    const typography = (await generateFor()).tokens?.typography;
    expect(typography?.heading_font_family).toBe('"Manrope", sans-serif');
    expect(typography?.body_font_family).toBe('"Manrope", sans-serif');
  });

  it("does not keep a generic keyword or a device-only face as a font, so that the canvas loads real ones", async () => {
    // what the preset build of the mindfulness reference got back: headings in `serif`, body in `sans-serif`
    modelReturns({ heading_font_family: "serif", body_font_family: '"sans-serif", sans-serif' }, ["New York", "SF Pro Display", "Lora", "Inter"]);
    const tokens = await generateFor();
    expect(loadableFontFamily(tokens.tokens?.typography?.heading_font_family)).toBe("Lora");
    expect(loadableFontFamily(tokens.tokens?.typography?.body_font_family)).toBe("Inter");
    const href = buildGoogleFontHref(tokens) ?? "";
    expect(href).toContain("family=Lora");
    expect(href).toContain("family=Inter");
  });

  it("keeps a font the user named, even one that only some devices have, and does not ask Google Fonts for it", async () => {
    modelReturns({ heading_font_family: '"SF Pro Display", sans-serif', body_font_family: '"SF Pro Display", sans-serif' }, ["SF Pro Display"]);
    const tokens = await generateDesignTokens({
      prompt: "A wellness app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
      designRequirements: [
        "EXPLICIT USER DESIGN REQUIREMENTS",
        "Preserve these evidenced choices.",
        JSON.stringify([{ id: "typography", label: "Typography", detail: "Use the SF Pro Display font", evidence: "the user said so" }]),
      ].join("\n"),
    });
    expect(tokens.tokens?.typography?.heading_font_family).toBe('"SF Pro Display", sans-serif');
    expect(tokens.tokens?.typography?.body_font_family).toBe('"SF Pro Display", sans-serif');
    // a request that names a face Google Fonts does not serve fails as a whole, so none is made
    expect(buildGoogleFontHref(tokens)).toBeNull();
  });

  it("keeps a reference read as a sans in a sans, whatever the model made of its mood", async () => {
    // the second mindfulness build: the analysis said an elegant serif, the close-up said a sans, and the model followed the analysis
    modelReturns({ heading_font_family: "Libre Baskerville, serif", body_font_family: "Quicksand, sans-serif" }, ["Libre Baskerville", "Quicksand"]);
    const tokens = await generateDesignTokens({
      prompt: "A wellness app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: { ...analysis, typefaceClass: "sans" },
    });
    expect(tokens.tokens?.typography?.heading_font_family).toBe("Quicksand, sans-serif");
    expect(tokens.tokens?.typography?.body_font_family).toBe("Quicksand, sans-serif");
  });

  it("leaves a serif alone when the reference was not read as a sans, and when the user named the fonts", async () => {
    modelReturns({ heading_font_family: "Fraunces, serif", body_font_family: "Inter, sans-serif" }, ["Fraunces", "Inter"]);
    const unread = await generateDesignTokens({
      prompt: "A wellness app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: analysis,
    });
    expect(unread.tokens?.typography?.heading_font_family).toBe("Fraunces, serif");

    const named = await generateDesignTokens({
      prompt: "A wellness app", image: await referenceImage(), referenceMode: "curated_style", referenceAnalysis: { ...analysis, typefaceClass: "sans" },
      designRequirements: [
        "EXPLICIT USER DESIGN REQUIREMENTS",
        "Preserve these evidenced choices.",
        JSON.stringify([{ id: "typography", label: "Typography", detail: "Use a serif font for headings", evidence: "the user said so" }]),
      ].join("\n"),
    });
    expect(named.tokens?.typography?.heading_font_family).toBe("Fraunces, serif");
  });

  it("still gives two families to a model that named two", async () => {
    modelReturns({ heading_font_family: '"Fraunces", serif', body_font_family: '"Inter", sans-serif' }, ["Fraunces", "Inter"]);
    const typography = (await generateFor()).tokens?.typography;
    expect(typography?.heading_font_family).toBe('"Fraunces", serif');
    expect(typography?.body_font_family).toBe('"Inter", sans-serif');
  });
});

describe("generateDesignTokens leaves the art direction to a style reference", () => {
  it("writes no creative direction when a reference image is the direction", async () => {
    await generateDesignTokens({
      prompt: "An app for families with multiple pets",
      image: await referenceImage(),
      referenceMode: "curated_style",
      referenceAnalysis: analysis,
    });
    expect(creativeDirectionCalls()).toHaveLength(0);
    expect(tokenPromptText()).not.toContain("Creative Direction:");
    // the measured palette and the shape language are what the token model works from instead
    expect(tokenPromptText()).toContain("MEASURED COLORS");
  });

  it("writes none when only a stored reference analysis is the direction", async () => {
    await generateDesignTokens({ prompt: "A pet app", referenceMode: "curated_style", referenceAnalysis: analysis });
    expect(creativeDirectionCalls()).toHaveLength(0);
    expect(tokenPromptText()).not.toContain("Creative Direction:");
  });

  it("still writes one for a prompt-only project, where it is the only art direction", async () => {
    await generateDesignTokens({ prompt: "A recipe app", referenceMode: "internal_style", referenceAnalysis: null });
    expect(creativeDirectionCalls()).toHaveLength(1);
    expect(tokenPromptText()).toContain("Creative Direction:");
  });

  it("still writes one for an explicit design style with no reference", async () => {
    const stylePack = {
      id: "soft-clay", label: "Soft clay", version: 1, premiumIntent: "warm depth", bestFor: [],
      tokenSeed: {}, creativeDirectionSeed: {}, layoutGrammar: [], componentRecipes: [], navigationRecipes: [],
      assetAndImageryRules: [], densityRules: [], antiPatterns: [],
    } as unknown as DesignStylePack;
    await generateDesignTokens({ prompt: "A habit tracker", referenceMode: "internal_style", designStyle: stylePack, referenceAnalysis: null });
    expect(creativeDirectionCalls()).toHaveLength(1);
    expect(tokenPromptText()).toContain("Creative Direction:");
  });

  it("keeps Image to UI exactly as it was: its analysis is the source, and a direction is still written", async () => {
    await generateDesignTokens({
      prompt: "Recreate this screen",
      image: await referenceImage(),
      referenceMode: "user_recreate",
      referenceAnalysis: analysis,
    });
    expect(creativeDirectionCalls()).toHaveLength(1);
  });
});
