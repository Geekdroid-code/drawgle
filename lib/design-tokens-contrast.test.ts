import { describe, expect, it } from "vitest";
import { contrastRatio, ensureLegibleGeneratedTokens } from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";

const tokens = (navigationMuted: string, lowEmphasis: string): DesignTokens => ({
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#F5F5F5", secondary: "#EBEBEB" },
      surface: { card: "#FFFFFF" },
      text: { high_emphasis: "#1A1A1A", medium_emphasis: "#707070", low_emphasis: lowEmphasis },
    },
    navigation: { surface: "#FFFFFF", content: "#707070", muted_content: navigationMuted },
  },
} as DesignTokens);

describe("generated token legibility", () => {
  it("lifts near-invisible inactive navigation icons and captions to 3:1", () => {
    const result = ensureLegibleGeneratedTokens(tokens("#D1D1D1", "#C8C8C8"));
    const navigation = result.tokens?.navigation?.muted_content ?? "";
    const caption = result.tokens?.color?.text?.low_emphasis ?? "";

    expect(contrastRatio(navigation, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(caption, "#F5F5F5")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(caption, "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });

  it("leaves already legible and non-hex colors unchanged", () => {
    const result = ensureLegibleGeneratedTokens(tokens("#6B6B6B", "rgba(0,0,0,0.5)"));

    expect(result.tokens?.navigation?.muted_content).toBe("#6B6B6B");
    expect(result.tokens?.color?.text?.low_emphasis).toBe("rgba(0,0,0,0.5)");
  });
});
