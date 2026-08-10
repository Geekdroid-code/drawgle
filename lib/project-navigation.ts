import { indexScreenCode } from "@/lib/generation/block-index";
import { createNavigationArchitecture, resolveScreenChromePolicy, shouldForceImmersiveScreen } from "@/lib/navigation";
import type {
  NavigationArchitecture,
  NavigationDesignContract,
  NavigationPlan,
  NavigationPlanItem,
  ProjectNavigationData,
  ReferenceAnalysis,
  ScreenData,
  ScreenPlan,
  DesignTokens,
} from "@/lib/types";

const LEGACY_MIN_SHARED_NAV_ITEMS = 2;
const PROJECT_NATIVE_MIN_ITEMS = 3;
const MAX_SHARED_NAV_ITEMS = 5;
const MEANINGLESS_LABEL_PATTERN = /^(?:tab|item|menu|page|section|destination)(?:\s*\d+)?$/i;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const slugify = (value: string, fallback: string) => {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || fallback;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

const visualBriefAnatomy = (brief: string): NavigationDesignContract["anatomy"] => {
  if (/center(?:ed)?\s+(?:action|fab)|center-action|sculpted|notch/i.test(brief)) return "center-action-dock";
  if (/glass|frost|blur|translucent/i.test(brief)) return "glass-dock";
  if (/icon-only|icon only|compact icon/i.test(brief)) return "compact-icon-rail";
  if (/full-width|full width|attached|fixed rail|tab rail/i.test(brief)) return "fixed-tab-rail";
  return "floating-dock";
};

export function defaultNavigationDesignContract(visualBrief = ""): NavigationDesignContract {
  const anatomy = visualBriefAnatomy(visualBrief);
  const contracts: Record<NavigationDesignContract["anatomy"], NavigationDesignContract> = {
    "fixed-tab-rail": {
      anatomy: "fixed-tab-rail",
      width: "full",
      labels: "always",
      activeTreatment: "underline",
      surface: "solid",
      radiusPx: 0,
      safeAreaOffsetPx: 4,
      itemGapPx: 0,
      iconSizePx: 20,
      border: true,
      elevation: "none",
      centerActionItemId: null,
    },
    "floating-dock": {
      anatomy: "floating-dock",
      width: "content",
      labels: "always",
      activeTreatment: "icon-fill",
      surface: "solid",
      radiusPx: 28,
      safeAreaOffsetPx: 12,
      itemGapPx: 4,
      iconSizePx: 20,
      border: true,
      elevation: "low",
      centerActionItemId: null,
    },
    "glass-dock": {
      anatomy: "glass-dock",
      width: "inset",
      labels: "active-only",
      activeTreatment: "compact-chip",
      surface: "glass",
      radiusPx: 24,
      safeAreaOffsetPx: 16,
      itemGapPx: 8,
      iconSizePx: 21,
      border: true,
      elevation: "medium",
      centerActionItemId: null,
    },
    "compact-icon-rail": {
      anatomy: "compact-icon-rail",
      width: "content",
      labels: "hidden",
      activeTreatment: "tint",
      surface: "translucent",
      radiusPx: 32,
      safeAreaOffsetPx: 16,
      itemGapPx: 6,
      iconSizePx: 22,
      border: true,
      elevation: "low",
      centerActionItemId: null,
    },
    "center-action-dock": {
      anatomy: "center-action-dock",
      width: "inset",
      labels: "always",
      activeTreatment: "tint",
      surface: "solid",
      radiusPx: 22,
      safeAreaOffsetPx: 14,
      itemGapPx: 4,
      iconSizePx: 20,
      border: true,
      elevation: "medium",
      centerActionItemId: null,
    },
  };

  return contracts[anatomy];
}

const isLegacySchemaExampleDesign = (design: NavigationDesignContract) =>
  design.anatomy === "floating-dock"
  && design.width === "content"
  && design.labels === "always"
  && design.activeTreatment === "icon-fill"
  && design.surface === "solid"
  && design.radiusPx === 28
  && design.safeAreaOffsetPx === 12
  && design.itemGapPx === 4
  && design.iconSizePx === 20
  && design.border === true
  && design.elevation === "low"
  && !design.centerActionItemId;

export function normalizeNavigationDesignContract(
  design: NavigationDesignContract | null | undefined,
  visualBrief = "",
): NavigationDesignContract {
  const fallback = defaultNavigationDesignContract(visualBrief);
  if (!design) return fallback;

  // Early V2 plans frequently echoed the sole JSON example verbatim. When the
  // accompanying brief contains a real anatomy signal, let that evidence win.
  const candidate = isLegacySchemaExampleDesign(design) && fallback.anatomy !== "floating-dock"
    ? fallback
    : design;
  const anatomies = new Set<NavigationDesignContract["anatomy"]>([
    "fixed-tab-rail",
    "floating-dock",
    "glass-dock",
    "compact-icon-rail",
    "center-action-dock",
  ]);
  const widths = new Set<NavigationDesignContract["width"]>(["content", "inset", "full"]);
  const labels = new Set<NavigationDesignContract["labels"]>(["always", "active-only", "hidden"]);
  const activeTreatments = new Set<NavigationDesignContract["activeTreatment"]>(["icon-fill", "tint", "underline", "compact-chip"]);
  const surfaces = new Set<NavigationDesignContract["surface"]>(["solid", "translucent", "glass"]);
  const elevations = new Set<NavigationDesignContract["elevation"]>(["none", "low", "medium"]);

  return {
    anatomy: anatomies.has(candidate.anatomy) ? candidate.anatomy : fallback.anatomy,
    width: widths.has(candidate.width) ? candidate.width : fallback.width,
    labels: labels.has(candidate.labels) ? candidate.labels : fallback.labels,
    activeTreatment: activeTreatments.has(candidate.activeTreatment) ? candidate.activeTreatment : fallback.activeTreatment,
    surface: surfaces.has(candidate.surface) ? candidate.surface : fallback.surface,
    radiusPx: clampNumber(candidate.radiusPx, 0, 36, fallback.radiusPx),
    safeAreaOffsetPx: clampNumber(candidate.safeAreaOffsetPx, 4, 28, fallback.safeAreaOffsetPx),
    itemGapPx: clampNumber(candidate.itemGapPx, 0, 16, fallback.itemGapPx),
    iconSizePx: clampNumber(candidate.iconSizePx, 16, 26, fallback.iconSizePx),
    border: typeof candidate.border === "boolean" ? candidate.border : fallback.border,
    elevation: elevations.has(candidate.elevation) ? candidate.elevation : fallback.elevation,
    centerActionItemId: typeof candidate.centerActionItemId === "string" && candidate.centerActionItemId.trim()
      ? slugify(candidate.centerActionItemId, "")
      : null,
    containerHeightPx: clampNumber(candidate.containerHeightPx, 44, 120, fallback.containerHeightPx ?? 68),
    maxWidthPx: typeof candidate.maxWidthPx === "number" && Number.isFinite(candidate.maxWidthPx)
      ? clampNumber(candidate.maxWidthPx, 160, 390, 320)
      : null,
    horizontalInsetPx: clampNumber(candidate.horizontalInsetPx, 0, 48, fallback.horizontalInsetPx ?? 16),
    horizontalPaddingPx: clampNumber(candidate.horizontalPaddingPx, 0, 32, fallback.horizontalPaddingPx ?? 8),
    verticalPaddingPx: clampNumber(candidate.verticalPaddingPx, 0, 24, fallback.verticalPaddingPx ?? 6),
    labelSizePx: clampNumber(candidate.labelSizePx, 9, 16, fallback.labelSizePx ?? 11),
    labelWeight: clampNumber(candidate.labelWeight, 400, 800, fallback.labelWeight ?? 500),
    blurPx: clampNumber(candidate.blurPx, 0, 40, fallback.blurPx ?? 0),
    borderWidthPx: clampNumber(candidate.borderWidthPx, 0, 4, fallback.borderWidthPx ?? 1),
    itemLayout: candidate.itemLayout === "inline" || candidate.itemLayout === "icon-only" ? candidate.itemLayout : "stacked",
    activeIndicatorWidthPx: typeof candidate.activeIndicatorWidthPx === "number" ? clampNumber(candidate.activeIndicatorWidthPx, 2, 100, 30) : null,
    activeIndicatorHeightPx: typeof candidate.activeIndicatorHeightPx === "number" ? clampNumber(candidate.activeIndicatorHeightPx, 2, 100, 30) : null,
    activeIndicatorRadiusPx: typeof candidate.activeIndicatorRadiusPx === "number" ? clampNumber(candidate.activeIndicatorRadiusPx, 0, 50, 15) : null,
  };
}

const trustedReferenceMeasurement = (referenceAnalysis: ReferenceAnalysis, role: string) => {
  const values = (referenceAnalysis.geometryProfile?.measurements ?? [])
    .filter((measurement) => measurement.role === role && measurement.confidence !== "low" && measurement.sourceLayer === "app-ui")
    .map((measurement) => (measurement.minPx + measurement.maxPx) / 2)
    .sort((left, right) => left - right);
  if (!values.length) return null;
  return Math.round(values[Math.floor(values.length / 2)]);
};

const tokenPx = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
};

