import type {
  NavigationArchitecture,
  NavigationPlan,
  PrimaryNavigationKind,
  ScreenChromeKind,
  ScreenChromePolicy,
  ScreenPlan,
} from "@/lib/types";

const NAVIGATION_KINDS = new Set<NavigationArchitecture["kind"]>([
  "bottom-tabs-app",
  "hierarchical",
  "single-screen",
]);

const PRIMARY_NAVIGATION_KINDS = new Set<PrimaryNavigationKind>([
  "bottom-tabs",
  "none",
]);

const SCREEN_CHROME_KINDS = new Set<ScreenChromeKind>([
  "bottom-tabs",
  "top-bar",
  "top-bar-back",
  "modal-sheet",
  "immersive",
]);

const DEFAULT_CONSISTENCY_RULES = [
  "Keep navigation surfaces in one family: shared spacing, icon sizing, label treatment, radius language, and border or elevation treatment.",
  "Only root screens should own the primary navigation shell unless a brief explicitly defines a shell variant.",
  "Detail screens must clearly expose a back or dismiss affordance.",
];

const SCREEN_NAME_IMMERSIVE_PATTERN =
  /\b(login|log[\s-]?in|sign[\s-]?in|sign[\s-]?up|register|auth|forgot[\s-]?password|reset[\s-]?password|otp|verification|two[\s-]?factor|2fa|onboarding|splash|welcome|chat|ai[\s-]?chat|ai[\s-]?assistant|assistant|messaging|conversation|compose|camera|player|video[\s-]?call|fullscreen|immersive)\b/i;

const SCREEN_BRIEF_IMMERSIVE_PATTERN =
  /\b(login|log[\s-]?in|sign[\s-]?in|sign[\s-]?up|register|auth|forgot[\s-]?password|reset[\s-]?password|otp|verification|two[\s-]?factor|2fa|onboarding|splash|welcome|chat|ai[\s-]?chat|ai[\s-]?assistant|assistant|messaging|conversation|compose|camera|player|video[\s-]?call|fullscreen|immersive)\b/i;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isNavigationKind = (value: unknown): value is NavigationArchitecture["kind"] =>
  typeof value === "string" && NAVIGATION_KINDS.has(value as NavigationArchitecture["kind"]);

const isPrimaryNavigationKind = (value: unknown): value is PrimaryNavigationKind =>
  typeof value === "string" && PRIMARY_NAVIGATION_KINDS.has(value as PrimaryNavigationKind);

const isScreenChromeKind = (value: unknown): value is ScreenChromeKind =>
  typeof value === "string" && SCREEN_CHROME_KINDS.has(value as ScreenChromeKind);

const normalizeStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    if (!isNonEmptyString(value)) {
      continue;
    }

    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(trimmed);
  }

  return next;
};

