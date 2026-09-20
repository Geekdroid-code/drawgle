import { describe, expect, it } from "vitest";
import { actionGradientStops, updateActionGradient } from "./action-gradient";
import { normalizeDesignTokens } from "./design-tokens";
import { buildDrawgleTokenCss } from "./token-runtime";
import type { DesignTokenValues } from "./types";

const fixture = (): DesignTokenValues => ({ color: { action: { primary: "#5879F2", secondary: "rgba(255, 255, 255, 0.10)" } },
  gradients: { action_primary: "linear-gradient(135deg, #5879F2 0%, #4059B3 100%)", app_background: "linear-gradient(180deg, #121212, #000000)" } });

describe("action gradient editor and canvas tokens", () => {
  it("shows actual legacy stops rather than primary/secondary guesses", () => {
    expect(actionGradientStops(fixture())).toEqual({ start: "#5879F2", end: "#4059B3" });
  });
  it("updates canonical gradient and rendered CSS when the primary changes", () => {
    const tokens = fixture();
    tokens.color!.action!.primary = "#DE7A51";
    updateActionGradient(tokens, "primary", "#DE7A51");
    const normalized = normalizeDesignTokens({ tokens });
    const css = buildDrawgleTokenCss(normalized);
    expect(normalized.tokens!.gradients!.action_primary).not.toMatch(/#5879F2|#4059B3/i);
    expect(css).toContain("linear-gradient(135deg, #de7a51 0%");
    expect(tokens.gradients!.app_background).toBe(fixture().gradients!.app_background);
    expect(normalizeDesignTokens(normalized)).toEqual(normalized);
  });
  it("edits only the selected stop, preserving angle and intermediate stops", () => {
    const tokens = fixture();
    tokens.gradients!.action_primary = "linear-gradient(72deg, #5879F2 5%, rgba(20, 30, 40, 0.5) 45%, #4059B3 95%)";
    updateActionGradient(tokens, "primary_gradient_end", "#DE7A51");
    expect(tokens.gradients!.action_primary).toBe("linear-gradient(72deg, #5879F2 5%, rgba(20, 30, 40, 0.5) 45%, #DE7A51 95%)");
    expect(actionGradientStops(tokens).end).toBe("#DE7A51");
  });
  it("does not recolor an untouched recreation during normalization", () => {
    expect(normalizeDesignTokens({ tokens: fixture() }).tokens!.gradients!.action_primary).toBe(fixture().gradients!.action_primary);
  });
  it("retains alpha in transparent action gradient stops", () => {
    const tokens = fixture();
    tokens.gradients!.action_primary = "linear-gradient(45deg, rgba(88, 121, 242, 0.8), #4059B380)";
    updateActionGradient(tokens, "primary", "#DE7A51");
    expect(tokens.gradients!.action_primary).toContain("rgba(222, 122, 81, 0.8)");
    expect(tokens.gradients!.action_primary).toMatch(/80\)$/);
  });
});
