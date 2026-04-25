import { indexScreenCode } from "@/lib/generation/block-index";
import { createNavigationArchitecture, deriveRequiresBottomNav, resolveScreenChromePolicy } from "@/lib/navigation";
import type {
  DesignTokens,
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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const token = (designTokens: DesignTokens | null | undefined, path: string, fallback: string) => {
  let current: unknown = designTokens?.tokens;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : fallback;
};

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
      ? "Create a project-specific bottom tab bar using the approved design tokens, product tone, and icon style. It should feel like a native app shell, not a generic template."
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

export function buildFallbackNavigationShell(navigationPlan: NavigationPlan, designTokens?: DesignTokens | null) {
  if (!navigationPlan.enabled || navigationPlan.kind === "none" || navigationPlan.items.length === 0) {
    return "";
  }

  const surface = token(designTokens, "color.surface.bottom_sheet", token(designTokens, "color.surface.card", "#ffffff"));
  const border = token(designTokens, "color.border.divider", "rgba(15,23,42,0.12)");
  const text = token(designTokens, "color.text.medium_emphasis", "#64748b");
  const active = token(designTokens, "color.action.primary", "#111827");
  const radius = token(designTokens, "radii.app", "24px");
  const shadow = token(designTokens, "shadows.overlay", "0 -10px 30px rgba(15,23,42,0.12)");
  const height = token(designTokens, "sizing.bottom_nav_height", "78px");

  const items = navigationPlan.items
    .map((item) => `
      <button data-nav-item-id="${escapeHtml(item.id)}" class="min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-[18px] px-2 text-[11px] font-[700] transition" style="color:${text}">
        <i data-lucide="${escapeHtml(item.icon)}" class="h-[20px] w-[20px]"></i>
        <span>${escapeHtml(item.label)}</span>
      </button>`)
    .join("");

  return `<nav data-drawgle-primary-nav class="pointer-events-auto absolute inset-x-[14px] bottom-[10px] z-20 grid items-center gap-1 px-2" style="grid-template-columns: repeat(${navigationPlan.items.length}, minmax(0, 1fr)); min-height:${height}; border:1px solid ${border}; border-radius:${radius}; background:${surface}; box-shadow:${shadow}; --drawgle-nav-active:${active};">
    ${items}
  </nav>`;
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

export function composeScreenCode({
  screen,
  code,
  projectNavigation,
}: {
  screen: Pick<ScreenData, "chromePolicy" | "navigationItemId">;
  code: string;
  projectNavigation?: ProjectNavigationData | null;
}) {
  const shouldWrap = Boolean(
    projectNavigation?.plan.enabled &&
    projectNavigation.shellCode &&
    screen.chromePolicy?.showPrimaryNavigation &&
    screen.navigationItemId,
  );

  if (!shouldWrap) {
    return code;
  }

  return `<div data-drawgle-app-shell class="relative min-h-screen w-full overflow-hidden">
    <div data-drawgle-screen-content class="relative z-0 min-h-screen pb-[112px]">
      ${code}
    </div>
    ${projectNavigation!.shellCode}
    <style>
      [data-drawgle-primary-nav] [data-nav-item-id] { opacity: 0.56; }
      [data-drawgle-primary-nav] [data-nav-item-id][data-active="true"] { opacity: 1; color: var(--drawgle-nav-active) !important; }
      [data-drawgle-primary-nav] [data-nav-item-id][data-active="true"] svg { stroke: var(--drawgle-nav-active) !important; }
    </style>
    <script>
      (function(){
        var activeId = ${JSON.stringify(screen.navigationItemId)};
        document.querySelectorAll('[data-drawgle-primary-nav] [data-nav-item-id]').forEach(function(item) {
          item.setAttribute('data-active', item.getAttribute('data-nav-item-id') === activeId ? 'true' : 'false');
        });
      })();
    <\/script>
  </div>`;
}

export function indexNavigationShell(shellCode: string) {
  return shellCode ? indexScreenCode(shellCode) : null;
}
