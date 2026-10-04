import { indexScreenCode } from "@/lib/generation/block-index";
import { fillKitNavigationBar, kitBarWithBottom, usableKitNavigation } from "@/lib/kit-navigation";
import { createNavigationArchitecture, resolveScreenChromePolicy, shouldForceImmersiveScreen } from "@/lib/navigation";
import type {
  KitNavigation,
  NavigationArchitecture,
  NavigationDesignContract,
  NavigationEvidenceSource,
  NavigationPlan,
  NavigationPlanItem,
  ProjectNavigationData,
  ReferenceAnalysis,
  ScreenData,
  ScreenPlan,
} from "@/lib/types";

const LEGACY_MIN_SHARED_NAV_ITEMS = 2;
const PROJECT_NATIVE_MIN_ITEMS = 3;
const MAX_SHARED_NAV_ITEMS = 5;
/** Top-corner radius of an attached bar the reference draws with rounded corners. */
const ROUNDED_ATTACHED_BAR_RADIUS_PX = 24;

/**
 * A bar the planner chose for a project needs three destinations. One the person approved with the
 * screen flow is what they saw on the approval card, so two peer areas are enough.
 */
export const minimumNavigationItems = (
  decision: NavigationPlan["decision"] | undefined,
  version: NavigationPlan["version"] | undefined,
  source: NavigationEvidenceSource | null | undefined,
) => version === 2 && decision === "project-native" && source !== "approved-scope"
  ? PROJECT_NATIVE_MIN_ITEMS
  : LEGACY_MIN_SHARED_NAV_ITEMS;
const MEANINGLESS_LABEL_PATTERN = /^(?:tab|item|menu|page|section|destination)(?:\s*\d+)?$/i;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const slugify = (value: string, fallback: string) => {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || fallback;
};

/**
 * A Lucide icon name as the runtime looks it up: kebab case. Planners also write the component name ("FileText",
 * "BarChart3"), which lower-cased alone becomes "filetext", an icon that does not exist, so a tab drew nothing.
 */
export const lucideIconName = (value: string | null | undefined, fallback = "circle") =>
  slugify(
    (value ?? "")
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .replace(/([a-zA-Z])(\d)/g, "$1-$2"),
    fallback,
  );

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
  return defaultDesignForAnatomy(visualBriefAnatomy(visualBrief));
}

/** The construction an anatomy starts from: its own width, labels, radius, offset, gaps, border and shadow. */
export function defaultDesignForAnatomy(anatomy: NavigationDesignContract["anatomy"]): NavigationDesignContract {
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
    inactiveTreatment: candidate.inactiveTreatment === "well" ? "well" : "plain",
    // Solid is the default and is left unwritten, so plans made before the option existed are unchanged.
    ...(candidate.activeFill === "gradient" ? { activeFill: "gradient" as const } : {}),
    // The bar the component kit drew, kept only when it can be drawn; plans without one are unchanged.
    ...(usableKitNavigation(candidate.kit) ? { kit: usableKitNavigation(candidate.kit) } : {}),
  };
}

/**
 * The plan with the component kit's bar as the bar every screen shows. A plan without shared navigation, one that
 * already has a kit bar, or a kit bar that cannot be drawn leaves the plan as it is.
 */
export function withKitNavigation(navigationPlan: NavigationPlan, kit: KitNavigation | null | undefined): NavigationPlan {
  const usable = usableKitNavigation(kit);
  if (!usable || !navigationPlan.enabled || navigationPlan.version !== 2 || usableKitNavigation(navigationPlan.design?.kit)) {
    return navigationPlan;
  }
  return {
    ...navigationPlan,
    design: { ...normalizeNavigationDesignContract(navigationPlan.design, navigationPlan.visualBrief), kit: usable },
  };
}

/**
 * Hides the copy of each kit tab that its data-active does not show. An export, which knows its current tab,
 * writes each tab once and leaves this rule out.
 */
export const KIT_TAB_STATE_RULE =
  "[data-drawgle-primary-nav] .dg-nav-kit-item[data-active=\"true\"] > [data-dg-nav-state=\"inactive\"],[data-drawgle-primary-nav] .dg-nav-kit-item:not([data-active=\"true\"]) > [data-dg-nav-state=\"active\"]{display:none !important;}";

