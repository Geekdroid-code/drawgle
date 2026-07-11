import { indexScreenCode } from "@/lib/generation/block-index";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy, shouldForceImmersiveScreen } from "@/lib/navigation";
import type {
  NavigationArchitecture,
  NavigationPlan,
  NavigationPlanItem,
  ProjectNavigationData,
  ScreenData,
  ScreenPlan,
} from "@/lib/types";

const FALLBACK_ICONS = ["home", "search", "grid-2x2", "bell", "user"];
const MIN_SHARED_NAV_ITEMS = 2;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeAttribute = (value: string) =>
  escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || fallback;
};

export function renderDeterministicNavigationShell(navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none" || navigationPlan.items.length < MIN_SHARED_NAV_ITEMS) {
    return "";
  }

  const navItems = navigationPlan.items.slice(0, 5);
  const shellWidth = Math.min(342, navItems.length * 68 + 36);
  const items = navItems.map((item, index) => {
    const id = escapeAttribute(item.id);
    const label = escapeHtml(item.label || item.linkedScreenName || `Tab ${index + 1}`);
    const ariaLabel = escapeAttribute(item.label || item.linkedScreenName || `Tab ${index + 1}`);
    const icon = escapeAttribute(slugify(item.icon || FALLBACK_ICONS[index] || "circle", FALLBACK_ICONS[index] || "circle"));

    return [
      `<button type="button" class="dg-nav-item" data-nav-item-id="${id}" data-active="false" aria-label="${ariaLabel}">`,
      `  <span class="dg-nav-icon"><i data-lucide="${icon}"></i></span>`,
      `  <span class="dg-nav-label">${label}</span>`,
      `</button>`,
    ].join("\n");
  }).join("\n");

  return [
    `<nav data-drawgle-primary-nav class="dg-nav-shell" aria-label="Primary navigation">`,
    `<style>`,
    `[data-drawgle-primary-nav].dg-nav-shell{box-sizing:border-box;width:min(${shellWidth}px,calc(100% - 32px));margin:0 auto 12px;padding:7px;border-radius:var(--dg-radii-pill,999px);background:color-mix(in srgb,var(--dg-color-surface-card,#ffffff) 88%,transparent);border:var(--dg-border-widths-standard,1px) solid color-mix(in srgb,var(--dg-color-border-divider,#e5e7eb) 72%,transparent);box-shadow:0 10px 30px rgba(15,23,42,.10);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);pointer-events:auto;}`,
    `[data-drawgle-primary-nav] .dg-nav-shell-inner{display:grid;grid-template-columns:repeat(${navItems.length},minmax(0,1fr));align-items:center;gap:2px;}`,
    `[data-drawgle-primary-nav] .dg-nav-item{appearance:none;border:0;background:transparent;color:var(--dg-color-text-low-emphasis,#94a3b8);min-width:0;height:50px;padding:4px 6px;border-radius:var(--dg-radii-pill,999px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-family:var(--dg-typography-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:10px;line-height:1;font-weight:700;letter-spacing:0;cursor:pointer;transition:color .18s ease,transform .18s ease;}`,
    `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"]{color:var(--dg-color-action-primary,#111827);}`,
    `[data-drawgle-primary-nav] .dg-nav-icon{display:flex;height:28px;width:28px;align-items:center;justify-content:center;border-radius:var(--dg-radii-pill,999px);background:transparent;color:currentColor;transition:background .18s ease,color .18s ease;}`,
    `[data-drawgle-primary-nav] .dg-nav-item[data-active="true"] .dg-nav-icon{background:var(--dg-color-action-primary,#111827);color:var(--dg-color-action-on-primary-text,#ffffff);}`,
    `[data-drawgle-primary-nav] .dg-nav-icon svg{height:17px;width:17px;stroke-width:2.25;}`,
    `[data-drawgle-primary-nav] .dg-nav-label{max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;}`,
    `</style>`,
    `<div class="dg-nav-shell-inner">`,
    items,
    `</div>`,
    `</nav>`,
  ].join("\n");
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

