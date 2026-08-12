/**
 * Token coverage audit.
 *
 * Answers one question per element: *does this declared system-UI element
 * actually reference the token that owns it?*
 *
 * It does not ask what an element looks like, and it does not redesign
 * anything. Violations are reported with the element, its declared role, the
 * property at fault and the exact expected token, so a downstream repair — or
 * a human — has an unambiguous answer to act on.
 *
 * Elements inside `data-dg-scope="local"` are exempt from *ownership* only.
 * Security sanitization, structural validation, asset policy and rendered
 * measurement still apply to them: a local gradient is free, a local
 * `javascript:` URL is not.
 */

import type { CheerioAPI } from "cheerio";

import {
  DG_ROLE_ATTRIBUTE,
  DG_SCOPE_ATTRIBUTE,
  ROLE_OWNERSHIP,
  isDgRole,
  readTokenPath,
  tokenPathToVariable,
  type DgRole,
  type OwnedProperty,
} from "@/lib/generation/token-ownership";
import type { DesignTokens } from "@/lib/types";

export type TokenCoverageCode =
  | "owned_property_unbound"
  | "unknown_role"
  | "unclassified_system_surface";

export interface TokenCoverageFinding {
  code: TokenCoverageCode;
  selector: string;
  role: DgRole | null;
  property: OwnedProperty | null;
  /** The single token that owns this property, when one does. */
  expectedToken: string | null;
  /** The utility class or CSS variable that would satisfy it. */
  expectedBinding: string | null;
  detail: string;
  /** True only when exactly one token owns the property, so a repair is safe. */
  deterministicallyRepairable: boolean;
}

export interface TokenCoverageReportV1 {
  version: 1;
  rolesDeclared: number;
  localScopes: number;
  findings: TokenCoverageFinding[];
}

const classList = (value: string | undefined) => String(value ?? "").split(/\s+/).filter(Boolean);

const selectorFor = ($: CheerioAPI, element: never) => {
  const node = $(element as never);
  const id = node.attr("data-drawgle-id");
  if (id) return `[data-drawgle-id="${id}"]`;
  const tag = (element as unknown as { tagName?: string }).tagName ?? "element";
  const first = classList(node.attr("class"))[0];
  return first ? `${tag}.${first}` : tag;
};