/**
 * The kit's bar with the project's tabs. The renderer only places it at the bottom of the screen and owns the
 * space the screen leaves for it; its look is the kit's. Each tab is drawn as the current one and as another, and
 * the canvas shows the right one by the data-active it sets on the tab, as it does for the built-in bars.
 */
function renderKitNavigationShell(
  navigationPlan: NavigationPlan,
  navItems: NavigationPlanItem[],
  design: NavigationDesignContract,
  kit: KitNavigation,
) {
  const tabs = navItems.map((item) => ({
    id: item.id,
    label: item.label,
    icon: lucideIconName(item.icon),
    generated: item.availability !== "planned" && Boolean(item.linkedScreenName),
    linkedScreenName: item.linkedScreenName,
  }));
  return [
    `<nav data-drawgle-primary-nav data-navigation-version="${navigationPlan.version ?? 1}" data-navigation-anatomy="kit" data-navigation-layout="kit-bar" data-navigation-clearance-owner="renderer" class="dg-nav-shell dg-nav-kit" aria-label="Primary navigation">`,
    "<style>",
    `:root{--dg-navigation-visual-height:clamp(64px,var(--dg-sizing-bottom-nav-height,72px),96px);--dg-navigation-anatomy-height:auto;--dg-effective-safe-area-bottom:max(env(safe-area-inset-bottom,0px),var(--dg-mobile-layout-safe-area-bottom,0px));--dg-navigation-safe-offset:${design.safeAreaOffsetPx}px;--dg-navigation-overlap-buffer:12px;--dg-navigation-clearance:calc(var(--dg-navigation-visual-height) + var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom) + var(--dg-navigation-overlap-buffer));}`,
    // No padding of its own: the bar keeps the safe area (kitBarWithBottom), so an attached bar reaches the edge.
    "[data-drawgle-primary-nav].dg-nav-kit{box-sizing:border-box;display:block;width:100%;max-width:100%;margin:0;padding:0;background:transparent;border:0;box-shadow:none;pointer-events:auto;}",
    "[data-drawgle-primary-nav] .dg-nav-kit-item{display:contents;}",
    KIT_TAB_STATE_RULE,
    "[data-drawgle-primary-nav] .dg-nav-kit-item[aria-disabled=\"true\"] > *{cursor:default;}",
    "</style>",
    fillKitNavigationBar({ ...kit, bar: kitBarWithBottom(kit.bar) }, tabs),
    "</nav>",
  ].join("\n");
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

export function renderDeterministicNavigationShell(navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none" || navigationPlan.items.length < LEGACY_MIN_SHARED_NAV_ITEMS) {
    return "";
  }

  const navItems = navigationPlan.items.slice(0, MAX_SHARED_NAV_ITEMS);
  const design = normalizeNavigationDesignContract(navigationPlan.design, navigationPlan.visualBrief);
  if (design.kit) return renderKitNavigationShell(navigationPlan, navItems, design, design.kit);
  const itemCount = navItems.length;
  const radiusDelta = Math.min(8, Math.max(4, Math.round(design.radiusPx / 3)));
  const innerRadiusPx = design.radiusPx === 0 ? 0 : Math.max(0, design.radiusPx - radiusDelta);
  const overlapBufferPx = design.anatomy === "center-action-dock" ? 20 : 8;
  // An attached bar without labels has nothing but its icons: they draw a little larger, each in a circle
  // twice its size, and the bar grows to hold the circle.
  const attachedIconOnly = design.anatomy === "fixed-tab-rail" && design.labels === "hidden";
  const iconGlyphPx = attachedIconOnly ? Math.max(design.iconSizePx, 22) : design.iconSizePx;
  const contentWidth = Math.min(356, itemCount * 70 + 32);
  const requestedWidth = design.width === "full"
    ? "100%"
    : design.width === "inset"
      ? "calc(100% - 32px)"
      : `min(${contentWidth}px,calc(100% - 32px))`;
  const centerActionItemId = design.anatomy === "center-action-dock"
    ? design.centerActionItemId ?? navItems[Math.floor(itemCount / 2)]?.id ?? null
    : null;
  // Active-only labels on a chip is the expanding-capsule pattern: the active
  // destination is a capsule with its icon and label inline, the others are
  // compact round targets. Equal grid cells cannot draw it.
  const capsule = design.labels === "active-only" && design.activeTreatment === "compact-chip"
    && design.anatomy !== "fixed-tab-rail" && design.anatomy !== "center-action-dock";

  const anatomyLayout = capsule ? {
    key: "expanding-capsule",
    width: design.width === "content" ? "fit-content" : design.width === "full" ? "100%" : "calc(100% - 32px)",
    height: "64px",
    margin: "0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom))",
    padding: "8px",
    radius: design.radiusPx >= 24 ? "var(--dg-radii-pill,9999px)" : `var(--dg-radii-app,${design.radiusPx}px)`,
    innerDisplay: `flex;justify-content:${design.width === "content" ? "center" : "space-between"}`,
    itemDirection: "row",
    itemPadding: "0",
    iconBox: 48,
  } : (() => {
    switch (design.anatomy) {
      case "fixed-tab-rail":
        return {
          key: "attached-edge-rail",
          width: "100%",
          height: attachedIconOnly ? `${iconGlyphPx * 2 + 30}px` : "68px",
          // Attached means flush: the bar's surface runs to the bottom edge, and the home indicator's room
          // is padding inside it, as on the device. A gap under it would make it a floating bar.
          margin: "0 auto",
          padding: "7px 12px calc(5px + var(--dg-effective-safe-area-bottom))",
          // Attached to the bottom edge: only the top corners can round, and only when the design says so.
          radius: design.radiusPx > 0 ? `${design.radiusPx}px ${design.radiusPx}px 0 0` : "0",
          innerDisplay: `grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr))`,
          itemDirection: "column",
          itemPadding: "4px 6px",
          iconBox: attachedIconOnly ? iconGlyphPx * 2 : design.iconSizePx + 6,
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
  const blur = design.surface === "glass"
    ? "backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15);"
    : "";
  const shadow = design.elevation === "medium"
    ? "var(--dg-navigation-shadow,0 14px 34px rgba(15,23,42,.16))"
    : design.elevation === "low"
      ? "var(--dg-navigation-shadow,0 6px 18px rgba(15,23,42,.09))"
      : "none";
  const borderValue = "1px solid color-mix(in srgb,var(--dg-navigation-border,var(--dg-color-border-divider,#e5e7eb)) 72%,transparent)";
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
  const capsuleCss = capsule
    ? [
        "[data-drawgle-primary-nav] .dg-nav-item{flex:0 0 auto;width:48px;height:48px;border-radius:var(--dg-radii-pill,9999px);}",
        "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{width:auto;padding:0 18px 0 14px;gap:8px;}",
        "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-icon{height:auto;width:auto;flex-basis:auto;background:transparent;box-shadow:none;}",
        "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-label{max-width:112px;font-size:14px;font-weight:600;line-height:1.1;}",
      ].join("")
    : "";
  const wellCss = design.inactiveTreatment === "well"
    ? "[data-drawgle-primary-nav] .dg-nav-item:not([data-active=\"true\"]) .dg-nav-icon{background:color-mix(in srgb,var(--dg-navigation-muted-content,var(--dg-color-text-low-emphasis,#94a3b8)) 7%,var(--dg-navigation-surface,var(--dg-color-surface-card,#fff)));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dg-navigation-border,var(--dg-color-border-divider,#e5e7eb)) 90%,transparent);}"
    : "";
  // The action gradient the project's tokens define; the solid colour stays underneath as the fallback.
  const gradientFill = design.activeFill === "gradient" ? "background-image:var(--dg-gradient-action-primary);" : "";
  const activeCss = design.activeTreatment === "underline"
    ? `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"]::after{content:"";position:absolute;left:24%;right:24%;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));${gradientFill}}`
    : design.activeTreatment === "compact-chip"
      ? `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"]{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));${gradientFill}color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}`
      : design.activeTreatment === "tint"
        ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));background:color-mix(in srgb,var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827)) 10%,transparent);}"
        : `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"] .dg-nav-icon{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));${gradientFill}color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}`;

  const items = navItems.map((item) => {
    const generated = item.availability !== "planned" && Boolean(item.linkedScreenName);
    const id = escapeAttribute(item.id);
    const label = escapeHtml(item.label);
    const icon = escapeAttribute(lucideIconName(item.icon));
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
    `:root{--dg-navigation-visual-height:clamp(64px,var(--dg-sizing-bottom-nav-height,72px),88px);--dg-navigation-anatomy-height:${anatomyLayout.height};--dg-effective-safe-area-bottom:max(env(safe-area-inset-bottom,0px),var(--dg-mobile-layout-safe-area-bottom,0px));--dg-navigation-safe-offset:${design.safeAreaOffsetPx}px;--dg-navigation-overlap-buffer:${overlapBufferPx}px;--dg-navigation-clearance:calc(var(--dg-navigation-visual-height) + var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom) + var(--dg-navigation-overlap-buffer));}`,
    `[data-drawgle-primary-nav].dg-nav-shell{box-sizing:border-box;width:${anatomyLayout.width};max-width:100%;min-height:var(--dg-navigation-anatomy-height);margin:${anatomyLayout.margin};padding:${anatomyLayout.padding};border-radius:${anatomyLayout.radius};background:${background};${borderCss}box-shadow:${shadow};${blur}pointer-events:auto;}`,
    `[data-drawgle-primary-nav] .dg-nav-shell-inner{display:${anatomyLayout.innerDisplay};align-items:stretch;gap:${design.itemGapPx}px;min-height:calc(var(--dg-navigation-anatomy-height) - 12px);}`,
    `[data-drawgle-primary-nav] .dg-nav-item{position:relative;appearance:none;border:0;background:transparent;color:var(--dg-navigation-muted-content,var(--dg-color-text-low-emphasis,#94a3b8));min-width:0;min-height:var(--dg-sizing-min-touch-target,48px);padding:${anatomyLayout.itemPadding};display:flex;flex:1 1 0;flex-direction:${anatomyLayout.itemDirection};align-items:center;justify-content:center;gap:${anatomyLayout.itemDirection === "row" ? 7 : 3}px;border-radius:var(--dg-radii-inner,${innerRadiusPx}px);font-family:var(--dg-typography-body-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:10px;line-height:1;font-weight:650;letter-spacing:0;cursor:pointer;}`,
    "[data-drawgle-primary-nav] .dg-nav-item[data-availability=\"planned\"]{cursor:default;}",
    "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));}",
    `[data-drawgle-primary-nav] .dg-nav-icon{display:flex;height:${anatomyLayout.iconBox}px;width:${anatomyLayout.iconBox}px;flex:0 0 ${anatomyLayout.iconBox}px;align-items:center;justify-content:center;border-radius:var(--dg-radii-pill,9999px);background:transparent;color:currentColor;}`,
    `[data-drawgle-primary-nav] .dg-nav-icon svg{height:${iconGlyphPx}px;width:${iconGlyphPx}px;stroke-width:2;}`,
    `[data-drawgle-primary-nav] .dg-nav-label{max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;${labelCss}}`,
    activeOnlyCss,
    activeCss,
    capsuleCss,
    wellCss,
    "[data-drawgle-primary-nav] .dg-nav-item-center-action{transform:translateY(-14px);overflow:visible;}",
    `[data-drawgle-primary-nav] .dg-nav-item-center-action .dg-nav-icon{height:48px;width:48px;flex-basis:48px;border:5px solid var(--dg-navigation-surface,var(--dg-color-surface-card,#fff));box-shadow:0 8px 20px rgba(15,23,42,.16);background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));${gradientFill}color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}`,
    "</style>",
    '<div class="dg-nav-shell-inner">',
    items,
    "</div>",
    "</nav>",
  ].filter(Boolean).join("\n");
}
export function resolveProjectNavigationShell(projectNavigation?: ProjectNavigationData | null) {
  if (!projectNavigation?.plan.enabled) return "";
  if (projectNavigation.plan.version === 2) {
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

/**
 * A reference's visible navigation decides how the shared navigation is
 * built; the product still decides its destinations. Used for style
 * references, whose navigation is craft evidence rather than architecture.
 */
export function applyReferenceNavigationStyle(
  navigationPlan: NavigationPlan,
  evidence?: ReferenceAnalysis["primaryNavigation"],
): NavigationPlan {
  if (!navigationPlan.enabled || !evidence?.present) return navigationPlan;
  const planned = normalizeNavigationDesignContract(navigationPlan.design, navigationPlan.visualBrief);
  const observed = [evidence.geometry, evidence.activeState, evidence.elevation].join(". ");
  const anatomy = evidence.anatomy ?? planned.anatomy;
  // The planner tuned its safe-area offset, gaps, icon size, border and shadow for the anatomy it chose. When
  // the reference is built another way, those are the new anatomy's to set: a dock's offset would float an
  // attached bar above the bottom edge.
  const base = anatomy === planned.anatomy ? planned : { ...planned, ...defaultDesignForAnatomy(anatomy) };
  // Corners are only observable on an attached bar, whose top corners round or stay square. Every other
  // anatomy is drawn with its own radius, so a bar's corners never override a dock's.
  const attachedRadiusPx = anatomy !== "fixed-tab-rail" || !evidence.corners
    ? base.radiusPx
    : evidence.corners === "rounded" ? ROUNDED_ATTACHED_BAR_RADIUS_PX : 0;
  const activeFill = evidence.activeFill ?? base.activeFill;
  const design: NavigationDesignContract = {
    ...base,
    anatomy,
    labels: evidence.labels ?? base.labels,
    activeTreatment: evidence.activeTreatment ?? base.activeTreatment,
    inactiveTreatment: evidence.inactiveTreatment ?? base.inactiveTreatment,
    width: evidence.width ?? base.width,
    surface: evidence.material ?? base.surface,
    radiusPx: attachedRadiusPx,
    ...(activeFill ? { activeFill } : {}),
    centerActionItemId: evidence.anatomy === "center-action-dock" ? base.centerActionItemId : null,
  };
  return {
    ...navigationPlan,
    design: normalizeNavigationDesignContract(design, navigationPlan.visualBrief),
    visualBrief: `Built like the reference navigation: ${observed}`.slice(0, 600),
  };
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
      icon: lucideIconName(item.icon),
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

  const isV2 = navigationPlan.version === 2;
  const decision = isV2
    ? navigationPlan.decision ?? "none"
    : navigationPlan.enabled
      ? "project-native"
      : "none";
  const evidence = isV2
    ? navigationPlan.evidence ?? { source: null, reason: "Missing Navigation V2 evidence." }
    : { source: "product-architecture" as const, reason: "Existing V1 project navigation preserved for compatibility." };
  const requestedEnabled = navigationPlan.enabled && decision !== "none" && (!isV2 || Boolean(evidence.source));

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
  // The screens tabs name as theirs. A tab whose own screen is not in this batch is never given one of these by a
  // guess: "Drops" once took "Release Calendar", which the Calendar tab names, and Calendar was left with nothing.
  const namedByTabs = navigationPlan.items
    .map((item) => ({ id: item.id, comparable: cleanComparable(item.linkedScreenName?.trim() ?? "") }))
    .filter((entry) => entry.comparable);
  const namedByAnotherTab = (screen: ScreenPlan, itemId: string) => {
    const comparable = cleanComparable(screen.name);
    return namedByTabs.some((entry) => entry.id !== itemId && entry.comparable === comparable);
  };
  const inferScreenForNavigationItem = (label: string, role: string, itemId: string) => {
    const itemTerms = meaningfulTerms(`${label} ${role}`);
    return screens
      .filter((screen) =>
        screen.type === "root"
        && !shouldForceImmersiveScreen(screen)
        && !generatedScreenNames.has(screen.name.toLowerCase())
        && !namedByAnotherTab(screen, itemId))
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
    const plannedScreen = plannedScreenForItem.get(rawItem.id);
    // A later batch of a product is checked against its own screens, but a tab that already opens a screen built
    // in an earlier batch still opens it, and is not guessed another one: without this, Home turned "planned" once
    // the other tabs' screens were built, and "Drops" was guessed onto the Calendar tab's screen.
    const earlierLink = !matchedByName && !plannedScreen && !strictScreenLinks && rawItem.availability === "generated"
      && rawLinkedName && !generatedScreenNames.has(rawLinkedName.toLowerCase())
      ? rawLinkedName
      : null;
    const matchedScreen = matchedByName
      ?? plannedScreen
      ?? (earlierLink ? null : inferScreenForNavigationItem(label, role, rawItem.id));
    const validGeneratedScreen = matchedScreen &&
      matchedScreen.type === "root" &&
      !shouldForceImmersiveScreen(matchedScreen) &&
      !generatedScreenNames.has(matchedScreen.name.toLowerCase())
      ? matchedScreen
      : null;
    const linkedScreenName = validGeneratedScreen?.name ?? earlierLink;

    if (!linkedScreenName && !isV2 && strictScreenLinks) continue;

    seenIds.add(id);
    seenLabels.add(labelKey);
    seenRoles.add(roleKey);
    if (linkedScreenName) generatedScreenNames.add(linkedScreenName.toLowerCase());

    normalizedItems.push({
      id,
      label,
      icon: lucideIconName(rawItem.icon),
      role,
      availability: linkedScreenName ? "generated" : "planned",
      linkedScreenName,
    });
  }

  const minimumItems = minimumNavigationItems(decision, isV2 ? 2 : 1, evidence.source);
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
    version: isV2 ? 2 : 1,
    decision,
    evidence,
    design: isV2 ? normalizeNavigationDesignContract(navigationPlan.design, visualBrief) : navigationPlan.design ?? null,
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
      const chrome = forcedImmersive
        ? "immersive"
        : screen.type === "root" && matchingItem
          ? "bottom-tabs"
          : planned?.chrome ?? fallbackPolicy.chrome;
      const suppressesNav = chrome === "immersive" || chrome === "modal-sheet";
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
    return {
      ...screen,
      navigationItemId: screenChrome?.navigationItemId ?? null,
      chromePolicy: {
        ...existingPolicy,
        chrome: screenChrome?.chrome ?? existingPolicy.chrome,
        showPrimaryNavigation: Boolean(screenChrome?.navigationItemId),
      },
    };
  });
}