export function createFallbackNavigationPlan({
  screens,
  navigationArchitecture,
  requiresBottomNav,
}: {
  screens: ScreenPlan[];
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
}): NavigationPlan {
  const architecture = createNavigationArchitecture({
    navigationArchitecture,
    requiresBottomNav,
  });
  const enabled = deriveRequiresBottomNav(architecture);
  const NAV_EXCLUDED_SCREEN_NAMES = /\b(login|sign[\s-]?in|sign[\s-]?up|register|auth|onboarding|splash|welcome|chat|ai[\s-]?assistant|assistant|forgot[\s-]?password|otp|verification|camera|player)\b/i;
  const rootScreens = screens
    .filter((screen) => screen.type === "root" && !NAV_EXCLUDED_SCREEN_NAMES.test(screen.name))
    .slice(0, 5);

  const items: NavigationPlanItem[] = enabled
    ? (rootScreens.length > 0 ? rootScreens : screens.slice(0, 1)).map((screen, index) => ({
        id: slugify(screen.name, `tab-${index + 1}`),
        label: screen.name.replace(/\b(screen|page|view)\b/gi, "").trim().slice(0, 18) || `Tab ${index + 1}`,
        icon: FALLBACK_ICONS[index] ?? "circle",
        role: index === 0 ? "Primary landing destination" : "Peer root destination",
        linkedScreenName: screen.name,
      }))
    : [];

  return {
    enabled,
    kind: enabled ? "bottom-tabs" : "none",
    items,
    visualBrief: enabled
      ? "Create a project-specific modern mobile navigation shell. Infer whether it should feel like a floating dock, glass pill, minimal tab rail, sculpted bottom card, or compact action dock from the reference image, creative direction, and product tone. Avoid generic 2015 equal-width tab bars."
      : "This project should not use persistent primary navigation.",
    screenChrome: screens.map((screen) => {
      const chromePolicy = resolveScreenChromePolicy({ screenPlan: screen, navigationArchitecture: architecture });
      const item = items.find((entry) => entry.linkedScreenName.toLowerCase() === screen.name.toLowerCase());
      return {
        screenName: screen.name,
        chrome: chromePolicy.chrome,
        navigationItemId: chromePolicy.showPrimaryNavigation ? item?.id ?? null : null,
      };
    }),
  };
}

