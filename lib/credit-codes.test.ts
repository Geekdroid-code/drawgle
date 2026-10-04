// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CREDIT_CODE_PATTERN,
  describeCreditCodeResult,
  generateCreditCode,
  normalizeCreditCode,
  readCreditCodeResult,
} from "./credit-codes";

describe("credit codes", () => {
  it("accepts a code however it was typed and rejects anything that is not one", () => {
    expect(normalizeCreditCode(" dg-7k2m4p\n")).toBe("DG-7K2M4P");
    expect(normalizeCreditCode("FRIENDS")).toBe("FRIENDS");
    for (const value of ["", "abc", "-DG7K2M", "DG 7K2M4P", "DG_7K2M4P", "DG-7K2M4P;", "A".repeat(41), null, 42, undefined]) {
      expect(normalizeCreditCode(value)).toBeNull();
    }
  });

  it("generates codes that are valid, unambiguous and do not repeat", () => {
    const codes = Array.from({ length: 2000 }, () => generateCreditCode());
    for (const code of codes) {
      expect(code).toMatch(/^DG-[2-9A-HJKMNP-Z]{6}$/);
      expect(CREDIT_CODE_PATTERN.test(code)).toBe(true);
    }
    expect(new Set(codes).size).toBe(codes.length);
    expect(generateCreditCode("launch", 8)).toMatch(/^LAUNCH-[2-9A-HJKMNP-Z]{8}$/);
    expect(generateCreditCode("", 8)).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
  });

  it("reads only results the database can return", () => {
    expect(readCreditCodeResult({ status: "redeemed", credits: "200.00", balance: 250 })).toEqual({
      status: "redeemed",
      credits: 200,
      balance: 250,
    });
    expect(readCreditCodeResult({ status: "exhausted" })).toEqual({ status: "exhausted" });
    expect(readCreditCodeResult({ status: "granted" })).toBeNull();
    expect(readCreditCodeResult(null)).toBeNull();
    expect(readCreditCodeResult("redeemed")).toBeNull();
  });

  it("tells people what a claim did in screens, not just credits", () => {
    expect(describeCreditCodeResult({ status: "redeemed", credits: 200 })).toBe(
      "200 credits added. That's enough for 10 screens.",
    );
    expect(describeCreditCodeResult({ status: "redeemed", credits: 20 })).toBe(
      "20 credits added. That's enough for 1 screen.",
    );
    expect(describeCreditCodeResult({ status: "redeemed", credits: 10 })).toBe("10 credits added.");
    expect(describeCreditCodeResult({ status: "already_redeemed" })).toMatch(/already claimed/);
  });
});