export function validateNavigationShell(shellCode: string, navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") return shellCode.trim().length === 0;
  const minimumItems = minimumNavigationItems(navigationPlan.decision, navigationPlan.version, navigationPlan.evidence?.source);
  if (navigationPlan.items.length < minimumItems || navigationPlan.items.length > MAX_SHARED_NAV_ITEMS) return false;

  const navRootCount = (shellCode.match(/<nav\b[^>]*\bdata-drawgle-primary-nav\b/gi) ?? []).length;
  if (navRootCount !== 1 || /<\/?(?:html|head|body)\b/i.test(shellCode) || /<script\b/i.test(shellCode)) return false;

  const expectedIds = navigationPlan.items.map((item) => item.id);
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

const PRIMARY_NAV_WORD_PATTERN = /bottom\s+(?:nav|navigation)|tab\s*bar|footer\s*nav|navigation\s+(?:dock|pill|bar|surface|shell)|floating\s+(?:dock|nav|navigation|tab)|dock\s+navigation|shared\s+shell\s+simulation|data-nav-item-id|data-drawgle-primary-nav|data-dg-nav\s*=\s*["']bar["']/i;
const POSITIONED_PATTERN = /\b(?:fixed|sticky|absolute)\b|position\s*:\s*(?:fixed|sticky|absolute)/i;
const BOTTOM_EDGE_PATTERN = /\bbottom-(?:0|px|full|\d+(?:\.\d+)?|\[[^\]]+\])(?=\s|["'])|bottom\s*:/i;

const isBottomPositioned = (value: string) =>
  POSITIONED_PATTERN.test(value) && BOTTOM_EDGE_PATTERN.test(value);
const isMarkedNavigationRoot = (value: string) =>
  /\bdata-drawgle-primary-nav\b|\bdata-dg-nav\s*=\s*["']bar["']/i.test(value);

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
    if (!isBottomPositioned(openTag) && !isMarkedNavigationRoot(openTag)) continue;
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
    if (!isBottomPositioned(openTag) && !isMarkedNavigationRoot(openTag)) continue;
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
  options: { projectNavigationEnabled?: boolean } = {},
) {
  if (!options.projectNavigationEnabled && !screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) return code;

  let sanitized = code;
  // One comment at a time: a body that may not run past its own "-->". Unbounded, the pattern ran from a screen's
  // first comment to a later one that mentioned the bottom nav, and the whole screen was taken for that comment.
  const commentPattern = /<!--(?:(?!-->)[\s\S])*?(?:floating\s+dock|floating\s+navigation|bottom\s+nav|bottom\s+navigation|navigation\s+(?:dock|pill|bar|surface|shell)|tab\s+bar|dock\s+navigation|shared\s+shell\s+simulation|visual\s+mockup\s+for\s+screen\s+context)(?:(?!-->)[\s\S])*?-->/gi;
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

  // A screen's own tab bar is a small part of it. A removal that would take most of the screen has mistaken the
  // screen for a bar, so the screen is kept as the builder wrote it.
  return removesMostOfTheScreen(code, sanitized) ? code.trim() : sanitized;
}

const elementCount = (code: string) => (code.match(/<[a-z][a-z0-9-]*\b/gi) ?? []).length;

/** Whether cleaning a screen's code left less than half of its elements (out of a screen of more than a few). */
export const removesMostOfTheScreen = (before: string, after: string) => {
  const total = elementCount(before);
  return total >= 12 && elementCount(after) < total * 0.5;
};
export function applyNavigationDesignEdit(navigationPlan: NavigationPlan, prompt: string): NavigationPlan {
  if (navigationPlan.version !== 2 || !navigationPlan.enabled) return navigationPlan;

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
  // An edit to how the bar looks is drawn by the built-in bars, which the edit describes, instead of the kit's.
  const looksChanged = (Object.keys(next) as Array<keyof NavigationDesignContract>)
    .some((key) => key !== "kit" && next[key] !== current[key]);
  if (looksChanged) delete next.kit;

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
  const version = value.version === 2 ? 2 : 1;
  const decision = value.decision === "project-native" || value.decision === "reference-derived" || value.decision === "none"
    ? value.decision
    : value.enabled === true
      ? "project-native"
      : "none";
  const evidenceRecord = isRecord(value.evidence) ? value.evidence : null;
  const evidenceSource = evidenceRecord?.source === "explicit-prompt" ||
      evidenceRecord?.source === "reference" ||
      evidenceRecord?.source === "product-architecture" ||
      evidenceRecord?.source === "approved-scope"
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
      icon: lucideIconName(typeof item.icon === "string" ? item.icon : null),
      role: item.role.trim().slice(0, 160),
      linkedScreenName,
      availability: item.availability === "planned" || !linkedScreenName ? "planned" : "generated",
    }];
  });
  const minimumItems = minimumNavigationItems(decision, version, evidenceSource);
  const enabled = version === 1
    ? value.enabled === true && items.length > 0
    : value.enabled === true &&
      decision !== "none" &&
      items.length >= minimumItems &&
      items.length <= MAX_SHARED_NAV_ITEMS &&
      Boolean(evidenceSource);

  return {
    version,
    decision: version === 2 ? decision : undefined,
    evidence: version === 2
      ? {
          source: evidenceSource,
          reason: typeof evidenceRecord?.reason === "string" && evidenceRecord.reason.trim()
            ? evidenceRecord.reason.trim().slice(0, 1200)
            : "Stored Navigation V2 evidence was not described.",
        }
      : undefined,
    design: version === 2 && isRecord(value.design)
      ? normalizeNavigationDesignContract(value.design as unknown as NavigationDesignContract, typeof value.visualBrief === "string" ? value.visualBrief : "")
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
