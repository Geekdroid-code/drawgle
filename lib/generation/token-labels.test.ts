import { describe, expect, it } from "vitest";

import { asksAnything, readTokenLabels, withoutTokenLabels } from "@/lib/generation/token-labels";

const answer = (meta: Record<string, unknown>) => ({ system_schema: "mobile_universal_core", meta: { recommendedFonts: ["Inter"], ...meta }, tokens: {} });

describe("the token model's labels", () => {
  it("reads what the user asked for and whether the design uses tints", () => {
    const labels = readTokenLabels(answer({
      tints: true,
      userAsked: { colorRoles: ["background", "Action", "background", "sparkle"], fonts: true, corners: "extra-rounded", depth: "soft-shadow" },
    }));
    expect(labels).toEqual({
      userAsked: { colorRoles: ["background", "action"], fonts: true, corners: "extra-rounded", depth: "soft-shadow" },
      tints: true,
    });
  });

  it("takes exact names only, so that a model's 'none' is nothing asked and not square corners or a flat page", () => {
    const labels = readTokenLabels(answer({ userAsked: { colorRoles: "background", fonts: "yes", corners: "none", depth: "none" } }));
    expect(labels.userAsked).toEqual({ colorRoles: [], fonts: false, corners: null, depth: null });
    expect(asksAnything(labels.userAsked!)).toBe(false);
  });

  it("says nothing when the model did not say, so that the caller falls back to its own reading", () => {
    expect(readTokenLabels(answer({}))).toEqual({ userAsked: null, tints: null });
    expect(readTokenLabels({ tokens: {} })).toEqual({ userAsked: null, tints: null });
    expect(readTokenLabels(null)).toEqual({ userAsked: null, tints: null });
  });

  it("takes the labels off the tokens, and leaves everything else", () => {
    const raw = answer({ tints: false, userAsked: { colorRoles: [] } });
    expect(withoutTokenLabels(raw)).toEqual({ system_schema: "mobile_universal_core", meta: { recommendedFonts: ["Inter"] }, tokens: {} });
    // the input is not changed, and an answer without a meta is returned as it is
    expect(raw.meta).toHaveProperty("userAsked");
    expect(withoutTokenLabels({ tokens: {} })).toEqual({ tokens: {} });
  });

  it("knows when the user's words ask anything of the design", () => {
    expect(asksAnything({ colorRoles: [], fonts: false, corners: null, depth: null })).toBe(false);
    expect(asksAnything({ colorRoles: ["text"], fonts: false, corners: null, depth: null })).toBe(true);
    expect(asksAnything({ colorRoles: [], fonts: true, corners: null, depth: null })).toBe(true);
    expect(asksAnything({ colorRoles: [], fonts: false, corners: "square", depth: null })).toBe(true);
    expect(asksAnything({ colorRoles: [], fonts: false, corners: null, depth: "hairline" })).toBe(true);
  });
});
