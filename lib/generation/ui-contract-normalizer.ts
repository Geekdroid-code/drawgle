import { load } from "cheerio";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import { runDesignCritic } from "@/lib/generation/design-critic";
import { applyGeometryContract } from "@/lib/generation/geometry-contract";
import { flattenDesignTokensToCssVariables } from "@/lib/token-runtime";
import type {
  DesignComponentShapePolicy,
  DesignTokens,
  ScreenQualityDiagnosticsV1,
  UiContractDiagnostic,
  UiContractNormalizationReportV1,
} from "@/lib/types";

const EXACT_TOKEN_ALIASES: Record<string, string> = {
  "--dg-spacing-element-gap": "--dg-mobile-layout-element-gap",
  "--dg-spacing-section-gap": "--dg-mobile-layout-section-gap",
  "--dg-typography-font-family": "--dg-typography-body-font-family",
  "--dg-typography-title-font-family": "--dg-typography-heading-font-family",
  "--dg-color-status-error": "--dg-color-status-danger-foreground",
  "--dg-color-status-success": "--dg-color-status-success-foreground",
  "--dg-color-status-warning": "--dg-color-status-warning-foreground",
  "--dg-color-status-info": "--dg-color-status-info-foreground",
};

const RUNTIME_VARIABLES = new Set([
  "--dg-preview-background",
  "--dg-navigation-clearance",
  "--dg-navigation-visual-height",
  "--dg-navigation-anatomy-height",
  "--dg-navigation-safe-offset",
  "--dg-navigation-overlap-buffer",
  "--dg-effective-safe-area-bottom",
  "--dg-gradient-action-primary",
  "--dg-gradient-app-background",
  "--dg-gradient-surface-highlight",
  "--dg-gradient-accent-ring",
]);

const DEFAULT_SHAPE_POLICY: DesignComponentShapePolicy = {
  version: 1,
  field: "app",
  standardButton: "inner",
  primaryCta: "inner",
  segmentedContainer: "app",
  segmentedItem: "inner",
  nestedSurface: "inner",
  iconWell: "pill",
  evidenceSource: "default",
  rationale: "Use the canonical component-role radius hierarchy.",
};

const FULL_RADIUS_CLASS = /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$/;
const STATUS_PALETTE_CLASS = /^(bg|text|border)-(red|rose|green|emerald|amber|yellow|blue|sky)-(?:50|100|200|300|400|500|600|700|800|900|950)$/;
const CRITICAL_SELECTOR = "h1,h2,h3,h4,h5,h6,button,[role='tab'],[data-drawgle-primary-nav] a,[data-drawgle-primary-nav] button";

const selectorFor = (element: any) =>
  element.attribs?.["data-drawgle-id"]
    ? `[data-drawgle-id="${element.attribs["data-drawgle-id"]}"]`
    : element.tagName ?? "unknown";

const dedupeDiagnostics = (items: UiContractDiagnostic[]) => Array.from(
  new Map(items.map((item) => [`${item.code}|${item.selector}|${item.detail}`, item])).values(),
);

const shapePolicyFor = (designTokens?: DesignTokens | null) =>
  normalizeDesignTokens(designTokens).meta?.componentShapePolicy ?? DEFAULT_SHAPE_POLICY;

const replaceFullRadiusClass = (classes: string[], role: "app" | "inner" | "pill") => {
  const next = classes.filter((className) => !FULL_RADIUS_CLASS.test(className));
  next.push(`rounded-[var(--dg-radii-${role})]`);
  return Array.from(new Set(next));
};

const replaceInlineRadius = (style: string | undefined, role: "app" | "inner" | "pill") => {
  if (!style || !/border-radius\s*:/i.test(style)) return style;
  return style.replace(/border-radius\s*:\s*[^;]+;?/gi, `border-radius:var(--dg-radii-${role});`);
};

const statusRoleFor = (text: string) => {
  if (/\b(?:error|failed|failure|danger|overdue|declined|unpaid|late)\b/i.test(text)) return "danger";
  if (/\b(?:success|successful|paid|complete|completed|approved|active)\b/i.test(text)) return "success";
  if (/\b(?:warning|pending|due soon|attention|caution)\b/i.test(text)) return "warning";
  if (/\b(?:info|informational|notice|scheduled)\b/i.test(text)) return "info";
  return null;
};

