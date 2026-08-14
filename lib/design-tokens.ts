import { TOKEN_SCHEMA_V2, classifyTokenPath } from "@/lib/design-token-classification";
import type {
  DesignComponentShapePolicy,
  DesignStylePack,
  DesignTokenMetadata,
  DesignTokenValues,
  DesignTokens,
} from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_APP_RADIUS = "18px";
const DEFAULT_PILL_RADIUS = "9999px";
const DEFAULT_BORDER_WIDTH = "1px";
const DEFAULT_SURFACE_SHADOW = "0 12px 32px rgba(15,23,42,0.14)";
const DEFAULT_OVERLAY_SHADOW = "0 -4px 24px rgba(15,23,42,0.18)";
const DEFAULT_ACTION_GRADIENT_ANGLE = "135deg";
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
const DEFAULT_TYPOGRAPHY = {
  nav_title: { size: "17px", weight: 700, line_height: "22px" },
  screen_title: { size: "24px", weight: 800, line_height: "30px" },
  hero_title: { size: "32px", weight: 800, line_height: "40px" },
  section_title: { size: "18px", weight: 700, line_height: "24px" },
  metric_value: { size: "32px", weight: 800, line_height: "38px" },
  body: { size: "16px", weight: 500, line_height: "24px" },
  supporting: { size: "14px", weight: 400, line_height: "20px" },
  caption: { size: "12px", weight: 600, line_height: "16px" },
  button_label: { size: "15px", weight: 700, line_height: "20px" },
} as const;

const GENERIC_FONT_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "cursive",
  "fantasy",
  "math",
  "emoji",
  "fangsong",
]);

const PLATFORM_CONSTRAINT_TOKENS = {
  mobile_layout: {
    safe_area_top: "16px",
    safe_area_bottom: "16px",
  },
  sizing: {
    min_touch_target: "48px",
  },
} as const;

/**
 * Which paths are runtime constants comes from the classification, not from a
 * second hand-maintained list here. The values above are the constants
 * themselves; `design-token-classification.ts` owns the question of what counts
 * as one, so this file and the editor and the builder prompt cannot disagree.
 */
const isRuntimeOnlyTokenPath = (path: string) => classifyTokenPath(path).klass === "runtime-invariant";

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pickFirstString = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
const pickEnum = <T extends string>(allowed: readonly T[], fallback: T, value: unknown): T =>
  typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;

const parsePixelValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseHex = (value: unknown) => {
  if (typeof value !== "string") return null;
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
};

