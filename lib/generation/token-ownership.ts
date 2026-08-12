/**
 * Declared semantic token ownership.
 *
 * The system previously inferred meaning from appearance — a neutral `bg-*`
 * became `dg-surface-card` because it looked like a card. A color value carries
 * no semantic content, so that guess inverted black CTAs into white cards.
 *
 * Ownership is therefore declared by the builder, never inferred:
 *
 *   <button data-dg-role="primary-action">
 *   <section data-dg-scope="local">
 *
 * Two rules keep this from becoming the same hammer one level up:
 *
 * 1. Ownership is per PROPERTY, not per component. `primary-action` tells us
 *    which token owns the fill and its foreground. It says nothing about
 *    whether that CTA is a pill, oversized, floating or icon-led.
 *
 * 2. A required binding must name EXACTLY ONE token. Any rule phrased as
 *    "token A or token B" is diagnostics-only by definition — if deterministic
 *    code has to choose, it is guessing, which is the original defect.
 */

import type { DesignTokens } from "@/lib/types";

/**
 * Closed vocabulary. Deliberately small.
 *
 * There is no generic `card`: a premium screen routinely carries a normal
 * card, an inverse card, an accent card and a media card. Collapsing them into
 * one role and forcing `surface.card` would re-flatten exactly what this work
 * exists to stop.
 */
export const DG_ROLES = [
  "system-card",
  "system-sheet",
  "system-modal",
  "primary-action",
  "secondary-action",
  "field",
  "navigation",
  "inverse-surface",
  "accent-surface",
] as const;

export type DgRole = (typeof DG_ROLES)[number];

export const DG_ROLE_ATTRIBUTE = "data-dg-role";
export const DG_SCOPE_ATTRIBUTE = "data-dg-scope";

/** CSS property families ownership is expressed over. */
export type OwnedProperty = "background" | "foreground" | "border" | "typography";

export interface PropertyBinding {
  property: OwnedProperty;
  /** Dot path into the token tree. Exactly one — never a choice. */
  tokenPath: string;
  /** The `dg-*` utility that satisfies it, when one exists. */
  utilityClass?: string;
}

export interface RoleOwnership {
  role: DgRole;
  /** Repairable when violated: the role makes the answer unambiguous. */
  required: PropertyBinding[];
  /** Reported when violated, never rewritten. The builder may have a reason. */
  recommended: string[];
  /** Never inspected. Shape, layout, elevation, decoration, effects. */
  localNote: string;
}

/**
 * Only roles whose required tokens exist in the current schema carry required
 * bindings. `inverse-surface` and `accent-surface` are recognised so the
 * builder can declare intent and so the audit stops treating them as
 * unclassified system UI — but the schema has no inverse-surface token yet, so
 * inventing a binding for them would be fabricating a rule. They gain required
 * bindings in Phase 4 if the schema grows to support them.
 */