export function applyReferenceNavigationAppearance({
  navigationPlan,
  referenceAnalysis,
  curatedNavigationTags = [],
  curatedMaterialTags = [],
  designTokens,
}: {
  navigationPlan: NavigationPlan;
  referenceAnalysis?: ReferenceAnalysis | null;
  curatedNavigationTags?: string[];
  curatedMaterialTags?: string[];
  designTokens?: DesignTokens | null;
}): NavigationPlan {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") return navigationPlan;
  const visualBrief = navigationPlan.visualBrief || "Product-owned navigation.";
  const base = normalizeNavigationDesignContract(navigationPlan.appearance?.primary ?? navigationPlan.design, visualBrief);
  const referenceEvidence = referenceAnalysis?.primaryNavigation;
  const useReference = Boolean(referenceAnalysis && referenceEvidence?.present);
  const useCuratedFallback = !useReference && curatedNavigationTags.length > 0;
  const measured = (role: string, fallback: number) => referenceAnalysis
    ? trustedReferenceMeasurement(referenceAnalysis, role) ?? fallback
    : fallback;
  const structuredPrimary = referenceEvidence?.appearance?.primary;
  const projectNavigationTokens = designTokens?.tokens?.navigation;
  const projectTokenPrimary = projectNavigationTokens ? normalizeNavigationDesignContract({
    ...base,
    anatomy: projectNavigationTokens.anatomy ?? base.anatomy,
    width: projectNavigationTokens.width ?? base.width,
    labels: projectNavigationTokens.labels ?? base.labels,
    activeTreatment: projectNavigationTokens.active_treatment ?? base.activeTreatment,
    surface: projectNavigationTokens.surface_material ?? base.surface,
    containerHeightPx: tokenPx(projectNavigationTokens.container_height) ?? base.containerHeightPx,
    maxWidthPx: tokenPx(projectNavigationTokens.max_width) ?? base.maxWidthPx,
    safeAreaOffsetPx: tokenPx(projectNavigationTokens.safe_area_offset) ?? base.safeAreaOffsetPx,
    horizontalInsetPx: tokenPx(projectNavigationTokens.horizontal_inset) ?? base.horizontalInsetPx,
    horizontalPaddingPx: tokenPx(projectNavigationTokens.horizontal_padding) ?? base.horizontalPaddingPx,
    verticalPaddingPx: tokenPx(projectNavigationTokens.vertical_padding) ?? base.verticalPaddingPx,
    itemGapPx: tokenPx(projectNavigationTokens.item_gap) ?? base.itemGapPx,
    iconSizePx: tokenPx(projectNavigationTokens.icon_size) ?? base.iconSizePx,
    labelSizePx: tokenPx(projectNavigationTokens.label_size) ?? base.labelSizePx,
    labelWeight: Number(projectNavigationTokens.label_weight) || base.labelWeight,
    blurPx: tokenPx(projectNavigationTokens.backdrop_blur) ?? base.blurPx,
    activeIndicatorWidthPx: tokenPx(projectNavigationTokens.active_indicator_width) ?? base.activeIndicatorWidthPx,
    activeIndicatorHeightPx: tokenPx(projectNavigationTokens.active_indicator_height) ?? base.activeIndicatorHeightPx,
  }, visualBrief) : base;
  const curatedAnatomy: NavigationDesignContract["anatomy"] = curatedNavigationTags.some((tag) => /fab/.test(tag))
    ? "center-action-dock"
    : curatedNavigationTags.some((tag) => /fixed-tabs|bottom-tab-bar|bottom-nav-bar/.test(tag))
      ? "fixed-tab-rail"
      : "floating-dock";
  const curatedSurface: NavigationDesignContract["surface"] = curatedMaterialTags.some((tag) => /glass|frost|blur/.test(tag))
    ? "glass"
    : curatedMaterialTags.some((tag) => /translucent/.test(tag)) ? "translucent" : base.surface;
  const primary = useReference && referenceAnalysis && referenceEvidence
    ? normalizeNavigationDesignContract({
        ...base,
        ...(structuredPrimary ?? {}),
        anatomy: referenceEvidence.anatomy ?? structuredPrimary?.anatomy ?? base.anatomy,
        labels: referenceEvidence.labels ?? structuredPrimary?.labels ?? base.labels,
        surface: structuredPrimary?.surface
          ?? (/glass|frost|blur/i.test(`${referenceEvidence.geometry} ${referenceEvidence.elevation}`) ? "glass" : base.surface),
        containerHeightPx: measured("navigation-height", base.containerHeightPx ?? 68),
        horizontalInsetPx: measured("navigation-inset", base.horizontalInsetPx ?? 16),
        safeAreaOffsetPx: measured("navigation-bottom-offset", base.safeAreaOffsetPx),
        iconSizePx: measured("navigation-icon-size", base.iconSizePx),
        maxWidthPx: base.maxWidthPx ?? null,
      }, visualBrief)
    : useCuratedFallback
      ? normalizeNavigationDesignContract({
          ...base,
          anatomy: curatedAnatomy,
          surface: curatedSurface === "glass" && !(base.blurPx && base.blurPx > 0) ? "translucent" : curatedSurface,
        }, visualBrief)
      : projectTokenPrimary;
  const geometryMeasurementFields = referenceAnalysis
    ? (referenceAnalysis.geometryProfile?.measurements ?? [])
        .filter((measurement) => measurement.confidence !== "low" && measurement.sourceLayer === "app-ui" && measurement.role.startsWith("navigation"))
        .map((measurement) => ({
          "navigation-height": "containerHeightPx",
          "navigation-inset": "horizontalInsetPx",
          "navigation-bottom-offset": "safeAreaOffsetPx",
          "navigation-icon-size": "iconSizePx",
        }[measurement.role] ?? measurement.role))
    : [];
  const measuredFields = Array.from(new Set([
    ...(referenceEvidence?.appearance?.measuredFields ?? []),
    ...geometryMeasurementFields,
  ]));
  const safePrimary = primary.surface === "glass" && !(primary.blurPx && primary.blurPx > 0)
    ? { ...primary, surface: "translucent" as const, blurPx: 0 }
    : primary;
  const contextualMeasurement = referenceAnalysis ? {
    heightPx: trustedReferenceMeasurement(referenceAnalysis, "row-height"),
    horizontalInsetPx: trustedReferenceMeasurement(referenceAnalysis, "screen-rail"),
    controlSizePx: trustedReferenceMeasurement(referenceAnalysis, "icon-well-size"),
    controlRadiusPx: trustedReferenceMeasurement(referenceAnalysis, "icon-well-radius"),
    controlGapPx: trustedReferenceMeasurement(referenceAnalysis, "internal-gap"),
    iconSizePx: trustedReferenceMeasurement(referenceAnalysis, "navigation-icon-size"),
  } : null;
  const hasCompleteContextualMeasurement = contextualMeasurement
    && Object.values(contextualMeasurement).every((value) => typeof value === "number");
  const contextualChrome = referenceEvidence?.appearance?.contextualChrome ?? (hasCompleteContextualMeasurement ? {
    heightPx: contextualMeasurement.heightPx!,
    horizontalInsetPx: contextualMeasurement.horizontalInsetPx!,
    controlSizePx: contextualMeasurement.controlSizePx!,
    controlRadiusPx: contextualMeasurement.controlRadiusPx!,
    controlGapPx: contextualMeasurement.controlGapPx!,
    iconSizePx: contextualMeasurement.iconSizePx!,
    titleAlignment: "center" as const,
    surface: "transparent" as const,
    border: true,
    elevation: "none" as const,
  } : null);

  return {
    ...navigationPlan,
    version: 3,
    design: safePrimary,
    appearance: {
      source: useReference || useCuratedFallback ? "reference" : "project-native",
      evidenceSource: useReference ? "structured-reference" : useCuratedFallback ? "curated-catalog" : "project-native",
      evidenceConfidence: useReference
        ? structuredPrimary && measuredFields.length >= 2 ? "high" : "medium"
        : "medium",
      geometryOwner: useReference && measuredFields.length > 0
        ? "reference-measurements"
        : "project-tokens",
      measuredFields,
      primary: safePrimary,
      contextualChrome,
      rationale: useReference
        ? "Product destinations are preserved while visible reference navigation supplies appearance only."
        : useCuratedFallback
          ? "Structured extraction was incomplete; curated tags select coarse anatomy/material while project tokens own every dimension."
        : "No usable reference navigation appearance was visible; project navigation tokens own the native appearance.",
    },
  };
}
const disabledNavigationPlan = (
  screens: ScreenPlan[],
  reason: string,
  source: NavigationPlan["evidence"] extends infer T ? T : never = undefined,
): NavigationPlan => ({
  version: 2,
  decision: "none",
  evidence: source ?? { source: null, reason },
  design: null,
  enabled: false,
  kind: "none",
  items: [],
  visualBrief: "This project does not use persistent primary navigation.",
  screenChrome: screens.map((screen) => ({
    screenName: screen.name,
    chrome: shouldForceImmersiveScreen(screen)
      ? "immersive"
      : screen.type === "root"
        ? "top-bar"
        : "top-bar-back",
    navigationItemId: null,
  })),
});