const relativeLuminance = (value: unknown) => {
  const rgb = parseHex(value);
  if (!rgb) return null;
  const channels = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: unknown, surface: unknown) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const surfaceLuminance = relativeLuminance(surface);
  if (foregroundLuminance === null || surfaceLuminance === null) return null;
  const lighter = Math.max(foregroundLuminance, surfaceLuminance);
  const darker = Math.min(foregroundLuminance, surfaceLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const accessibleForeground = (foreground: string, surface: string, fallback: string) => {
  if ((contrastRatio(foreground, surface) ?? 0) >= 4.5) return foreground;
  if ((contrastRatio(fallback, surface) ?? 0) >= 4.5) return fallback;
  return (contrastRatio("#111827", surface) ?? 0) >= (contrastRatio("#FFFFFF", surface) ?? 0)
    ? "#111827"
    : "#FFFFFF";
};

const statusFallbacks = (dark: boolean) => dark
  ? {
      success: { foreground: "#86EFAC", surface: "#14532D", border: "#166534" },
      warning: { foreground: "#FDE68A", surface: "#78350F", border: "#92400E" },
      danger: { foreground: "#FCA5A5", surface: "#7F1D1D", border: "#991B1B" },
      info: { foreground: "#93C5FD", surface: "#1E3A8A", border: "#1E40AF" },
    }
  : {
      success: { foreground: "#166534", surface: "#DCFCE7", border: "#86EFAC" },
      warning: { foreground: "#92400E", surface: "#FEF3C7", border: "#FCD34D" },
      danger: { foreground: "#991B1B", surface: "#FEE2E2", border: "#FCA5A5" },
      info: { foreground: "#1E40AF", surface: "#DBEAFE", border: "#93C5FD" },
    };

const normalizeStatusColors = (tokens: DesignTokenValues) => {
  const backgroundLuminance = relativeLuminance(tokens.color?.background?.primary);
  const fallback = statusFallbacks(backgroundLuminance !== null && backgroundLuminance < 0.24);
  const incoming = isRecord(tokens.color?.status) ? tokens.color?.status as UnknownRecord : {};
  return Object.fromEntries(Object.entries(fallback).map(([role, defaults]) => {
    const candidate = isRecord(incoming[role]) ? incoming[role] : {};
    const surface = pickFirstString(candidate.surface, defaults.surface) ?? defaults.surface;
    const foreground = pickFirstString(candidate.foreground, defaults.foreground) ?? defaults.foreground;
    return [role, {
      foreground: accessibleForeground(foreground, surface, defaults.foreground),
      surface,
      border: pickFirstString(candidate.border, defaults.border),
    }];
  }));
};

const normalizeShapePolicy = (value: unknown): DesignComponentShapePolicy => {
  if (!isRecord(value)) return deepClone(DEFAULT_SHAPE_POLICY);
  return {
    ...DEFAULT_SHAPE_POLICY,
    primaryCta: value.primaryCta === "pill" ? "pill" : "inner",
    segmentedItem: value.segmentedItem === "pill" ? "pill" : "inner",
    evidenceSource: value.evidenceSource === "user" || value.evidenceSource === "reference" || value.evidenceSource === "design-style"
      ? value.evidenceSource
      : "default",
    rationale: pickFirstString(value.rationale, DEFAULT_SHAPE_POLICY.rationale) ?? DEFAULT_SHAPE_POLICY.rationale,
  };
};

const explicitPillEvidence = (value: string) =>
  /\b(?:pill|capsule)[-\s\w]{0,36}\b(?:button|cta|call to action|primary action)\b|\b(?:button|cta|call to action|primary action)[-\s\w]{0,36}\b(?:pill|capsule)\b/i.test(value);

const explicitSegmentedPillEvidence = (value: string) =>
  /\b(?:pill|capsule)[-\s\w]{0,36}\b(?:segment|segmented|tab)\b|\b(?:segment|segmented|tab)[-\s\w]{0,36}\b(?:pill|capsule)\b/i.test(value);

export const deriveComponentShapePolicy = ({
  prompt = "",
  referenceText = "",
  designStyle,
}: {
  prompt?: string;
  referenceText?: string;
  designStyle?: DesignStylePack | null;
}): DesignComponentShapePolicy => {
  const styleText = [
    ...(designStyle?.componentRecipes ?? []),
    ...(designStyle?.layoutGrammar ?? []),
  ].join(" ");
  const evidence = explicitPillEvidence(prompt)
    ? { source: "user" as const, text: prompt }
    : explicitPillEvidence(referenceText)
      ? { source: "reference" as const, text: referenceText }
      : explicitPillEvidence(styleText)
        ? { source: "design-style" as const, text: styleText }
        : null;
  const segmentedEvidence = explicitSegmentedPillEvidence(`${prompt} ${referenceText} ${styleText}`);
  return {
    ...DEFAULT_SHAPE_POLICY,
    primaryCta: evidence ? "pill" : "inner",
    segmentedItem: segmentedEvidence ? "pill" : "inner",
    evidenceSource: evidence?.source ?? "default",
    rationale: evidence
      ? `Explicit ${evidence.source} evidence links capsule geometry to a primary action.`
      : DEFAULT_SHAPE_POLICY.rationale,
  };
};

const formatPixelValue = (value: number) => `${Math.round(value * 100) / 100}px`;

/**
 * Smallest radius a nested surface may keep. Below this the corner reads as
 * square and the concentric relationship stops being legible.
 */
const MIN_INSET_RADIUS_PX = 4;

/** Spacing steps that a nested surface is realistically inset by. */
const INSET_SPACING_KEYS = ["xxs", "xs", "sm", "md", "lg"] as const;

/**
 * Concentric radius law: a nested surface's radius equals its parent's radius
 * minus the gap between their edges. Two shapes sharing a center only look
 * concentric when their curvature differs by exactly that gap.
 *
 * A single global `radii.inner` cannot satisfy this for more than one padding
 * value, which is why generated screens kept pairing a 32px card with a 16px
 * inset well at 8px padding — the inner curve read visibly tighter than its
 * parent. These derived tokens give the builder one correct value per gap.
 */
export const concentricInsetRadius = (outerRadiusPx: number, gapPx: number) => {
  if (outerRadiusPx <= 0) return 0;
  return Math.max(MIN_INSET_RADIUS_PX, Math.round(outerRadiusPx - gapPx));
};

const buildInsetRadii = (appRadiusPx: number, spacing: UnknownRecord | undefined) => {
  const entries: Array<[string, string]> = [];
  for (const key of INSET_SPACING_KEYS) {
    const gap = parsePixelValue(spacing?.[key]);
    if (gap === null) continue;
    entries.push([`inset_${key}`, formatPixelValue(concentricInsetRadius(appRadiusPx, gap))]);
  }
  return Object.fromEntries(entries);
};

const normalizeRadiusHierarchy = (value: UnknownRecord, standardInsetGapPx: number | null) => {
  const rawApp = pickFirstString(
    value.app,
    value.lg,
    value.md,
    value.xl,
    value.sm,
    value.sharp,
    DEFAULT_APP_RADIUS,
  );
  const parsedApp = parsePixelValue(rawApp);
  const app = Math.min(48, Math.max(0, parsedApp ?? 18));
  const suppliedInner = parsePixelValue(value.inner);
  const suppliedInnerIsSane = suppliedInner !== null
    && suppliedInner >= 0
    && (app === 0 ? suppliedInner === 0 : suppliedInner < app);

  // `inner` means "the radius of a surface nested at the standard component inset".
  // With a known inset the concentric law owns it exactly. Keeping an authored
  // value merely because it was within a small optical tolerance allowed the
  // production 26px / 16px pair to survive even though spacing.xs was 8px and
  // the required inner radius was 18px. A freely chosen inner radius is the
  // single most common source of the "nested corner looks tighter" defect.
  //
  // Without an inset there is nothing to be concentric with, so the original
  // proportional derivation stands and previously stored token sets keep their
  // exact hierarchy.
  const inner = (() => {
    if (app === 0) return 0;
    if (standardInsetGapPx === null) {
      const delta = Math.min(8, Math.max(4, Math.round(app / 3)));
      return suppliedInnerIsSane ? suppliedInner! : Math.max(0, app - delta);
    }
    return concentricInsetRadius(app, standardInsetGapPx);
  })();

  return {
    app: formatPixelValue(app),
    inner: formatPixelValue(inner),
    pill: pickFirstString(value.pill, DEFAULT_PILL_RADIUS) ?? DEFAULT_PILL_RADIUS,
  };
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(trimmed);
  }

  return next;
};