export function createNavigationArchitecture({
  navigationArchitecture,
  requiresBottomNav = false,
}: {
  navigationArchitecture?: NavigationArchitecture | null;
  requiresBottomNav?: boolean;
} = {}): NavigationArchitecture {
  const fallback: NavigationArchitecture = requiresBottomNav
    ? {
        kind: "bottom-tabs-app",
        primaryNavigation: "bottom-tabs",
        rootChrome: "bottom-tabs",
        detailChrome: "top-bar-back",
        consistencyRules: DEFAULT_CONSISTENCY_RULES,
        rationale: "The product spans multiple peer sections, so the primary shell should stay anchored in bottom tabs on root screens.",
      }
    : {
        kind: "hierarchical",
        primaryNavigation: "none",
        rootChrome: "top-bar",
        detailChrome: "top-bar-back",
        consistencyRules: DEFAULT_CONSISTENCY_RULES,
        rationale: "The product behaves like a focused flow, so navigation should stay hierarchical instead of exposing a persistent tab bar.",
      };

  const normalized: NavigationArchitecture = {
    kind: isNavigationKind(navigationArchitecture?.kind) ? navigationArchitecture.kind : fallback.kind,
    primaryNavigation: isPrimaryNavigationKind(navigationArchitecture?.primaryNavigation)
      ? navigationArchitecture.primaryNavigation
      : fallback.primaryNavigation,
    rootChrome: isScreenChromeKind(navigationArchitecture?.rootChrome) ? navigationArchitecture.rootChrome : fallback.rootChrome,
    detailChrome: isScreenChromeKind(navigationArchitecture?.detailChrome) ? navigationArchitecture.detailChrome : fallback.detailChrome,
    consistencyRules: normalizeStringArray(navigationArchitecture?.consistencyRules).slice(0, 6),
    rationale: isNonEmptyString(navigationArchitecture?.rationale) ? navigationArchitecture.rationale.trim() : fallback.rationale,
  };

  if (normalized.consistencyRules.length === 0) {
    normalized.consistencyRules = DEFAULT_CONSISTENCY_RULES;
  }

  if (normalized.kind === "bottom-tabs-app") {
    normalized.primaryNavigation = "bottom-tabs";
    normalized.rootChrome = "bottom-tabs";
    if (normalized.detailChrome === "bottom-tabs") {
      normalized.detailChrome = "top-bar-back";
    }
  }

  if (normalized.kind === "single-screen") {
    normalized.primaryNavigation = "none";
    if (normalized.rootChrome === "bottom-tabs") {
      normalized.rootChrome = "immersive";
    }
    if (normalized.detailChrome === "bottom-tabs") {
      normalized.detailChrome = "top-bar-back";
    }
  }

  if (normalized.primaryNavigation === "bottom-tabs" && normalized.rootChrome !== "bottom-tabs") {
    normalized.rootChrome = "bottom-tabs";
  }

  if (normalized.primaryNavigation === "bottom-tabs") {
    normalized.kind = "bottom-tabs-app";
  }

  if (normalized.detailChrome === "bottom-tabs") {
    normalized.detailChrome = "top-bar-back";
  }

  return normalized;
}

export function reconcileNavigationArchitectureWithPlan({
  navigationArchitecture,
  navigationPlan,
}: {
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan: NavigationPlan;
}): NavigationArchitecture {
  const current = createNavigationArchitecture({ navigationArchitecture });
  const enabled = navigationPlan.enabled && navigationPlan.kind === "bottom-tabs";

  return createNavigationArchitecture({
    navigationArchitecture: enabled
      ? {
          ...current,
          kind: "bottom-tabs-app",
          primaryNavigation: "bottom-tabs",
          rootChrome: "bottom-tabs",
        }
      : {
          ...current,
          kind: current.kind === "single-screen" ? "single-screen" : "hierarchical",
          primaryNavigation: "none",
          rootChrome: current.rootChrome === "bottom-tabs" ? "top-bar" : current.rootChrome,
        },
    requiresBottomNav: enabled,
  });
}

export function deriveRequiresBottomNav(navigationArchitecture?: NavigationArchitecture | null) {
  if (!navigationArchitecture) {
    return false;
  }

  const normalized = createNavigationArchitecture({ navigationArchitecture });
  return normalized.primaryNavigation === "bottom-tabs" || normalized.rootChrome === "bottom-tabs";
}

/**
 * Whether the structural reference visibly shows primary navigation on the
 * screen this plan was mapped to. Only meaningful for exact recreation, where
 * the image is the authority on chrome visibility.
 */
export function referenceShowsNavigationOnScreen({
  screenPlan,
  referenceAnalysis,
  promptMode,
}: {
  screenPlan: Pick<ScreenPlan, "referenceScreenIndex">;
  referenceAnalysis?: { primaryNavigation?: { present?: boolean; visibleOnScreenIndexes?: number[] } | null } | null;
  promptMode?: string | null;
}) {
  if (promptMode !== "recreate") return false;
  const navigation = referenceAnalysis?.primaryNavigation;
  if (!navigation?.present) return false;
  const visible = navigation.visibleOnScreenIndexes ?? [];
  const index = screenPlan.referenceScreenIndex;
  // A single-screen reference with visible navigation applies to that screen.
  if (visible.length === 0) return false;
  return typeof index === "number" ? visible.includes(index) : visible.length > 0;
}

export function shouldForceImmersiveScreen(screenPlan: Pick<ScreenPlan, "name" | "description">) {
  const name = screenPlan.name ?? "";
  const description = screenPlan.description ?? "";

  return SCREEN_NAME_IMMERSIVE_PATTERN.test(name) || SCREEN_BRIEF_IMMERSIVE_PATTERN.test(description);
}

