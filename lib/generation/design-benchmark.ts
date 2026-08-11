/**
 * Design-quality scoring harness.
 *
 * "Does it look better" is not something a unit test can answer, and it is not
 * something a prompt change can be trusted to have improved. This turns the
 * deterministic rules into a per-rule pass rate over a set of generated
 * screens, so a change either moves the numbers or it does not.
 *
 * Deliberately offline: it scores HTML that already exists (fixtures, or
 * screens read from a project) rather than generating any. Generation cost is
 * a separate, explicit decision.
 */

import { load } from "cheerio";

import { validateTokenRelationships } from "@/lib/design-tokens-relationships";
import { runDesignCritic } from "@/lib/generation/design-critic";
import { applyGeometryContract } from "@/lib/generation/geometry-contract";
import type { StyleCharterV1 } from "@/lib/generation/style-charter";
import type { DesignTokens } from "@/lib/types";

export interface DesignBenchmarkScreen {
  id: string;
  name: string;
  code: string;
}

export interface DesignBenchmarkRuleResult {
  rule: string;
  /** Screens where the rule found nothing to report. */
  passed: number;
  /** Screens where the rule fired. */
  failed: number;
  failingScreens: string[];
}

export interface DesignBenchmarkResult {
  screenCount: number;
  rules: DesignBenchmarkRuleResult[];
  /** Fraction of (rule, screen) pairs that passed, 0-1. */
  overallPassRate: number;
  tokenDiagnostics: string[];
  perScreen: Array<{ id: string; name: string; findings: string[] }>;
}

/**
 * Every rule that can fire, listed up front so a rule that never triggers is
 * still reported at 100% rather than silently missing from the table.
 */
const RULES = [
  "concentric_radius_repaired",
  "nested_gap_exceeds_padding",
  "sibling_imbalance",
  "decorative_dead_space",
  "fabricated_object_art",
  "above_fold_budget_exceeded",
  "raw_surface_color",
  "surface_text_contrast",
  "radius_vocabulary_drift",
] as const;

export function scoreDesignBenchmark({
  screens,
  designTokens,
  charter,
}: {
  screens: DesignBenchmarkScreen[];
  designTokens?: DesignTokens | null;
  charter?: StyleCharterV1 | null;
}): DesignBenchmarkResult {
  const failuresByRule = new Map<string, string[]>(RULES.map((rule) => [rule, []]));
  const perScreen: DesignBenchmarkResult["perScreen"] = [];

  for (const screen of screens) {
    const $ = load(screen.code, {}, false);
    // repairEnabled false: scoring measures what the builder produced, not
    // what the normalizer could rescue.
    const geometry = applyGeometryContract({ $, designTokens, repairEnabled: false });
    const critic = runDesignCritic({ $, designTokens });

    const codes = [
      ...geometry.map((diagnostic) => diagnostic.code as string),
      ...critic.findings.map((finding) => finding.code as string),
    ];

    for (const code of new Set(codes)) {
      failuresByRule.get(code)?.push(screen.id);
    }

    perScreen.push({
      id: screen.id,
      name: screen.name,
      findings: [
        ...geometry.map((diagnostic) => `${diagnostic.code}: ${diagnostic.detail}`),
        ...critic.findings.map((finding) => `${finding.code}: ${finding.detail}`),
      ],
    });
  }

  const tokenDiagnostics = designTokens?.tokens
    ? validateTokenRelationships({
        tokens: designTokens.tokens,
        charter,
        repairEnabled: false,
      }).report.diagnostics.map((diagnostic) => `${diagnostic.code} @ ${diagnostic.path}: ${diagnostic.detail}`)
    : [];

  const rules: DesignBenchmarkRuleResult[] = RULES.map((rule) => {
    const failingScreens = failuresByRule.get(rule) ?? [];
    return {
      rule,
      passed: screens.length - failingScreens.length,
      failed: failingScreens.length,
      failingScreens,
    };
  });

  const totalChecks = rules.length * screens.length;
  const totalPassed = rules.reduce((sum, rule) => sum + rule.passed, 0);

  return {
    screenCount: screens.length,
    rules,
    overallPassRate: totalChecks > 0 ? totalPassed / totalChecks : 1,
    tokenDiagnostics,
    perScreen,
  };
}

/** Human-readable table for CLI runs and handoff notes. */
export function formatDesignBenchmark(result: DesignBenchmarkResult) {
  const lines = [
    `Screens scored: ${result.screenCount}`,
    `Overall pass rate: ${(result.overallPassRate * 100).toFixed(1)}%`,
    "",
    "Rule                            pass  fail",
  ];

  for (const rule of result.rules) {
    lines.push(`${rule.rule.padEnd(32)}${String(rule.passed).padStart(4)}${String(rule.failed).padStart(6)}`);
  }

  if (result.tokenDiagnostics.length > 0) {
    lines.push("", "Token relationship findings:", ...result.tokenDiagnostics.map((entry) => `  - ${entry}`));
  }

  return lines.join("\n");
}