export function normalizeNavigationPlan({
  navigationPlan,
  screens,
  navigationArchitecture,
  requiresBottomNav,
  strictScreenLinks = true,
}: {
  navigationPlan?: NavigationPlan | null;
  screens: ScreenPlan[];
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
  strictScreenLinks?: boolean;
}): NavigationPlan {
  const fallback = createFallbackNavigationPlan({ screens, navigationArchitecture, requiresBottomNav });
  
  // Dynamic architectural hardening:
  // If multiple screens are present and bottom tabs are requested or fall back to enabled,
  // we force shared navigation to be enabled to prevent separate, local bottom bars.
  const isBottomTabsArchitecture =
    requiresBottomNav ||
    fallback.enabled ||
    navigationArchitecture?.primaryNavigation === "bottom-tabs" ||
    navigationPlan?.kind === "bottom-tabs" ||
    screens.some((s) => s.chromePolicy?.chrome === "bottom-tabs") ||
    navigationPlan?.screenChrome?.some((sc) => sc.chrome === "bottom-tabs");
    
  let requestedEnabled = navigationPlan?.enabled ?? fallback.enabled;
  if (screens.length > 1 && isBottomTabsArchitecture) {
    requestedEnabled = true;
  }

  const screenByName = new Map(screens.map((screen) => [screen.name.toLowerCase(), screen]));
  const screenNameSet = new Set(screenByName.keys());
  const linkedScreenSeen = new Set<string>();
  const seen = new Set<string>();
  const rawItems = requestedEnabled
    ? (navigationPlan?.items?.length ? navigationPlan.items : fallback.items)
        .slice(0, 5)
        .map((item, index) => {
          const baseId = slugify(item.id || item.label || item.linkedScreenName, `tab-${index + 1}`);
          let id = baseId;
          let suffix = 2;
          while (seen.has(id)) {
            id = `${baseId}-${suffix++}`;
          }
          seen.add(id);

          const rawLinkedName = (item.linkedScreenName || fallback.items[index]?.linkedScreenName || screens[index]?.name || "").trim();

          // Fuzzy screen matching:
          // Lowercase and strip common screen suffixes (screen, page, tab, view, dashboard) & non-alphanumeric chars
          const cleanStr = (s: string) =>
            s
              .toLowerCase()
              .replace(/\b(screen|page|tab|view|dashboard)\b/g, "")
              .replace(/[^a-z0-9]/g, "");

          const cleanL = cleanStr(rawLinkedName);

          const matchedScreen = cleanL
            ? screens.find((s) => {
                const cleanS = cleanStr(s.name);
                return cleanL === cleanS || cleanS.includes(cleanL) || cleanL.includes(cleanS);
              })
            : null;

          const linkedScreenName = matchedScreen ? matchedScreen.name : rawLinkedName;

          return {
            id,
            label: (item.label || item.linkedScreenName || `Tab ${index + 1}`).trim().slice(0, 18),
            icon: slugify(item.icon || FALLBACK_ICONS[index] || "circle", "circle"),
            role: (item.role || "Primary app destination").trim().slice(0, 160),
            linkedScreenName,
          };
        })
        .filter((item) => item.label.length > 0 && item.id.length > 0)
        .filter((item) => !strictScreenLinks || screenNameSet.has(item.linkedScreenName.toLowerCase()))
        .filter((item) => {
          if (!strictScreenLinks) {
            return true;
          }

          const linkedScreen = screenByName.get(item.linkedScreenName.toLowerCase());
          return Boolean(linkedScreen && linkedScreen.type === "root" && !shouldForceImmersiveScreen(linkedScreen));
        })
        .filter((item) => {
          if (!strictScreenLinks) {
            return true;
          }

          const key = item.linkedScreenName.toLowerCase();
          if (linkedScreenSeen.has(key)) {
            return false;
          }

          linkedScreenSeen.add(key);
          return true;
        })
    : [];

  // If rawItems mapping resulted in empty list but bottom tabs are structurally needed,
  // auto-recover items from root screens to guarantee identical shared navigation.
  let finalItems = rawItems;
  if (requestedEnabled && rawItems.length === 0 && screens.length > 1 && isBottomTabsArchitecture) {
    finalItems = fallback.items;
  }

  const enabled = requestedEnabled && finalItems.length >= MIN_SHARED_NAV_ITEMS && (!strictScreenLinks || screens.length > 1);
  const kind = enabled ? "bottom-tabs" : "none";
  const items = enabled ? finalItems : [];
  const rootScreens = screens.filter((screen) => screen.type === "root");
  const firstRootScreenName = rootScreens[0]?.name ?? screens[0]?.name ?? null;
  const firstItem = items[0] ?? null;
  const itemForScreen = (screen: ScreenPlan) => {
    const planned = navigationPlan?.screenChrome?.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
    const plannedItem = planned?.navigationItemId
      ? items.find((item) => item.id === planned.navigationItemId)
      : null;
    const linkedItem = items.find((item) => item.linkedScreenName.toLowerCase() === screen.name.toLowerCase());

    return plannedItem ?? linkedItem ?? (screen.name === firstRootScreenName ? firstItem : null);
  };

  return {
    enabled,
    kind,
    items,
    visualBrief: (navigationPlan?.visualBrief || fallback.visualBrief).trim().slice(0, 1600),
    screenChrome: screens.map((screen) => {
      if (!enabled) {
        return {
          screenName: screen.name,
          chrome: shouldForceImmersiveScreen(screen)
            ? "immersive"
            : screen.type === "root"
              ? "top-bar"
              : "top-bar-back",
          navigationItemId: null,
        };
      }

      const planned = navigationPlan?.screenChrome?.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
      const fallbackChrome = fallback.screenChrome.find((entry) => entry.screenName === screen.name);
      const matchingItem = itemForScreen(screen);
      const shouldForceImmersive = shouldForceImmersiveScreen(screen);

      const rawChrome = planned?.chrome ?? fallbackChrome?.chrome ?? screen.chromePolicy?.chrome ?? "top-bar";
      const chrome = shouldForceImmersive
        ? "immersive"
        : screen.type === "root" && matchingItem
          ? "bottom-tabs"
          : rawChrome;
      const suppressesNav = chrome === "immersive" || chrome === "modal-sheet";
      return {
        screenName: screen.name,
        chrome,
        navigationItemId: enabled && screen.type === "root" && !suppressesNav
          ? planned?.navigationItemId ?? matchingItem?.id ?? null
          : null,
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
      navigationItemId: screenChrome?.navigationItemId ?? screen.navigationItemId ?? null,
      chromePolicy: {
        ...existingPolicy,
        chrome: screenChrome?.chrome ?? existingPolicy.chrome,
        showPrimaryNavigation: Boolean(screenChrome?.navigationItemId),
      },
    };
  });
}

export function validateNavigationShell(shellCode: string, navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    return true;
  }

  if (navigationPlan.items.length < MIN_SHARED_NAV_ITEMS) {
    return false;
  }

  const navRootCount = (shellCode.match(/<nav\b[^>]*\bdata-drawgle-primary-nav\b/gi) ?? []).length;
  if (navRootCount !== 1 || /<\/?(?:html|head|body)\b/i.test(shellCode) || /<script\b/i.test(shellCode)) {
    return false;
  }

  const expectedIds = navigationPlan.items.map((item) => item.id);
  const actualIds = Array.from(shellCode.matchAll(/\bdata-nav-item-id\s*=\s*(?:"([^"]+)"|'([^']+)')/gi))
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);

  if (actualIds.length !== expectedIds.length) {
    return false;
  }

  const expected = new Set(expectedIds);
  const actual = new Set(actualIds);
  return expected.size === actual.size && expectedIds.every((id) => actual.has(id));
}

