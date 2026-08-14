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
      // Explicit opt-in: HTML mutation is off by default after Phase 1.
      repairEnabled: true,
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

  it("keeps aesthetic repairs disabled while always resolving exact compatibility aliases", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
      code: `<input class="rounded-full" style="gap:var(--dg-spacing-element-gap)" />`,
    });
    expect(result.code).toContain("rounded-full");
    expect(result.code).toContain("--dg-mobile-layout-element-gap");
    expect(result.code).not.toContain("--dg-spacing-element-gap");
    expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "known_token_alias" }));
  });

  it("matches legacy variables at identifier boundaries without corrupting compound status tokens", () => {
    const code = `<div class="bg-[var(--dg-color-status-info-surface)] text-[var(--dg-color-status-info-foreground)] border-[var(--dg-color-status-info-border)]"></div>`;
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
      code,
    });

    expect(result.code).toBe(code);
    expect(result.code).not.toContain("foreground-surface");
    expect(result.report.repairs).toHaveLength(0);
  });

  it("recovers status variables corrupted by the former prefix replacement", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
      code: `<div style="background:var(--dg-color-status-success-foreground-surface);color:var(--dg-color-status-success-foreground-foreground);border-color:var(--dg-color-status-success-foreground-border)"></div>`,
    });

    expect(result.code).toContain("--dg-color-status-success-surface");
    expect(result.code).toContain("--dg-color-status-success-foreground");
    expect(result.code).toContain("--dg-color-status-success-border");
    expect(result.code).not.toContain("foreground-surface");
    expect(result.code).not.toContain("foreground-foreground");
    expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "known_token_alias" }));
  });

  it("canonicalizes known semantic class aliases even when aesthetic mutation is disabled", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
      code: `<div class="rounded-app"><button class="rounded-pill">Filter</button><span class="rounded-inner"></span></div>`,
    });

    expect(result.code).toContain("dg-radius-app");
    expect(result.code).toContain("dg-radius-inner");
    expect(result.code).toContain("dg-radius-pill");
    expect(result.code).not.toContain("rounded-pill");
    expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "known_class_alias" }));
  });

  it("accepts runtime aliases and locally declared variables while warning on truly unknown variables", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
      code: `<style>:root{--ring-progress:42%}</style><div style="gap:var(--spacing-xs);padding:var(--surface-muted);font-size:var(--nav-title-size);width:var(--ring-progress);height:var(--missing-layout-var)"></div>`,
    });

    expect(result.report.warnings.filter((item) => item.code === "unknown_token_reference")).toEqual([
      expect.objectContaining({ detail: "--missing-layout-var has no CSS fallback" }),
    ]);
  });

  it("requires explicit CTA or segmented evidence before using pill radii", () => {
    expect(deriveComponentShapePolicy({ prompt: "Use a premium pill-shaped design." }).primaryCta).toBe("inner");
    expect(deriveComponentShapePolicy({ prompt: "Use a capsule primary CTA button." }).primaryCta).toBe("pill");
    expect(deriveComponentShapePolicy({ prompt: "Use pill-shaped segmented tabs." }).segmentedItem).toBe("pill");
  });

  it("uses the actual segmented-control inset for selected item radii", () => {
    const result = normalizeGeneratedUiContracts({
      designTokens: normalizeDesignTokens({
        tokens: {
          radii: { app: "16px", inner: "8px", pill: "9999px" },
          spacing: { xxs: "4px", xs: "8px", sm: "12px" },
        },
      }),
      repairEnabled: true,
      code: `<div role="group" class="dg-radius-app p-[var(--dg-spacing-xxs)] bg-slate-100">
        <button aria-pressed="true" class="dg-action-primary dg-radius-inner">Week</button>
        <button aria-pressed="false" class="dg-radius-inner">Month</button>
      </div>`,
    });

    expect(result.code).toContain("dg-radius-inset-xxs");
    expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "concentric_radius_repaired" }));
  });

  it("repairs concentric geometry by default without enabling broad HTML mutation", () => {
    const previousMaster = process.env.DRAWGLE_HTML_MUTATION_ENABLED;
    const previousGeometry = process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
    process.env.DRAWGLE_HTML_MUTATION_ENABLED = "false";
    delete process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
    try {
      const result = normalizeGeneratedUiContracts({
        designTokens: normalizeDesignTokens({
          tokens: {
            radii: { app: "26px", inner: "16px", pill: "9999px" },
            spacing: { xxs: "4px", xs: "8px", sm: "12px" },
          },
        }),
        code: `<div class="dg-radius-app p-[var(--dg-spacing-xxs)] bg-slate-950 flex flex-col gap-[12px]">
          <button aria-pressed="true" class="dg-radius-inner bg-[var(--dg-color-action-primary)]">All</button>
          <button aria-pressed="false" class="dg-radius-inner">This Week</button>
        </div>`,
      });

      expect(result.code).toContain("dg-radius-inset-xxs");
      expect(result.code).toContain("gap-[12px]");
      expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "concentric_radius_repaired" }));
      expect(result.report.warnings).toContainEqual(expect.objectContaining({ code: "nested_gap_exceeds_padding" }));
    } finally {
      if (previousMaster === undefined) delete process.env.DRAWGLE_HTML_MUTATION_ENABLED;
      else process.env.DRAWGLE_HTML_MUTATION_ENABLED = previousMaster;
      if (previousGeometry === undefined) delete process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
      else process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED = previousGeometry;
    }
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
      repairEnabled: true,
      code: `<div><span class="bg-red-100 text-red-700">Overdue</span><div class="bg-blue-500">Artwork</div></div>`,
    });
    expect(normalized.code).toContain("dg-color-status-danger-surface");
    expect(normalized.code).toContain("bg-blue-500");
    expect(normalized.report.warnings).toContainEqual(expect.objectContaining({ code: "raw_status_color" }));
  });
});