/**
 * The items the shared shell would actually render, after the V3 rule that a
 * destination must be generated and linked to a real screen.
 */
export function resolveRenderableSharedNavigationItems(navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none" || navigationPlan.items.length < LEGACY_MIN_SHARED_NAV_ITEMS) {
    return [];
  }
  const isV3 = navigationPlan.version === 3 && Boolean(navigationPlan.appearance?.primary);
  const navItems = (isV3
    ? navigationPlan.items.filter((item) => item.availability !== "planned" && Boolean(item.linkedScreenName))
    : navigationPlan.items).slice(0, MAX_SHARED_NAV_ITEMS);
  return navItems.length < LEGACY_MIN_SHARED_NAV_ITEMS ? [] : navItems;
}

/**
 * Whether the renderer will actually produce a shared navigation shell.
 *
 * Persistence must consult this before removing a screen's own navigation.
 * Stripping local navigation while the shell then declines to render is what
 * produced the "nav appears during streaming, disappears after refresh"
 * regression: the canvas showed the raw stream, the saved HTML had the
 * navigation removed, and the deterministic shell had fewer than two eligible
 * destinations to replace it with.
 */
export function willRenderSharedNavigationShell(navigationPlan?: NavigationPlan | null) {
  return Boolean(navigationPlan) && resolveRenderableSharedNavigationItems(navigationPlan!).length > 0;
}

