import { describe, expect, it } from "vitest";

import { deriveComponentShapePolicy, normalizeDesignTokens } from "@/lib/design-tokens";
import { normalizeGeneratedUiContracts } from "@/lib/generation/ui-contract-normalizer";

const tokens = normalizeDesignTokens({
  tokens: {
    color: {
      background: { primary: "#ffffff" },
      surface: { card: "#ffffff" },
      text: { high_emphasis: "#111827" },
      action: { primary: "#111827", on_primary_text: "#ffffff" },
      border: { divider: "#e5e7eb" },
    },
    radii: { app: "20px", inner: "12px", pill: "9999px" },
    spacing: { md: "16px" },
  },
  meta: {
    componentShapePolicy: {
      version: 1,
      field: "app",
      standardButton: "inner",
      primaryCta: "inner",
      segmentedContainer: "app",
      segmentedItem: "inner",
      nestedSurface: "inner",
      iconWell: "pill",
      evidenceSource: "default",
      rationale: "Canonical hierarchy",
    },
  },
});

describe("generated UI contract normalization", () => {
  it("repairs exact aliases and confident radius roles without failing unknown variables", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      code: `<div style="gap:var(--dg-spacing-element-gap);color:var(--dg-unknown-color)">
        <input class="rounded-full border" />
        <button type="submit" class="dg-action-primary rounded-full">Save</button>
        <div role="tablist" class="rounded-md"><button role="tab" class="rounded-full">Open</button></div>
      </div>`,
    });
    expect(result.code).toContain("--dg-mobile-layout-element-gap");
    expect(result.code).toContain("rounded-[var(--dg-radii-app)]");
    expect(result.code).toContain("rounded-[var(--dg-radii-inner)]");
    expect(result.report.repairs.some((item) => item.code === "known_token_alias")).toBe(true);
    expect(result.report.warnings).toContainEqual(expect.objectContaining({ code: "unknown_token_reference" }));
  });

  it("supports diagnostics-only rollback mode", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      code: `<input class="rounded-full" style="gap:var(--dg-spacing-element-gap)" />`,
    });
    expect(result.code).toContain("rounded-full");
    expect(result.code).toContain("--dg-spacing-element-gap");
    expect(result.report.warnings.length).toBeGreaterThan(0);
  });

  it("requires explicit CTA or segmented evidence before using pill radii", () => {
    expect(deriveComponentShapePolicy({ prompt: "Use a premium pill-shaped design." }).primaryCta).toBe("inner");
    expect(deriveComponentShapePolicy({ prompt: "Use a capsule primary CTA button." }).primaryCta).toBe("pill");
    expect(deriveComponentShapePolicy({ prompt: "Use pill-shaped segmented tabs." }).segmentedItem).toBe("pill");
  });

  it("supplies accessible semantic status roles and repairs only semantically identified status colors", () => {
    const status = normalizeDesignTokens({
      tokens: { color: { background: { primary: "#ffffff" }, status: {
        success: { foreground: "#f0fdf4", surface: "#ffffff", border: "#22c55e" },
      } } },
    }).tokens?.color?.status;
    expect(status?.success?.foreground).toBe("#166534");
    expect(status?.danger).toMatchObject({ foreground: "#991B1B", surface: "#FEE2E2" });

    const normalized = normalizeGeneratedUiContracts({
      designTokens: tokens,
      code: `<div><span class="bg-red-100 text-red-700">Overdue</span><div class="bg-blue-500">Artwork</div></div>`,
    });
    expect(normalized.code).toContain("dg-color-status-danger-surface");
    expect(normalized.code).toContain("bg-blue-500");
    expect(normalized.report.warnings).toContainEqual(expect.objectContaining({ code: "raw_status_color" }));
  });
});
