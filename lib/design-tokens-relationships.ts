/**
 * Token Relationship Validator.
 *
 * `enforcePlatformConstraints()` in lib/design-tokens.ts validates token
 * *shapes*: is this a px string, is `inner` smaller than `app`, does this
 * status foreground clear contrast. It never asks whether the values work
 * together, and that is where generated token sets actually fail.
 *
 * Observed production failure (project 6c6ff9da, "premium cosmetics"):
 *   - `surface.card #FFFFFF` on `background.primary #F5F2ED` — a pure neutral
 *     card on a warm page, separated by a 3.8% lightness step and a shadow at
 *     0.03 alpha. Nothing reads as deliberate.
 *   - `spacing` = 0/4/8/12/24/32/48/64 with `element_gap: 16px` — the app's
 *     most-used gap was not a member of its own spacing scale.
 *   - `section_gap: 48px` against `element_gap: 16px` — a 3x macro/micro ratio
 *     that leaves roughly one and a half sections in a 390x844 frame.
 *   - `border_widths.standard: 0.75px` — sub-pixel, paired with an 0.08-alpha
 *     divider that is effectively invisible.
 *   - `text.low_emphasis #A0A0A0` — 2.6:1 on white.
 *
 * Each rule below repairs one relationship and records what it changed, so the
 * per-rule correction rate is measurable rather than anecdotal.
 */

import {
  contrastRatio,
  ensureContrast,
  hueDistance,
  oklchToHex,
  parseCssColor,
  toOklch,
  type Oklch,
} from "@/lib/color-math";
import type { StyleCharterV1 } from "@/lib/generation/style-charter";
import type { DesignTokenValues } from "@/lib/types";

export type TokenRelationshipCode =
  | "surface_hue_retinted"
  | "surface_separation_widened"
  | "surface_edge_required"
  | "elevation_clamped"
  | "glass_removed"
  | "gradient_background_removed"
  | "base_color_clamped"
  | "accent_chroma_clamped"
  | "heading_family_rejected"
  | "spacing_scale_rebuilt"
  | "layout_gap_snapped"
  | "macro_micro_ratio_clamped"
  | "border_width_snapped"
  | "divider_alpha_raised"
  | "type_scale_clamped"
  | "line_height_clamped"
  | "text_contrast_repaired"
  | "text_contrast_unresolved";

export interface TokenRelationshipDiagnostic {
  code: TokenRelationshipCode;
  path: string;
  detail: string;
  from?: string;
  to?: string;
  severity: "repaired" | "warning";
}

export interface TokenRelationshipReportV1 {
  version: 1;
  repairEnabled: boolean;
  charterSource: StyleCharterV1["source"] | null;
  diagnostics: TokenRelationshipDiagnostic[];
}

const MOBILE_FRAME_HEIGHT_PX = 844;

/**
 * A ratio wider than this between adjacent steps is a hole in the scale — the
 * value the layout actually needs does not exist and gets invented alongside.
 *
 * Only enforced once the steps are large enough for the ratio to mean anything:
 * 4px to 8px is 2x but is the normal base of every mobile scale, whereas 12px
 * to 24px is the same ratio and skips the single most-used gap on the platform.
 */
const MAX_SPACING_STEP_RATIO = 1.9;
const SPACING_RATIO_FLOOR_PX = 12;

const SPACING_KEY_ORDER = ["none", "xxs", "xs", "sm", "md", "lg", "xl", "xxl"] as const;

/**
 * Canonical mobile spacing ladders. Authored scales are kept whenever they are
 * coherent; these are only used to rebuild a scale that has failed validation.
 */
const SPACING_LADDERS: Record<"compact" | "standard" | "generous", readonly number[]> = {
  compact: [0, 4, 8, 12, 16, 20, 28, 40],
  standard: [0, 4, 8, 12, 16, 24, 32, 48],
  generous: [0, 4, 8, 16, 24, 32, 48, 64],
};

const ALLOWED_BORDER_WIDTHS_PX = [1, 1.5, 2, 3] as const;

/** Ratio bands for `line_height / size`, by typographic role. */
const LINE_HEIGHT_BANDS: Record<string, [number, number]> = {
  hero_title: [1.0, 1.3],
  screen_title: [1.05, 1.35],
  metric_value: [1.0, 1.3],
  section_title: [1.1, 1.45],
  nav_title: [1.1, 1.45],
  body: [1.35, 1.7],
  supporting: [1.3, 1.7],
  caption: [1.15, 1.6],
  button_label: [1.1, 1.5],
};