export function renderDeterministicNavigationShell(navigationPlan: NavigationPlan) {
  const navItems = resolveRenderableSharedNavigationItems(navigationPlan);
  if (navItems.length === 0) return "";
  const isV3 = navigationPlan.version === 3 && Boolean(navigationPlan.appearance?.primary);
  const design = normalizeNavigationDesignContract(navigationPlan.appearance?.primary ?? navigationPlan.design, navigationPlan.visualBrief);
  const itemCount = navItems.length;
  const radiusDelta = Math.min(8, Math.max(4, Math.round(design.radiusPx / 3)));
  const innerRadiusPx = design.radiusPx === 0 ? 0 : Math.max(0, design.radiusPx - radiusDelta);
  const overlapBufferPx = isV3 ? Math.max(4, design.safeAreaOffsetPx) : design.anatomy === "center-action-dock" ? 20 : 8;
  const contentWidth = Math.min(356, itemCount * 70 + 32);
  const requestedWidth = design.width === "full"
    ? "100%"
    : design.width === "inset"
      ? "calc(100% - 32px)"
      : `min(${contentWidth}px,calc(100% - 32px))`;
  const centerActionItemId = design.anatomy === "center-action-dock"
    ? design.centerActionItemId ?? navItems[Math.floor(itemCount / 2)]?.id ?? null
    : null;

  const referenceMeasuredFields = new Set(navigationPlan.appearance?.measuredFields ?? []);
  const referenceOwnsGeometryField = (field: string) =>
    navigationPlan.appearance?.geometryOwner === "reference-measurements" && referenceMeasuredFields.has(field);
  const geometryValue = (token: string, field: string, measured: number | null | undefined, fallback: number) =>
    referenceOwnsGeometryField(field) ? `${measured ?? fallback}px` : `var(${token},${measured ?? fallback}px)`;
  const maxWidthValue = referenceOwnsGeometryField("maxWidthPx")
    ? `${design.maxWidthPx ?? contentWidth}px`
    : `var(--dg-navigation-max-width,${design.maxWidthPx ?? contentWidth}px)`;
  const horizontalInsetValue = referenceOwnsGeometryField("horizontalInsetPx")
    ? `${design.horizontalInsetPx ?? 16}px`
    : `var(--dg-navigation-horizontal-inset,${design.horizontalInsetPx ?? 16}px)`;
  const anatomyLayout = isV3 ? {
    key: "contract-driven",
    width: design.width === "full"
      ? "100%"
      : `min(${maxWidthValue},calc(100% - (2 * ${horizontalInsetValue})))`,
    height: geometryValue("--dg-navigation-container-height", "containerHeightPx", design.containerHeightPx, 68),
    margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
    padding: `${geometryValue("--dg-navigation-vertical-padding", "verticalPaddingPx", design.verticalPaddingPx, 6)} ${geometryValue("--dg-navigation-horizontal-padding", "horizontalPaddingPx", design.horizontalPaddingPx, 8)}`,
    radius: referenceOwnsGeometryField("radiusPx") ? `${design.radiusPx}px` : "var(--dg-radii-app)",
    innerDisplay: design.itemLayout === "stacked"
      ? `grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr))`
      : "flex;justify-content:center",
    itemDirection: design.itemLayout === "inline" ? "row" : "column",
    itemPadding: "0",
    iconBox: design.activeIndicatorWidthPx ?? design.iconSizePx,
  } : (() => {
    switch (design.anatomy) {
      case "fixed-tab-rail":
        return {
          key: "attached-edge-rail",
          width: "100%",
          height: "68px",
          margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
          padding: "7px 12px 5px",
          radius: "0",
          innerDisplay: `grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr))`,
          itemDirection: "column",
          itemPadding: "4px 6px",
          iconBox: design.iconSizePx + 6,
        };
      case "glass-dock":
        return {
          key: "inset-glass-ribbon",
          width: design.width === "content" ? requestedWidth : "calc(100% - 40px)",
          height: "66px",
          margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
          padding: "7px",
          radius: `var(--dg-radii-app,${design.radiusPx}px)`,
          innerDisplay: "flex",
          itemDirection: "row",
          itemPadding: "6px 9px",
          iconBox: design.iconSizePx + 6,
        };
      case "compact-icon-rail":
        return {
          key: "compact-icon-capsule",
          width: `min(${Math.min(308, itemCount * 54 + 20)}px,calc(100% - 40px))`,
          height: "58px",
          margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
          padding: "5px",
          radius: "var(--dg-radii-pill,9999px)",
          innerDisplay: "flex;justify-content:center",
          itemDirection: "row",
          itemPadding: "4px",
          iconBox: 42,
        };
      case "center-action-dock":
        return {
          key: "lifted-center-action",
          width: design.width === "content" ? requestedWidth : "calc(100% - 28px)",
          height: "70px",
          margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
          padding: "7px 10px",
          radius: `var(--dg-radii-app,${design.radiusPx}px)`,
          innerDisplay: `grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr))`,
          itemDirection: "column",
          itemPadding: "4px",
          iconBox: design.iconSizePx + 8,
        };
      default:
        return {
          key: "floating-content-dock",
          width: requestedWidth,
          height: "72px",
          margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
          padding: "8px",
          radius: `var(--dg-radii-app,${design.radiusPx}px)`,
          innerDisplay: `grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr))`,
          itemDirection: "column",
          itemPadding: "4px",
          iconBox: design.iconSizePx + 10,
        };
    }
  })();

  const background = design.surface === "glass"
    ? "color-mix(in srgb,var(--dg-navigation-surface,var(--dg-color-surface-card,#fff)) 76%,transparent)"
    : design.surface === "translucent"
      ? "color-mix(in srgb,var(--dg-navigation-surface,var(--dg-color-surface-card,#fff)) 88%,transparent)"
      : "var(--dg-navigation-surface,var(--dg-color-surface-card,#fff))";
  const blurAmount = isV3
    ? geometryValue("--dg-navigation-backdrop-blur", "blurPx", design.blurPx, 0)
    : "18px";
  const blur = design.surface === "glass"
    ? `backdrop-filter:blur(${blurAmount}) saturate(1.15);-webkit-backdrop-filter:blur(${blurAmount}) saturate(1.15);`
    : "";
  const shadow = isV3
    ? "var(--dg-navigation-shadow,var(--dg-shadows-surface))"
    : design.elevation === "medium"
    ? "var(--dg-navigation-shadow,0 14px 34px rgba(15,23,42,.16))"
    : design.elevation === "low"
      ? "var(--dg-navigation-shadow,0 6px 18px rgba(15,23,42,.09))"
      : "none";
  const borderValue = `${isV3 ? geometryValue("--dg-border-widths-standard", "borderWidthPx", design.borderWidthPx, 1) : "1px"} solid color-mix(in srgb,var(--dg-navigation-border,var(--dg-color-border-divider,#e5e7eb)) 72%,transparent)`;
  const borderCss = design.anatomy === "fixed-tab-rail"
    ? `border:0;${design.border ? `border-top:${borderValue};` : ""}`
    : `border:${design.border ? borderValue : "0"};`;
  const labelCss = design.labels === "hidden"
    ? "display:none;"
    : design.labels === "active-only"
      ? "display:none;"
      : "";
  const activeOnlyCss = design.labels === "active-only"
    ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-label{display:block;}"
    : "";
  const activeWidth = isV3 ? geometryValue("--dg-navigation-active-indicator-width", "activeIndicatorWidthPx", design.activeIndicatorWidthPx, 30) : `${design.activeIndicatorWidthPx ?? 30}px`;
  const activeHeight = isV3 ? geometryValue("--dg-navigation-active-indicator-height", "activeIndicatorHeightPx", design.activeIndicatorHeightPx, 30) : `${design.activeIndicatorHeightPx ?? 30}px`;
  const activeRadius = isV3
    ? referenceOwnsGeometryField("activeIndicatorRadiusPx") && design.activeIndicatorRadiusPx !== null && design.activeIndicatorRadiusPx !== undefined
      ? `${design.activeIndicatorRadiusPx}px`
      : "var(--dg-radii-inner)"
    : `${design.activeIndicatorRadiusPx ?? innerRadiusPx}px`;
  const activeCss = design.activeTreatment === "underline"
    ? isV3
      ? `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"]::after{content:"";position:absolute;left:50%;bottom:0;width:${activeWidth};height:${activeHeight};transform:translateX(-50%);border-radius:${activeRadius} ${activeRadius} 0 0;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));}`
      : "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]::after{content:\"\";position:absolute;left:24%;right:24%;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));}"
    : design.activeTreatment === "compact-chip"
      ? `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"]{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));border-radius:${activeRadius};}`
      : design.activeTreatment === "tint"
        ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));background:color-mix(in srgb,var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827)) 10%,transparent);}"
        : `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"] .dg-nav-icon{width:${activeWidth};height:${activeHeight};border-radius:${activeRadius};background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}`;

  const items = navItems.map((item) => {
    const generated = item.availability !== "planned" && Boolean(item.linkedScreenName);
    const id = escapeAttribute(item.id);
    const label = escapeHtml(item.label);
    const icon = escapeAttribute(slugify(item.icon, "circle"));
    const linkedScreen = generated && item.linkedScreenName ? ` data-linked-screen-name="${escapeAttribute(item.linkedScreenName)}"` : "";
    const centerAction = centerActionItemId === item.id;
    return [
      `<button type="button" class="dg-nav-item${centerAction ? " dg-nav-item-center-action" : ""}" data-nav-item-id="${id}" data-nav-availability="${generated ? "generated" : "planned"}" data-active="false" aria-label="${escapeAttribute(item.label)}"${generated ? "" : ' aria-disabled="true" tabindex="-1"'}${linkedScreen}>`,
      `  <span class="dg-nav-icon"><i data-lucide="${icon}"></i></span>`,
      `  <span class="dg-nav-label">${label}</span>`,
      "</button>",
    ].join("\n");
  }).join("\n");

  return [
    `<nav data-drawgle-primary-nav data-navigation-version="${navigationPlan.version ?? 1}" data-navigation-anatomy="${design.anatomy}" data-navigation-layout="${anatomyLayout.key}" data-navigation-clearance-owner="renderer" class="dg-nav-shell" aria-label="Primary navigation">`,
    "<style>",
    `:root{--dg-navigation-visual-height:clamp(64px,var(--dg-sizing-bottom-nav-height,72px),88px);--dg-navigation-anatomy-height:${anatomyLayout.height};--dg-effective-safe-area-bottom:max(env(safe-area-inset-bottom,0px),var(--dg-mobile-layout-safe-area-bottom,0px));--dg-navigation-safe-offset:${isV3 ? geometryValue("--dg-navigation-safe-area-offset", "safeAreaOffsetPx", design.safeAreaOffsetPx, 16) : `${design.safeAreaOffsetPx}px`};--dg-navigation-overlap-buffer:${overlapBufferPx}px;--dg-navigation-clearance:calc(var(--dg-navigation-visual-height) + var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom) + var(--dg-navigation-overlap-buffer));}`,
    `[data-drawgle-primary-nav].dg-nav-shell{box-sizing:border-box;width:${anatomyLayout.width};max-width:100%;min-height:var(--dg-navigation-anatomy-height);margin:${anatomyLayout.margin};padding:${anatomyLayout.padding};border-radius:${anatomyLayout.radius};background:${background};${borderCss}box-shadow:${shadow};${blur}pointer-events:auto;}`,
    `[data-drawgle-primary-nav] .dg-nav-shell-inner{display:${anatomyLayout.innerDisplay};align-items:stretch;gap:${isV3 ? geometryValue("--dg-navigation-item-gap", "itemGapPx", design.itemGapPx, 4) : `${design.itemGapPx}px`};min-height:calc(var(--dg-navigation-anatomy-height) - var(--dg-spacing-xs,8px));}`,
    `[data-drawgle-primary-nav] .dg-nav-item{position:relative;appearance:none;border:0;background:transparent;color:var(--dg-navigation-muted-content,var(--dg-color-text-low-emphasis,#94a3b8));min-width:0;min-height:var(--dg-sizing-min-touch-target,48px);padding:${anatomyLayout.itemPadding};display:flex;flex:1 1 0;flex-direction:${anatomyLayout.itemDirection};align-items:center;justify-content:center;gap:var(--dg-spacing-xxs,4px);border-radius:var(--dg-radii-inner,${innerRadiusPx}px);font-family:var(--dg-typography-body-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:var(--dg-navigation-label-size,11px);line-height:1;font-weight:var(--dg-navigation-label-weight,500);letter-spacing:0;cursor:pointer;}`,
    "[data-drawgle-primary-nav] .dg-nav-item[data-availability=\"planned\"]{cursor:default;}",
    "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));}",
    `[data-drawgle-primary-nav] .dg-nav-icon{display:flex;height:${isV3 ? activeWidth : `${anatomyLayout.iconBox}px`};width:${isV3 ? activeWidth : `${anatomyLayout.iconBox}px`};flex:0 0 ${isV3 ? activeWidth : `${anatomyLayout.iconBox}px`};align-items:center;justify-content:center;border-radius:var(--dg-radii-pill,9999px);background:transparent;color:currentColor;}`,
    `[data-drawgle-primary-nav] .dg-nav-icon svg{height:${isV3 ? geometryValue("--dg-navigation-icon-size", "iconSizePx", design.iconSizePx, 20) : `${design.iconSizePx}px`};width:${isV3 ? geometryValue("--dg-navigation-icon-size", "iconSizePx", design.iconSizePx, 20) : `${design.iconSizePx}px`};stroke-width:2;}`,
    `[data-drawgle-primary-nav] .dg-nav-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;font-size:${isV3 ? geometryValue("--dg-navigation-label-size", "labelSizePx", design.labelSizePx, 11) : "12px"};font-weight:${isV3 ? `var(--dg-navigation-label-weight,${design.labelWeight ?? 500})` : "500"};${labelCss}}`,
    activeOnlyCss,
    activeCss,
    isV3
      ? "[data-drawgle-primary-nav] .dg-nav-item-center-action{transform:translateY(calc(-1 * var(--dg-navigation-vertical-padding,var(--dg-spacing-xs,8px))));overflow:visible;}"
      : "[data-drawgle-primary-nav] .dg-nav-item-center-action{transform:translateY(-14px);overflow:visible;}",
    isV3
      ? `[data-drawgle-primary-nav] .dg-nav-item-center-action .dg-nav-icon{height:${activeHeight};width:${activeWidth};flex-basis:${activeWidth};border:var(--dg-border-widths-standard,1px) solid var(--dg-navigation-surface,var(--dg-color-surface-card,#fff));box-shadow:var(--dg-navigation-shadow,var(--dg-shadows-surface));background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}`
      : "[data-drawgle-primary-nav] .dg-nav-item-center-action .dg-nav-icon{height:48px;width:48px;flex-basis:48px;border:5px solid var(--dg-navigation-surface,var(--dg-color-surface-card,#fff));box-shadow:0 8px 20px rgba(15,23,42,.16);background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}",
    "</style>",
    '<div class="dg-nav-shell-inner">',
    items,
    "</div>",
    "</nav>",
  ].filter(Boolean).join("\n");
}
export function resolveProjectNavigationShell(projectNavigation?: ProjectNavigationData | null) {
  if (!projectNavigation?.plan.enabled) return "";
  if (projectNavigation.plan.version === 2 || projectNavigation.plan.version === 3) {
    return renderDeterministicNavigationShell(projectNavigation.plan);
  }
  return projectNavigation.shellCode ?? "";
}