const mergeRecords = (base: UnknownRecord, incoming: unknown): UnknownRecord => {
  if (!isRecord(incoming)) {
    return deepClone(base);
  }

  const result: UnknownRecord = deepClone(base);

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) {
      continue;
    }

    const existing = result[key];
    if (isRecord(existing) && isRecord(value)) {
      result[key] = mergeRecords(existing, value);
      continue;
    }

    result[key] = value;
  }

  return result;
};

const sanitizeStringArray = (value: unknown) => uniqueStrings(
  (Array.isArray(value) ? value : [])
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.replace(/["']/g, "").trim())
    .filter((entry) => entry && !GENERIC_FONT_FAMILIES.has(entry.toLowerCase())),
);

const sanitizeMetadata = (value: unknown): DesignTokenMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const recommendedFonts = sanitizeStringArray(value.recommendedFonts);
  const componentShapePolicy = normalizeShapePolicy(value.componentShapePolicy);

  const next: DesignTokenMetadata = { componentShapePolicy };

  if (recommendedFonts.length > 0) {
    next.recommendedFonts = recommendedFonts;
  }

  // Preserved verbatim: the style charter and its repair report are approved
  // project evidence that the planner and builder read later. Sanitizing them
  // here would silently drop the constraints they exist to carry.
  if (isRecord(value.styleCharter)) {
    next.styleCharter = value.styleCharter as DesignTokenMetadata["styleCharter"];
  }
  if (isRecord(value.tokenRelationships)) {
    next.tokenRelationships = value.tokenRelationships as DesignTokenMetadata["tokenRelationships"];
  }
  if (Array.isArray(value.charterConflicts)) {
    next.charterConflicts = value.charterConflicts.filter((entry): entry is string => typeof entry === "string");
  }

  return next;
};

const pickFirstRecord = (...values: unknown[]) => values.find(isRecord);

const isGradientValue = (value: unknown): value is string =>
  typeof value === "string" && /\b(?:linear|radial|conic)-gradient\(/i.test(value);

const buildActionGradient = (tokens: DesignTokenValues | undefined) => {
  const action = tokens?.color?.action;
  const start = pickFirstString(action?.primary_gradient_start, action?.primary);
  const end = pickFirstString(action?.primary_gradient_end, action?.secondary, action?.primary);

  return start && end ? `linear-gradient(${DEFAULT_ACTION_GRADIENT_ANGLE}, ${start} 0%, ${end} 100%)` : undefined;
};

const normalizeTypography = (value: unknown): DesignTokenValues["typography"] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  // font_family is accepted only as legacy input. Canonical tokens expose
  // explicit heading/body roles so consumers cannot treat one font as universal.
  const legacyFontFamily = pickFirstString(value.font_family);
  const headingFontFamily = pickFirstString(value.heading_font_family, legacyFontFamily);
  const bodyFontFamily = pickFirstString(value.body_font_family, legacyFontFamily);
  const next: NonNullable<DesignTokenValues["typography"]> = {};

  if (headingFontFamily) next.heading_font_family = headingFontFamily;
  if (bodyFontFamily) next.body_font_family = bodyFontFamily;

  const roleSources = {
    nav_title: pickFirstRecord(value.nav_title, value.title_main, DEFAULT_TYPOGRAPHY.nav_title),
    screen_title: pickFirstRecord(value.screen_title, value.title_main, DEFAULT_TYPOGRAPHY.screen_title),
    hero_title: pickFirstRecord(value.hero_title, value.title_large, DEFAULT_TYPOGRAPHY.hero_title),
    section_title: pickFirstRecord(value.section_title, value.title_main, DEFAULT_TYPOGRAPHY.section_title),
    metric_value: pickFirstRecord(value.metric_value, value.title_large, DEFAULT_TYPOGRAPHY.metric_value),
    body: pickFirstRecord(value.body, value.body_primary, DEFAULT_TYPOGRAPHY.body),
    supporting: pickFirstRecord(value.supporting, value.body_secondary, DEFAULT_TYPOGRAPHY.supporting),
    caption: pickFirstRecord(value.caption, DEFAULT_TYPOGRAPHY.caption),
    button_label: pickFirstRecord(value.button_label, DEFAULT_TYPOGRAPHY.button_label),
  };

  for (const [key, source] of Object.entries(roleSources)) {
    (next as UnknownRecord)[key] = deepClone(source);
  }

  return next;
};

const enforcePlatformConstraints = (tokens: DesignTokenValues | undefined) => {
  if (!tokens) {
    return undefined;
  }

  const next = deepClone(tokens);
  const legacyRadii = isRecord(next.radii) ? next.radii : {};
  const legacyBorderWidths = isRecord(next.border_widths) ? next.border_widths : {};
  const legacyShadows = isRecord(next.shadows) ? next.shadows : {};
  const legacyGradients = isRecord(next.gradients) ? next.gradients : {};
  const legacyNavigation = isRecord(next.navigation) ? next.navigation : {};
  const typography = normalizeTypography(next.typography);
  const actionGradient = pickFirstString(
    isGradientValue(legacyGradients.action_primary) ? legacyGradients.action_primary : undefined,
    buildActionGradient(next),
  );
  // `radii.inner` is the standard *component inset* relationship, not the
  // distance between sibling elements. Using `mobile_layout.element_gap` here
  // made a perfectly ordinary 16px outer radius collapse to 4px whenever the
  // page rhythm happened to use a 12px element gap. Components such as
  // segmented controls are usually inset by spacing.xxs/xs (4-8px), while
  // element_gap describes the space *between* those controls. Prefer the
  // canonical xs inset; keep element_gap only as a legacy fallback for token
  // sets that do not carry a spacing scale.
  const standardInsetGapPx = parsePixelValue(next.spacing?.xs)
    ?? parsePixelValue(next.mobile_layout?.element_gap);
  const normalizedRadii = normalizeRadiusHierarchy(legacyRadii, standardInsetGapPx);

  next.mobile_layout = {
    ...(next.mobile_layout ?? {}),
    ...PLATFORM_CONSTRAINT_TOKENS.mobile_layout,
  };
  next.sizing = {
    ...(next.sizing ?? {}),
    ...PLATFORM_CONSTRAINT_TOKENS.sizing,
  };
  next.spacing = {
    none: "0px",
    ...(next.spacing ?? {}),
  };
  next.radii = {
    ...(legacyRadii as DesignTokenValues["radii"]),
    app: normalizedRadii.app,
    inner: normalizedRadii.inner,
    pill: normalizedRadii.pill,
    ...buildInsetRadii(parsePixelValue(normalizedRadii.app) ?? 0, next.spacing),
  };
  next.border_widths = {
    ...(legacyBorderWidths as DesignTokenValues["border_widths"]),
    standard: pickFirstString(
      legacyBorderWidths.standard,
      legacyBorderWidths.thin,
      legacyBorderWidths.hairline,
      legacyBorderWidths.thick,
      DEFAULT_BORDER_WIDTH,
    ),
  };
  next.shadows = {
    ...(legacyShadows as DesignTokenValues["shadows"]),
    none: "none",
    surface: pickFirstString(
      legacyShadows.surface,
      legacyShadows.md,
      legacyShadows.sm,
      legacyShadows.lg,
      DEFAULT_SURFACE_SHADOW,
    ),
    overlay: pickFirstString(
      legacyShadows.overlay,
      legacyShadows.upward,
      legacyShadows.lg,
      legacyShadows.surface,
      legacyShadows.md,
      DEFAULT_OVERLAY_SHADOW,
    ),
  };
  next.navigation = {
    ...(legacyNavigation as DesignTokenValues["navigation"]),
    surface: pickFirstString(legacyNavigation.surface, next.color?.surface?.card, "#ffffff"),
    content: pickFirstString(legacyNavigation.content, next.color?.text?.high_emphasis, "#111827"),
    muted_content: pickFirstString(legacyNavigation.muted_content, next.color?.text?.low_emphasis, "#94a3b8"),
    active_surface: pickFirstString(legacyNavigation.active_surface, next.color?.action?.primary, "#111827"),
    active_content: pickFirstString(legacyNavigation.active_content, next.color?.action?.on_primary_text, "#ffffff"),
    border: pickFirstString(legacyNavigation.border, next.color?.border?.divider, "#e5e7eb"),
    shadow: pickFirstString(legacyNavigation.shadow, legacyShadows.surface, DEFAULT_SURFACE_SHADOW),
    anatomy: pickEnum(["fixed-tab-rail", "floating-dock", "glass-dock", "compact-icon-rail", "center-action-dock"] as const, "floating-dock", legacyNavigation.anatomy),
    width: pickEnum(["content", "inset", "full"] as const, "inset", legacyNavigation.width),
    labels: pickEnum(["always", "active-only", "hidden"] as const, "always", legacyNavigation.labels),
    active_treatment: pickEnum(["icon-fill", "tint", "underline", "compact-chip"] as const, "tint", legacyNavigation.active_treatment),
    surface_material: pickEnum(["solid", "translucent", "glass"] as const, "solid", legacyNavigation.surface_material),
    container_height: pickFirstString(legacyNavigation.container_height, next.sizing?.bottom_nav_height, "68px"),
    max_width: pickFirstString(legacyNavigation.max_width, "356px"),
    safe_area_offset: pickFirstString(legacyNavigation.safe_area_offset, next.mobile_layout?.safe_area_bottom, "16px"),
    horizontal_inset: pickFirstString(legacyNavigation.horizontal_inset, next.mobile_layout?.screen_margin, "16px"),
    horizontal_padding: pickFirstString(legacyNavigation.horizontal_padding, next.spacing?.xs, "8px"),
    vertical_padding: pickFirstString(legacyNavigation.vertical_padding, next.spacing?.xxs, "4px"),
    item_gap: pickFirstString(legacyNavigation.item_gap, next.mobile_layout?.element_gap, "8px"),
    icon_size: pickFirstString(legacyNavigation.icon_size, next.sizing?.icon_standard, "20px"),
    label_size: pickFirstString(legacyNavigation.label_size, next.typography?.caption?.size, "11px"),
    label_weight: pickFirstString(legacyNavigation.label_weight, String(next.typography?.caption?.weight ?? "500")),
    backdrop_blur: pickFirstString(legacyNavigation.backdrop_blur, "0px"),
    active_indicator_width: pickFirstString(legacyNavigation.active_indicator_width, next.sizing?.min_touch_target, "48px"),
    active_indicator_height: pickFirstString(legacyNavigation.active_indicator_height, next.sizing?.min_touch_target, "48px"),
  };
  next.color = {
    ...(next.color ?? {}),
    status: normalizeStatusColors(next),
  };
  if (actionGradient) {
    next.gradients = {
      ...(legacyGradients as DesignTokenValues["gradients"]),
      action_primary: actionGradient,
      app_background: pickFirstString(
        isGradientValue(legacyGradients.app_background) ? legacyGradients.app_background : undefined,
        `linear-gradient(180deg, ${next.color?.background?.primary ?? "#ffffff"} 0%, ${next.color?.background?.secondary ?? "#f5f5f5"} 100%)`,
      ),
      surface_highlight: pickFirstString(
        isGradientValue(legacyGradients.surface_highlight) ? legacyGradients.surface_highlight : undefined,
        `linear-gradient(145deg, ${next.color?.surface?.card ?? "#ffffff"} 0%, ${next.color?.background?.surface_elevated ?? next.color?.background?.secondary ?? "#f5f5f5"} 100%)`,
      ),
      accent_ring: pickFirstString(
        isGradientValue(legacyGradients.accent_ring) ? legacyGradients.accent_ring : undefined,
        actionGradient,
      ),
    };
  }
  if (typography) {
    next.typography = typography;
  }

  return next;
};

const sanitizeTokenValues = (value: unknown): DesignTokenValues | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return enforcePlatformConstraints(deepClone(value) as DesignTokenValues);
};

