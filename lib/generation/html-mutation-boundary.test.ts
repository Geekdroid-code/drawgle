/**
 * Phase 1 boundary: deterministic code may inspect builder HTML, never redesign it.
 *
 * The repository previously documented `DRAWGLE_UI_CONTRACT_REPAIR_ENABLED=false`
 * as a rollback switch, but diagnostics-only mode still parsed the markup with
 * Cheerio and reserialized `$.root().html()`. Attribute order, quoting,
 * whitespace and void-element form could all change. No test asserted exact
 * preservation, so the guarantee was never real.
 */

import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { runDesignCritic } from "@/lib/generation/design-critic";
import { normalizeGeneratedUiContracts } from "@/lib/generation/ui-contract-normalizer";
import { load } from "cheerio";

const tokens = normalizeDesignTokens({
  tokens: {
    color: { background: { primary: "#FFFFFF" }, surface: { card: "#FFFFFF" }, text: { high_emphasis: "#111827" } },
    radii: { app: "28px", inner: "16px", pill: "9999px" },
    spacing: { xs: "8px", md: "16px" },
    mobile_layout: { element_gap: "12px" },
  },
});

/**
 * Deliberately adversarial: a black CTA with white text, a capsule radius, a
 * nested surface that violates the concentric formula, a raw palette color, and
 * an intentionally asymmetric grid. Every one of these was previously rewritten.
 */
const INTENTIONAL_DESIGN = `<div class="w-full min-h-screen bg-black text-white flex flex-col">
  <section class='hero' data-drawgle-id="dg-1">
    <button type="submit" class="bg-black text-white rounded-full px-6">Start</button>
    <div class="dg-radius-app p-[var(--dg-spacing-xs)]"><div class="rounded-[9px] bg-white">nested</div></div>
  </section>
  <div class="grid grid-cols-[1.2fr_.8fr] items-start">
    <article class="mt-[24px]"><div class="h-[200px]"></div></article>
    <article><div class="h-[140px]"></div></article>
  </div>
</div>`;

describe("byte preservation", () => {
  it("returns the exact original string when repairs are disabled", () => {
    const result = normalizeGeneratedUiContracts({
      code: INTENTIONAL_DESIGN,
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
    });

    // The assertion that never existed.
    expect(result.code).toBe(INTENTIONAL_DESIGN);
  });

  it("keeps aesthetic mutation off while applying the deterministic geometry contract by default", () => {
    const previous = process.env.DRAWGLE_HTML_MUTATION_ENABLED;
    const previousGeometry = process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
    delete process.env.DRAWGLE_HTML_MUTATION_ENABLED;
    delete process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
    try {
      const result = normalizeGeneratedUiContracts({ code: INTENTIONAL_DESIGN, designTokens: tokens });
      expect(result.code).toContain("bg-black text-white rounded-full");
      expect(result.code).toContain("grid-cols-[1.2fr_.8fr]");
      expect(result.code).toContain("dg-radius-inner");
      expect(result.report.repairs).toContainEqual(expect.objectContaining({ code: "concentric_radius_repaired" }));
    } finally {
      if (previous === undefined) delete process.env.DRAWGLE_HTML_MUTATION_ENABLED;
      else process.env.DRAWGLE_HTML_MUTATION_ENABLED = previous;
      if (previousGeometry === undefined) delete process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
      else process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED = previousGeometry;
    }
  });

  it("still reports what it found while changing nothing", () => {
    const result = normalizeGeneratedUiContracts({
      code: INTENTIONAL_DESIGN,
      designTokens: tokens,
      repairEnabled: false,
      geometryRepairEnabled: false,
    });

    expect(result.code).toBe(INTENTIONAL_DESIGN);
    expect(result.report.repairs).toHaveLength(0);
    expect(result.report.warnings.length + (result.report.critic?.findings.length ?? 0)).toBeGreaterThan(0);
  });

  it("the master switch overrides the legacy per-behaviour flag", () => {
    const previousMaster = process.env.DRAWGLE_HTML_MUTATION_ENABLED;
    const previousLegacy = process.env.DRAWGLE_UI_CONTRACT_REPAIR_ENABLED;
    const previousGeometry = process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
    // Legacy flag "enabled", master off: nothing may mutate.
    delete process.env.DRAWGLE_UI_CONTRACT_REPAIR_ENABLED;
    process.env.DRAWGLE_HTML_MUTATION_ENABLED = "false";
    process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED = "false";
    try {
      const result = normalizeGeneratedUiContracts({ code: INTENTIONAL_DESIGN, designTokens: tokens });
      expect(result.code).toBe(INTENTIONAL_DESIGN);
    } finally {
      if (previousMaster === undefined) delete process.env.DRAWGLE_HTML_MUTATION_ENABLED;
      else process.env.DRAWGLE_HTML_MUTATION_ENABLED = previousMaster;
      if (previousLegacy === undefined) delete process.env.DRAWGLE_UI_CONTRACT_REPAIR_ENABLED;
      else process.env.DRAWGLE_UI_CONTRACT_REPAIR_ENABLED = previousLegacy;
      if (previousGeometry === undefined) delete process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED;
      else process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED = previousGeometry;
    }
  });
});

describe("the design critic no longer rewrites anything", () => {
  it("reports a black CTA without inverting it", () => {
    const $ = load(`<button class="bg-black text-white rounded-full">Buy</button>`, {}, false);
    const before = $.root().html();

    const report = runDesignCritic({ $, designTokens: tokens });

    expect($.root().html()).toBe(before);
    expect($("button").attr("class")).toContain("bg-black");
    expect($("button").attr("class")).toContain("text-white");
    expect($("button").attr("class")).not.toContain("dg-surface-card");
    expect(report.findings.map((finding) => finding.code)).toContain("raw_surface_color");
  });
});