export const hashUiCode = (code: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export function normalizeGeneratedUiContracts({
  code,
  designTokens,
  repairEnabled = process.env.DRAWGLE_UI_CONTRACT_REPAIR_ENABLED !== "false",
}: {
  code: string;
  designTokens?: DesignTokens | null;
  repairEnabled?: boolean;
}) {
  const repairs: UiContractDiagnostic[] = [];
  const warnings: UiContractDiagnostic[] = [];
  let normalizedCode = code;

  for (const [legacy, canonical] of Object.entries(EXACT_TOKEN_ALIASES)) {
    if (!normalizedCode.includes(legacy)) continue;
    if (repairEnabled) {
      normalizedCode = normalizedCode.replaceAll(legacy, canonical);
      repairs.push({ code: "known_token_alias", selector: null, detail: `${legacy} → ${canonical}` });
    } else {
      warnings.push({ code: "unknown_token_reference", selector: null, detail: `${legacy} should resolve to ${canonical}` });
    }
  }

  const $ = load(normalizedCode, {}, false);
  const shapePolicy = shapePolicyFor(designTokens);

  const applyRadiusRole = (element: any, role: "app" | "inner" | "pill", reason: string) => {
    const classes = String($(element).attr("class") ?? "").split(/\s+/).filter(Boolean);
    const style = $(element).attr("style");
    const alreadyCorrect = classes.includes(`rounded-[var(--dg-radii-${role})]`)
      || classes.includes(`dg-radius-${role}`)
      || style?.includes(`var(--dg-radii-${role})`);
    if (alreadyCorrect) return;
    const hasRadius = classes.some((className) => FULL_RADIUS_CLASS.test(className)) || /border-radius\s*:/i.test(style ?? "");
    if (!hasRadius) return;
    const selector = selectorFor(element);
    if (!repairEnabled) {
      warnings.push({ code: "radius_role_repaired", selector, detail: `${reason} should use radii.${role}` });
      return;
    }
    $(element).attr("class", replaceFullRadiusClass(classes, role).join(" "));
    const nextStyle = replaceInlineRadius(style, role);
    if (nextStyle !== undefined) $(element).attr("style", nextStyle);
    repairs.push({ code: "radius_role_repaired", selector, detail: `${reason} → radii.${role}` });
  };

  $("input,textarea,select").each((_, element) => {
    applyRadiusRole(element, shapePolicy.field, "form control");
    const parent = $(element).parent();
    const parentElement = parent.get(0);
    if (!parentElement || parent.children("input,textarea,select").length !== 1 || parent.find("input,textarea,select").length !== 1) return;
    const parentClasses = parent.attr("class") ?? "";
    if (/\b(?:border|ring|bg-|dg-surface|shadow)/.test(parentClasses)) {
      applyRadiusRole(parentElement, shapePolicy.field, "single-control field wrapper");
    }
  });

  $("button,[role='button']").each((_, element) => {
    const node = $(element);
    const classes = node.attr("class") ?? "";
    const text = node.text().replace(/\s+/g, " ").trim();
    const iconOnly = !text || node.attr("aria-label") && text.length <= 2;
    const isPrimary = node.attr("data-action-role") === "primary"
      || /\bdg-(?:action|gradient-action)-primary\b/.test(classes)
      || node.attr("type") === "submit";
    applyRadiusRole(
      element,
      iconOnly ? shapePolicy.iconWell : isPrimary ? shapePolicy.primaryCta : shapePolicy.standardButton,
      iconOnly ? "icon-only control" : isPrimary ? "primary CTA" : "standard button",
    );
  });

  $("[role='tablist']").each((_, element) => applyRadiusRole(element, shapePolicy.segmentedContainer, "segmented-control container"));
  $("[role='tab']").each((_, element) => applyRadiusRole(element, shapePolicy.segmentedItem, "segmented-control item"));

  $("*").each((_, element) => {
    const node = $(element);
    const classes = String(node.attr("class") ?? "").split(/\s+/).filter(Boolean);
    if (!classes.some((className) => STATUS_PALETTE_CLASS.test(className))) return;
    const visibleText = node.text().replace(/\s+/g, " ").trim();
    const hasStatusContext = /\b(?:status|state|badge|chip|alert|notice)\b/i.test(classes.join(" "))
      || Boolean(node.attr("data-status"))
      || /^(?:active|inactive|paid|unpaid|overdue|pending|approved|declined|failed|complete|completed|success|warning|danger|scheduled|due soon)$/i.test(visibleText);
    if (!hasStatusContext) {
      warnings.push({ code: "raw_status_color", selector: selectorFor(element), detail: "Palette color resembles a status role, but surrounding semantics are ambiguous; saved unchanged." });
      return;
    }
    const semanticText = `${classes.join(" ")} ${node.attr("aria-label") ?? ""} ${node.attr("data-status") ?? ""} ${visibleText}`;
    const role = statusRoleFor(semanticText);
    if (!role) {
      warnings.push({ code: "raw_status_color", selector: selectorFor(element), detail: "Status context is present, but no semantic status role can be selected safely; saved unchanged." });
      return;
    }
    let changed = false;
    const next = classes.map((className) => {
      const match = className.match(STATUS_PALETTE_CLASS);
      if (!match) return className;
      const property = match[1] === "bg" ? "surface" : match[1] === "text" ? "foreground" : "border";
      changed = true;
      return `${match[1]}-[var(--dg-color-status-${role}-${property})]`;
    });
    if (!changed) return;
    const selector = selectorFor(element);
    if (repairEnabled) {
      node.attr("class", next.join(" "));
      repairs.push({ code: "status_role_repaired", selector, detail: `Tailwind palette → semantic ${role} status` });
    } else {
      warnings.push({ code: "status_role_repaired", selector, detail: `Use semantic ${role} status tokens` });
    }
  });

  // Runs after the role-based rules on purpose. Role assignment cannot see
  // nesting, so a correct concentric radius would otherwise be rewritten back
  // to the generic `radii.inner` by the rule above.
  const geometryRepairEnabled = repairEnabled && process.env.DRAWGLE_GEOMETRY_CONTRACT_ENABLED !== "false";
  for (const diagnostic of applyGeometryContract({ $, designTokens, repairEnabled: geometryRepairEnabled })) {
    const entry: UiContractDiagnostic = {
      code: diagnostic.code,
      selector: diagnostic.selector,
      detail: diagnostic.detail,
    };
    (diagnostic.severity === "repaired" ? repairs : warnings).push(entry);
  }

  const critic = runDesignCritic({ $, designTokens, repairEnabled });

  $(CRITICAL_SELECTOR).each((_, element) => {
    const classes = $(element).attr("class") ?? "";
    if (/\b(?:truncate|text-ellipsis|line-clamp-\d+)\b/.test(classes)) {
      warnings.push({ code: "critical_truncation_risk", selector: selectorFor(element), detail: "Critical text uses explicit truncation." });
    }
  });

  const hasPrimaryNav = $("[data-drawgle-primary-nav]").length > 0;
  const hasBack = $("[data-drawgle-back],button[aria-label*='back' i],a[aria-label*='back' i]").length > 0;
  if (hasPrimaryNav && hasBack) {
    warnings.push({ code: "navigation_chrome_conflict", selector: null, detail: "Back chrome and persistent primary navigation coexist." });
  }

  normalizedCode = $.root().html() ?? normalizedCode;
  const allowedVariables = new Set([
    ...flattenDesignTokensToCssVariables(designTokens).map((item) => item.name),
    ...RUNTIME_VARIABLES,
    ...Object.values(EXACT_TOKEN_ALIASES),
  ]);
  const variablePattern = /var\(\s*(--dg-[a-z0-9-]+)\s*(,\s*[^)]+)?\)/gi;
  for (const match of normalizedCode.matchAll(variablePattern)) {
    if (allowedVariables.has(match[1])) continue;
    warnings.push({
      code: match[2] ? "unknown_token_reference_with_fallback" : "unknown_token_reference",
      selector: null,
      detail: `${match[1]}${match[2] ? " has a CSS fallback" : " has no CSS fallback"}`,
    });
  }

  const report: UiContractNormalizationReportV1 = {
    version: 1,
    repairEnabled,
    repairs: dedupeDiagnostics(repairs),
    warnings: dedupeDiagnostics(warnings),
    critic,
  };
  return { code: normalizedCode, report };
}

export const buildStaticScreenQualityDiagnostics = (
  code: string,
  report: UiContractNormalizationReportV1,
): ScreenQualityDiagnosticsV1 => ({
  version: 1,
  codeHash: hashUiCode(code),
  disposition: report.warnings.length > 0 || (report.critic?.findings.length ?? 0) > 0 ? "warning" : "clean",
  static: report,
  rendered: null,
});