export function resolveScreenChromePolicy({
  screenPlan,
  navigationArchitecture,
  referenceNavigationVisible = false,
}: {
  screenPlan: ScreenPlan;
  navigationArchitecture?: NavigationArchitecture | null;
  /**
   * The structural reference visibly shows primary navigation on this screen.
   *
   * Product-architecture heuristics classify screens like a charging session,
   * player, or checkout as immersive and suppress navigation. That is right for
   * prompt-generated apps and wrong for exact recreation: when the source image
   * shows a dock on that screen, visible evidence owns chrome visibility.
   */
  referenceNavigationVisible?: boolean;
}): ScreenChromePolicy {
  const normalizedArchitecture = createNavigationArchitecture({
    navigationArchitecture,
    requiresBottomNav: screenPlan.type === "root" && deriveRequiresBottomNav(navigationArchitecture),
  });
  const requestedPolicy = screenPlan.chromePolicy ?? null;
  const fallbackChrome = screenPlan.type === "root"
    ? normalizedArchitecture.rootChrome
    : normalizedArchitecture.detailChrome;

  let chrome = isScreenChromeKind(requestedPolicy?.chrome) ? requestedPolicy.chrome : fallbackChrome;

  // A typed planner/navigation decision is explicit architecture. Keyword
  // heuristics are only a fallback when no chrome policy was supplied.
  const shouldForceImmersive = !requestedPolicy
    && shouldForceImmersiveScreen(screenPlan)
    && !referenceNavigationVisible;

  if (shouldForceImmersive) {
    chrome = "immersive";
  }

  if (referenceNavigationVisible) {
    chrome = "bottom-tabs";
  }

  if (screenPlan.type !== "root" && chrome === "bottom-tabs" && !referenceNavigationVisible) {
    chrome = normalizedArchitecture.detailChrome;
  }

  if (screenPlan.type === "root" && normalizedArchitecture.primaryNavigation === "bottom-tabs" && !shouldForceImmersive) {
    const screenExplicitlyOptedOut = requestedPolicy?.chrome && requestedPolicy.chrome !== "bottom-tabs";
    if (!screenExplicitlyOptedOut) {
      chrome = "bottom-tabs";
    }
  }

  let showPrimaryNavigation = requestedPolicy?.showPrimaryNavigation ?? chrome === "bottom-tabs";
  let showsBackButton = requestedPolicy?.showsBackButton ?? chrome === "top-bar-back";

  if (chrome === "bottom-tabs") {
    showPrimaryNavigation = true;
    showsBackButton = false;
  }

  if (chrome === "modal-sheet") {
    showPrimaryNavigation = false;
    showsBackButton = false;
  }

  if (screenPlan.type !== "root" && !referenceNavigationVisible) {
    showPrimaryNavigation = false;
  }

  if (screenPlan.type === "detail" && chrome !== "modal-sheet" && !referenceNavigationVisible) {
    showsBackButton = requestedPolicy?.showsBackButton ?? true;
  }

  if (screenPlan.type === "root" && chrome !== "top-bar-back") {
    showsBackButton = false;
  }

  return {
    chrome,
    showPrimaryNavigation,
    showsBackButton,
  };
}

export function describeNavigationArchitecture(navigationArchitecture?: NavigationArchitecture | null) {
  const normalized = createNavigationArchitecture({ navigationArchitecture });

  switch (normalized.kind) {
    case "bottom-tabs-app":
      return "Tabbed app architecture";
    case "single-screen":
      return "Single-screen flow";
    default:
      return "Hierarchical flow";
  }
}

export function describeScreenNavigation(screenPlan: ScreenPlan, navigationArchitecture?: NavigationArchitecture | null) {
  const chromePolicy = resolveScreenChromePolicy({ screenPlan, navigationArchitecture });

  switch (chromePolicy.chrome) {
    case "bottom-tabs":
      return "Primary tab screen";
    case "top-bar-back":
      return "Back-stack detail";
    case "modal-sheet":
      return "Sheet presentation";
    case "immersive":
      return screenPlan.type === "root" ? "Immersive root screen" : "Immersive detail";
    default:
      return screenPlan.type === "root" ? "Standalone root screen" : "Detail screen";
  }
}
