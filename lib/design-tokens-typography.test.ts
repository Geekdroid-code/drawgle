import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { buildDrawgleTokenCss, buildGoogleFontHref, normalizeLegacyTypographyFontMarkup } from "@/lib/token-runtime";

describe("dual-font typography contract", () => {
  it("accepts legacy JSON only at read time and emits canonical heading/body roles", () => {
    const normalized = normalizeDesignTokens({ tokens: { typography: { font_family: '"Inter", sans-serif' } } as never });
    expect(normalized.tokens?.typography?.heading_font_family).toBe('"Inter", sans-serif');
    expect(normalized.tokens?.typography?.body_font_family).toBe('"Inter", sans-serif');
    expect(normalized.tokens?.typography).not.toHaveProperty("font_family");
    const css = buildDrawgleTokenCss(normalized);
    expect(css).toContain("--dg-typography-heading-font-family");
    expect(css).toContain("--dg-typography-body-font-family");
    expect(css).toContain("--dg-typography-font-family: var(--dg-typography-body-font-family");
  });

  it("loads distinct role fonts in one Google Fonts request", () => {
    const href = buildGoogleFontHref({ tokens: { typography: {
      heading_font_family: '"Space Grotesk", sans-serif',
      body_font_family: '"Inter", sans-serif',
      screen_title: { size: "28px", weight: 800, line_height: "34px" },
      body: { size: "16px", weight: 400, line_height: "24px" },
    } } });
    expect(href).toContain("family=Space+Grotesk:wght@700;800");
    expect(href).toContain("family=Inter:wght@400;600;700;800");
  });

  it("rewrites stored universal font references to the body role", () => {
    expect(normalizeLegacyTypographyFontMarkup('<main style="font-family:var(--dg-typography-font-family)"></main>'))
      .toBe('<main style="font-family:var(--dg-typography-body-font-family)"></main>');
  });
});
