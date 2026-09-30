import { describe, expect, it } from "vitest";

import { costOf, formatCost, parsePrice, priceOf } from "./cost";

describe("the price of a model", () => {
  it("knows Flash and Pro, and does not guess at a model it has not been told the price of", () => {
    expect(priceOf("gemini-3-flash-preview")).toEqual({ input: 0.5, output: 3 });
    expect(priceOf("gemini-3-pro-preview")).toEqual({ input: 2, output: 12 });
    // Lite is priced differently from Flash, and is not in the table
    expect(priceOf("gemini-3.1-flash-lite")).toBeNull();
    expect(priceOf("some-other-model")).toBeNull();
  });

  it("reads a price given for a run", () => {
    expect(parsePrice("0.5,3")).toEqual({ input: 0.5, output: 3 });
    expect(parsePrice(" 2 , 12 ")).toEqual({ input: 2, output: 12 });
    for (const bad of ["0.5", "a,b", "1,2,3", "-1,2", ""]) expect(() => parsePrice(bad)).toThrow(/--price/);
  });
});

describe("what a build cost", () => {
  const flash = priceOf("gemini-3-flash-preview");
  const pro = priceOf("gemini-3-pro-preview");

  it("is the plan's own figures: about $0.013 on Flash and $0.05 on Pro for a build of 9k in and 3k out", () => {
    const usage = { inputTokens: 9000, outputTokens: 3000, thinkingTokens: 0 };
    expect(costOf(usage, flash)).toBeCloseTo(0.0135, 4);
    expect(costOf(usage, pro)).toBeCloseTo(0.054, 4);
    // "roughly 4x"
    expect(costOf(usage, pro)! / costOf(usage, flash)!).toBeCloseTo(4, 1);
  });

  it("bills the thinking tokens as output", () => {
    expect(costOf({ inputTokens: 9000, outputTokens: 3000, thinkingTokens: 2000 }, flash)).toBeCloseTo((9000 * 0.5 + 5000 * 3) / 1_000_000, 6);
    expect(costOf({ inputTokens: 9000, outputTokens: 3000, thinkingTokens: null }, flash)).toBeCloseTo(0.0135, 4);
  });

  it("is unknown when the tokens or the price are", () => {
    expect(costOf({ inputTokens: null, outputTokens: 3000, thinkingTokens: 0 }, flash)).toBeNull();
    expect(costOf({ inputTokens: 9000, outputTokens: null, thinkingTokens: 0 }, flash)).toBeNull();
    expect(costOf({ inputTokens: 9000, outputTokens: 3000, thinkingTokens: 0 }, null)).toBeNull();
  });

  it("is written in dollars to a tenth of a cent, or as n/a", () => {
    expect(formatCost(0.0135)).toBe("$0.0135");
    expect(formatCost(0.054)).toBe("$0.0540");
    expect(formatCost(null)).toBe("n/a");
  });
});