export function hasSharedNavigation({
  screen,
  projectNavigation,
}: {
  screen: Pick<ScreenData, "chromePolicy" | "navigationItemId">;
  projectNavigation?: ProjectNavigationData | null;
}) {
  return Boolean(
    projectNavigation?.plan.enabled &&
    resolveProjectNavigationShell(projectNavigation) &&
    screen.chromePolicy?.showPrimaryNavigation &&
    screen.navigationItemId,
  );
}

// Kept for V1 callers. V2 deliberately has no fabricated destination fallback.
export function createFallbackNavigationPlan({
  screens,
}: {
  screens: ScreenPlan[];
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
}): NavigationPlan {
  return disabledNavigationPlan(screens, "No positive navigation evidence was provided.");
}

const cleanComparable = (value: string) =>
  value.toLowerCase().replace(/\b(screen|page|tab|view|dashboard)\b/g, "").replace(/[^a-z0-9]/g, "");

const hasStrongReferenceNavigation = (referenceAnalysis?: ReferenceAnalysis | null) => {
  const evidence = referenceAnalysis?.primaryNavigation;
  return Boolean(
    evidence?.present
    && evidence.repeatedAcrossScreens
    && evidence.items.length >= LEGACY_MIN_SHARED_NAV_ITEMS
    && evidence.items.length <= MAX_SHARED_NAV_ITEMS,
  );
};

const referenceScreenForPlan = (
  screen: ScreenPlan,
  screenIndex: number,
  referenceAnalysis: ReferenceAnalysis,
) => referenceAnalysis.screenReferences.find((reference) => {
  const referenceName = cleanComparable(reference.suggestedRole);
  const screenName = cleanComparable(screen.name);
  return referenceName && screenName && (
    referenceName === screenName
    || referenceName.includes(screenName)
    || screenName.includes(referenceName)
  );
}) ?? referenceAnalysis.screenReferences[screenIndex] ?? null;

export function applyReferenceNavigationRolesToScreens(
  screens: ScreenPlan[],
  referenceAnalysis?: ReferenceAnalysis | null,
) {
  if (!referenceAnalysis || !hasStrongReferenceNavigation(referenceAnalysis)) return screens;
  const activeScreenIndexes = new Set(
    referenceAnalysis.primaryNavigation?.activeItemByScreen.map((entry) => entry.screenIndex) ?? [],
  );

  return screens.map((screen, index) => {
    const referenceScreen = referenceScreenForPlan(screen, index, referenceAnalysis);
    if (!referenceScreen || !activeScreenIndexes.has(referenceScreen.index) || shouldForceImmersiveScreen(screen)) {
      return screen;
    }

    return { ...screen, type: "root" as const };
  });
}