const CONTRAST_TARGETS: Array<{ foreground: string; background: string; ratio: number; note?: string }> = [
  { foreground: "color.text.high_emphasis", background: "color.background.primary", ratio: 4.5 },
  { foreground: "color.text.high_emphasis", background: "color.surface.card", ratio: 4.5 },
  { foreground: "color.text.medium_emphasis", background: "color.background.primary", ratio: 4.5 },
  { foreground: "color.text.medium_emphasis", background: "color.surface.card", ratio: 4.5 },
  // Low emphasis targets 3:1 rather than 4.5:1 on purpose. Forcing it to 4.5
  // collapses the emphasis ladder into two indistinguishable tiers, which is a
  // worse design outcome than a deliberately quiet metadata tier.
  { foreground: "color.text.low_emphasis", background: "color.background.primary", ratio: 3, note: "metadata tier floor" },
  { foreground: "color.text.low_emphasis", background: "color.surface.card", ratio: 3, note: "metadata tier floor" },
  { foreground: "color.action.on_primary_text", background: "color.action.primary", ratio: 4.5 },
  { foreground: "navigation.content", background: "navigation.surface", ratio: 4.5 },
  { foreground: "navigation.muted_content", background: "navigation.surface", ratio: 3 },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readPath = (tokens: DesignTokenValues, path: string): unknown => {
  let current: unknown = tokens;
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
};

const writePath = (tokens: DesignTokenValues, path: string, value: string) => {
  const keys = path.split(".");
  let current: Record<string, unknown> = tokens as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    if (!isRecord(current[key])) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[keys.at(-1)!] = value;
};

const px = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatPx = (value: number) => `${Math.round(value * 100) / 100}px`;

/** Flattens a translucent color onto an opaque backdrop so contrast math is honest. */
const compositeOver = (foreground: unknown, backdrop: unknown): string | null => {
  const front = parseCssColor(foreground);
  const back = parseCssColor(backdrop);
  if (!front) return null;
  if (front.alpha >= 1 || !back) return typeof foreground === "string" ? foreground : null;
  const blend = (a: number, b: number) => Math.round(a * front.alpha + b * (1 - front.alpha));
  const channel = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(blend(front.r, back.r))}${channel(blend(front.g, back.g))}${channel(blend(front.b, back.b))}`;
};

const nearest = (value: number, candidates: readonly number[]) =>
  candidates.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best, candidates[0]);

/** Largest blur radius and alpha appearing anywhere in a CSS box-shadow list. */
const parseShadowStrength = (value: unknown) => {
  if (typeof value !== "string" || value.trim().toLowerCase() === "none") return null;
  const lengths = [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const alphas = [...value.matchAll(/rgba?\([^)]*?[,/]\s*([0-9.]+)\s*\)/gi)].map((match) => Number(match[1]));
  // In `0 10px 30px rgba(...)` the third length is the blur; take the max of
  // every third-or-later length so multi-layer shadows are covered.
  const blur = lengths.length > 0 ? Math.max(...lengths.map(Math.abs)) : 0;
  const alpha = alphas.length > 0 ? Math.max(...alphas) : 1;
  return { blur, alpha };
};

const canonicalShadow = (elevation: StyleCharterV1["elevation"], darkTheme: boolean) => {
  const tint = darkTheme ? "0,0,0" : "17,17,17";
  switch (elevation) {
    case "flat":
      return `0 1px 2px rgba(${tint},0.04)`;
    case "soft":
      return `0 4px 12px rgba(${tint},0.08)`;
    default:
      return `0 12px 32px rgba(${tint},0.14)`;
  }
};

export function validateTokenRelationships({
  tokens,
  charter,
  repairEnabled = process.env.DRAWGLE_TOKEN_RELATIONSHIPS_ENABLED !== "false",
}: {
  tokens: DesignTokenValues;
  charter?: StyleCharterV1 | null;
  repairEnabled?: boolean;
}): { tokens: DesignTokenValues; report: TokenRelationshipReportV1 } {
  const next = JSON.parse(JSON.stringify(tokens)) as DesignTokenValues;
  const diagnostics: TokenRelationshipDiagnostic[] = [];

  const record = (
    code: TokenRelationshipCode,
    path: string,
    detail: string,
    from?: string,
    to?: string,
  ) => {
    diagnostics.push({ code, path, detail, from, to, severity: repairEnabled ? "repaired" : "warning" });
  };

  const set = (path: string, value: string, code: TokenRelationshipCode, detail: string) => {
    const before = readPath(next, path);
    if (typeof before === "string" && before === value) return;
    record(code, path, detail, typeof before === "string" ? before : undefined, value);
    if (repairEnabled) writePath(next, path, value);
  };

  const backgroundPrimary = readPath(next, "color.background.primary");
  const backgroundOklch = toOklch(backgroundPrimary);
  const darkTheme = (backgroundOklch?.l ?? 1) < 0.4;

  // -------------------------------------------------------------------------
  // Charter conformance
  // -------------------------------------------------------------------------
  if (charter) {
    // Base color band.
    if (charter.baseColor && backgroundOklch) {
      const { minLightness, maxLightness, maxChroma, label } = charter.baseColor;
      let clamped: Oklch = { ...backgroundOklch };
      let violated = false;
      if (minLightness !== null && clamped.l < minLightness) { clamped = { ...clamped, l: minLightness }; violated = true; }
      if (maxLightness !== null && clamped.l > maxLightness) { clamped = { ...clamped, l: maxLightness }; violated = true; }
      if (maxChroma !== null && clamped.c > maxChroma) { clamped = { ...clamped, c: maxChroma }; violated = true; }
      if (violated) {
        set("color.background.primary", oklchToHex(clamped), "base_color_clamped",
          `Charter requires a ${label}.`);
      }
    }

    // Accent chroma ceiling for restrained/monochrome directions.
    if (charter.maxAccentChroma !== null) {
      const accent = toOklch(readPath(next, "color.action.primary"));
      if (accent && accent.c > charter.maxAccentChroma) {
        set("color.action.primary", oklchToHex({ ...accent, c: charter.maxAccentChroma }), "accent_chroma_clamped",
          `Charter caps accent chroma at ${charter.maxAccentChroma}.`);
      }
    }

    // Elevation ceiling.
    const surfaceShadow = readPath(next, "shadows.surface");
    const strength = parseShadowStrength(surfaceShadow);
    const blurCeiling = charter.maxShadowBlurPx;
    const alphaCeiling = charter.maxShadowAlpha;
    if (strength && ((blurCeiling !== null && strength.blur > blurCeiling) || (alphaCeiling !== null && strength.alpha > alphaCeiling))) {
      set("shadows.surface", canonicalShadow(charter.elevation, darkTheme), "elevation_clamped",
        `Charter elevation ceiling is "${charter.elevation}" (blur <= ${blurCeiling ?? "-"}px, alpha <= ${alphaCeiling ?? "-"}).`);
    }

    // Glass.
    if (!charter.allowGlass) {
      const material = readPath(next, "navigation.surface_material");
      if (material === "glass") {
        set("navigation.surface_material", "solid", "glass_removed", "Charter forbids glassmorphism.");
      }
      const blur = px(readPath(next, "navigation.backdrop_blur"));
      if (blur !== null && blur > 0) {
        set("navigation.backdrop_blur", "0px", "glass_removed", "Charter forbids backdrop blur.");
      }
    }

    // Gradient app background.
    if (!charter.allowGradientBackground) {
      const gradient = readPath(next, "gradients.app_background");
      if (typeof gradient === "string" && /gradient\(/i.test(gradient)) {
        const base = typeof backgroundPrimary === "string" ? backgroundPrimary : "#FFFFFF";
        set("gradients.app_background", `linear-gradient(180deg, ${base} 0%, ${base} 100%)`, "gradient_background_removed",
          "Charter requires a flat base field.");
      }
    }

    // Heading family class.
    if (charter.headingClass === "sans") {
      const heading = readPath(next, "typography.heading_font_family");
      if (typeof heading === "string" && /\bserif\b/i.test(heading) && !/sans-serif/i.test(heading.split(",").at(-1) ?? "")) {
        const body = readPath(next, "typography.body_font_family");
        const replacement = typeof body === "string" && body.trim()
          ? body
          : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        set("typography.heading_font_family", replacement, "heading_family_rejected",
          "Charter declares a sans-serif system; the generated heading family was a serif.");
      }
    }
  }

  // -------------------------------------------------------------------------
  // Surface / background relationship
  // -------------------------------------------------------------------------
  const cardOklch = toOklch(readPath(next, "color.surface.card"));
  if (backgroundOklch && cardOklch) {
    let card = { ...cardOklch };
    let changed = false;

    // Hue family: a neutral card on a tinted page reads cold against it
    // (simultaneous contrast). Track the page's hue at reduced chroma.
    const targetChroma = Math.min(backgroundOklch.c * 0.6, 0.03);
    const hueDrifted = card.c > 0.004 && hueDistance(card.h, backgroundOklch.h) > 40;
    if (backgroundOklch.c >= 0.004 && (card.c < backgroundOklch.c * 0.4 || hueDrifted)) {
      card = { ...card, h: backgroundOklch.h, c: targetChroma };
      changed = true;
    }

    // Lightness separation: below this the surface reads as a printing error
    // rather than a deliberate layer. The epsilon keeps the rule idempotent —
    // tokens are re-normalized on every edit, and a rule that nudges by a
    // rounding error on each pass would drift the palette over time.
    const MIN_SEPARATION = 0.05;
    const SEPARATION_EPSILON = 0.005;
    const separation = Math.abs(card.l - backgroundOklch.l);
    if (separation < MIN_SEPARATION - SEPARATION_EPSILON) {
      const cardIsLighter = card.l >= backgroundOklch.l;
      const headroom = cardIsLighter ? 1 - card.l : card.l;
      if (headroom >= MIN_SEPARATION - separation) {
        card = { ...card, l: backgroundOklch.l + (cardIsLighter ? MIN_SEPARATION : -MIN_SEPARATION) };
        changed = true;
      } else {
        // The card is already at the lightness ceiling (typically pure white),
        // so the page moves instead. The charter's base-color band still holds.
        const floor = charter?.baseColor?.minLightness ?? 0;
        const pushed = cardIsLighter
          ? Math.max(floor, card.l - MIN_SEPARATION)
          : Math.min(1, card.l + MIN_SEPARATION);
        if (Math.abs(pushed - backgroundOklch.l) > 0.001) {
          set("color.background.primary", oklchToHex({ ...backgroundOklch, l: pushed }), "surface_separation_widened",
            `Card and page were only ${separation.toFixed(3)} apart in lightness; the card is at the lightness ceiling, so the page steps back.`);
        } else {
          diagnostics.push({
            code: "surface_edge_required",
            path: "color.surface.card",
            detail: "Card and page cannot be separated by lightness alone; separation must come from a border.",
            severity: "warning",
          });
        }
      }
    }

    if (changed) {
      set("color.surface.card", oklchToHex(card), "surface_hue_retinted",
        "Card surface now shares the page's hue family and clears the minimum lightness step.");
    }
  }

  // -------------------------------------------------------------------------
  // Spacing scale coherence
  // -------------------------------------------------------------------------
  const spacing = isRecord(next.spacing) ? next.spacing : {};
  const authored = SPACING_KEY_ORDER.map((key) => px(spacing[key]));
  const authoredValues = authored.filter((value): value is number => value !== null);

  const scaleIsCoherent = (() => {
    if (authoredValues.length < SPACING_KEY_ORDER.length) return false;
    for (let index = 1; index < authoredValues.length; index += 1) {
      const previous = authoredValues[index - 1];
      const current = authoredValues[index];
      if (current <= previous) return false;
      if (current % 4 !== 0) return false;
      if (previous >= SPACING_RATIO_FLOOR_PX && current / previous > MAX_SPACING_STEP_RATIO) return false;
    }
    return true;
  })();

  const ladderKey: keyof typeof SPACING_LADDERS = charter?.density === "dense"
    ? "compact"
    : charter?.density === "airy"
      ? "generous"
      : "standard";

  if (!scaleIsCoherent) {
    const ladder = SPACING_LADDERS[ladderKey];
    record("spacing_scale_rebuilt", "spacing",
      `Authored scale was not a coherent ladder (non-monotonic, off-grid, or a step ratio above ${MAX_SPACING_STEP_RATIO}x). Rebuilt on the ${ladderKey} ladder.`,
      authoredValues.map(formatPx).join("/"),
      ladder.map(formatPx).join("/"));
    if (repairEnabled) {
      next.spacing = Object.fromEntries(SPACING_KEY_ORDER.map((key, index) => [key, formatPx(ladder[index])]));
    }
  }

  const scaleMembers = SPACING_KEY_ORDER
    .map((key) => px((next.spacing as Record<string, unknown> | undefined)?.[key]))
    .filter((value): value is number => value !== null && value > 0);

  // Layout gaps must be drawn from the spacing scale, not invented alongside it.
  if (scaleMembers.length > 0) {
    for (const path of ["mobile_layout.screen_margin", "mobile_layout.section_gap", "mobile_layout.element_gap"] as const) {
      const value = px(readPath(next, path));
      if (value === null) continue;
      if (scaleMembers.includes(value)) continue;
      const snapped = nearest(value, scaleMembers);
      set(path, formatPx(snapped), "layout_gap_snapped",
        `${path.split(".").at(-1)} was not a member of the spacing scale.`);
    }
  }

  // Charter density band for section gap.
  if (charter?.sectionGapRangePx) {
    const [min, max] = charter.sectionGapRangePx;
    const sectionGap = px(readPath(next, "mobile_layout.section_gap"));
    if (sectionGap !== null && (sectionGap < min || sectionGap > max)) {
      const clamped = Math.min(max, Math.max(min, sectionGap));
      const inBandScaleMembers = scaleMembers.filter((member) => member >= min && member <= max);
      const snapped = inBandScaleMembers.length > 0 ? nearest(clamped, inBandScaleMembers) : clamped;
      set("mobile_layout.section_gap", formatPx(snapped), "macro_micro_ratio_clamped",
        `Charter density "${charter.density}" bounds section gap to ${min}-${max}px.`);
    }
  }

  // Macro rhythm must stay legible against micro rhythm. Beyond 2x the page
  // stops reading as one system and starts reading as disconnected islands.
  // An approved charter density band is stronger evidence than this derived
  // ratio: preserve its macro rhythm and raise the micro gap to a scale member
  // instead of silently pushing an airy design below its approved range.
  const elementGap = px(readPath(next, "mobile_layout.element_gap"));
  const sectionGap = px(readPath(next, "mobile_layout.section_gap"));
  if (elementGap !== null && sectionGap !== null && sectionGap > elementGap * 2) {
    const [charterMin, charterMax] = charter?.sectionGapRangePx ?? [null, null];
    const sectionGapIsCharterApproved = charterMin !== null
      && charterMax !== null
      && sectionGap >= charterMin
      && sectionGap <= charterMax;

    if (sectionGapIsCharterApproved) {
      const minimumElementGap = sectionGap / 2;
      const eligibleMicroGaps = scaleMembers.filter((member) =>
        member >= minimumElementGap && member < sectionGap,
      );
      const repairedElementGap = eligibleMicroGaps.length > 0
        ? Math.min(...eligibleMicroGaps)
        : minimumElementGap;
      set("mobile_layout.element_gap", formatPx(repairedElementGap), "macro_micro_ratio_clamped",
        `Section gap ${sectionGap}px is inside the approved ${charterMin}-${charterMax}px charter band; element gap rises to preserve the 2x rhythm ceiling.`);
    } else {
      const clamped = elementGap * 2;
      const snapped = scaleMembers.length > 0 ? nearest(clamped, scaleMembers) : clamped;
      set("mobile_layout.section_gap", formatPx(snapped), "macro_micro_ratio_clamped",
        `Section gap was ${(sectionGap / elementGap).toFixed(1)}x the element gap; the ceiling is 2x.`);
    }
  }

  // -------------------------------------------------------------------------
  // Border weight and divider visibility
  // -------------------------------------------------------------------------
  const borderWidth = px(readPath(next, "border_widths.standard"));
  if (borderWidth !== null && !ALLOWED_BORDER_WIDTHS_PX.includes(borderWidth as (typeof ALLOWED_BORDER_WIDTHS_PX)[number])) {
    set("border_widths.standard", formatPx(nearest(borderWidth, ALLOWED_BORDER_WIDTHS_PX)), "border_width_snapped",
      "Sub-pixel and off-ladder border widths render inconsistently at 1x.");
  }

  const effectiveBorderWidth = px(readPath(next, "border_widths.standard")) ?? 1;
  const divider = parseCssColor(readPath(next, "color.border.divider"));
  if (divider && effectiveBorderWidth <= 1 && divider.alpha < 0.1) {
    const raised = `rgba(${Math.round(divider.r)}, ${Math.round(divider.g)}, ${Math.round(divider.b)}, 0.12)`;
    set("color.border.divider", raised, "divider_alpha_raised",
      `A ${effectiveBorderWidth}px border at ${divider.alpha} alpha is not visible; hairlines need at least 0.10.`);
  }

  // -------------------------------------------------------------------------
  // Typographic scale against the viewport
  // -------------------------------------------------------------------------
  const typography = isRecord(next.typography) ? next.typography : {};
  const roleSize = (role: string) => px(isRecord(typography[role]) ? (typography[role] as Record<string, unknown>).size : undefined);

  const screenTitle = roleSize("screen_title");
  const heroTitle = roleSize("hero_title");

  // A screen title is a screen title, not a poster. 32px is already 8% of the
  // 390px rail; beyond that every screen becomes a title with a footnote.
  if (screenTitle !== null && screenTitle > 32 && charter?.headingClass !== "display") {
    set("typography.screen_title.size", formatPx(32), "type_scale_clamped",
      "Screen titles above 32px do not leave room for content on a 390px frame.");
  }

  const effectiveScreenTitle = roleSize("screen_title") ?? screenTitle;
  if (heroTitle !== null && effectiveScreenTitle !== null && heroTitle > effectiveScreenTitle * 1.9) {
    set("typography.hero_title.size", formatPx(Math.round(effectiveScreenTitle * 1.9)), "type_scale_clamped",
      `Hero was ${(heroTitle / effectiveScreenTitle).toFixed(1)}x the screen title; beyond 1.9x the ladder loses its middle.`);
  }

  for (const [role, [minRatio, maxRatio]] of Object.entries(LINE_HEIGHT_BANDS)) {
    const entry = typography[role];
    if (!isRecord(entry)) continue;
    const size = px(entry.size);
    const lineHeight = px(entry.line_height);
    if (size === null || lineHeight === null || size <= 0) continue;
    const ratio = lineHeight / size;
    if (ratio >= minRatio && ratio <= maxRatio) continue;
    const clamped = Math.min(maxRatio, Math.max(minRatio, ratio));
    set(`typography.${role}.line_height`, formatPx(Math.round(size * clamped)), "line_height_clamped",
      `${role} leading was ${ratio.toFixed(2)}x its size; the band is ${minRatio}-${maxRatio}x.`);
  }

  // A single screen's chrome plus one section of vertical rhythm must not
  // consume the frame before any content exists.
  const safeTop = px(readPath(next, "mobile_layout.safe_area_top")) ?? 16;
  const safeBottom = px(readPath(next, "mobile_layout.safe_area_bottom")) ?? 16;
  const finalSectionGap = px(readPath(next, "mobile_layout.section_gap")) ?? 24;
  const finalHero = roleSize("hero_title") ?? 32;
  const chromeCost = safeTop + safeBottom + finalHero * 1.3 + finalSectionGap * 2;
  if (chromeCost > MOBILE_FRAME_HEIGHT_PX * 0.42) {
    diagnostics.push({
      code: "type_scale_clamped",
      path: "mobile_layout",
      detail: `Header type plus two section gaps consume ${Math.round(chromeCost)}px of the ${MOBILE_FRAME_HEIGHT_PX}px frame before any content.`,
      severity: "warning",
    });
  }

  // -------------------------------------------------------------------------
  // Contrast ramp
  // -------------------------------------------------------------------------
  for (const target of CONTRAST_TARGETS) {
    const rawForeground = readPath(next, target.foreground);
    const rawBackground = readPath(next, target.background);
    if (typeof rawForeground !== "string" || typeof rawBackground !== "string") continue;

    const flattenedBackground = compositeOver(rawBackground, backgroundPrimary) ?? rawBackground;
    const flattenedForeground = compositeOver(rawForeground, flattenedBackground) ?? rawForeground;
    const ratio = contrastRatio(flattenedForeground, flattenedBackground);
    if (ratio === null || ratio >= target.ratio) continue;

    const repaired = ensureContrast(flattenedForeground, flattenedBackground, target.ratio);
    const repairedRatio = repaired ? contrastRatio(repaired, flattenedBackground) ?? 0 : 0;

    if (repaired && repairedRatio >= target.ratio) {
      set(target.foreground, repaired, "text_contrast_repaired",
        `${ratio.toFixed(2)}:1 against ${target.background}${target.note ? ` (${target.note})` : ""}; required ${target.ratio}:1.`);
    } else {
      diagnostics.push({
        code: "text_contrast_unresolved",
        path: target.foreground,
        detail: `${ratio.toFixed(2)}:1 against ${target.background}; could not reach ${target.ratio}:1 without destroying the palette.`,
        severity: "warning",
      });
    }
  }

  return {
    tokens: repairEnabled ? next : tokens,
    report: {
      version: 1,
      repairEnabled,
      charterSource: charter?.source ?? null,
      diagnostics,
    },
  };
}
