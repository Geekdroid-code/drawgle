import { indexScreenCode } from "@/lib/generation/block-index";
import { createNavigationArchitecture, resolveScreenChromePolicy, shouldForceImmersiveScreen } from "@/lib/navigation";
import type {
  NavigationArchitecture,
  NavigationDesignContract,
  NavigationPlan,
  NavigationPlanItem,
  ProjectNavigationData,
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
  const contentWidth = Math.min(356, itemCount * 70 + 32);
  const width = design.width === "full"
    ? "calc(100% - 24px)"
    : design.width === "inset"
      ? "calc(100% - 32px)"
      : `min(${contentWidth}px,calc(100% - 32px))`;
  const background = design.surface === "glass"
    ? "color-mix(in srgb,var(--dg-color-surface-card,#fff) 78%,transparent)"
    : design.surface === "translucent"
      ? "color-mix(in srgb,var(--dg-color-surface-card,#fff) 90%,transparent)"
      : "var(--dg-color-surface-card,#fff)";
  const blur = design.surface === "glass" ? "backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);" : "";
  const shadow = design.elevation === "medium"
    ? "0 12px 28px rgba(15,23,42,.14)"
    : design.elevation === "low"
      ? "0 6px 18px rgba(15,23,42,.09)"
      : "none";
  const border = design.border
    ? "1px solid color-mix(in srgb,var(--dg-color-border-divider,#e5e7eb) 72%,transparent)"
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
    ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]::after{content:\"\";position:absolute;bottom:2px;width:18px;height:2px;border-radius:2px;background:var(--dg-color-action-primary,#111827);}"
    : design.activeTreatment === "compact-chip"
      ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{background:color-mix(in srgb,var(--dg-color-action-primary,#111827) 10%,transparent);}"
      : design.activeTreatment === "tint"
        ? "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-color-action-primary,#111827);}"
        : "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"] .dg-nav-icon{background:var(--dg-color-action-primary,#111827);color:var(--dg-color-action-on-primary-text,#fff);}";
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
    `<nav data-drawgle-primary-nav data-navigation-version="${navigationPlan.version ?? 1}" data-navigation-anatomy="${design.anatomy}" class="dg-nav-shell" aria-label="Primary navigation">`,
    "<style>",
    `[data-drawgle-primary-nav].dg-nav-shell{box-sizing:border-box;width:${width};max-width:100%;margin:0 auto calc(${design.safeAreaOffsetPx}px + env(safe-area-inset-bottom,0px));padding:7px;border-radius:${design.radiusPx}px;background:${background};border:${border};box-shadow:${shadow};${blur}pointer-events:auto;}`,
    `[data-drawgle-primary-nav] .dg-nav-shell-inner{display:grid;grid-template-columns:repeat(${itemCount},minmax(0,1fr));align-items:end;gap:${design.itemGapPx}px;}`,
    "[data-drawgle-primary-nav] .dg-nav-item{position:relative;appearance:none;border:0;background:transparent;color:var(--dg-color-text-low-emphasis,#94a3b8);min-width:0;height:50px;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:14px;font-family:var(--dg-typography-font-family,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif);font-size:10px;line-height:1;font-weight:650;letter-spacing:0;cursor:pointer;}",
    "[data-drawgle-primary-nav] .dg-nav-item[data-availability=\"planned\"]{cursor:default;}",
    "[data-drawgle-primary-nav] .dg-nav-item[data-active=\"true\"]{color:var(--dg-color-action-primary,#111827);}",
    `[data-drawgle-primary-nav] .dg-nav-icon{display:flex;height:${design.iconSizePx + 10}px;width:${design.iconSizePx + 10}px;align-items:center;justify-content:center;border-radius:999px;background:transparent;color:currentColor;}`,
    `[data-drawgle-primary-nav] .dg-nav-icon svg{height:${design.iconSizePx}px;width:${design.iconSizePx}px;stroke-width:2;}`,
    `[data-drawgle-primary-nav] .dg-nav-label{max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;${labelCss}}`,
    activeOnlyCss,
    activeCss,
    "[data-drawgle-primary-nav] .dg-nav-item-center-action{transform:translateY(-8px);}",
    "[data-drawgle-primary-nav] .dg-nav-item-center-action .dg-nav-icon{height:42px;width:42px;background:var(--dg-color-action-primary,#111827);color:var(--dg-color-action-on-primary-text,#fff);}",
    "</style>",
    '<div class="dg-nav-shell-inner">',
    items,
    "</div>",
    "</nav>",
  ].filter(Boolean).join("\n");
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
    projectNavigation.shellCode &&
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
    const matchedScreen = matchedByName ?? plannedScreenForItem.get(rawItem.id) ?? null;
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
    const looksFixedBottom = /\b(?:fixed|sticky|absolute|bottom-0|bottom-\[|inset-x-0)\b|position\s*:\s*fixed|bottom\s*:/i.test(snippet);
    const explicitlyPrimary = /bottom\s+(?:nav|navigation)|tab\s*bar|floating\s+dock|data-nav-item-id|data-drawgle-primary-nav/i.test(snippet);
    if (explicitlyPrimary || (looksFixedBottom && actionCount >= 2)) {
      push(`${match[1].toLowerCase()}_primary_navigation`, snippet);
    }
  }

  for (const block of withoutStyles.match(/<div\b[^>]*(?:\bfixed\b[^>]*\bbottom-|bottom-\[|bottom-0|inset-x-0)[\s\S]{0,2600}?<\/div>/gi) ?? []) {
    const iconCount = (block.match(/\bdata-lucide\s*=/gi) ?? []).length + (block.match(/<svg\b/gi) ?? []).length;
    const actionCount = (block.match(/<(?:button|a)\b/gi) ?? []).length;
    const explicitNavWords = /bottom\s+(?:nav|navigation)|tab\s*bar|navigation\s+pill|floating\s+dock|dock\s+navigation/i.test(block);
    if (explicitNavWords || (iconCount >= 2 && actionCount >= 2)) push("fixed_bottom_nav_cluster", block);
  }

  return { hasLocalNavigation: reasons.length > 0, reasons, candidates };
}

const removeBalancedDivAt = (code: string, start: number) => {
  let depth = 0;
  let cursor = start;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  for (let match = tagPattern.exec(code); match; match = tagPattern.exec(code)) {
    depth += /^<div\b/i.test(match[0]) ? 1 : -1;
    cursor = tagPattern.lastIndex;
    if (depth === 0) return { end: cursor, code: code.slice(0, start) + code.slice(cursor) };
  }
  return null;
};

export function sanitizeScreenCodeForSharedNavigation(
  code: string,
  screenPlan: ScreenPlan,
  options: { projectNavigationEnabled?: boolean } = {},
) {
  if (!options.projectNavigationEnabled && !screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) return code;

  let sanitized = code;
  const commentPattern = /<!--[\s\S]*?(?:floating\s+dock|bottom\s+nav|bottom\s+navigation|navigation\s+pill|tab\s+bar|dock\s+navigation|visual\s+mockup\s+for\s+screen\s+context)[\s\S]*?-->/gi;
  for (const comment of Array.from(sanitized.matchAll(commentPattern)).reverse()) {
    const commentStart = comment.index ?? -1;
    if (commentStart < 0) continue;
    const afterComment = commentStart + comment[0].length;
    const divStart = sanitized.indexOf("<div", afterComment);
    if (divStart < 0) continue;
    const openEnd = sanitized.indexOf(">", divStart);
    if (openEnd < 0 || !/fixed|sticky|bottom-|inset-x-0/i.test(sanitized.slice(divStart, openEnd + 1))) continue;
    const removed = removeBalancedDivAt(sanitized, divStart);
    if (removed) sanitized = sanitized.slice(0, commentStart) + removed.code.slice(commentStart);
  }

  sanitized = sanitized
    .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, (match) => {
      const actionCount = (match.match(/<(?:button|a)\b/gi) ?? []).length;
      const highConfidence = /data-drawgle-primary-nav|data-nav-item-id|bottom\s+(?:nav|navigation)|tab\s*bar|floating\s+dock/i.test(match) ||
        (/fixed|sticky|bottom-0|bottom-\[|inset-x-0|position\s*:\s*fixed/i.test(match) && actionCount >= 2);
      return highConfidence ? "" : match;
    })
    .trim();

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