export function deriveReferenceNavigationPlan({
  screens,
  referenceAnalysis,
}: {
  screens: ScreenPlan[];
  referenceAnalysis?: ReferenceAnalysis | null;
}): NavigationPlan | null {
  const evidence = referenceAnalysis?.primaryNavigation;
  if (!referenceAnalysis || !evidence || !hasStrongReferenceNavigation(referenceAnalysis)) return null;

  const screenByReferenceIndex = new Map<number, ScreenPlan>();
  screens.forEach((screen, index) => {
    const referenceScreen = referenceScreenForPlan(screen, index, referenceAnalysis);
    if (referenceScreen && screen.type === "root" && !shouldForceImmersiveScreen(screen)) {
      screenByReferenceIndex.set(referenceScreen.index, screen);
    }
  });
  const activeScreenForItem = new Map<number, ScreenPlan>();
  for (const active of evidence.activeItemByScreen) {
    if (!active.itemIndex) continue;
    const screen = screenByReferenceIndex.get(active.screenIndex);
    if (screen) activeScreenForItem.set(active.itemIndex, screen);
  }

  const usedIds = new Set<string>();
  const items = evidence.items.map((item, index) => {
    const label = item.label?.trim() || `Destination ${index + 1}`;
    const baseId = slugify(label, `destination-${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const linkedScreen = activeScreenForItem.get(index + 1) ?? null;
    return {
      id,
      label,
      icon: slugify(item.icon, "circle"),
      role: `${label} primary product destination`,
      availability: linkedScreen ? "generated" as const : "planned" as const,
      linkedScreenName: linkedScreen?.name ?? null,
    };
  });
  const visualBrief = [
    evidence.anatomy,
    evidence.geometry,
    evidence.activeState,
    evidence.elevation,
    evidence.safeAreaRelationship,
  ].filter(Boolean).join(". ");
  const design = defaultNavigationDesignContract(visualBrief);
  design.anatomy = evidence.anatomy ?? design.anatomy;
  design.labels = evidence.labels ?? "hidden";
  design.surface = /glass|frost|blur/i.test(`${evidence.geometry} ${evidence.elevation}`) ? "glass" : design.surface;

  return {
    version: 2,
    decision: "reference-derived",
    evidence: {
      source: "reference",
      reason: "The saved reference DNA shows the same primary navigation across multiple visible screens.",
    },
    design,
    enabled: true,
    kind: "bottom-tabs",
    items,
    visualBrief,
    screenChrome: screens.map((screen) => {
      const item = items.find((candidate) => candidate.linkedScreenName === screen.name);
      return {
        screenName: screen.name,
        chrome: item ? "bottom-tabs" as const : shouldForceImmersiveScreen(screen) ? "immersive" as const : "top-bar-back" as const,
        navigationItemId: item?.id ?? null,
      };
    }),
  };
}

export function normalizeNavigationPlan({
  navigationPlan,
  screens,
  navigationArchitecture,
  strictScreenLinks = true,
}: {
  navigationPlan?: NavigationPlan | null;
  screens: ScreenPlan[];
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
  strictScreenLinks?: boolean;
}): NavigationPlan {
  if (!navigationPlan) {
    return disabledNavigationPlan(screens, "Planner supplied no positive navigation evidence.");
  }

  const isTyped = navigationPlan.version === 2 || navigationPlan.version === 3;
  const decision = isTyped
    ? navigationPlan.decision ?? "none"
    : navigationPlan.enabled
      ? "project-native"
      : "none";
  const evidence = isTyped
    ? navigationPlan.evidence ?? { source: null, reason: "Missing Navigation V2 evidence." }
    : { source: "product-architecture" as const, reason: "Existing V1 project navigation preserved for compatibility." };
  const requestedEnabled = navigationPlan.enabled && decision !== "none" && (!isTyped || Boolean(evidence.source));

  if (!requestedEnabled) {
    return disabledNavigationPlan(screens, evidence.reason, evidence);
  }

  const screenByName = new Map(screens.map((screen) => [screen.name.toLowerCase(), screen]));
  const plannedScreenForItem = new Map<string, ScreenPlan>();
  for (const chrome of navigationPlan.screenChrome ?? []) {
    if (!chrome.navigationItemId) continue;
    const screen = screenByName.get(chrome.screenName.toLowerCase());
    if (screen && screen.type === "root" && !shouldForceImmersiveScreen(screen)) {
      plannedScreenForItem.set(chrome.navigationItemId, screen);
    }
  }

  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const seenRoles = new Set<string>();
  const generatedScreenNames = new Set<string>();
  const normalizedItems: NavigationPlanItem[] = [];
  const meaningfulTerms = (value: string) => new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) =>
        term.length >= 4
        && !["screen", "page", "view", "primary", "destination"].includes(term)),
  );
  const inferScreenForNavigationItem = (label: string, role: string) => {
    const itemTerms = meaningfulTerms(`${label} ${role}`);
    return screens
      .filter((screen) =>
        screen.type === "root"
        && !shouldForceImmersiveScreen(screen)
        && !generatedScreenNames.has(screen.name.toLowerCase()))
      .map((screen) => {
        const screenTerms = meaningfulTerms(`${screen.name} ${screen.description}`);
        let score = 0;
        for (const term of itemTerms) if (screenTerms.has(term)) score += 1;
        return { screen, score };
      })
      .filter(({ score }) => score >= 2)
      .sort((left, right) =>
        right.score - left.score
        || left.screen.name.localeCompare(right.screen.name))[0]?.screen ?? null;
  };

  for (const [index, rawItem] of navigationPlan.items.slice(0, MAX_SHARED_NAV_ITEMS).entries()) {
    const label = (rawItem.label ?? "").trim().slice(0, 18);
    const role = (rawItem.role ?? "").trim().slice(0, 160);
    if (!label || !role || MEANINGLESS_LABEL_PATTERN.test(label)) continue;

    const labelKey = label.toLowerCase();
    const roleKey = role.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenLabels.has(labelKey) || seenRoles.has(roleKey)) continue;

    const baseId = slugify(rawItem.id || label, `destination-${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (seenIds.has(id)) id = `${baseId}-${suffix++}`;

    const rawLinkedName = rawItem.linkedScreenName?.trim() ?? "";
    const comparable = cleanComparable(rawLinkedName);
    const matchedByName = comparable
      ? screens.find((screen) => {
          const candidate = cleanComparable(screen.name);
          return comparable === candidate || candidate.includes(comparable) || comparable.includes(candidate);
        })
      : null;
    const matchedScreen = matchedByName
      ?? plannedScreenForItem.get(rawItem.id)
      ?? inferScreenForNavigationItem(label, role);
    const validGeneratedScreen = matchedScreen &&
      matchedScreen.type === "root" &&
      !shouldForceImmersiveScreen(matchedScreen) &&
      !generatedScreenNames.has(matchedScreen.name.toLowerCase())
      ? matchedScreen
      : null;

    if (!validGeneratedScreen && !isTyped && strictScreenLinks) continue;

    seenIds.add(id);
    seenLabels.add(labelKey);
    seenRoles.add(roleKey);
    if (validGeneratedScreen) generatedScreenNames.add(validGeneratedScreen.name.toLowerCase());

    normalizedItems.push({
      id,
      label,
      icon: slugify(rawItem.icon || "circle", "circle"),
      role,
      availability: validGeneratedScreen ? "generated" : "planned",
      linkedScreenName: validGeneratedScreen?.name ?? null,
    });
  }

  // Term-overlap matching needs two shared meaningful words, which a product
  // whose destinations are named generically ("Home", "Search") never reaches
  // against screens named for their domain ("Sneaker Feed"). The result was a
  // plan where every destination stayed `planned` with a null linkedScreenName,
  // so the V3 shell filtered all of them out and rendered nothing.
  //
  // When matching leaves too few links but eligible root screens exist, link
  // the remaining destinations to them in declared order. Navigation pointing
  // at the right screens in the planner's own order is strictly better than a
  // product with no navigation at all.
  if (generatedScreenNames.size < LEGACY_MIN_SHARED_NAV_ITEMS) {
    const eligibleScreens = screens.filter((screen) =>
      screen.type === "root"
      && !shouldForceImmersiveScreen(screen)
      && !generatedScreenNames.has(screen.name.toLowerCase()));

    if (generatedScreenNames.size + eligibleScreens.length >= LEGACY_MIN_SHARED_NAV_ITEMS) {
      let cursor = 0;
      for (const item of normalizedItems) {
        if (cursor >= eligibleScreens.length) break;
        if (item.availability === "generated") continue;
        const screen = eligibleScreens[cursor++];
        item.availability = "generated";
        item.linkedScreenName = screen.name;
        generatedScreenNames.add(screen.name.toLowerCase());
      }
    }
  }

  const minimumItems = decision === "project-native" && isTyped
    ? PROJECT_NATIVE_MIN_ITEMS
    : LEGACY_MIN_SHARED_NAV_ITEMS;
  const validCount = normalizedItems.length >= minimumItems && normalizedItems.length <= MAX_SHARED_NAV_ITEMS;
  if (!validCount) {
    return disabledNavigationPlan(
      screens,
      `${evidence.reason} Navigation disabled because ${decision} requires ${minimumItems}-${MAX_SHARED_NAV_ITEMS} unique meaningful destinations; received ${normalizedItems.length}.`,
      evidence,
    );
  }

  const itemsById = new Map(normalizedItems.map((item) => [item.id, item]));
  const itemForScreen = (screen: ScreenPlan) => {
    const planned = navigationPlan.screenChrome?.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
    const plannedItem = planned?.navigationItemId ? itemsById.get(planned.navigationItemId) : null;
    if (plannedItem?.availability === "generated" && plannedItem.linkedScreenName?.toLowerCase() === screen.name.toLowerCase()) {
      return plannedItem;
    }
    return normalizedItems.find((item) =>
      item.availability === "generated" && item.linkedScreenName?.toLowerCase() === screen.name.toLowerCase(),
    ) ?? null;
  };

  const visualBrief = navigationPlan.visualBrief?.trim().slice(0, 1600) || "Typed project navigation.";
  return {
    version: navigationPlan.version === 3 ? 3 : isTyped ? 2 : 1,
    decision,
    evidence,
    design: isTyped ? normalizeNavigationDesignContract(navigationPlan.appearance?.primary ?? navigationPlan.design, visualBrief) : navigationPlan.design ?? null,
    appearance: navigationPlan.version === 3 && navigationPlan.appearance
      ? {
          ...navigationPlan.appearance,
          primary: normalizeNavigationDesignContract(navigationPlan.appearance.primary ?? navigationPlan.design, visualBrief),
        }
      : null,
    enabled: true,
    kind: "bottom-tabs",
    items: normalizedItems,
    visualBrief,
    screenChrome: screens.map((screen) => {
      const matchingItem = itemForScreen(screen);
      const forcedImmersive = shouldForceImmersiveScreen(screen);
      const planned = navigationPlan.screenChrome?.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
      const fallbackPolicy = resolveScreenChromePolicy({
        screenPlan: screen,
        navigationArchitecture: createNavigationArchitecture({ navigationArchitecture }),
      });
      const explicitChrome = screen.chromePolicy?.chrome ?? planned?.chrome ?? null;
      const chrome = forcedImmersive
        ? "immersive"
        : explicitChrome && explicitChrome !== "bottom-tabs"
          ? explicitChrome
        : screen.type === "root" && matchingItem
          ? "bottom-tabs"
          : explicitChrome ?? fallbackPolicy.chrome;
      const suppressesNav = chrome !== "bottom-tabs";
      return {
        screenName: screen.name,
        chrome,
        navigationItemId: !suppressesNav && matchingItem ? matchingItem.id : null,
      };
    }),
  };
}

export function applyNavigationPlanToScreens(screens: ScreenPlan[], navigationPlan: NavigationPlan): ScreenPlan[] {
  return screens.map((screen) => {
    const screenChrome = navigationPlan.screenChrome.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
    const existingPolicy = screen.chromePolicy ?? {
      chrome: screenChrome?.chrome ?? (screen.type === "root" ? (navigationPlan.enabled ? "bottom-tabs" : "top-bar") : "top-bar-back"),
      showPrimaryNavigation: Boolean(screenChrome?.navigationItemId),
      showsBackButton: screen.type === "detail" && screenChrome?.chrome !== "modal-sheet",
    };
    const resolvedChrome = screenChrome?.chrome ?? existingPolicy.chrome;
    const showPrimaryNavigation = resolvedChrome === "bottom-tabs" && Boolean(screenChrome?.navigationItemId);
    return {
      ...screen,
      navigationItemId: screenChrome?.navigationItemId ?? null,
      chromePolicy: {
        ...existingPolicy,
        chrome: resolvedChrome,
        showPrimaryNavigation,
        showsBackButton: resolvedChrome === "top-bar-back",
      },
    };
  });
}

export function validateNavigationShell(shellCode: string, navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") return shellCode.trim().length === 0;
  const minimumItems = (navigationPlan.version === 2 || navigationPlan.version === 3) && navigationPlan.decision === "project-native"
    ? PROJECT_NATIVE_MIN_ITEMS
    : LEGACY_MIN_SHARED_NAV_ITEMS;
  if (navigationPlan.items.length < minimumItems || navigationPlan.items.length > MAX_SHARED_NAV_ITEMS) return false;

  const navRootCount = (shellCode.match(/<nav\b[^>]*\bdata-drawgle-primary-nav\b/gi) ?? []).length;
  if (navRootCount !== 1 || /<\/?(?:html|head|body)\b/i.test(shellCode) || /<script\b/i.test(shellCode)) return false;

  const expectedIds = (navigationPlan.version === 3
    ? navigationPlan.items.filter((item) => item.availability !== "planned" && Boolean(item.linkedScreenName))
    : navigationPlan.items).map((item) => item.id);
  const actualIds = Array.from(shellCode.matchAll(/\bdata-nav-item-id\s*=\s*(?:"([^"]+)"|'([^']+)')/gi))
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);
  const expected = new Set(expectedIds);
  const actual = new Set(actualIds);
  return actualIds.length === expectedIds.length &&
    expected.size === actual.size &&
    expectedIds.every((id) => actual.has(id));
}

const summarizeCandidate = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 320);

const PRIMARY_NAV_WORD_PATTERN = /bottom\s+(?:nav|navigation)|tab\s*bar|footer\s*nav|navigation\s+(?:dock|pill|bar|surface|shell)|floating\s+(?:dock|nav|navigation|tab)|dock\s+navigation|shared\s+shell\s+simulation|data-nav-item-id|data-drawgle-primary-nav/i;
const POSITIONED_PATTERN = /\b(?:fixed|sticky|absolute)\b|position\s*:\s*(?:fixed|sticky|absolute)/i;
const BOTTOM_EDGE_PATTERN = /\bbottom-(?:0|px|full|\d+(?:\.\d+)?|\[[^\]]+\])(?=\s|["'])|bottom\s*:/i;

const isBottomPositioned = (value: string) =>
  POSITIONED_PATTERN.test(value) && BOTTOM_EDGE_PATTERN.test(value);

const countNavLikeChildren = (block: string) => {
  const actionCount = (block.match(/<(?:button|a)\b/gi) ?? []).length;
  const iconCount = (block.match(/\bdata-lucide\s*=/gi) ?? []).length + (block.match(/<svg\b/gi) ?? []).length;
  const labelCount = (block.match(/<span\b/gi) ?? []).length + (block.match(/aria-label\s*=/gi) ?? []).length;
  return { actionCount, iconCount, labelCount };
};

const looksLikePrimaryBottomNavigationBlock = (block: string) => {
  const { actionCount, iconCount, labelCount } = countNavLikeChildren(block);
  const explicitNavWords = PRIMARY_NAV_WORD_PATTERN.test(block);
  const looksFixedBottom = isBottomPositioned(block);

  if (explicitNavWords && actionCount >= 2) return true;
  // Geometry alone is deliberately conservative: contextual action bars and
  // positioned control overlays can also contain multiple buttons and labels.
  if (looksFixedBottom && actionCount >= 3 && iconCount >= 3 && labelCount >= 2) return true;
  return false;
};

export function detectLocalNavigationMarkup(code: string) {
  const reasons: string[] = [];
  const candidates: string[] = [];
  const withoutStyles = code.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const push = (reason: string, candidate?: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
    if (candidate) {
      const summary = summarizeCandidate(candidate);
      if (summary && !candidates.includes(summary)) candidates.push(summary);
    }
  };

  if (/\bdata-drawgle-primary-nav\b/i.test(withoutStyles)) push("screen_contains_shared_nav_marker");
  if (/\bdata-nav-item-id\s*=/i.test(withoutStyles)) push("screen_contains_nav_item_ids");

  for (const match of withoutStyles.matchAll(/<(nav|footer)\b[\s\S]*?<\/\1>/gi)) {
    const snippet = match[0];
    const actionCount = (snippet.match(/<(?:button|a)\b/gi) ?? []).length;
    const semanticBottomNav = match[1].toLowerCase() === "nav" &&
      isBottomPositioned(snippet) &&
      actionCount >= 2;
    if (semanticBottomNav || looksLikePrimaryBottomNavigationBlock(snippet)) {
      push(`${match[1].toLowerCase()}_primary_navigation`, snippet);
    }
  }

  for (const block of findBalancedFixedBottomDivBlocks(withoutStyles)) {
    if (looksLikePrimaryBottomNavigationBlock(block)) push("fixed_bottom_nav_cluster", block);
  }

  return { hasLocalNavigation: reasons.length > 0, reasons, candidates };
}

const removeBalancedDivAt = (code: string, start: number) => {
  let depth = 0;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  for (let match = tagPattern.exec(code); match; match = tagPattern.exec(code)) {
    depth += /^<div\b/i.test(match[0]) ? 1 : -1;
    if (depth === 0) {
      const end = tagPattern.lastIndex;
      return { end, block: code.slice(start, end), code: code.slice(0, start) + code.slice(end) };
    }
  }
  return null;
};

const findBalancedFixedBottomDivBlocks = (code: string) => {
  const blocks: string[] = [];
  const openDivPattern = /<div\b[^>]*>/gi;
  for (let match = openDivPattern.exec(code); match; match = openDivPattern.exec(code)) {
    const openTag = match[0];
    if (!isBottomPositioned(openTag)) continue;
    const removed = removeBalancedDivAt(code, match.index);
    if (removed) blocks.push(removed.block);
  }
  return blocks;
};

const removeHighConfidenceFixedBottomNavigationDivs = (code: string) => {
  let next = code;
  const openDivPattern = /<div\b[^>]*>/gi;
  const removals: Array<{ start: number; end: number }> = [];

  for (let match = openDivPattern.exec(next); match; match = openDivPattern.exec(next)) {
    const openTag = match[0];
    if (!isBottomPositioned(openTag)) continue;
    const removed = removeBalancedDivAt(next, match.index);
    if (!removed || !looksLikePrimaryBottomNavigationBlock(removed.block)) continue;
    removals.push({ start: match.index, end: removed.end });
  }

  for (const removal of removals.reverse()) {
    next = next.slice(0, removal.start) + next.slice(removal.end);
  }

  return next;
};

export function sanitizeScreenCodeForSharedNavigation(
  code: string,
  screenPlan: ScreenPlan,
  options: { projectNavigationEnabled?: boolean; navigationPlan?: NavigationPlan | null } = {},
) {
  if (!options.projectNavigationEnabled && !screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) return code;

  // Never remove a screen's own navigation unless the shared shell will really
  // replace it. Enabling navigation is not the same as rendering it: the V3
  // shell drops planned and unlinked destinations, so an "enabled" plan whose
  // destinations are not yet generated renders nothing at all. Stripping in
  // that state leaves the saved screen with no navigation whatsoever.
  if (options.navigationPlan !== undefined && !willRenderSharedNavigationShell(options.navigationPlan)) {
    return code;
  }

  let sanitized = code;
  const commentPattern = /<!--[\s\S]*?(?:floating\s+dock|floating\s+navigation|bottom\s+nav|bottom\s+navigation|navigation\s+(?:dock|pill|bar|surface|shell)|tab\s+bar|dock\s+navigation|shared\s+shell\s+simulation|visual\s+mockup\s+for\s+screen\s+context)[\s\S]*?-->/gi;
  for (const comment of Array.from(sanitized.matchAll(commentPattern)).reverse()) {
    const commentStart = comment.index ?? -1;
    if (commentStart < 0) continue;
    const afterComment = commentStart + comment[0].length;
    const divStart = sanitized.indexOf("<div", afterComment);
    if (divStart < 0) continue;
    const openEnd = sanitized.indexOf(">", divStart);
    if (openEnd < 0 || !isBottomPositioned(sanitized.slice(divStart, openEnd + 1))) continue;
    const removed = removeBalancedDivAt(sanitized, divStart);
    if (removed && looksLikePrimaryBottomNavigationBlock(`${comment[0]}${removed.block}`)) {
      sanitized = sanitized.slice(0, commentStart) + sanitized.slice(removed.end);
    }
  }

  sanitized = sanitized
    .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, (match, tagName: string) => {
      const actionCount = (match.match(/<(?:button|a)\b/gi) ?? []).length;
      const semanticBottomNav = tagName.toLowerCase() === "nav" &&
        isBottomPositioned(match) &&
        actionCount >= 2;
      const highConfidence = semanticBottomNav || looksLikePrimaryBottomNavigationBlock(match);
      return highConfidence ? "" : match;
    });

  sanitized = removeHighConfidenceFixedBottomNavigationDivs(sanitized).trim();

  return sanitized;
}
export function applyNavigationDesignEdit(navigationPlan: NavigationPlan, prompt: string): NavigationPlan {
  if ((navigationPlan.version !== 2 && navigationPlan.version !== 3) || !navigationPlan.enabled) return navigationPlan;

  const normalizedPrompt = prompt.toLowerCase();
  const current = normalizeNavigationDesignContract(navigationPlan.design, navigationPlan.visualBrief);
  const next = { ...current };

  if (/glass|frost|blur/.test(normalizedPrompt)) {
    next.anatomy = "glass-dock";
    next.surface = "glass";
  } else if (/center(?:ed)? action|center fab|notch|sculpted/.test(normalizedPrompt)) {
    next.anatomy = "center-action-dock";
  } else if (/icon[- ]only|compact icon/.test(normalizedPrompt)) {
    next.anatomy = "compact-icon-rail";
    next.labels = "hidden";
  } else if (/fixed tab|tab rail|full[- ]width/.test(normalizedPrompt)) {
    next.anatomy = "fixed-tab-rail";
    next.width = "inset";
  } else if (/floating|dock|pill/.test(normalizedPrompt)) {
    next.anatomy = "floating-dock";
  }

  if (/hide (?:the )?labels|icon[- ]only/.test(normalizedPrompt)) next.labels = "hidden";
  if (/active[- ]only labels?/.test(normalizedPrompt)) next.labels = "active-only";
  if (/show (?:all )?labels|labels always/.test(normalizedPrompt)) next.labels = "always";
  if (/no shadow|remove (?:the )?shadow|flat elevation/.test(normalizedPrompt)) next.elevation = "none";
  if (/stronger shadow|more elevation|medium elevation/.test(normalizedPrompt)) next.elevation = "medium";
  if (/subtle shadow|low elevation/.test(normalizedPrompt)) next.elevation = "low";
  if (/underline active|active underline/.test(normalizedPrompt)) next.activeTreatment = "underline";
  if (/active chip|compact chip/.test(normalizedPrompt)) next.activeTreatment = "compact-chip";
  if (/tint active|active tint/.test(normalizedPrompt)) next.activeTreatment = "tint";
  if (/filled icon|icon fill/.test(normalizedPrompt)) next.activeTreatment = "icon-fill";

  const radiusMatch = normalizedPrompt.match(/(?:radius|corner radius)[^0-9]{0,8}(\d{1,2})/);
  if (radiusMatch) next.radiusPx = clampNumber(Number(radiusMatch[1]), 0, 36, next.radiusPx);

  const renameMatch = prompt.match(/rename\s+["']?([^"']+?)["']?\s+to\s+["']?([^"']+?)["']?(?:\s|$)/i);
  const items = renameMatch
    ? navigationPlan.items.map((item) =>
        item.label.toLowerCase() === renameMatch[1].trim().toLowerCase()
          ? { ...item, label: renameMatch[2].trim().slice(0, 18) || item.label }
          : item,
      )
    : navigationPlan.items;

  return {
    ...navigationPlan,
    design: normalizeNavigationDesignContract(next, navigationPlan.visualBrief),
    appearance: navigationPlan.version === 3 && navigationPlan.appearance
      ? { ...navigationPlan.appearance, primary: normalizeNavigationDesignContract(next, navigationPlan.visualBrief) }
      : navigationPlan.appearance,
    items,
  };
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function parseStoredNavigationPlan(value: unknown): NavigationPlan {
  if (!isRecord(value)) {
    return disabledNavigationPlan([], "Stored navigation plan is missing or invalid.");
  }

  const rawItems = Array.isArray(value.items) ? value.items.filter(isRecord).slice(0, MAX_SHARED_NAV_ITEMS) : [];
  const rawChrome = Array.isArray(value.screenChrome) ? value.screenChrome.filter(isRecord) : [];
  const version = value.version === 3 ? 3 : value.version === 2 ? 2 : 1;
  const decision = value.decision === "project-native" || value.decision === "reference-derived" || value.decision === "none"
    ? value.decision
    : value.enabled === true
      ? "project-native"
      : "none";
  const evidenceRecord = isRecord(value.evidence) ? value.evidence : null;
  const evidenceSource = evidenceRecord?.source === "explicit-prompt" ||
      evidenceRecord?.source === "reference" ||
      evidenceRecord?.source === "product-architecture"
    ? evidenceRecord.source
    : null;
  const items: NavigationPlanItem[] = rawItems.flatMap((item, index) => {
    if (typeof item.label !== "string" || typeof item.role !== "string") return [];
    const linkedScreenName = typeof item.linkedScreenName === "string" && item.linkedScreenName.trim()
      ? item.linkedScreenName.trim()
      : null;
    return [{
      id: slugify(typeof item.id === "string" ? item.id : item.label, `destination-${index + 1}`),
      label: item.label.trim().slice(0, 18),
      icon: slugify(typeof item.icon === "string" ? item.icon : "circle", "circle"),
      role: item.role.trim().slice(0, 160),
      linkedScreenName,
      availability: item.availability === "planned" || !linkedScreenName ? "planned" : "generated",
    }];
  });
  const minimumItems = (version === 2 || version === 3) && decision === "project-native"
    ? PROJECT_NATIVE_MIN_ITEMS
    : LEGACY_MIN_SHARED_NAV_ITEMS;
  const enabled = version === 1
    ? value.enabled === true && items.length > 0
    : value.enabled === true &&
      decision !== "none" &&
      items.length >= minimumItems &&
      items.length <= MAX_SHARED_NAV_ITEMS &&
      Boolean(evidenceSource);

  return {
    version,
    decision: version === 2 || version === 3 ? decision : undefined,
    evidence: version === 2 || version === 3
      ? {
          source: evidenceSource,
          reason: typeof evidenceRecord?.reason === "string" && evidenceRecord.reason.trim()
            ? evidenceRecord.reason.trim().slice(0, 1200)
            : "Stored Navigation V2 evidence was not described.",
        }
      : undefined,
    design: (version === 2 || version === 3) && isRecord(value.design)
      ? normalizeNavigationDesignContract(value.design as unknown as NavigationDesignContract, typeof value.visualBrief === "string" ? value.visualBrief : "")
      : null,
    appearance: version === 3 && isRecord(value.appearance)
      ? {
          source: value.appearance.source === "reference" ? "reference" : "project-native",
          evidenceSource: value.appearance.evidenceSource === "structured-reference"
            || value.appearance.evidenceSource === "curated-catalog"
            || value.appearance.evidenceSource === "project-native"
            ? value.appearance.evidenceSource
            : undefined,
          evidenceConfidence: value.appearance.evidenceConfidence === "high"
            || value.appearance.evidenceConfidence === "medium"
            || value.appearance.evidenceConfidence === "low"
            ? value.appearance.evidenceConfidence
            : undefined,
          geometryOwner: value.appearance.geometryOwner === "reference-measurements"
            ? "reference-measurements"
            : "project-tokens",
          measuredFields: Array.isArray(value.appearance.measuredFields)
            ? value.appearance.measuredFields.filter((item): item is string => typeof item === "string").slice(0, 24)
            : [],
          primary: isRecord(value.appearance.primary)
            ? normalizeNavigationDesignContract(value.appearance.primary as unknown as NavigationDesignContract, typeof value.visualBrief === "string" ? value.visualBrief : "")
            : null,
          contextualChrome: isRecord(value.appearance.contextualChrome)
            ? value.appearance.contextualChrome as unknown as NonNullable<NavigationPlan["appearance"]>["contextualChrome"]
            : null,
          rationale: typeof value.appearance.rationale === "string" ? value.appearance.rationale.slice(0, 1200) : "Stored Navigation V3 appearance.",
        }
      : null,
    enabled,
    kind: enabled ? "bottom-tabs" : "none",
    items: enabled ? items : [],
    visualBrief: typeof value.visualBrief === "string" ? value.visualBrief : "Typed project navigation.",
    screenChrome: rawChrome.flatMap((entry) => {
      if (typeof entry.screenName !== "string" || typeof entry.chrome !== "string") return [];
      return [{
        screenName: entry.screenName,
        chrome: entry.chrome as NavigationPlan["screenChrome"][number]["chrome"],
        navigationItemId: typeof entry.navigationItemId === "string" ? entry.navigationItemId : null,
      }];
    }),
  };
}
export function indexNavigationShell(shellCode: string) {
  return shellCode ? indexScreenCode(shellCode) : null;
}
