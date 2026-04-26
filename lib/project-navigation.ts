import { indexScreenCode } from "@/lib/generation/block-index";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy } from "@/lib/navigation";
import type {
  NavigationArchitecture,
  NavigationPlan,
  NavigationPlanItem,
  ProjectNavigationData,
  ScreenData,
  ScreenPlan,
} from "@/lib/types";

const FALLBACK_ICONS = ["home", "search", "grid-2x2", "bell", "user"];

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || fallback;
};

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
  const rootScreens = screens.filter((screen) => screen.type === "root").slice(0, 5);

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
}: {
  navigationPlan?: NavigationPlan | null;
  screens: ScreenPlan[];
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
}): NavigationPlan {
  const fallback = createFallbackNavigationPlan({ screens, navigationArchitecture, requiresBottomNav });
  const enabled = navigationPlan?.enabled ?? fallback.enabled;
  const kind = enabled ? "bottom-tabs" : "none";
  const seen = new Set<string>();
  const items = enabled
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
          return {
            id,
            label: (item.label || item.linkedScreenName || `Tab ${index + 1}`).trim().slice(0, 18),
            icon: slugify(item.icon || FALLBACK_ICONS[index] || "circle", "circle"),
            role: (item.role || "Primary app destination").trim().slice(0, 160),
            linkedScreenName: (item.linkedScreenName || fallback.items[index]?.linkedScreenName || screens[index]?.name || "").trim(),
          };
        })
    : [];

  return {
    enabled,
    kind,
    items,
    visualBrief: (navigationPlan?.visualBrief || fallback.visualBrief).trim().slice(0, 1600),
    screenChrome: screens.map((screen) => {
      const planned = navigationPlan?.screenChrome?.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
      const fallbackChrome = fallback.screenChrome.find((entry) => entry.screenName === screen.name);
      const matchingItem = items.find((item) => item.linkedScreenName.toLowerCase() === screen.name.toLowerCase());
      return {
        screenName: screen.name,
        chrome: planned?.chrome ?? fallbackChrome?.chrome ?? screen.chromePolicy?.chrome ?? "top-bar",
        navigationItemId: enabled && screen.type === "root"
          ? planned?.navigationItemId ?? matchingItem?.id ?? fallbackChrome?.navigationItemId ?? null
          : null,
      };
    }),
  };
}

export function applyNavigationPlanToScreens(screens: ScreenPlan[], navigationPlan: NavigationPlan): ScreenPlan[] {
  return screens.map((screen) => {
    const screenChrome = navigationPlan.screenChrome.find((entry) => entry.screenName.toLowerCase() === screen.name.toLowerCase());
    return {
      ...screen,
      navigationItemId: screenChrome?.navigationItemId ?? screen.navigationItemId ?? null,
      chromePolicy: screen.chromePolicy
        ? {
            ...screen.chromePolicy,
            chrome: screenChrome?.chrome ?? screen.chromePolicy.chrome,
            showPrimaryNavigation: Boolean(screenChrome?.navigationItemId),
          }
        : screen.chromePolicy,
    };
  });
}

export function validateNavigationShell(shellCode: string, navigationPlan: NavigationPlan) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none") {
    return true;
  }

  if (!shellCode.includes("data-drawgle-primary-nav")) {
    return false;
  }

  return navigationPlan.items.every((item) => shellCode.includes(`data-nav-item-id="${item.id}"`) || shellCode.includes(`data-nav-item-id='${item.id}'`));
}

export function sanitizeScreenCodeForSharedNavigation(code: string, screenPlan: ScreenPlan) {
  if (!screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) {
    return code;
  }

  return code
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
