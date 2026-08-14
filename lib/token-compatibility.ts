/**
 * Shared compatibility vocabulary for generated screens.
 *
 * The HTML compiler writes portable variable names while the preview runtime
 * owns the canonical Drawgle tokens. Keeping both directions here prevents a
 * compiler alias from becoming an undefined variable in the live canvas.
 */
export const DRAWGLE_TO_NORMALIZED_VAR = new Map<string, string>([
  ["--dg-color-background-primary", "--background"],
  ["--dg-color-background-secondary", "--muted"],
  ["--dg-color-background-surface-elevated", "--muted"],
  ["--dg-color-surface-card", "--card"],
  ["--dg-color-surface-modal", "--popover"],
  ["--dg-color-surface-bottom-sheet", "--card"],
  ["--dg-color-text-high-emphasis", "--foreground"],
  ["--dg-color-text-medium-emphasis", "--muted-foreground"],
  ["--dg-color-text-low-emphasis", "--low-foreground"],
  ["--dg-color-action-primary", "--primary"],
  ["--dg-color-action-on-primary-text", "--primary-foreground"],
  ["--dg-color-action-secondary", "--secondary"],
  ["--dg-color-border-divider", "--border"],
  ["--dg-color-border-focused", "--ring"],
  ["--dg-color-action-disabled", "--action-disabled"],
  ["--dg-color-functional-tints-blue-base", "--tint-blue"],
  ["--dg-color-functional-tints-cyan-base", "--tint-cyan"],
  ["--dg-color-functional-tints-orange-base", "--tint-orange"],
  ["--dg-color-functional-tints-purple-base", "--tint-purple"],
  ["--dg-radii-app", "--radius"],
  ["--dg-radii-inner", "--radius-inner"],
  ["--dg-radii-pill", "--radius-pill"],
  ["--dg-mobile-layout-screen-margin", "--screen-margin"],
  ["--dg-mobile-layout-section-gap", "--section-gap"],
  ["--dg-mobile-layout-element-gap", "--element-gap"],
  ["--dg-mobile-layout-safe-area-top", "--safe-area-top"],
  ["--dg-mobile-layout-safe-area-bottom", "--safe-area-bottom"],
  ["--dg-sizing-icon-small", "--icon-small"],
  ["--dg-sizing-icon-standard", "--icon-standard"],
  ["--dg-sizing-bottom-nav-height", "--bottom-nav-height"],
  ["--dg-sizing-standard-input-height", "--standard-input-height"],
  ["--dg-sizing-standard-button-height", "--standard-button-height"],
  ["--dg-sizing-min-touch-target", "--min-touch-target"],
  ["--dg-shadows-surface", "--shadow-surface"],
  ["--dg-shadows-overlay", "--shadow-overlay"],
  ["--dg-shadows-none", "--shadow-none"],
  ["--dg-spacing-none", "--spacing-none"],
  ["--dg-spacing-xxs", "--spacing-xxs"],
  ["--dg-spacing-xs", "--spacing-xs"],
  ["--dg-spacing-sm", "--spacing-sm"],
  ["--dg-spacing-md", "--spacing-md"],
  ["--dg-spacing-lg", "--spacing-lg"],
  ["--dg-spacing-xl", "--spacing-xl"],
  ["--dg-spacing-xxl", "--spacing-xxl"],
  ["--dg-z-index-base", "--z-index-base"],
  ["--dg-z-index-sticky-header", "--z-index-sticky-header"],
  ["--dg-z-index-bottom-nav", "--z-index-bottom-nav"],
  ["--dg-z-index-bottom-sheet", "--z-index-bottom-sheet"],
  ["--dg-z-index-modal-dialog", "--z-index-modal-dialog"],
  ["--dg-z-index-toast-snackbar", "--z-index-toast-snackbar"],
  ["--dg-opacities-opaque", "--opacity-opaque"],
  ["--dg-opacities-pressed", "--opacity-pressed"],
  ["--dg-opacities-disabled", "--opacity-disabled"],
  ["--dg-opacities-transparent", "--opacity-transparent"],
  ["--dg-opacities-scrim-overlay", "--opacity-scrim-overlay"],
  ["--dg-typography-heading-font-family", "--font-heading"],
  ["--dg-typography-body-font-family", "--font-body"],
]);

const STATUS_ROLES = ["success", "warning", "info", "danger"] as const;

const STATUS_CORRUPTION_ALIASES = Object.fromEntries(
  STATUS_ROLES.flatMap((role) => ([
    [`--dg-color-status-${role}-foreground-surface`, `--dg-color-status-${role}-surface`],
    [`--dg-color-status-${role}-foreground-foreground`, `--dg-color-status-${role}-foreground`],
    [`--dg-color-status-${role}-foreground-border`, `--dg-color-status-${role}-border`],
  ])),
);

export const EXACT_TOKEN_ALIASES: Record<string, string> = {
  // Repair already-persisted output from the former prefix-unsafe scalar
  // replacement before applying the scalar aliases themselves.
  ...STATUS_CORRUPTION_ALIASES,
  "--dg-spacing-element-gap": "--dg-mobile-layout-element-gap",
  "--dg-spacing-section-gap": "--dg-mobile-layout-section-gap",
  "--dg-typography-font-family": "--dg-typography-body-font-family",
  "--dg-typography-title-font-family": "--dg-typography-heading-font-family",
  "--dg-color-status-error": "--dg-color-status-danger-foreground",
  "--dg-color-status-success": "--dg-color-status-success-foreground",
  "--dg-color-status-warning": "--dg-color-status-warning-foreground",
  "--dg-color-status-info": "--dg-color-status-info-foreground",
};

export const SEMANTIC_CLASS_ALIASES: Record<string, string> = {
  "rounded-app": "dg-radius-app",
  "rounded-inner": "dg-radius-inner",
  "rounded-pill": "dg-radius-pill",
};

export const canonicalizeSemanticClassName = (className: string) =>
  SEMANTIC_CLASS_ALIASES[className] ?? className;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace full custom-property identifiers only; a scalar token must never
 * match the prefix of a compound token such as `...-info-surface`. */
export function applyExactTokenAliases(code: string) {
  let normalizedCode = code;
  const applied: Array<[legacy: string, canonical: string]> = [];

  for (const [legacy, canonical] of Object.entries(EXACT_TOKEN_ALIASES)) {
    const pattern = new RegExp(`${escapeRegExp(legacy)}(?![a-zA-Z0-9_-])`, "g");
    if (!pattern.test(normalizedCode)) continue;
    pattern.lastIndex = 0;
    normalizedCode = normalizedCode.replace(pattern, canonical);
    applied.push([legacy, canonical]);
  }

  return { code: normalizedCode, applied };
}

/** Runtime aliases for every portable name the HTML compiler can emit. */
export function buildNormalizedRuntimeAliasVariables(existingCss = "") {
  const existingNames = new Set(
    Array.from(existingCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g), (match) => match[1]),
  );
  const declarations = new Map<string, string>();
  for (const [canonical, normalized] of DRAWGLE_TO_NORMALIZED_VAR) {
    if (!existingNames.has(normalized) && !declarations.has(normalized)) {
      declarations.set(normalized, canonical);
    }
  }
  return Array.from(declarations, ([normalized, canonical]) =>
    `  ${normalized}: var(${canonical});`).join("\n");
}

/** Runtime recovery keeps already-saved screens readable before regeneration. */
export function buildCorruptedTokenRecoveryVariables() {
  return Object.entries(STATUS_CORRUPTION_ALIASES)
    .map(([corrupted, canonical]) => `  ${corrupted}: var(${canonical});`)
    .join("\n");
}
