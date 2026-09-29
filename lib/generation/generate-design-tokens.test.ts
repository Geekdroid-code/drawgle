// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: generate } }) }));

import { hexDeltaE } from "@/lib/color-lab";
import { generateDesignTokens } from "@/lib/generation/service";
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

describe("generateDesignTokens measures and calibrates", () => {
  it("tells the token model the measured colours and calibrates a style reference's tokens", async () => {
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
    // pastel tints exist for the wells and chips
    expect(Object.keys(values.color?.accent_tints ?? {}).length).toBeGreaterThan(0);
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

  it("calibrates prompt-only tokens too, without a palette", async () => {
    const tokens = await generateDesignTokens({ prompt: "A recipe app", referenceMode: "internal_style", referenceAnalysis: null });
    expect(tokenPromptText()).not.toContain("MEASURED COLORS");
    expect(tokens.tokens?.radii?.app).toBe("24px");
    expect(tokens.tokens?.shadows?.surface).toBe("none");
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
