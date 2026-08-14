/**
 * Deterministic geometry rules that operate on the rendered DOM rather than on
 * component role names.
 *
 * The existing radius normalizer assigns radii by *role* — a field gets the
 * field radius, a button gets the button radius. That cannot see nesting, so
 * it could never catch the defect that actually shipped:
 *
 *   <article class="dg-radius-app">                          (32px)
 *     <div class="dg-radius-inner m-[var(--dg-spacing-xs)]">  (16px at an 8px gap)
 *
 * The concentric law says a nested surface's radius equals its parent's radius
 * minus the gap between their edges, so that child should have been 24px. At
 * 16px its corner reads visibly tighter than the shell around it. A single
 * global `radii.inner` cannot be correct for more than one gap value, which is
 * why this has to be computed per element pair.
 */

import type { CheerioAPI } from "cheerio";

import { concentricInsetRadius } from "@/lib/design-tokens";
import { flattenDesignTokensToCssVariables } from "@/lib/token-runtime";
import type { DesignTokens } from "@/lib/types";

export type GeometryDiagnosticCode = "concentric_radius_repaired" | "nested_gap_exceeds_padding";

export interface GeometryDiagnostic {
  code: GeometryDiagnosticCode;
  selector: string | null;
  detail: string;
  severity: "repaired" | "warning";
}

/** Rounding tolerance only; known concentric geometry follows the exact law. */
const RADIUS_TOLERANCE_PX = 0.5;

/** Gap must exceed padding by this factor before it counts as a rhythm inversion. */
const GAP_INVERSION_FACTOR = 1.5;

const TAILWIND_RADIUS_PX: Record<string, number> = {
  none: 0,
  sm: 2,
  "": 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

const PILL_THRESHOLD_PX = 500;

const CONTROL_TAGS = new Set(["input", "textarea", "select"]);

const SURFACE_HINT = /\b(?:bg-|dg-surface|dg-bg-|dg-action-|border(?:$|-)|ring-|dg-shadow|shadow-)/;

type Insets = { top: number; right: number; bottom: number; left: number } | null;

const classList = (value: string | undefined) => String(value ?? "").split(/\s+/).filter(Boolean);

/**
 * Resolves a length written as a Tailwind arbitrary value, a token variable, or
 * a numeric Tailwind step. Returns null when the value cannot be resolved
 * confidently — every rule here skips rather than guesses.
 */
const resolveLength = (raw: string, variables: Map<string, string>): number | null => {
  const trimmed = raw.trim();

  const variableMatch = trimmed.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i);
  if (variableMatch) {
    const resolved = variables.get(variableMatch[1]);
    return resolved ? resolveLength(resolved, variables) : null;
  }

  const pxMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (pxMatch) return Number(pxMatch[1]);

  const remMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)rem$/i);
  if (remMatch) return Number(remMatch[1]) * 16;

  const bare = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]);

  return null;
};

/** Tailwind numeric spacing step (`p-4`) resolves on the 4px grid. */
const resolveSpacingStep = (token: string) => {
  const numeric = Number(token);
  return Number.isFinite(numeric) ? numeric * 4 : null;
};

const readSpacingClass = (
  className: string,
  prefixes: readonly string[],
  variables: Map<string, string>,
): { sides: string; value: number } | null => {
  for (const prefix of prefixes) {
    if (!className.startsWith(`${prefix}-`)) continue;
    const remainder = className.slice(prefix.length + 1);
    const arbitrary = remainder.match(/^\[(.+)\]$/);
    const value = arbitrary
      ? resolveLength(arbitrary[1].replace(/_/g, " "), variables)
      : resolveSpacingStep(remainder);
    if (value === null) continue;
    return { sides: prefix.slice(1) || "a", value };
  }
  return null;
};

const SIDE_MAP: Record<string, Array<keyof NonNullable<Insets>>> = {
  a: ["top", "right", "bottom", "left"],
  x: ["left", "right"],
  y: ["top", "bottom"],
  t: ["top"],
  r: ["right"],
  b: ["bottom"],
  l: ["left"],
  s: ["left"],
  e: ["right"],
};