export const ROLE_OWNERSHIP: Record<DgRole, RoleOwnership> = {
  "system-card": {
    role: "system-card",
    required: [{ property: "background", tokenPath: "color.surface.card", utilityClass: "dg-surface-card" }],
    recommended: ["radii.app", "shadows.surface"],
    localNote: "Padding, internal composition, aspect ratio and decoration are yours.",
  },
  "system-sheet": {
    role: "system-sheet",
    required: [{ property: "background", tokenPath: "color.surface.bottom_sheet", utilityClass: "dg-surface-bottom-sheet" }],
    recommended: ["radii.app", "shadows.overlay"],
    localNote: "Handle, internal layout and dismiss affordance are yours.",
  },
  "system-modal": {
    role: "system-modal",
    required: [{ property: "background", tokenPath: "color.surface.modal", utilityClass: "dg-surface-modal" }],
    recommended: ["radii.app", "shadows.overlay"],
    localNote: "Internal layout and dismiss affordance are yours.",
  },
  "primary-action": {
    role: "primary-action",
    required: [
      { property: "background", tokenPath: "color.action.primary", utilityClass: "dg-action-primary" },
      { property: "foreground", tokenPath: "color.action.on_primary_text" },
    ],
    // Height and radius are recommended, not required: a primary CTA may
    // legitimately be a pill, oversized, floating or icon-led.
    recommended: ["sizing.standard_button_height", "typography.button_label"],
    localNote: "Shape, width, layout, elevation and effects are yours.",
  },
  "secondary-action": {
    role: "secondary-action",
    required: [{ property: "background", tokenPath: "color.action.secondary", utilityClass: "dg-action-secondary" }],
    recommended: ["sizing.standard_button_height", "typography.button_label"],
    localNote: "Shape, width, layout and effects are yours.",
  },
  field: {
    role: "field",
    // Fill is deliberately absent: a field may legitimately sit on the card
    // surface or the page background. That is a genuine "A or B", so it is
    // reported rather than repaired.
    required: [{ property: "border", tokenPath: "color.border.divider", utilityClass: "dg-border-divider" }],
    recommended: ["sizing.standard_input_height", "typography.body", "color.surface.card"],
    localNote: "Affordances, icons and internal layout are yours.",
  },
  navigation: {
    role: "navigation",
    required: [{ property: "background", tokenPath: "navigation.surface" }],
    recommended: ["navigation.content", "navigation.border", "navigation.shadow"],
    localNote: "Anatomy, geometry and indicator treatment belong to the navigation recipe.",
  },
  "inverse-surface": {
    role: "inverse-surface",
    required: [],
    recommended: [],
    localNote: "A deliberately inverted surface. No schema token owns this yet; declared so the audit does not mistake it for unclassified system UI.",
  },
  "accent-surface": {
    role: "accent-surface",
    required: [],
    recommended: [],
    localNote: "A deliberately accent-filled surface. Same status as inverse-surface.",
  },
};

export const isDgRole = (value: unknown): value is DgRole =>
  typeof value === "string" && (DG_ROLES as readonly string[]).includes(value);

/** Resolves a dot path into the token tree. */
export const readTokenPath = (designTokens: DesignTokens | null | undefined, path: string) => {
  let current: unknown = designTokens?.tokens;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
};

/** The CSS variable name a token path resolves to. */
export const tokenPathToVariable = (path: string) => {
  const parts = path.split(".");
  if (parts[0] === "typography" && parts.length >= 3) {
    return `--dg-type-${parts[1].replace(/_/g, "-")}-${parts.slice(2).join("-").replace(/_/g, "-")}`;
  }
  return `--dg-${parts.map((part) => part.replace(/_/g, "-")).join("-")}`;
};

/** Renders the role contract for the builder prompt. */
export function formatTokenOwnershipContract() {
  const lines = [
    "SEMANTIC ROLES — declare what system UI *is*, then style it freely.",
    "",
    `Add ${DG_ROLE_ATTRIBUTE}="..." to system UI so the project's live design system can control it:`,
  ];

  for (const role of DG_ROLES) {
    const ownership = ROLE_OWNERSHIP[role];
    const required = ownership.required.length
      ? ownership.required.map((binding) => `${binding.property} must use ${binding.utilityClass ?? `var(${tokenPathToVariable(binding.tokenPath)})`}`).join("; ")
      : "no required binding";
    lines.push(`  ${role} — ${required}. ${ownership.localNote}`);
  }

  lines.push(
    "",
    `Everything else is local art and needs no role: heroes, charts, gradients, decorative geometry, illustrations, maps, media compositions, intentional high-contrast sections, deliberate asymmetry. Use any CSS you like.`,
    `Wrap a whole region in ${DG_SCOPE_ATTRIBUTE}="local" to state explicitly that its styling is intentional and project-local.`,
    "",
    "Only the listed required properties are owned. Shape, size, layout, spacing, elevation and effects always remain your decision, including on roled elements. A pill primary CTA is a legitimate choice.",
  );

  return lines.join("\n");
}
