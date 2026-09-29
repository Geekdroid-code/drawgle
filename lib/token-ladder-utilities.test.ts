import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import { buildPublicDesignMdDocument } from "@/lib/design-md";
import { buildTailwindConfigScript, compileHtmlForProduction } from "@/lib/html-compiler";
import {
  buildDrawgleTokenCss,
  buildTokenPromptContext,
  buildTokenUsageGuide,
  flattenDesignTokensToCssVariables,
} from "@/lib/token-runtime";
import type { DesignTokens, ProjectData } from "@/lib/types";

const withLadder: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#F2EADC", secondary: "#EDE6D8" },
      surface: { card: "#F7F4E8", inset: "#EDEAD7", modal: "#F7F4E8" },
      text: { high_emphasis: "#2D2926", medium_emphasis: "#5C5650", low_emphasis: "#7A746C" },
      action: { primary: "#FEC068", on_primary_text: "#2D2926", secondary: "#A8B89A" },
      border: { divider: "#E4DCCB", focused: "#FEC068" },
      accent_tints: { "1": "#F6DDB9", "2": "#EEEBBF", "3": "#E9EEDD" },
      accent_tints_text: { "1": "#2D2926", "2": "#2D2926", "3": "#2D2926" },
    },
    radii: { app: "20px", inner: "14px", pill: "9999px" },
  },
};

const withoutLadder: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#FFFFFF", secondary: "#F5F5F5" },
      surface: { card: "#FAFAFA" },
      text: { high_emphasis: "#111827", medium_emphasis: "#4B5563", low_emphasis: "#6B7280" },
      action: { primary: "#2563EB", on_primary_text: "#FFFFFF", secondary: "#E5E7EB" },
      border: { divider: "#E5E7EB", focused: "#2563EB" },
    },
  },
};

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

const computed = async (tokens: DesignTokens, html: string) => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html><head><style>${buildDrawgleTokenCss(tokens)}</style></head><body>${html}</body></html>`);
    return await page.evaluate(() => Object.fromEntries(
      Array.from(document.querySelectorAll("[data-probe]")).map((element) => {
        const style = getComputedStyle(element);
        return [element.getAttribute("data-probe"), { background: style.backgroundColor, color: style.color }];
      }),
    )) as Record<string, { background: string; color: string }>;
  } finally {
    await page.close();
  }
};

const probes = `
  <div data-probe="card" class="dg-surface-card"></div>
  <div data-probe="inset" class="dg-surface-inset"></div>
  <div data-probe="tint1" class="dg-tint-1">Tint</div>
  <div data-probe="tint4" class="dg-tint-4">Tint</div>`;

describe("surface ladder utilities", () => {
  it("emits the inset and tint variables from the tokens", () => {
    const names = new Map(flattenDesignTokensToCssVariables(withLadder).map((variable) => [variable.name, variable.value]));
    expect(names.get("--dg-color-surface-inset")).toBe("#EDEAD7");
    expect(names.get("--dg-color-accent-tints-1")).toBe("#F6DDB9");
    expect(names.get("--dg-color-accent-tints-text-1")).toBe("#2D2926");
    expect(names.get("--dg-color-accent-tints-3")).toBe("#E9EEDD");
  });

  it("styles the utilities from the ladder tokens", async () => {
    const result = await computed(withLadder, probes);
    expect(result.card.background).toBe("rgb(247, 244, 232)");
    expect(result.inset.background).toBe("rgb(237, 234, 215)");
    expect(result.tint1.background).toBe("rgb(246, 221, 185)");
    expect(result.tint1.color).toBe("rgb(45, 41, 38)");
    // a tint the project does not define falls back to the card and the body text
    expect(result.tint4.background).toBe("rgb(247, 244, 232)");
  });

  it("keeps old projects unchanged: no inset or tint tokens falls back to the card", async () => {
    const result = await computed(withoutLadder, probes);
    expect(result.inset.background).toBe(result.card.background);
    expect(result.card.background).toBe("rgb(250, 250, 250)");
    expect(result.tint1.background).toBe("rgb(250, 250, 250)");
    expect(result.tint1.color).toBe("rgb(17, 24, 39)");
  });

  it("lists the new utilities and tokens for the builder", () => {
    for (const text of [buildTokenUsageGuide(withLadder), buildTokenPromptContext(withLadder, "compact_visual")]) {
      expect(text).toContain("dg-surface-inset");
      expect(text).toContain("dg-tint-1, dg-tint-2, dg-tint-3, dg-tint-4");
    }
    const compact = buildTokenPromptContext(withLadder, "compact_visual");
    expect(compact).toContain("color.surface.inset: var(--dg-color-surface-inset) = #EDEAD7");
    expect(compact).toContain("color.accent_tints.1: var(--dg-color-accent-tints-1) = #F6DDB9");
    expect(compact).toContain("color.accent_tints_text.1: var(--dg-color-accent-tints-text-1) = #2D2926");
  });
});

describe("surface ladder in the other token consumers", () => {
  it("compiles the utilities to semantic classes whose colours fall back to the card", () => {
    const compiled = compileHtmlForProduction(`<div class="dg-surface-inset"></div><span class="dg-tint-2"></span>`, withLadder);
    expect(compiled).toContain("bg-inset");
    expect(compiled).toContain("bg-tint-2");
    expect(compiled).toContain("text-tint-text-2");
    // the Tailwind config the compiled markup runs with defines them, falling back to the card
    const config = buildTailwindConfigScript();
    expect(config).toContain("inset: \"var(--dg-color-surface-inset, var(--card, var(--dg-color-surface-card)))\"");
    expect(config).toContain("\"2\": \"var(--dg-color-accent-tints-2, var(--card, var(--dg-color-surface-card)))\"");
    expect(config).toContain("\"tint-text\"");
  });

  it("publishes the inset and the tints in the design brief", () => {
    const project = { id: "p", name: "Pets", prompt: "pets", designTokens: withLadder } as unknown as ProjectData;
    const document = buildPublicDesignMdDocument({ project, projectNavigation: null, tokenDraft: withLadder });
    expect(document).toContain("surface-inset");
    expect(document).toContain("#EDEAD7");
    expect(document).toContain("tint-1");
    expect(document).toContain("#F6DDB9");

    const old = buildPublicDesignMdDocument({ project, projectNavigation: null, tokenDraft: withoutLadder });
    expect(old).not.toContain("surface-inset");
    expect(old).not.toContain("tint-1");
  });
});