const readInsets = (
  classes: string[],
  base: "p" | "m",
  variables: Map<string, string>,
): Insets => {
  const prefixes = [base, `${base}x`, `${base}y`, `${base}t`, `${base}r`, `${base}b`, `${base}l`, `${base}s`, `${base}e`]
    // Longest prefix first so `px-` is not swallowed by `p-`.
    .sort((left, right) => right.length - left.length);
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let matched = false;

  for (const className of classes) {
    const parsed = readSpacingClass(className, prefixes, variables);
    if (!parsed) continue;
    const sides = SIDE_MAP[parsed.sides];
    if (!sides) continue;
    for (const side of sides) insets[side] = parsed.value;
    matched = true;
  }

  return matched ? insets : { top: 0, right: 0, bottom: 0, left: 0 };
};

const readGap = (classes: string[], variables: Map<string, string>) => {
  for (const className of classes) {
    const match = className.match(/^gap(?:-(x|y))?-(?:\[(.+)\]|([\d.]+))$/);
    if (!match) continue;
    const value = match[2] !== undefined
      ? resolveLength(match[2].replace(/_/g, " "), variables)
      : resolveSpacingStep(match[3]);
    if (value === null) continue;
    return { axis: match[1] ?? "both", value };
  }
  return null;
};

export interface ResolvedRadius {
  px: number;
  /** The class that produced it, so a repair knows what to replace. */
  className: string | null;
  isPill: boolean;
}

const resolveRadius = (classes: string[], variables: Map<string, string>): ResolvedRadius | null => {
  for (const className of classes) {
    if (className === "dg-radius-pill") return { px: 9999, className, isPill: true };
    if (className === "dg-radius-app") {
      const value = resolveLength("var(--dg-radii-app)", variables);
      if (value !== null) return { px: value, className, isPill: false };
    }
    if (className === "dg-radius-inner") {
      const value = resolveLength("var(--dg-radii-inner)", variables);
      if (value !== null) return { px: value, className, isPill: false };
    }
    const insetMatch = className.match(/^dg-radius-inset-(xxs|xs|sm|md|lg)$/);
    if (insetMatch) {
      const value = resolveLength(`var(--dg-radii-inset-${insetMatch[1]})`, variables);
      if (value !== null) return { px: value, className, isPill: false };
    }

    const roundedArbitrary = className.match(/^rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e))?-\[(.+)\]$/);
    if (roundedArbitrary) {
      const value = resolveLength(roundedArbitrary[1].replace(/_/g, " "), variables);
      if (value !== null) return { px: value, className, isPill: value >= PILL_THRESHOLD_PX };
    }

    const roundedNamed = className.match(/^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/);
    if (roundedNamed) {
      const value = TAILWIND_RADIUS_PX[roundedNamed[1] ?? ""];
      if (value !== undefined) return { px: value, className, isPill: value >= PILL_THRESHOLD_PX };
    }
  }
  return null;
};

/** Design-token CSS variables, resolved to px strings, for class resolution. */
export const buildTokenVariableMap = (designTokens?: DesignTokens | null) => {
  const map = new Map<string, string>();
  for (const variable of flattenDesignTokensToCssVariables(designTokens)) {
    map.set(variable.name, variable.value);
  }
  return map;
};

/**
 * Picks the token class whose value matches `targetPx`, so repairs stay inside
 * the design system instead of scattering arbitrary pixel values.
 */
const radiusClassFor = (targetPx: number, variables: Map<string, string>) => {
  const candidates: Array<{ className: string; value: number }> = [];
  for (const [name, raw] of variables) {
    const insetMatch = name.match(/^--dg-radii-inset-(xxs|xs|sm|md|lg)$/);
    const value = resolveLength(raw, variables);
    if (value === null) continue;
    if (insetMatch) candidates.push({ className: `dg-radius-inset-${insetMatch[1]}`, value });
    if (name === "--dg-radii-app") candidates.push({ className: "dg-radius-app", value });
    if (name === "--dg-radii-inner") candidates.push({ className: "dg-radius-inner", value });
  }

  const exact = candidates.find((candidate) => Math.abs(candidate.value - targetPx) <= 0.5);
  return exact?.className ?? `rounded-[${Math.round(targetPx)}px]`;
};

