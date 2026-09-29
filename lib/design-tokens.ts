import { deltaE2000, hexToLab, mixHex, parseHex, shiftLightness } from "@/lib/color-lab";
import { RADIUS_CLASS_PX, SOFT_SHADOW_MAX_ALPHA } from "@/lib/generation/design-classes";
import type { MeasuredPalette } from "@/lib/generation/reference-palette";
import type { ColorRole } from "@/lib/generation/user-color-roles";
import { capShadow, softShadow } from "@/lib/shadow-css";
import type {
  DesignColorTokens,
  DesignTokenMetadata,
  DesignTokenValues,
  DesignTokens,
  RadiusClass,
  SurfaceElevation,
} from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_APP_RADIUS = "18px";
const DEFAULT_PILL_RADIUS = "9999px";
const DEFAULT_BORDER_WIDTH = "1px";
const DEFAULT_SURFACE_SHADOW = "0 12px 32px rgba(15,23,42,0.14)";
const DEFAULT_OVERLAY_SHADOW = "0 -4px 24px rgba(15,23,42,0.18)";
const DEFAULT_ACTION_GRADIENT_ANGLE = "135deg";
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

const RUNTIME_ONLY_TOKEN_PATHS = new Set([
  "mobile_layout.safe_area_top",
  "mobile_layout.safe_area_bottom",
  "sizing.min_touch_target",
]);

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pickFirstString = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();

const parsePixelValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatPixelValue = (value: number) => `${Math.round(value * 100) / 100}px`;

