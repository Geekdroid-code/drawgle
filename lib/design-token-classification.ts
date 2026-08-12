/**
 * What each design token actually is.
 *
 * The schema grew by accumulation, so four different kinds of value ended up
 * living together and being treated identically: project visual identity,
 * component construction recipes, device/runtime constants, and duplicates of
 * things expressed elsewhere. That is why a user could in principle theme
 * `z_index`, and why the builder was handed navigation indicator dimensions as
 * if they were brand identity.
 *
 * This module is the single source of truth for the distinction. The editor
 * decides what to expose from it, and the builder prompt decides what to send
 * from it, so the policy lives in one testable place instead of being implied
 * in three.
 *
 * Deliberately NOT a migration. No stored key is deleted and every CSS variable
 * keeps being emitted, so screens generated under v1 keep rendering exactly as
 * they do today. Classification changes what we *show* and what we *say*, never
 * what we store or paint.
 */

export type TokenClass =
  /** Project visual identity. User-themeable; changing it should transform every screen. */
  | "global"
  /** Component construction. Belongs to a navigation/component recipe, not to brand identity. */
  | "component-recipe"
  /** Device or engineering constant. Never user-themeable. */
  | "runtime-invariant"
  /** Superseded or duplicated elsewhere. Still emitted for compatibility; not offered. */
  | "deprecated";

/**
 * Longest-prefix-wins classification over dot paths into the token tree.
 *
 * Rationale is attached to every non-global entry, because "why is this not a
 * design token" is the question a future reader will actually have.
 */
const CLASSIFICATION: Array<{ prefix: string; klass: TokenClass; why?: string }> = [
  // ---- Global visual identity -------------------------------------------
  { prefix: "color.background", klass: "global" },
  { prefix: "color.surface", klass: "global" },
  { prefix: "color.text", klass: "global" },
  { prefix: "color.border", klass: "global" },
  { prefix: "color.status", klass: "global" },
  { prefix: "color.action.primary", klass: "global" },
  { prefix: "color.action.secondary", klass: "global" },
  { prefix: "color.action.on_primary_text", klass: "global" },
  { prefix: "color.action.disabled", klass: "global" },
  { prefix: "typography.heading_font_family", klass: "global" },
  { prefix: "typography.body_font_family", klass: "global" },
  { prefix: "typography.nav_title", klass: "global" },
  { prefix: "typography.screen_title", klass: "global" },
  { prefix: "typography.hero_title", klass: "global" },
  { prefix: "typography.section_title", klass: "global" },
  { prefix: "typography.metric_value", klass: "global" },
  { prefix: "typography.body", klass: "global" },
  { prefix: "typography.supporting", klass: "global" },
  { prefix: "typography.caption", klass: "global" },
  { prefix: "typography.button_label", klass: "global" },
  { prefix: "spacing", klass: "global" },
  { prefix: "mobile_layout.screen_margin", klass: "global" },
  { prefix: "mobile_layout.section_gap", klass: "global" },
  { prefix: "mobile_layout.element_gap", klass: "global" },
  { prefix: "radii.app", klass: "global" },
  { prefix: "radii.inner", klass: "global" },
  { prefix: "radii.pill", klass: "global" },
  { prefix: "border_widths.standard", klass: "global" },
  { prefix: "shadows.surface", klass: "global" },
  { prefix: "shadows.overlay", klass: "global" },
  { prefix: "sizing.standard_button_height", klass: "global" },
  { prefix: "sizing.standard_input_height", klass: "global" },
  { prefix: "sizing.icon_small", klass: "global" },
  { prefix: "sizing.icon_standard", klass: "global" },
  { prefix: "gradients.action_primary", klass: "global" },

  // Navigation *colours* are identity. Navigation *construction* is not.
  { prefix: "navigation.surface", klass: "global" },
  { prefix: "navigation.content", klass: "global" },
  { prefix: "navigation.muted_content", klass: "global" },
  { prefix: "navigation.active_surface", klass: "global" },
  { prefix: "navigation.active_content", klass: "global" },
  { prefix: "navigation.border", klass: "global" },
  { prefix: "navigation.shadow", klass: "global" },

  // ---- Component recipe --------------------------------------------------
  {
    prefix: "navigation",
    klass: "component-recipe",
    why: "Anatomy, width, labels, active treatment, material, height, insets, padding, gaps and indicator dimensions are component construction. A floating glass dock and a flat tab rail belong to the same design system while differing completely here.",
  },
  {
    prefix: "sizing.bottom_nav_height",
    klass: "component-recipe",
    why: "Depends on the navigation anatomy the recipe chooses; a compact dock and a fixed rail legitimately differ. The renderer derives content clearance from it.",
  },

  // ---- Runtime invariants ------------------------------------------------
  {
    prefix: "mobile_layout.safe_area_top",
    klass: "runtime-invariant",
    why: "Device geometry, not visual identity.",
  },
  {
    prefix: "mobile_layout.safe_area_bottom",
    klass: "runtime-invariant",
    why: "Device geometry, not visual identity.",
  },
  {
    prefix: "sizing.min_touch_target",
    klass: "runtime-invariant",
    why: "An accessibility floor. A validator constant, not something to theme.",
  },
  {
    prefix: "z_index",
    klass: "runtime-invariant",
    why: "Engineering layering. Nobody should theme stacking order.",
  },

  // ---- Deprecated: emitted for compatibility, never offered --------------
  {
    prefix: "shadows.none",
    klass: "deprecated",
    why: "CSS already has `none`. A project token adds nothing.",
  },
  {
    prefix: "elevation",
    klass: "deprecated",
    why: "Duplicates semantic shadows and creates a second competing system.",
  },
  {
    prefix: "color.action.on_surface_white_bg",
    klass: "deprecated",
    why: "Bakes a light-theme assumption into a semantic name; meaningless under a dark base.",
  },
  {
    prefix: "color.action.primary_gradient_start",
    klass: "deprecated",
    why: "Second source of truth for gradients.action_primary.",
  },
  {
    prefix: "color.action.primary_gradient_end",
    klass: "deprecated",
    why: "Second source of truth for gradients.action_primary.",
  },
  {
    prefix: "color.text.action_label",
    klass: "deprecated",
    why: "Duplicates action/link semantics already covered by the action colours.",
  },
  {
    prefix: "typography.title_large",
    klass: "deprecated",
    why: "Legacy alias of the semantic typography roles. More names for one thing means more ambiguity for the builder.",
  },
  { prefix: "typography.title_main", klass: "deprecated", why: "Legacy alias of the semantic typography roles." },
  { prefix: "typography.body_primary", klass: "deprecated", why: "Legacy alias of the semantic typography roles." },
  { prefix: "typography.body_secondary", klass: "deprecated", why: "Legacy alias of the semantic typography roles." },
  { prefix: "typography.font_family", klass: "deprecated", why: "Superseded by explicit heading/body families." },
  {
    prefix: "gradients.app_background",
    klass: "deprecated",
    why: "A required global background gradient makes every screen read as generated from one recipe. Available locally; not part of identity.",
  },
  {
    prefix: "gradients.surface_highlight",
    klass: "deprecated",
    why: "A decorative technique, not system identity. Applied globally it produces the AI-gloss look on every surface.",
  },
  {
    prefix: "gradients.accent_ring",
    klass: "deprecated",
    why: "Same as surface_highlight: a local effect promoted too far.",
  },
  {
    prefix: "radii.inset_",
    klass: "deprecated",
    why: "Optional convenience utilities derived from radii.app. Useful to reach for, never a rule to enforce.",
  },
  {
    prefix: "opacities",
    klass: "deprecated",
    why: "Component state recipe rather than project identity.",
  },
];