const replaceRadiusClass = (classes: string[], previous: string | null, next: string) => {
  const withoutRadius = classes.filter((className) =>
    className !== previous
    && !/^dg-radius-(?:app|inner|pill|inset-(?:xxs|xs|sm|md|lg))$/.test(className)
    && !/^rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e))?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$/.test(className));
  return [...withoutRadius, next];
};

const selectorFor = ($: CheerioAPI, element: never) => {
  const node = $(element);
  const id = node.attr("data-drawgle-id");
  if (id) return `[data-drawgle-id="${id}"]`;
  const tag = (element as unknown as { tagName?: string }).tagName ?? "element";
  const firstClass = classList(node.attr("class"))[0];
  return firstClass ? `${tag}.${firstClass}` : tag;
};

/**
 * A nested element only participates in the concentric relationship when it
 * reads as its own surface. A bare text wrapper that happens to carry a radius
 * is not something the eye compares against the shell.
 */
const isSurfaceLike = ($: CheerioAPI, element: never) => {
  const node = $(element);
  const classes = classList(node.attr("class")).join(" ");
  const style = node.attr("style") ?? "";
  return SURFACE_HINT.test(classes) || /background|border/i.test(style);
};

const isShapeOwnedControl = ($: CheerioAPI, element: never) => {
  const node = $(element);
  const tagName = ((element as unknown as { tagName?: string }).tagName ?? "").toLowerCase();
  if (CONTROL_TAGS.has(tagName)) return true;
  // A selected segment is both a button and a nested painted surface. Its
  // curve is owned by the actual tablist/group inset, not by the generic
  // button role. Let the concentric pass evaluate it even when the selected
  // state carries the primary-action class.
  const segmentedItem = node.attr("role") === "tab"
    || (node.attr("aria-pressed") !== undefined && /^(?:tablist|group)$/.test(node.parent().attr("role") ?? ""));
  if (segmentedItem) return false;
  if (node.attr("role") === "tablist") return true;
  // Primary CTAs get their shape from the component shape policy, not from the
  // container they happen to sit in.
  const classes = classList(node.attr("class")).join(" ");
  return node.attr("data-action-role") === "primary"
    || /\bdg-(?:action|gradient-action)-primary\b/.test(classes)
    || node.attr("type") === "submit";
};

/**
 * Walks up from `element` to the nearest radiused surface, accumulating the
 * insets that separate their edges.
 */
const findConcentricParent = (
  $: CheerioAPI,
  element: never,
  variables: Map<string, string>,
) => {
  const ownMargin = readInsets(classList($(element).attr("class")), "m", variables);
  let gapTop = ownMargin?.top ?? 0;
  let gapRight = ownMargin?.right ?? 0;
  let gapBottom = ownMargin?.bottom ?? 0;
  let gapLeft = ownMargin?.left ?? 0;

  let node = $(element).parent();
  let depth = 0;

  while (node.length > 0 && depth < 6) {
    const current = node.get(0);
    if (!current || (current as unknown as { type?: string }).type !== "tag") return null;

    const classes = classList(node.attr("class"));
    const padding = readInsets(classes, "p", variables);
    gapTop += padding?.top ?? 0;
    gapRight += padding?.right ?? 0;
    gapBottom += padding?.bottom ?? 0;
    gapLeft += padding?.left ?? 0;

    const radius = resolveRadius(classes, variables);
    if (radius && !radius.isPill) {
      return {
        element: current as never,
        radius,
        gap: Math.min(gapTop, gapRight, gapBottom, gapLeft),
        clips: classes.includes("overflow-hidden") || classes.includes("overflow-clip"),
      };
    }

    const margin = readInsets(classes, "m", variables);
    gapTop += margin?.top ?? 0;
    gapRight += margin?.right ?? 0;
    gapBottom += margin?.bottom ?? 0;
    gapLeft += margin?.left ?? 0;

    node = node.parent();
    depth += 1;
  }

  return null;
};