const hasNonConstraintTokenValues = (value: unknown, path: string[] = []): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    const nextPath = [...path, key];
    const joinedPath = nextPath.join(".");

    if (typeof entryValue === "string" || typeof entryValue === "number") {
      if (!isRuntimeOnlyTokenPath(joinedPath)) {
        return true;
      }
      continue;
    }

    if (hasNonConstraintTokenValues(entryValue, nextPath)) {
      return true;
    }
  }

  return false;
};

const mergeMetadata = (base: DesignTokenMetadata | undefined, incoming: unknown) => {
  if (incoming === undefined) {
    return base;
  }

  const sanitized = sanitizeMetadata(incoming);

  if (!base) {
    return sanitized;
  }

  if (!sanitized) {
    return base;
  }

  const recommendedFonts = sanitized.recommendedFonts ?? base.recommendedFonts;
  const componentShapePolicy = sanitized.componentShapePolicy ?? base.componentShapePolicy;
  const styleCharter = sanitized.styleCharter ?? base.styleCharter;
  const tokenRelationships = sanitized.tokenRelationships ?? base.tokenRelationships;
  const charterConflicts = sanitized.charterConflicts ?? base.charterConflicts;

  const next: DesignTokenMetadata = {};

  if (recommendedFonts?.length) {
    next.recommendedFonts = recommendedFonts;
  }
  if (componentShapePolicy) {
    next.componentShapePolicy = componentShapePolicy;
  }
  if (styleCharter) {
    next.styleCharter = styleCharter;
  }
  if (tokenRelationships) {
    next.tokenRelationships = tokenRelationships;
  }
  if (charterConflicts?.length) {
    next.charterConflicts = charterConflicts;
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

export const hasApprovedDesignTokens = (designTokens?: Partial<DesignTokens> | null) => hasNonConstraintTokenValues(designTokens?.tokens);

export const sanitizeApprovedDesignTokens = (
  incoming: Partial<DesignTokens> | null | undefined,
): DesignTokens => {
  // A stored schema identifier is preserved verbatim so v1 token sets stay v1
  // and keep behaving exactly as they did. Only newly authored sets carry v2,
  // which signals that the token classification applies. Every CSS variable is
  // emitted under both versions, so this changes authoring, never rendering.
  const next: DesignTokens = {
    system_schema: typeof incoming?.system_schema === "string" && incoming.system_schema.trim()
      ? incoming.system_schema.trim()
      : TOKEN_SCHEMA_V2,
  };

  const tokens = sanitizeTokenValues(incoming?.tokens);
  const meta = sanitizeMetadata(incoming?.meta);

  if (tokens) {
    next.tokens = tokens;
  }

  if (meta) {
    next.meta = meta;
  }

  return next;
};

export const mergeApprovedDesignTokens = (
  base: DesignTokens | null | undefined,
  incoming: Partial<DesignTokens> | null | undefined,
): DesignTokens => {
  const result = deepClone(sanitizeApprovedDesignTokens(base));

  if (typeof incoming?.system_schema === "string" && incoming.system_schema.trim()) {
    result.system_schema = incoming.system_schema.trim();
  }

  if (incoming?.tokens !== undefined) {
    const mergedTokens = mergeRecords((result.tokens ?? {}) as UnknownRecord, incoming.tokens);
    result.tokens = enforcePlatformConstraints(mergedTokens as DesignTokenValues);
  }

  const mergedMeta = mergeMetadata(result.meta, incoming?.meta);
  if (mergedMeta) {
    result.meta = mergedMeta;
  } else {
    delete result.meta;
  }

  return result;
};

export const mergeApprovedDesignTokenEdits = (
  base: DesignTokens | null | undefined,
  tokenEdits: Partial<DesignTokenValues>,
) => mergeApprovedDesignTokens(base, { tokens: tokenEdits });

export const normalizeDesignTokens = (incoming: Partial<DesignTokens> | null | undefined) => sanitizeApprovedDesignTokens(incoming);

export const getFontRecommendations = (designTokens?: DesignTokens | null) => sanitizeStringArray(designTokens?.meta?.recommendedFonts);