export function detectLocalNavigationMarkup(code: string) {
  const reasons: string[] = [];
  const withoutStyles = code.replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  const push = (reason: string) => {
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  };

  if (/\bdata-drawgle-primary-nav\b/i.test(withoutStyles)) {
    push("screen_contains_shared_nav_marker");
  }

  if (/\bdata-nav-item-id\s*=/i.test(withoutStyles)) {
    push("screen_contains_nav_item_ids");
  }

  if (/<!--[\s\S]*?(?:floating\s+dock|bottom\s+nav|bottom\s+navigation|navigation\s+pill|tab\s+bar|dock\s+navigation|visual\s+mockup\s+for\s+screen\s+context)[\s\S]*?-->/i.test(withoutStyles)) {
    push("screen_contains_navigation_comment");
  }

  for (const match of withoutStyles.matchAll(/<(nav|footer)\b[\s\S]*?<\/\1>/gi)) {
    const snippet = match[0];
    const looksFixedBottom = /\b(?:fixed|sticky|absolute|bottom-0|bottom-\[|inset-x-0)\b|position\s*:\s*fixed|bottom\s*:/i.test(snippet);
    const looksPrimaryNav = /bottom|tab|dock|navbar|navigation|data-nav-item-id/i.test(snippet);
    if (looksFixedBottom || looksPrimaryNav) {
      push(`${match[1].toLowerCase()}_primary_navigation`);
    }
  }

  const fixedBottomBlocks = withoutStyles.match(/<div\b[^>]*(?:\bfixed\b[^>]*\bbottom-|bottom-\[|bottom-0|inset-x-0)[\s\S]{0,2400}?<\/div>/gi) ?? [];
  for (const block of fixedBottomBlocks) {
    const iconCount = (block.match(/\bdata-lucide\s*=/gi) ?? []).length + (block.match(/<svg\b/gi) ?? []).length;
    const navLabelCount = (block.match(/\b(home|search|discover|markets|swap|wallet|profile|settings|journal|learn|plan|orders|cards|activity|account)\b/gi) ?? []).length;
    const buttonCount = (block.match(/<(?:button|a)\b/gi) ?? []).length;
    const explicitNavWords = /\b(?:bottom\s+nav|bottom\s+navigation|tab\s+bar|navigation\s+pill|floating\s+dock|dock\s+navigation)\b/i.test(block);

    if (explicitNavWords || (iconCount >= 2 && (navLabelCount >= 2 || buttonCount >= 2))) {
      push("fixed_bottom_nav_cluster");
    }
  }

  return {
    hasLocalNavigation: reasons.length > 0,
    reasons,
  };
}

export function sanitizeScreenCodeForSharedNavigation(
  code: string,
  screenPlan: ScreenPlan,
  options: { projectNavigationEnabled?: boolean } = {},
) {
  if (!options.projectNavigationEnabled && !screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) {
    return code;
  }

  // Tag-matching helper to safely remove the local fixed bottom bar div:
  const commentRegex = /<!--\s*(?:(?!-->)[\s\S])*(?:floating\s+dock|bottom\s+nav|navigation|nav\s+bar|dock\s+navigation|tab\s+bar|dock)(?:(?!-->)[\s\S])*-->/gi;
  let match;
  let sanitizedCode = code;
  while ((match = commentRegex.exec(sanitizedCode)) !== null) {
    const commentStart = match.index;
    const commentEnd = commentStart + match[0].length;
    
    // Find the next '<div' after the comment
    const divStart = sanitizedCode.indexOf("<div", commentEnd);
    if (divStart === -1) continue;
    
    // Check if it's a fixed bottom div
    const firstTagEnd = sanitizedCode.indexOf(">", divStart);
    if (firstTagEnd === -1) continue;
    const tagOpening = sanitizedCode.slice(divStart, firstTagEnd + 1);
    if (!/fixed\s+bottom|fixed\s+top|bottom-0|bottom-4/i.test(tagOpening)) {
      continue;
    }
    
    // Find the matching closing </div>
    let depth = 1;
    let pos = divStart + 4;
    while (depth > 0 && pos < sanitizedCode.length) {
      const nextOpen = sanitizedCode.indexOf("<div", pos);
      const nextClose = sanitizedCode.indexOf("</div>", pos);
      
      if (nextClose === -1) break;
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        pos = nextClose + 6;
      }
    }
    
    if (depth === 0) {
      // Successfully found the matching closing tag!
      const prefix = sanitizedCode.slice(0, commentStart);
      const suffix = sanitizedCode.slice(pos);
      sanitizedCode = prefix.trim() + "\n" + suffix.trim();
      // Reset regex index since we modified the string
      commentRegex.lastIndex = 0;
    }
  }

  return sanitizedCode
    .replace(/<!--\s*(?:floating\s+dock|bottom\s+nav|navigation)[\s\S]*?placeholder[\s\S]*?-->\s*<div\b[^>]*(?:h-\[[^\]]*(?:8[0-9]|9[0-9]|1[0-9]{2})px\]|height\s*:\s*(?:8[0-9]|9[0-9]|1[0-9]{2})px)[^>]*>\s*<\/div>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, (match) =>
      /bottom|tab|navigation|nav|data-drawgle-primary-nav/i.test(match) ? "" : match,
    )
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, (match) =>
      /bottom|tab|navigation|nav/i.test(match) ? "" : match,
    )
    .trim();
}

export function indexNavigationShell(shellCode: string) {
  return shellCode ? indexScreenCode(shellCode) : null;
}