/**
 * Applies the concentric radius law and the gap/padding rhythm rule.
 * Mutates `$` in place when `repairEnabled`; otherwise reports only.
 */
export function applyGeometryContract({
  $,
  designTokens,
  repairEnabled,
  gapRepairEnabled = repairEnabled,
}: {
  $: CheerioAPI;
  designTokens?: DesignTokens | null;
  repairEnabled: boolean;
  gapRepairEnabled?: boolean;
}): GeometryDiagnostic[] {
  const variables = buildTokenVariableMap(designTokens);
  const diagnostics: GeometryDiagnostic[] = [];

  if (!variables.has("--dg-radii-app")) return diagnostics;

  // --- C1: concentric radius ----------------------------------------------
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    const radius = resolveRadius(classes, variables);
    if (!radius || radius.isPill) return;
    if (isShapeOwnedControl($, element as never)) return;
    if (!isSurfaceLike($, element as never)) return;

    const parent = findConcentricParent($, element as never, variables);
    if (!parent) return;

    // A flush child inside a clipping parent is already shaped by the clip;
    // rewriting its radius would be churn without a visible change.
    if (parent.gap === 0 && parent.clips) return;

    const expected = concentricInsetRadius(parent.radius.px, parent.gap);
    if (Math.abs(radius.px - expected) <= RADIUS_TOLERANCE_PX) return;

    const selector = selectorFor($, element as never);
    const detail = `Nested surface is ${radius.px}px inside a ${parent.radius.px}px parent at a ${parent.gap}px gap; the concentric value is ${expected}px.`;

    if (!repairEnabled) {
      diagnostics.push({ code: "concentric_radius_repaired", selector, detail, severity: "warning" });
      return;
    }

    const replacement = radiusClassFor(expected, variables);
    node.attr("class", replaceRadiusClass(classes, radius.className, replacement).join(" "));
    diagnostics.push({
      code: "concentric_radius_repaired",
      selector,
      detail: `${detail} Applied ${replacement}.`,
      severity: "repaired",
    });
  });

  // --- C2: gap must not exceed the padding containing it -------------------
  $("[class]").each((_, element) => {
    const node = $(element as never);
    const classes = classList(node.attr("class"));
    if (!resolveRadius(classes, variables) && !SURFACE_HINT.test(classes.join(" "))) return;

    const padding = readInsets(classes, "p", variables);
    const verticalPadding = Math.min(padding?.top ?? 0, padding?.bottom ?? 0);
    if (verticalPadding <= 0) return;

    // The stack is usually an unstyled wrapper immediately inside the surface.
    const stackCandidates = [node, node.children().length === 1 ? node.children().first() : null]
      .filter((candidate): candidate is typeof node => Boolean(candidate));

    for (const candidate of stackCandidates) {
      const candidateClasses = classList(candidate.attr("class"));
      if (!candidateClasses.includes("flex-col") && !candidateClasses.some((name) => name.startsWith("grid"))) continue;
      const gap = readGap(candidateClasses, variables);
      if (!gap || gap.axis === "x") continue;
      if (gap.value <= verticalPadding * GAP_INVERSION_FACTOR) continue;

      const selector = selectorFor($, element as never);
      const detail = `Children are separated by ${gap.value}px inside a surface padded ${verticalPadding}px; content reads as escaping its container.`;

      if (!gapRepairEnabled) {
        diagnostics.push({ code: "nested_gap_exceeds_padding", selector, detail, severity: "warning" });
        break;
      }

      const gapClassName = candidateClasses.find((name) => /^gap(?:-y)?-/.test(name));
      if (!gapClassName) break;
      candidate.attr("class", candidateClasses
        .map((name) => (name === gapClassName ? `gap-[${verticalPadding}px]` : name))
        .join(" "));
      diagnostics.push({
        code: "nested_gap_exceeds_padding",
        selector,
        detail: `${detail} Reduced to ${verticalPadding}px.`,
        severity: "repaired",
      });
      break;
    }
  });

  return diagnostics;
}