const normalizeRadiusHierarchy = (value: UnknownRecord) => {
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
  const delta = Math.min(8, Math.max(4, Math.round(app / 3)));
  const derivedInner = app === 0 ? 0 : Math.max(0, app - delta);
  const inner = suppliedInner !== null &&
    suppliedInner >= 0 &&
    (app === 0 ? suppliedInner === 0 : suppliedInner < app)
    ? suppliedInner
    : derivedInner;

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

  if (!recommendedFonts.length) {
    return undefined;
  }

  const next: DesignTokenMetadata = {};

  if (recommendedFonts.length > 0) {
    next.recommendedFonts = recommendedFonts;
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
  const normalizedRadii = normalizeRadiusHierarchy(legacyRadii);

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
      if (!RUNTIME_ONLY_TOKEN_PATHS.has(joinedPath)) {
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

  const next: DesignTokenMetadata = {};

  if (recommendedFonts?.length) {
    next.recommendedFonts = recommendedFonts;
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

export const hasApprovedDesignTokens = (designTokens?: Partial<DesignTokens> | null) => hasNonConstraintTokenValues(designTokens?.tokens);

export const sanitizeApprovedDesignTokens = (
  incoming: Partial<DesignTokens> | null | undefined,
): DesignTokens => {
  const next: DesignTokens = {
    system_schema: typeof incoming?.system_schema === "string" && incoming.system_schema.trim()
      ? incoming.system_schema.trim()
      : "mobile_universal_core",
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

const hexChannels = (value?: string) => {
  const match = value?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split("").map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
};

const relativeLuminance = (channels: number[]) => {
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const contrastRatio = (first: string, second: string) => {
  const a = hexChannels(first);
  const b = hexChannels(second);
  if (!a || !b) return null;
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** Moves a muted foreground toward the strong one until it reaches `minimum` contrast on its surface. */
const legibleOn = (foreground: string | undefined, surfaces: Array<string | undefined>, strong: string | undefined, minimum: number) => {
  const from = hexChannels(foreground);
  const to = hexChannels(strong);
  const backgrounds = surfaces.filter((surface): surface is string => Boolean(hexChannels(surface)));
  if (!foreground || !from || !to || backgrounds.length === 0) return foreground;
  const worst = (candidate: string) => Math.min(...backgrounds.map((surface) => contrastRatio(candidate, surface) ?? 21));
  if (worst(foreground) >= minimum) return foreground;
  for (let step = 1; step <= 20; step += 1) {
    const mixed = `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * (step / 20))
      .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    if (worst(mixed) >= minimum) return mixed;
  }
  return strong;
};

/**
 * Generated palettes sometimes make muted text and inactive navigation icons
 * nearly invisible. Keep them at the 3:1 minimum for UI graphics (WCAG 1.4.11)
 * at generation time; later user edits are respected as written.
 */
export const ensureLegibleGeneratedTokens = (designTokens: DesignTokens): DesignTokens => {
  const color = designTokens.tokens?.color;
  const navigation = designTokens.tokens?.navigation;
  if (!designTokens.tokens || !color) return designTokens;
  const strongText = color.text?.high_emphasis;
  const lowEmphasis = legibleOn(color.text?.low_emphasis, [color.background?.primary, color.surface?.card], strongText, 3);
  const mutedNavigation = navigation
    ? legibleOn(navigation.muted_content, [navigation.surface ?? color.surface?.card], navigation.content ?? strongText, 3)
    : undefined;
  return {
    ...designTokens,
    tokens: {
      ...designTokens.tokens,
      color: { ...color, text: { ...color.text, ...(lowEmphasis ? { low_emphasis: lowEmphasis } : {}) } },
      ...(navigation ? { navigation: { ...navigation, ...(mutedNavigation ? { muted_content: mutedNavigation } : {}) } } : {}),
    },
  };
};

// ---------------------------------------------------------------------------
// Calibration of generated tokens
// ---------------------------------------------------------------------------

/** The founder's rule: up to 24px works best for a card radius when a default is needed. */
export const MAX_APP_RADIUS_PX = 24;
const MIN_INNER_RADIUS_PX = 6;
const MAX_INNER_RADIUS_PX = 16;
const RADIUS_CLASS_RANGE_PX: Record<RadiusClass, [number, number]> = {
  square: [0, 4],
  soft: [6, 10],
  rounded: [12, 16],
  "very-rounded": [18, 24],
};
const SOFT_SHADOW_MAX_BLUR_PX = 16;
const OVERLAY_SHADOW_MAX_ALPHA = 0.16;
const ACTION_SNAP_MAX_DELTA_E = 12;
/** A card sits one tone step above the page; a tile inside it sits one step from the card. */
const TONE_STEP_L = 4;
const TINT_MIX_TOWARD_BACKGROUND = 0.7;
const MAX_TINTS = 4;
const TINT_SOURCE_MIN_DELTA_E = 8;
const TINT_TEXT_MIN_CONTRAST = 4.5;

export type CalibrationEvidence = {
  /** Colours measured from the reference pixels (lib/generation/reference-palette.ts). */
  palette?: MeasuredPalette | null;
  /** What the reference analysis classified. Unknown elevation means no cast shadow. */
  radiusClass?: RadiusClass | null;
  surfaceElevation?: SurfaceElevation | null;
  /** Roles the user named colours for. The palette never overwrites those. */
  userColorRoles?: ReadonlySet<ColorRole> | readonly ColorRole[] | null;
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rgbOf = (hex: string | undefined, fallback: [number, number, number]) => parseHex(hex) ?? fallback;

/** Black or white, whichever reads better on the colour. */
const bestContentOn = (hex: string) =>
  (contrastRatio("#111111", hex) ?? 0) >= (contrastRatio("#FFFFFF", hex) ?? 0) ? "#111111" : "#FFFFFF";

const derivedGradients = (tokens: DesignTokenValues) => ({
  action_primary: buildActionGradient(tokens),
  app_background: `linear-gradient(180deg, ${tokens.color?.background?.primary ?? "#ffffff"} 0%, ${tokens.color?.background?.secondary ?? "#f5f5f5"} 100%)`,
  surface_highlight: `linear-gradient(145deg, ${tokens.color?.surface?.card ?? "#ffffff"} 0%, ${tokens.color?.background?.surface_elevated ?? tokens.color?.background?.secondary ?? "#f5f5f5"} 100%)`,
  accent_ring: buildActionGradient(tokens),
});

const derivedNavigation = (tokens: DesignTokenValues) => ({
  surface: pickFirstString(tokens.color?.surface?.card, "#ffffff"),
  content: pickFirstString(tokens.color?.text?.high_emphasis, "#111827"),
  muted_content: pickFirstString(tokens.color?.text?.low_emphasis, "#94a3b8"),
  active_surface: pickFirstString(tokens.color?.action?.primary, "#111827"),
  active_content: pickFirstString(tokens.color?.action?.on_primary_text, "#ffffff"),
  border: pickFirstString(tokens.color?.border?.divider, "#e5e7eb"),
});

/**
 * Generated tokens drift toward the same clichés: a 32px radius on everything, a
 * blurred shadow on every card, white cards on cream. The drift is corrected in
 * code, the same way ensureLegibleGeneratedTokens corrects contrast, so no
 * later stage has to be told not to copy it.
 *
 * Geometry follows the founder's rules and the reference's classification.
 * Colours come from the measured reference palette for the roles the user did
 * not name. Tokens that merely mirrored a role (the action gradient, the
 * navigation surface) follow it. Only ever call this on generated tokens: a
 * user's own token edits stay as written.
 */
export const calibrateGeneratedTokens = (
  designTokens: DesignTokens,
  evidence: CalibrationEvidence = {},
): DesignTokens => {
  if (!designTokens.tokens) return designTokens;
  const before = designTokens.tokens;
  const tokens = deepClone(before);
  const named = new Set(evidence.userColorRoles ?? []);
  const palette = evidence.palette ?? null;

  // Radius: at most 24px, and inside the reference's class when one was classified.
  const radii = isRecord(tokens.radii) ? { ...tokens.radii } : {};
  let app = parsePixelValue(radii.app) ?? Number.parseFloat(DEFAULT_APP_RADIUS);
  if (evidence.radiusClass) {
    const [low, high] = RADIUS_CLASS_RANGE_PX[evidence.radiusClass];
    if (app < low || app > high) app = RADIUS_CLASS_PX[evidence.radiusClass];
  }
  app = Math.min(app, MAX_APP_RADIUS_PX);
  let inner = parsePixelValue(radii.inner) ?? Math.max(0, app - 6);
  if (app >= 10) inner = clampNumber(inner, MIN_INNER_RADIUS_PX, Math.min(MAX_INNER_RADIUS_PX, app - 4));
  else inner = Math.min(inner, Math.max(0, app - 1));
  tokens.radii = { ...radii, app: formatPixelValue(app), inner: formatPixelValue(inner) };

  // Elevation: flat unless the reference shows a cast shadow.
  const shadows = isRecord(tokens.shadows) ? { ...tokens.shadows } : {};
  const previousSurfaceShadow = pickFirstString(shadows.surface);
  const textRgb = rgbOf(tokens.color?.text?.high_emphasis, [17, 24, 39]);
  let surfaceShadow = "none";
  if (evidence.surfaceElevation === "strong-shadow") {
    surfaceShadow = previousSurfaceShadow ?? "none";
  } else if (evidence.surfaceElevation === "soft-shadow") {
    surfaceShadow = capShadow(previousSurfaceShadow, { maxBlur: SOFT_SHADOW_MAX_BLUR_PX, maxAlpha: SOFT_SHADOW_MAX_ALPHA }) ?? softShadow(textRgb);
  }
  shadows.surface = surfaceShadow;
  shadows.overlay = capShadow(pickFirstString(shadows.overlay), { maxBlur: Number.POSITIVE_INFINITY, maxAlpha: OVERLAY_SHADOW_MAX_ALPHA })
    ?? pickFirstString(shadows.overlay)
    ?? DEFAULT_OVERLAY_SHADOW;
  tokens.shadows = shadows as DesignTokenValues["shadows"];
  if (tokens.navigation) {
    const navigationShadow = pickFirstString(tokens.navigation.shadow);
    tokens.navigation = {
      ...tokens.navigation,
      shadow: navigationShadow === undefined || navigationShadow === previousSurfaceShadow
        ? surfaceShadow
        : capShadow(navigationShadow, { maxBlur: Number.POSITIVE_INFINITY, maxAlpha: OVERLAY_SHADOW_MAX_ALPHA }) ?? navigationShadow,
    };
  }

  if (tokens.color) {
    const color = deepClone(tokens.color) as DesignColorTokens;
    const measured = Boolean(palette) && !named.has("background");

    // The ladder: page, then a card one tone step above it, then an inset one step from the card.
    const page = measured ? palette!.background.hex : color.background?.primary;
    if (page) color.background = { ...color.background, primary: page };
    const darkTheme = palette ? palette.theme === "dark" : (hexToLab(page)?.[0] ?? 100) < 50;
    if (page && !named.has("surface") && palette) {
      const card = measured && palette.raised ? palette.raised.hex : shiftLightness(page, TONE_STEP_L);
      color.surface = { ...color.surface, card };
      color.surface.inset = measured && palette.inset
        ? palette.inset.hex
        : shiftLightness(card, darkTheme ? TONE_STEP_L : -TONE_STEP_L);
    } else if (color.surface?.card && !color.surface.inset) {
      color.surface = { ...color.surface, inset: shiftLightness(color.surface.card, darkTheme ? TONE_STEP_L : -TONE_STEP_L) };
    }

    // The action colour snaps to the nearest measured accent, when it is that close.
    if (palette && !named.has("action") && color.action?.primary) {
      const current = hexToLab(color.action.primary);
      const nearest = current
        ? palette.accents
          .map((accent) => ({ hex: accent.hex, delta: deltaE2000(current, hexToLab(accent.hex) ?? current) }))
          .sort((a, b) => a.delta - b.delta)[0]
        : undefined;
      if (nearest && nearest.delta <= ACTION_SNAP_MAX_DELTA_E && nearest.hex !== color.action.primary) {
        const oldPrimary = color.action.primary;
        color.action = { ...color.action, primary: nearest.hex };
        if (color.action.primary_gradient_start === oldPrimary) color.action.primary_gradient_start = nearest.hex;
        if (color.action.primary_gradient_end === oldPrimary) color.action.primary_gradient_end = nearest.hex;
        if (color.border?.focused === oldPrimary) color.border = { ...color.border, focused: nearest.hex };
      }
    }
    if (color.action?.primary && color.action.on_primary_text
      && (contrastRatio(color.action.on_primary_text, color.action.primary) ?? 21) < TINT_TEXT_MIN_CONTRAST) {
      color.action = { ...color.action, on_primary_text: bestContentOn(color.action.primary) };
    }

    // Accent tints: pastel wells and chips, each an accent mixed most of the way to the page.
    const tintPage = color.background?.primary;
    if (tintPage) {
      const sources: string[] = [];
      const addSource = (hex: string | undefined) => {
        const lab = hexToLab(hex);
        if (!hex || !lab) return;
        if (sources.every((source) => deltaE2000(lab, hexToLab(source) ?? lab) >= TINT_SOURCE_MIN_DELTA_E)) sources.push(hex);
      };
      if (palette && !named.has("action")) palette.accents.forEach((accent) => addSource(accent.hex));
      addSource(color.action?.primary);
      addSource(color.action?.secondary);
      addSource(color.action?.primary_gradient_end);
      const tints: Record<string, string> = {};
      const tintText: Record<string, string> = {};
      sources.slice(0, MAX_TINTS).forEach((source, index) => {
        const tint = mixHex(source, tintPage, TINT_MIX_TOWARD_BACKGROUND);
        const key = String(index + 1);
        tints[key] = tint;
        const preferred = color.text?.high_emphasis ?? "#111111";
        tintText[key] = (contrastRatio(preferred, tint) ?? 0) >= TINT_TEXT_MIN_CONTRAST ? preferred : bestContentOn(tint);
      });
      if (Object.keys(tints).length > 0) {
        color.accent_tints = tints;
        color.accent_tints_text = tintText;
      }
    }
    tokens.color = color;
  }

  // Tokens that only mirrored a role follow it; ones the model set deliberately stay.
  const oldGradients = derivedGradients(before);
  const newGradients = derivedGradients(tokens);
  if (isRecord(tokens.gradients)) {
    const gradients = { ...tokens.gradients } as Record<string, unknown>;
    for (const key of Object.keys(newGradients) as Array<keyof typeof newGradients>) {
      if (gradients[key] === oldGradients[key] && newGradients[key]) gradients[key] = newGradients[key];
    }
    tokens.gradients = gradients as DesignTokenValues["gradients"];
  }
  if (tokens.navigation) {
    const oldNavigation = derivedNavigation(before);
    const newNavigation = derivedNavigation(tokens);
    const navigation = { ...tokens.navigation } as Record<string, unknown>;
    for (const key of Object.keys(newNavigation) as Array<keyof typeof newNavigation>) {
      if (navigation[key] === oldNavigation[key]) navigation[key] = newNavigation[key];
    }
    tokens.navigation = navigation as DesignTokenValues["navigation"];
  }

  return { ...designTokens, tokens };
};
