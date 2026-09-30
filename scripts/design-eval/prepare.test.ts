// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { hexDeltaE } from "@/lib/color-lab";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { ProjectCharter } from "@/lib/types";

import type { ProjectBundle } from "./bundle";
import { prepareSnapshot } from "./prepare";

const tokens = normalizeDesignTokens({
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#F9F6F0", secondary: "#F1ECE3" },
      surface: { card: "#FFFFFF" },
      text: { high_emphasis: "#2D2926", medium_emphasis: "#5C5650", low_emphasis: "#8A847C" },
      action: { primary: "#F5B25A", secondary: "#A8B89A", on_primary_text: "#2D2926" },
      border: { divider: "#EBE5DA", focused: "#F5B25A" },
    },
    radii: { app: "32px", inner: "20px" },
    shadows: { surface: "0 4px 20px rgba(45,41,38,0.04)", overlay: "0 -8px 40px rgba(45,41,38,0.3)" },
  },
});

const charter = {
  referenceDna: {
    analysis: {
      radiusClass: "very-rounded",
      surfaceElevation: "flat-tone",
      screenReferences: [{ boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
    },
  },
} as unknown as ProjectCharter;

const bundle = (overrides: Partial<ProjectBundle["project"]> = {}): ProjectBundle => ({
  version: 1,
  fetchedAt: "now",
  project: { id: "0ce99a06-1111-4222-8333-444444444444", name: "Pets", prompt: "", designTokens: tokens, charter, productPlanning: null, ...overrides },
  screens: [],
  navigation: null,
  reference: { source: "curated", id: "mindfulness-meditation-beige-light", imageUrl: null, imagePath: null, file: null },
});

const image = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" shape-rendering="crispEdges">
    <rect width="400" height="800" fill="#ECE9D6"/>
    <rect x="16" y="120" width="368" height="240" rx="20" fill="#F7F5E9"/>
    <rect x="16" y="400" width="368" height="240" rx="20" fill="#F7F5E9"/>
    <rect x="32" y="440" width="140" height="44" rx="22" fill="#FFC068"/>
  </svg>`;
  return { bytes: await sharp(Buffer.from(svg)).png().toBuffer(), extension: "png" };
};

const planning = (detail: string) => ({
  version: 1,
  designerVersion: 2,
  revision: 1,
  phase: "canvas",
  blueprint: {
    facts: [{
      id: "palette", section: "preferences", label: "Colour palette", detail, source: "user",
      evidence: "the user asked for it", status: "active", supersededBy: null, messageId: null, links: [], blocking: false,
    }],
  },
  scope: null,
  initialTurnComplete: true,
  input: { originalRequest: "pets", imagePath: null, imageReferenceMode: "style", stylePresetSlug: null },
  lease: null,
});

describe("prepareSnapshot", () => {
  it("measures the reference to enable the tone match, and reads elevation from the DNA", async () => {
    const prepared = await prepareSnapshot({ bundle: bundle(), image: await image() });
    expect(prepared.overrides.elevation).toBe("flat-tone");
    expect(prepared.overrides.expected?.background).toMatch(/^#E[CD]E[89A]D[56]$/);
    expect(prepared.overrides.expected?.card).toBe("#F7F5E9");
    expect(prepared.notes[0]).toContain("measured from the reference");
    expect(prepared.bundle).toBe(prepared.bundle);
    expect(prepared.bundle.project.designTokens).toBe(tokens);
  });

  it("lets explicit flags win over the measurement and the DNA", async () => {
    const prepared = await prepareSnapshot({
      bundle: bundle(),
      image: await image(),
      overrides: { elevation: "soft-shadow", expected: { background: "#111111", card: "#222222" } },
    });
    expect(prepared.overrides).toEqual({ elevation: "soft-shadow", expected: { background: "#111111", card: "#222222" } });
    expect(prepared.notes).toEqual([]);
  });

  it("has no expected colours without a reference image", async () => {
    const prepared = await prepareSnapshot({ bundle: bundle(), image: null });
    expect(prepared.overrides.expected).toBeNull();
    expect(prepared.measured).toBeNull();
  });

  it("re-tokens the stored project without touching the original", async () => {
    const original = bundle();
    const snapshot = JSON.stringify(original);
    const prepared = await prepareSnapshot({ bundle: original, image: await image(), retoken: true });
    const values = prepared.bundle.project.designTokens!.tokens!;
    expect(values.radii?.app).toBe("20px");
    expect(values.shadows?.surface).toBe("none");
    expect(hexDeltaE(values.color!.background!.primary!, "#ECE9D6")).toBeLessThan(2);
    expect(values.color?.surface?.card).toBe("#F7F5E9");
    expect(prepared.notes.some((note) => note.startsWith("re-tokened with the calibration"))).toBe(true);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("keeps the user's named colours when re-tokening, as generation does", async () => {
    const prepared = await prepareSnapshot({
      bundle: bundle({ productPlanning: planning("Soft Sage and Warm Cream") }),
      image: await image(),
      retoken: true,
    });
    const color = prepared.bundle.project.designTokens!.tokens!.color!;
    expect(color.background?.primary).toBe("#F9F6F0");
    expect(color.action?.primary).toBe("#F5B25A");
    expect(prepared.bundle.project.designTokens!.tokens!.radii?.app).toBe("20px");
  });

  it("lets a radius class flag override the DNA's", async () => {
    const prepared = await prepareSnapshot({ bundle: bundle(), image: null, retoken: true, radiusClass: "soft" });
    expect(prepared.bundle.project.designTokens!.tokens!.radii?.app).toBe("10px");
  });
});