// Longest prefix first so `navigation.surface` (global) beats `navigation`
// (component-recipe), and `color.action.primary` beats `color.action`.
const ORDERED = [...CLASSIFICATION].sort((left, right) => right.prefix.length - left.prefix.length);

export interface TokenClassification {
  klass: TokenClass;
  why?: string;
}

/** Classifies a dot path. Unknown paths default to global — new tokens are visible until classified. */
export function classifyTokenPath(path: string): TokenClassification {
  const match = ORDERED.find((entry) => path === entry.prefix || path.startsWith(entry.prefix));
  return match ? { klass: match.klass, why: match.why } : { klass: "global" };
}

/** Only global tokens are offered for editing. */
export const isUserEditableToken = (path: string) => classifyTokenPath(path).klass === "global";

/**
 * Only global tokens reach the builder prompt.
 *
 * Component recipes, runtime constants and deprecated duplicates were prompt
 * noise: the builder does not choose the safe area, must not theme z-index, and
 * gains nothing from four names for one typographic role.
 */
export const isBuilderVisibleToken = (path: string) => classifyTokenPath(path).klass === "global";

/**
 * Every path still resolves to a CSS variable regardless of class, so screens
 * generated before this classification keep rendering. Compatibility is a
 * runtime concern; classification is an authoring concern.
 */
export const isRuntimeEmittedToken = () => true;

/** Schema identifier for token sets authored with this classification. */
export const TOKEN_SCHEMA_V2 = "mobile_universal_core_v2";

/** Token sets written before the classification existed. Still fully supported. */
export const TOKEN_SCHEMA_V1 = "mobile_universal_core";

export const isSupportedTokenSchema = (schema?: string | null) =>
  schema === TOKEN_SCHEMA_V2 || schema === TOKEN_SCHEMA_V1 || !schema;