/** Property families, expressed as the Tailwind prefixes that set them. */
const PROPERTY_PREFIXES: Record<OwnedProperty, RegExp> = {
  background: /^(?:bg-|dg-surface|dg-bg-|dg-action-|dg-gradient-)/,
  foreground: /^(?:text-|dg-text-)/,
  border: /^(?:border-|dg-border-)/,
  typography: /^(?:dg-type-|font-|text-\[)/,
};

/**
 * Does this element bind the given property to the owning token?
 *
 * Satisfied by the `dg-*` utility, by an arbitrary value referencing the
 * variable, or by an inline style using it. Anything else that sets the same
 * property is a violation; an element that does not set the property at all is
 * not — inheriting from a parent is legitimate.
 */
const bindingState = (
  classes: string[],
  style: string,
  property: OwnedProperty,
  variable: string,
  utilityClass?: string,
): "bound" | "unbound" | "absent" => {
  const referencesToken = (utilityClass && classes.includes(utilityClass))
    || classes.some((name) => name.includes(`var(${variable})`))
    || style.includes(`var(${variable})`);
  if (referencesToken) return "bound";

  const setsProperty = classes.some((name) => PROPERTY_PREFIXES[property].test(name));
  return setsProperty ? "unbound" : "absent";
};

/** Surfaces that look like system UI but declare no role, so ownership is unknown. */
const SYSTEM_SURFACE_HINT = /^(?:dg-surface|dg-action-)/;

export function auditTokenCoverage({
  $,
  designTokens,
}: {
  $: CheerioAPI;
  designTokens?: DesignTokens | null;
}): TokenCoverageReportV1 {
  const findings: TokenCoverageFinding[] = [];
  let rolesDeclared = 0;

  const localScopes = $(`[${DG_SCOPE_ATTRIBUTE}="local"]`).length;
  const inLocalScope = (element: never) =>
    $(element as never).closest(`[${DG_SCOPE_ATTRIBUTE}="local"]`).length > 0;

  $(`[${DG_ROLE_ATTRIBUTE}]`).each((_, element) => {
    const node = $(element as never);
    const declared = node.attr(DG_ROLE_ATTRIBUTE);

    if (!isDgRole(declared)) {
      findings.push({
        code: "unknown_role",
        selector: selectorFor($, element as never),
        role: null,
        property: null,
        expectedToken: null,
        expectedBinding: null,
        detail: `"${declared}" is not a recognised role. Use one of the declared vocabulary or remove the attribute.`,
        deterministicallyRepairable: false,
      });
      return;
    }

    rolesDeclared += 1;
    // A role inside a local scope is a contradiction, but the explicit local
    // declaration wins: the builder said this region is intentional.
    if (inLocalScope(element as never)) return;

    const classes = classList(node.attr("class"));
    const style = node.attr("style") ?? "";

    for (const binding of ROLE_OWNERSHIP[declared].required) {
      const variable = tokenPathToVariable(binding.tokenPath);
      const state = bindingState(classes, style, binding.property, variable, binding.utilityClass);
      if (state !== "unbound") continue;

      const tokenValue = readTokenPath(designTokens, binding.tokenPath);
      findings.push({
        code: "owned_property_unbound",
        selector: selectorFor($, element as never),
        role: declared,
        property: binding.property,
        expectedToken: binding.tokenPath,
        expectedBinding: binding.utilityClass ?? `var(${variable})`,
        detail: `${declared} sets its own ${binding.property} instead of ${binding.tokenPath}`
          + `${tokenValue ? ` (${tokenValue})` : ""}. Live design-system edits will not reach it.`,
        // Exactly one token owns this property, so the answer is unambiguous.
        deterministicallyRepairable: true,
      });
    }
  });

  // Coverage gap: an element using a system utility while declaring no role.
  // Reported at low confidence — this is a hint that the builder skipped the
  // declaration, never grounds for rewriting anything.
  $("[class]").each((_, element) => {
    const node = $(element as never);
    if (node.attr(DG_ROLE_ATTRIBUTE) || inLocalScope(element as never)) return;
    const classes = classList(node.attr("class"));
    if (!classes.some((name) => SYSTEM_SURFACE_HINT.test(name))) return;

    findings.push({
      code: "unclassified_system_surface",
      selector: selectorFor($, element as never),
      role: null,
      property: null,
      expectedToken: null,
      expectedBinding: null,
      detail: `Uses a system token utility (${classes.filter((name) => SYSTEM_SURFACE_HINT.test(name)).join(", ")}) but declares no ${DG_ROLE_ATTRIBUTE}. Ownership is unverifiable.`,
      deterministicallyRepairable: false,
    });
  });

  return { version: 1, rolesDeclared, localScopes, findings };
}

/**
 * Repairs only the findings where a single token owns the property.
 *
 * Gated by the caller. Adds the owning utility or variable binding and removes
 * the competing declaration for that property alone — it never touches shape,
 * size, layout, spacing, elevation or effects, even on the same element.
 */
export function repairOwnedProperties({
  $,
  report,
}: {
  $: CheerioAPI;
  report: TokenCoverageReportV1;
}) {
  const repaired: TokenCoverageFinding[] = [];

  for (const finding of report.findings) {
    if (!finding.deterministicallyRepairable || !finding.expectedBinding || !finding.property) continue;
    const node = $(finding.selector);
    if (node.length !== 1) continue;

    const classes = classList(node.attr("class"));
    const withoutCompeting = classes.filter((name) => !PROPERTY_PREFIXES[finding.property!].test(name));
    node.attr("class", [...new Set([...withoutCompeting, finding.expectedBinding.startsWith("var(")
      ? `${finding.property === "background" ? "bg" : finding.property === "foreground" ? "text" : "border"}-[${finding.expectedBinding}]`
      : finding.expectedBinding])].join(" "));
    repaired.push(finding);
  }

  return repaired;
}
