import type {
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

const sanitizeRationale = (value: unknown): DesignTokenMetadata["rationale"] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([key, entryValue]) => [key, entryValue.trim()]),
  );

  return Object.keys(entries).length > 0
    ? entries as DesignTokenMetadata["rationale"]
    : undefined;
};

const sanitizeMetadata = (value: unknown): DesignTokenMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const recommendedFonts = sanitizeStringArray(value.recommendedFonts);
  const rationale = sanitizeRationale(value.rationale);

  if (!recommendedFonts.length && !rationale) {
    return undefined;
  }

  const next: DesignTokenMetadata = {};

  if (recommendedFonts.length > 0) {
    next.recommendedFonts = recommendedFonts;
  }

  if (rationale) {
    next.rationale = rationale;
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
    app: pickFirstString(
      legacyRadii.app,
      legacyRadii.lg,
      legacyRadii.md,
      legacyRadii.xl,
      legacyRadii.sm,
      legacyRadii.sharp,
      DEFAULT_APP_RADIUS,
    ),
    pill: pickFirstString(
      legacyRadii.pill,
      DEFAULT_PILL_RADIUS,
    ),
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
    none: pickFirstString(legacyShadows.none, "none"),
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
  const rationale = sanitized.rationale
    ? { ...(base.rationale ?? {}), ...sanitized.rationale }
    : base.rationale;

  const next: DesignTokenMetadata = {};

  if (recommendedFonts?.length) {
    next.recommendedFonts = recommendedFonts;
  }

  if (rationale && Object.keys(rationale).length > 0) {
    next.rationale = rationale;
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