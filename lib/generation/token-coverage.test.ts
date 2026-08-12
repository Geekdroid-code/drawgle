/**
 * Phase 2: ownership is declared, per-property, and never inferred.
 *
 * The tests that matter most here are the negative ones — the cases where the
 * audit must stay silent. Phase 2's whole risk is replacing blind color
 * inference with blind role enforcement.
 */

import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { auditTokenCoverage, repairOwnedProperties } from "@/lib/generation/token-coverage";
import { ROLE_OWNERSHIP } from "@/lib/generation/token-ownership";

const tokens = normalizeDesignTokens({
  tokens: {
    color: {
      background: { primary: "#FFFFFF" },
      surface: { card: "#FFFFFF" },
      text: { high_emphasis: "#111827" },
      action: { primary: "#CCFF00", on_primary_text: "#111111", secondary: "#EEEEEE" },
      border: { divider: "#E5E7EB" },
    },
    radii: { app: "28px", inner: "16px", pill: "9999px" },
  },
});

const audit = (html: string) => auditTokenCoverage({ $: load(html, {}, false), designTokens: tokens });

describe("declared ownership is enforced per property", () => {
  it("flags a primary action that paints its own background", () => {
    const report = audit(`<button data-dg-role="primary-action" data-drawgle-id="dg-1" class="bg-black text-white rounded-full">Go</button>`);
    const unbound = report.findings.filter((f) => f.code === "owned_property_unbound");

    expect(unbound.map((f) => f.property)).toEqual(expect.arrayContaining(["background", "foreground"]));
    expect(unbound[0].expectedToken).toBe("color.action.primary");
    expect(unbound[0].deterministicallyRepairable).toBe(true);
  });

  it("does not flag shape, size or layout on the same element", () => {
    // rounded-full is a legitimate choice for a primary CTA. Only the fill and
    // its foreground are owned.
    const report = audit(`<button data-dg-role="primary-action" class="dg-action-primary text-[var(--dg-color-action-on-primary-text)] rounded-full h-16 w-full shadow-2xl">Go</button>`);
    expect(report.findings.filter((f) => f.code === "owned_property_unbound")).toHaveLength(0);
  });

  it("accepts either the utility class or the variable binding", () => {
    const utility = audit(`<div data-dg-role="system-card" class="dg-surface-card p-4">x</div>`);
    const variable = audit(`<div data-dg-role="system-card" class="bg-[var(--dg-color-surface-card)] p-4">x</div>`);
    expect(utility.findings.filter((f) => f.code === "owned_property_unbound")).toHaveLength(0);
    expect(variable.findings.filter((f) => f.code === "owned_property_unbound")).toHaveLength(0);
  });

  it("ignores an owned property the element never sets", () => {
    // Inheriting the foreground from a parent is legitimate.
    const report = audit(`<button data-dg-role="primary-action" class="dg-action-primary">Go</button>`);
    expect(report.findings.filter((f) => f.property === "foreground")).toHaveLength(0);
  });
});

describe("what the audit must stay silent about", () => {
  it("never inspects anything inside a local scope", () => {
    const report = audit(`<section data-dg-scope="local">
      <div data-dg-role="system-card" class="bg-black text-white">inverted on purpose</div>
      <div class="dg-surface-card">also fine</div>
    </section>`);
    expect(report.findings).toHaveLength(0);
    expect(report.localScopes).toBe(1);
  });

  it("never flags unroled elements for their colors", () => {
    // The Phase 1 defect, restated: a black CTA with no role is local art.
    const report = audit(`<button class="bg-black text-white rounded-full">Buy</button>`);
    expect(report.findings).toHaveLength(0);
  });

  it("has no required binding for inverse or accent surfaces", () => {
    // The schema has no inverse-surface token; inventing one would fabricate a rule.
    expect(ROLE_OWNERSHIP["inverse-surface"].required).toHaveLength(0);
    expect(ROLE_OWNERSHIP["accent-surface"].required).toHaveLength(0);

    const report = audit(`<div data-dg-role="inverse-surface" class="bg-black text-white">hero</div>`);
    expect(report.findings.filter((f) => f.code === "owned_property_unbound")).toHaveLength(0);
  });

  it("does not require a fill for fields, because two tokens are valid", () => {
    // "surface.card OR background" cannot be repaired deterministically.
    const fill = ROLE_OWNERSHIP.field.required.filter((binding) => binding.property === "background");
    expect(fill).toHaveLength(0);
  });

  it("reports an unclassified system surface without repairing it", () => {
    const report = audit(`<div class="dg-surface-card p-4">no role</div>`);
    const finding = report.findings.find((f) => f.code === "unclassified_system_surface");
    expect(finding).toBeDefined();
    expect(finding?.deterministicallyRepairable).toBe(false);
  });

  it("rejects an unrecognised role rather than guessing", () => {
    const report = audit(`<div data-dg-role="mystery-box" class="bg-black">x</div>`);
    expect(report.findings.map((f) => f.code)).toContain("unknown_role");
  });
});

describe("repair touches only the owned property", () => {
  it("binds the background and leaves shape and layout intact", () => {
    const $ = load(`<button data-dg-role="primary-action" data-drawgle-id="dg-9" class="bg-black rounded-full h-16 w-full shadow-2xl">Go</button>`, {}, false);
    const report = auditTokenCoverage({ $, designTokens: tokens });
    const repaired = repairOwnedProperties({ $, report });

    const classes = String($("button").attr("class"));
    expect(repaired.length).toBeGreaterThan(0);
    expect(classes).toContain("dg-action-primary");
    expect(classes).not.toContain("bg-black");
    // Everything the role does not own survives untouched.
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("h-16");
    expect(classes).toContain("w-full");
    expect(classes).toContain("shadow-2xl");
  });
});
