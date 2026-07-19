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
  return {
    anatomy,
    width: anatomy === "fixed-tab-rail" ? "inset" : "content",
    labels: anatomy === "compact-icon-rail" ? "hidden" : "always",
    activeTreatment: anatomy === "fixed-tab-rail" ? "tint" : "icon-fill",
    surface: anatomy === "glass-dock" ? "glass" : "solid",
    radiusPx: anatomy === "fixed-tab-rail" ? 18 : 28,
    safeAreaOffsetPx: 12,
    itemGapPx: 4,
    iconSizePx: 20,
    border: true,
    elevation: anatomy === "fixed-tab-rail" ? "none" : "low",
    centerActionItemId: null,
  };
}

export function normalizeNavigationDesignContract(
  design: NavigationDesignContract | null | undefined,
  visualBrief = "",
): NavigationDesignContract {
  const fallback = defaultNavigationDesignContract(visualBrief);
  if (!design) return fallback;

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
    anatomy: anatomies.has(design.anatomy) ? design.anatomy : fallback.anatomy,
    width: widths.has(design.width) ? design.width : fallback.width,
    labels: labels.has(design.labels) ? design.labels : fallback.labels,
    activeTreatment: activeTreatments.has(design.activeTreatment) ? design.activeTreatment : fallback.activeTreatment,
    surface: surfaces.has(design.surface) ? design.surface : fallback.surface,
    radiusPx: clampNumber(design.radiusPx, 0, 36, fallback.radiusPx),
    safeAreaOffsetPx: clampNumber(design.safeAreaOffsetPx, 4, 28, fallback.safeAreaOffsetPx),
    itemGapPx: clampNumber(design.itemGapPx, 0, 16, fallback.itemGapPx),
    iconSizePx: clampNumber(design.iconSizePx, 16, 26, fallback.iconSizePx),
    border: typeof design.border === "boolean" ? design.border : fallback.border,
    elevation: elevations.has(design.elevation) ? design.elevation : fallback.elevation,
    centerActionItemId: typeof design.centerActionItemId === "string" && design.centerActionItemId.trim()
      ? slugify(design.centerActionItemId, "")
      : null,
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

export function renderDeterministicNavigationShell(navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none" || navigationPlan.items.length < LEGACY_MIN_SHARED_NAV_ITEMS) {
    return "";
  }

  const navItems = navigationPlan.items.slice(0, MAX_SHARED_NAV_ITEMS);
  const design = normalizeNavigationDesignContract(navigationPlan.design, navigationPlan.visualBrief);
  const itemCount = navItems.length;
  const radiusDelta = Math.min(8, Math.max(4, Math.round(design.radiusPx / 3)));
  const legacyInnerRadiusPx = design.radiusPx === 0 ? 0 : Math.max(0, design.radiusPx - radiusDelta);
  const overlapBufferPx = design.anatomy === "center-action-dock" ? 16 : 8;
  const contentWidth = Math.min(356, itemCount * 70 + 32);
  const width = design.width === "full"
    ? "calc(100% - 24px)"
    : design.width === "inset"
      ? "calc(100% - 32px)"
      : `min(${contentWidth}px,calc(100% - 32px))`;
  const background = design.surface === "glass"
    ? "color-mix(in srgb,var(--dg-navigation-surface,var(--dg-color-surface-card,#fff)) 78%,transparent)"
    : design.surface === "translucent"
      ? "color-mix(in srgb,var(--dg-navigation-surface,var(--dg-color-surface-card,#fff)) 90%,transparent)"
      : "var(--dg-navigation-surface,var(--dg-color-surface-card,#fff))";
  const blur = design.surface === "glass" ? "backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);" : "";
  const shadow = design.elevation === "medium"
    ? "var(--dg-navigation-shadow,0 12px 28px rgba(15,23,42,.14))"
    : design.elevation === "low"
      ? "var(--dg-navigation-shadow,0 6px 18px rgba(15,23,42,.09))"
      : "none";
  const border = design.border
    ? "1px solid color-mix(in srgb,var(--dg-navigation-border,var(--dg-color-border-divider,#e5e7eb)) 72%,transparent)"
    : "0";
  const labelCss = design.labels === "hidden"
    ? "display:none;"
    : design.labels === "active-only"
      ? "visibility:hidden;"
      : "";
  const activeOnlyCss = design.labels === "active-only"
    ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-label{visibility:visible;}"
    : "";
  const activeCss = design.activeTreatment === "underline"
    ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]::after{content:\"\";position:absolute;bottom:2px;width:18px;height:2px;border-radius:2px;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));}"
    : design.activeTreatment === "compact-chip"
      ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}"
      : design.activeTreatment === "tint"
        ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));}"
        : "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-icon{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}";
  const items = navItems.map((item) => {
    const generated = item.availability !== "planned" && Boolean(item.linkedScreenName);
    const id = escapeAttribute(item.id);
    const label = escapeHtml(item.label);
    const icon = escapeAttribute(slugify(item.icon, "circle"));
    const linkedScreen = generated && item.linkedScreenName ? ` data-linked-screen-name="${escapeAttribute(item.linkedScreenName)}"` : "";
    const centerAction = design.anatomy === "center-action-dock" && design.centerActionItemId === item.id;
    return [
      `<button type="button" class="dg-nav-item${centerAction ? " dg-nav-item-center-action" : ""}" data-nav-item-id="${id}" data-nav-availability="${generated ? "generated" : "planned"}" data-active="false" aria-label="${escapeAttribute(item.label)}"${generated ? "" : ' aria-disabled="true" tabindex="-1"'}${linkedScreen}>`,
      `  <span class="dg-nav-icon"><i data-lucide="${icon}"></i></span>`,
      `  <span class="dg-nav-label">${label}</span>`,
      "</button>",
    ].join("\n");
  }).join("\n");

  return [
    `<nav data-drawgle-primary-nav data-navigation-version="${navigationPlan.version ?? 1}" data-navigation-anatomy="${design.anatomy}" data-navigation-clearance-owner="renderer" class="dg-nav-shell" aria-label="Primary navigation">`,
    "<style>",
    `:root{--dg-navigation-visual-height:clamp(64px,var(--dg-sizing-bottom-nav-height,72px),88px);--dg-effective-safe-area-bottom:max(env(safe-area-inset-bottom,0px),var(--dg-mobile-layout-safe-area-bottom,0px));--dg-navigation-safe-offset:${design.safeAreaOffsetPx}px;--dg-navigation-overlap-buffer:${overlapBufferPx}px;--dg-navigation-clearance:calc(var(--dg-navigation-visual-height) + var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom) + var(--dg-navigation-overlap-buffer));}`,
    `[data-drawgle-primary-nav].dg-nav-shell{box-sizing:border-box;width:${width};max-width:100%;min-height:var(--dg-navigation-visual-height);margin:0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom));padding:var(--dg-spacing-xs,8px);border-radius:var(--dg-radii-app,${design.radiusPx}px);background:${background};border:${border};box-shadow:${shadow};${blur}pointer-events:auto;}`,
    `[data-drawgle-primary-nav] .dg-nav-shell-inner{display:grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr));align-items:stretch;gap:${design.itemGapPx}px;min-height:calc(var(--dg-navigation-visual-height) - var(--dg-spacing-xs,8px) - var(--dg-spacing-xs,8px));}`,
    `[data-drawgle-primary-nav] .dg-nav-item{position:relative;appearance:none;border:0;background:transparent;color:var(--dg-navigation-muted-content,var(--dg-color-text-low-emphasis,#94a3b8));min-width:0;min-height:var(--dg-sizing-min-touch-target,48px);padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:var(--dg-radii-inner,${legacyInnerRadiusPx}px);font-family:var(--dg-typography-body-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:10px;line-height:1;font-weight:650;letter-spacing:0;cursor:pointer;}`,
    "[data-drawgle-primary-nav] .dg-nav-item[data-availability=\"planned\"]{cursor:default;}",
    "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));}",
    `[data-drawgle-primary-nav] .dg-nav-icon{display:flex;height:${design.iconSizePx + 10}px;width:${design.iconSizePx + 10}px;align-items:center;justify-content:center;border-radius:var(--dg-radii-pill,9999px);background:transparent;color:currentColor;}`,
    `[data-drawgle-primary-nav] .dg-nav-icon svg{height:${design.iconSizePx}px;width:${design.iconSizePx}px;stroke-width:2;}`,
    `[data-drawgle-primary-nav] .dg-nav-label{max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;${labelCss}}`,
    activeOnlyCss,
    activeCss,
    "[data-drawgle-primary-nav] .dg-nav-item-center-action{transform:translateY(-8px);}",
    "[data-drawgle-primary-nav] .dg-nav-item-center-action .dg-nav-icon{height:42px;width:42px;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));color:var(--dg-navigation-active-content,var(--dg-color-action-on-primary-text,#fff));}",
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

    if (!validGeneratedScreen && !isV2 && strictScreenLinks) continue;

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

  const minimumItems = decision === "project-native" && isV2
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
  const minimumItems = navigationPlan.version === 2 && navigationPlan.decision === "project-native"
    ? PROJECT_NATIVE_MIN_ITEMS
    : LEGACY_MIN_SHARED_NAV_ITEMS;
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

const PRIMARY_NAV_WORD_PATTERN = /bottom\s+(?:nav|navigation)|tab\s*bar|footer\s*nav|navigation\s+(?:dock|pill|bar|surface|shell)|floating\s+(?:dock|nav|navigation|tab)|dock\s+navigation|shared\s+shell\s+simulation|data-nav-item-id|data-drawgle-primary-nav/i;
const FIXED_BOTTOM_PATTERN = /\b(?:fixed|sticky|absolute|bottom-0|bottom-\[|inset-x-0)\b|position\s*:\s*fixed|bottom\s*:/i;

const countNavLikeChildren = (block: string) => {
  const actionCount = (block.match(/<(?:button|a)\b/gi) ?? []).length;
  const iconCount = (block.match(/\bdata-lucide\s*=/gi) ?? []).length + (block.match(/<svg\b/gi) ?? []).length;
  const labelCount = (block.match(/<span\b/gi) ?? []).length + (block.match(/aria-label\s*=/gi) ?? []).length;
  return { actionCount, iconCount, labelCount };
};

const looksLikePrimaryBottomNavigationBlock = (block: string) => {
  const { actionCount, iconCount, labelCount } = countNavLikeChildren(block);
  const explicitNavWords = PRIMARY_NAV_WORD_PATTERN.test(block);
  const looksFixedBottom = FIXED_BOTTOM_PATTERN.test(block);

  if (explicitNavWords && actionCount >= 2) return true;
  if (looksFixedBottom && actionCount >= 2 && (iconCount >= 2 || labelCount >= 2)) return true;
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
    if (PRIMARY_NAV_WORD_PATTERN.test(snippet) || (FIXED_BOTTOM_PATTERN.test(snippet) && actionCount >= 2)) {
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
    if (!FIXED_BOTTOM_PATTERN.test(openTag)) continue;
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
    if (!FIXED_BOTTOM_PATTERN.test(openTag)) continue;
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
  const commentPattern = /<!--[\s\S]*?(?:floating\s+dock|floating\s+navigation|bottom\s+nav|bottom\s+navigation|navigation\s+(?:dock|pill|bar|surface|shell)|tab\s+bar|dock\s+navigation|shared\s+shell\s+simulation|visual\s+mockup\s+for\s+screen\s+context)[\s\S]*?-->/gi;
  for (const comment of Array.from(sanitized.matchAll(commentPattern)).reverse()) {
    const commentStart = comment.index ?? -1;
    if (commentStart < 0) continue;
    const afterComment = commentStart + comment[0].length;
    const divStart = sanitized.indexOf("<div", afterComment);
    if (divStart < 0) continue;
    const openEnd = sanitized.indexOf(">", divStart);
    if (openEnd < 0 || !FIXED_BOTTOM_PATTERN.test(sanitized.slice(divStart, openEnd + 1))) continue;
    const removed = removeBalancedDivAt(sanitized, divStart);
    if (removed && looksLikePrimaryBottomNavigationBlock(removed.block)) {
      sanitized = sanitized.slice(0, commentStart) + sanitized.slice(removed.end);
    }
  }

  sanitized = sanitized
    .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, (match) => {
      const actionCount = (match.match(/<(?:button|a)\b/gi) ?? []).length;
      const highConfidence = PRIMARY_NAV_WORD_PATTERN.test(match) ||
        (FIXED_BOTTOM_PATTERN.test(match) && actionCount >= 2);
      return highConfidence ? "" : match;
    });

  sanitized = removeHighConfidenceFixedBottomNavigationDivs(sanitized).trim();

  return sanitized;
}
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
  const minimumItems = version === 2 && decision === "project-native"
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
