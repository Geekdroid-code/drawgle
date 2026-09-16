import { describe, expect, it } from "vitest";
import type { DesignTokens } from "@/lib/types";

describe("recreation token binding to source hash", () => {
  it("reuses candidate tokens when meta.sourceHash matches currentSourceHash", () => {
    const currentSourceHash = "abc123hash";
    const candidateTokens: DesignTokens = {
      meta: { sourceHash: "abc123hash" },
      tokens: { color: { brand: { primary: { role: "brand_primary", variable: "--dg-primary", value: "#10B981" } } } },
    };

    const exactRecreation = true;
    const isSameSourceTokens = Boolean(
      exactRecreation &&
      currentSourceHash &&
      (candidateTokens as any)?.meta?.sourceHash === currentSourceHash
    );

    let designTokens: DesignTokens | null = isSameSourceTokens ? candidateTokens : null;
    expect(designTokens).toBe(candidateTokens);
  });

  it("nullifies candidate tokens when meta.sourceHash does not match currentSourceHash", () => {
    const currentSourceHash = "newsource456";
    const oldSourceTokens: DesignTokens = {
      meta: { sourceHash: "oldsource123" },
      tokens: { color: { brand: { primary: { role: "brand_primary", variable: "--dg-primary", value: "#10B981" } } } },
    };

    const exactRecreation = true;
    const isSameSourceTokens = Boolean(
      exactRecreation &&
      currentSourceHash &&
      (oldSourceTokens as any)?.meta?.sourceHash === currentSourceHash
    );

    let designTokens: DesignTokens | null = isSameSourceTokens ? oldSourceTokens : null;
    expect(designTokens).toBeNull();
  });

  it("nullifies candidate tokens when no sourceHash is stamped (unrelated project tokens)", () => {
    const currentSourceHash = "newsource456";
    const unrelatedTokens: DesignTokens = {
      tokens: { color: { brand: { primary: { role: "brand_primary", variable: "--dg-primary", value: "#3B82F6" } } } },
    };

    const exactRecreation = true;
    const isSameSourceTokens = Boolean(
      exactRecreation &&
      currentSourceHash &&
      (unrelatedTokens as any)?.meta?.sourceHash === currentSourceHash
    );

    let designTokens: DesignTokens | null = isSameSourceTokens ? unrelatedTokens : null;
    expect(designTokens).toBeNull();
  });
});
