import { describe, expect, it } from "vitest";

import { applyDeleteElement, applyDuplicateElement } from "@/lib/drawgle-dom";
import { normalizeReferenceAnalysis } from "@/lib/generation/scope-contract";
import { normalizeSharedNavigationClearanceHtml } from "@/lib/generation/screen-quality";
import {
  createNavigationArchitecture,
  reconcileNavigationArchitectureWithPlan,
  resolveScreenChromePolicy,
} from "@/lib/navigation";
import {
  applyReferenceNavigationRolesToScreens,
  applyReferenceNavigationAppearance,
  applyNavigationDesignEdit,
  createFallbackNavigationPlan,
  deriveReferenceNavigationPlan,
  detectLocalNavigationMarkup,
  normalizeNavigationDesignContract,
  normalizeNavigationPlan,
  parseStoredNavigationPlan,
  renderDeterministicNavigationShell,
  sanitizeScreenCodeForSharedNavigation,
  validateNavigationShell,
} from "@/lib/project-navigation";
import type { NavigationAnatomy, NavigationArchitecture, NavigationPlan, ScreenPlan } from "@/lib/types";

const architecture: NavigationArchitecture = {
  kind: "bottom-tabs-app",
  primaryNavigation: "bottom-tabs",
  rootChrome: "bottom-tabs",
  detailChrome: "top-bar-back",
  consistencyRules: [],
  rationale: "Peer product destinations",
};

const design = (anatomy: NavigationAnatomy = "floating-dock"): NonNullable<NavigationPlan["design"]> => ({
  anatomy,
  width: anatomy === "fixed-tab-rail" ? "inset" : "content",
  labels: anatomy === "compact-icon-rail" ? "hidden" : "always",
  activeTreatment: anatomy === "fixed-tab-rail" ? "tint" : "icon-fill",
  surface: anatomy === "glass-dock" ? "glass" : "solid",
  radiusPx: 24,
  safeAreaOffsetPx: 12,
  itemGapPx: 4,
  iconSizePx: 20,
  border: true,
  elevation: "low",
  centerActionItemId: anatomy === "center-action-dock" ? "book" : null,
});

const v2Plan = (
  items: NavigationPlan["items"],
  decision: NavigationPlan["decision"] = "project-native",
  anatomy: NavigationAnatomy = "floating-dock",
): NavigationPlan => ({
  version: 2,
  decision,
  evidence: {
    source: decision === "reference-derived" ? "reference" : "product-architecture",
    reason: "Positive navigation evidence",
  },
  design: design(anatomy),
  enabled: true,
  kind: "bottom-tabs",
  items,
  visualBrief: "Typed navigation",
  screenChrome: [],
});

describe("Production Navigation V2", () => {
  it("lets an explicit planned chrome policy outrank immersive keywords", () => {
    const activeSession: ScreenPlan = {
      name: "AI Assistant Session",
      type: "root",
      description: "An active assistant conversation with listening controls.",
      chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    };
    expect(resolveScreenChromePolicy({ screenPlan: activeSession, navigationArchitecture: architecture }).chrome)
      .toBe("bottom-tabs");
    expect(resolveScreenChromePolicy({
      screenPlan: { ...activeSession, chromePolicy: null },
      navigationArchitecture: architecture,
    }).chrome).toBe("immersive");
  });

  it("keeps a typed blueprint destination even when its name matches an immersive heuristic", () => {
    const screens: ScreenPlan[] = [
      { name: "AI Assistant", type: "root", description: "Primary product workspace" },
      { name: "Library", type: "root", description: "Browse saved knowledge" },
      { name: "Activity", type: "root", description: "Review recent work" },
    ];
    const source = v2Plan([
      { id: "assistant", label: "Assist", icon: "sparkles", role: "Use the primary assistant workspace", linkedScreenName: "AI Assistant" },
      { id: "library", label: "Library", icon: "library", role: "Browse saved knowledge", linkedScreenName: "Library" },
      { id: "activity", label: "Activity", icon: "history", role: "Review recent work", linkedScreenName: "Activity" },
    ]);
    source.screenChrome = [
      { screenName: "AI Assistant", chrome: "bottom-tabs", navigationItemId: "assistant" },
      { screenName: "Library", chrome: "bottom-tabs", navigationItemId: "library" },
      { screenName: "Activity", chrome: "bottom-tabs", navigationItemId: "activity" },
    ];
    const normalized = normalizeNavigationPlan({ navigationPlan: source, screens, navigationArchitecture: architecture });
    expect(normalized.items.find((item) => item.id === "assistant")).toMatchObject({
      availability: "generated",
      linkedScreenName: "AI Assistant",
    });
    expect(normalized.screenChrome[0]).toMatchObject({ chrome: "bottom-tabs", navigationItemId: "assistant" });
  });

  it("never fabricates default navigation", () => {
    const screens: ScreenPlan[] = [{ name: "Dashboard", type: "root", description: "Focused dashboard" }];
    expect(createFallbackNavigationPlan({ screens, navigationArchitecture: architecture, requiresBottomNav: true }).enabled).toBe(false);
    expect(normalizeNavigationPlan({ screens, navigationArchitecture: architecture, requiresBottomNav: true }).items).toEqual([]);
  });

  it("keeps architecture aligned with the final normalized navigation decision", () => {
    const canonicalBottomTabs = createNavigationArchitecture({
      navigationArchitecture: {
        ...architecture,
        kind: "hierarchical",
        primaryNavigation: "bottom-tabs",
        rootChrome: "top-bar",
      },
    });
    expect(canonicalBottomTabs).toMatchObject({
      kind: "bottom-tabs-app",
      primaryNavigation: "bottom-tabs",
      rootChrome: "bottom-tabs",
    });

    const disabledPlan = createFallbackNavigationPlan({
      screens: [{ name: "Dashboard", type: "root", description: "Focused dashboard" }],
      navigationArchitecture: canonicalBottomTabs,
      requiresBottomNav: true,
    });
    const reconciled = reconcileNavigationArchitectureWithPlan({
      navigationArchitecture: canonicalBottomTabs,
      navigationPlan: disabledPlan,
    });
    expect(disabledPlan.enabled).toBe(false);
    expect(reconciled).toMatchObject({
      kind: "hierarchical",
      primaryNavigation: "none",
      rootChrome: "top-bar",
    });
  });

  it("supports one generated taxi screen and three planned product destinations", () => {
    const screens: ScreenPlan[] = [{ name: "Ride Dashboard", type: "root", description: "Book a ride" }];
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "book", label: "Book", icon: "car", role: "Book and monitor rides", availability: "generated", linkedScreenName: "Ride Dashboard" },
        { id: "trips", label: "Trips", icon: "clock-3", role: "Review ride history", availability: "planned", linkedScreenName: null },
        { id: "pay", label: "Pay", icon: "wallet-cards", role: "Manage payment methods", availability: "planned", linkedScreenName: null },
        { id: "account", label: "Account", icon: "circle-user", role: "Manage rider identity", availability: "planned", linkedScreenName: null },
      ]),
      screens,
      navigationArchitecture: architecture,
    });

    expect(plan.enabled).toBe(true);
    expect(plan.items).toHaveLength(4);
    expect(plan.items.filter((item) => item.availability === "generated")).toHaveLength(1);
    expect(plan.items.filter((item) => item.availability === "planned")).toHaveLength(3);
    expect(plan.screenChrome[0].navigationItemId).toBe("book");

    const shell = renderDeterministicNavigationShell(plan);
    expect(shell.match(/<nav\b[^>]*data-drawgle-primary-nav/g)).toHaveLength(1);
    expect(shell.match(/data-nav-availability="planned"/g)).toHaveLength(3);
    expect(shell).toContain('aria-disabled="true"');
    expect(validateNavigationShell(shell, plan)).toBe(true);
  });

  it("preserves exact two-item reference navigation with per-screen active states", () => {
    const screens: ScreenPlan[] = [
      { name: "Portfolio", type: "root", description: "Portfolio" },
      { name: "Markets", type: "root", description: "Markets" },
    ];
    const source = v2Plan([
      { id: "portfolio", label: "Portfolio", icon: "wallet", role: "Portfolio overview", linkedScreenName: "Portfolio" },
      { id: "markets", label: "Markets", icon: "chart-no-axes-combined", role: "Market discovery", linkedScreenName: "Markets" },
    ], "reference-derived", "compact-icon-rail");
    source.screenChrome = [
      { screenName: "Portfolio", chrome: "bottom-tabs", navigationItemId: "portfolio" },
      { screenName: "Markets", chrome: "bottom-tabs", navigationItemId: "markets" },
    ];

    const plan = normalizeNavigationPlan({ navigationPlan: source, screens, navigationArchitecture: architecture });
    expect(plan.enabled).toBe(true);
    expect(plan.items).toHaveLength(2);
    expect(plan.screenChrome.map((entry) => entry.navigationItemId)).toEqual(["portfolio", "markets"]);
    expect(renderDeterministicNavigationShell(plan)).toContain('data-navigation-anatomy="compact-icon-rail"');
  });

  it("recovers one shared dock from repeated saved reference DNA", () => {
    const referenceAnalysis = normalizeReferenceAnalysis({
      overallVisualStyle: "Playful learning app",
      screenCountEstimate: 3,
      screenReferences: [
        { index: 1, suggestedRole: "Onboarding / Splash" },
        { index: 2, suggestedRole: "Dashboard / Home" },
        { index: 3, suggestedRole: "Lesson Browser" },
      ],
      primaryNavigation: {
        present: true,
        repeatedAcrossScreens: true,
        itemCount: 4,
        items: [
          { label: "Home", icon: "house" },
          { label: "Lessons", icon: "book-open" },
          { label: "Progress", icon: "chart-no-axes-column" },
          { label: "Settings", icon: "settings" },
        ],
        anatomy: "floating-dock",
        activeItemByScreen: [
          { screenIndex: 2, itemIndex: 1 },
          { screenIndex: 3, itemIndex: 2 },
        ],
      },
      designSystemSignals: {},
    }).analysis!;
    const classified = applyReferenceNavigationRolesToScreens([
      { name: "Onboarding / Splash", type: "root", description: "Immersive welcome" },
      { name: "Dashboard / Home", type: "detail", description: "Learning dashboard" },
      { name: "Lesson Browser", type: "detail", description: "Browse lessons" },
    ], referenceAnalysis);
    const recovered = deriveReferenceNavigationPlan({ screens: classified, referenceAnalysis });
    const normalized = normalizeNavigationPlan({
      navigationPlan: recovered,
      screens: classified,
      navigationArchitecture: architecture,
    });

    expect(classified.map((screen) => screen.type)).toEqual(["root", "root", "root"]);
    expect(normalized.enabled).toBe(true);
    expect(normalized.items.filter((item) => item.availability === "generated").map((item) => item.linkedScreenName)).toEqual([
      "Dashboard / Home",
      "Lesson Browser",
    ]);
    expect(normalized.screenChrome.map((entry) => entry.navigationItemId)).toEqual([null, "home", "lessons"]);
    expect(renderDeterministicNavigationShell(normalized).match(/<nav\b[^>]*data-drawgle-primary-nav/g)).toHaveLength(1);
  });

  it("skins product-owned destinations from a root-only reference dock without copying its labels", () => {
    const referenceAnalysis = normalizeReferenceAnalysis({
      overallVisualStyle: "Compact white finance UI",
      screenCountEstimate: 3,
      screenReferences: [
        { index: 1, suggestedRole: "Root" },
        { index: 2, suggestedRole: "Detail" },
        { index: 3, suggestedRole: "Detail" },
      ],
      primaryNavigation: {
        present: true,
        repeatedAcrossScreens: false,
        itemCount: 4,
        items: [
          { label: "Finance Home", icon: "house" },
          { label: "Stats", icon: "chart" },
          { label: "Calendar", icon: "calendar" },
          { label: "Profile", icon: "user" },
        ],
        anatomy: "floating-dock",
        labels: "always",
        visibleOnScreenIndexes: [1],
        absentOnScreenIndexes: [2, 3],
      },
      geometryProfile: { measurements: [
        { role: "navigation-height", minPx: 55, maxPx: 57, confidence: "high", sourceScreenIndexes: [1], scope: "component-family", sourceLayer: "app-ui", note: "floating root dock" },
        { role: "navigation-inset", minPx: 19, maxPx: 21, confidence: "high", sourceScreenIndexes: [1], scope: "component-family", sourceLayer: "app-ui", note: "dock inset" },
        { role: "navigation-icon-size", minPx: 17, maxPx: 19, confidence: "high", sourceScreenIndexes: [1], scope: "component-family", sourceLayer: "app-ui", note: "dock icons" },
      ] },
      designSystemSignals: {},
    }).analysis!;
    const productPlan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "catalog", label: "Catalog", icon: "layout-grid", role: "Browse sneaker catalog", linkedScreenName: "Sneaker Catalog" },
        { id: "search", label: "Search", icon: "search", role: "Search sneakers", linkedScreenName: "Search Discovery" },
        { id: "saved", label: "Saved", icon: "heart", role: "Review saved sneakers", linkedScreenName: null },
        { id: "account", label: "Account", icon: "user", role: "Manage sneaker account", linkedScreenName: "User Profile" },
      ]),
      screens: [
        { name: "Sneaker Catalog", type: "root", description: "Catalog" },
        { name: "Search Discovery", type: "root", description: "Search" },
        { name: "User Profile", type: "root", description: "Profile" },
      ],
      navigationArchitecture: architecture,
    });
    const styled = applyReferenceNavigationAppearance({ navigationPlan: productPlan, referenceAnalysis });
    expect(styled.version).toBe(3);
    expect(styled.appearance?.source).toBe("reference");
    expect(styled.items.map((item) => item.label)).toEqual(["Catalog", "Search", "Saved", "Account"]);
    expect(styled.items.map((item) => item.label)).not.toContain("Finance Home");
    const shell = renderDeterministicNavigationShell(styled);
    expect(shell).toContain('data-navigation-layout="floating-content-dock"');
    expect(shell).toContain("--dg-navigation-anatomy-height:56px");
    expect(shell).toContain("calc(100% - (2 * 20px))");
    expect(shell).toContain("min(312px,calc(100% - (2 * 20px)))");

    // Changed 2026-08-12. "Saved" is a destination the product declared and has
    // not built yet, and it used to be filtered out of the dock entirely. The
    // dock now renders the declared architecture: all four tabs, with the
    // unbuilt one inert. The subject of this test — product labels, never the
    // reference dock's labels — is unaffected.
    expect(shell).toContain("Saved");
    expect(shell).toContain('data-nav-item-id="saved"');
    expect(shell).toContain('aria-disabled="true"');
    expect((shell.match(/data-nav-availability="planned"/g) ?? []).length).toBe(1);
    expect((shell.match(/data-nav-availability="generated"/g) ?? []).length).toBe(3);
  });

  it("keeps planner construction while using project tokens only for missing V3 measurements", () => {
    const productPlan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "home", label: "Home", icon: "home", role: "Home overview", linkedScreenName: "Home" },
        { id: "search", label: "Search", icon: "search", role: "Search content", linkedScreenName: "Search" },
        { id: "profile", label: "Profile", icon: "user", role: "Manage profile", linkedScreenName: "Profile" },
      ]),
      screens: [
        { name: "Home", type: "root", description: "Home" },
        { name: "Search", type: "root", description: "Search" },
        { name: "Profile", type: "root", description: "Profile" },
      ],
      navigationArchitecture: architecture,
    });
    const styled = applyReferenceNavigationAppearance({
      navigationPlan: productPlan,
      designTokens: {
        tokens: {
          navigation: {
            anatomy: "compact-icon-rail",
            labels: "hidden",
            active_treatment: "underline",
            surface_material: "translucent",
            container_height: "60px",
            max_width: "300px",
            horizontal_inset: "18px",
          },
        },
      },
    });
    const shell = renderDeterministicNavigationShell(styled);
    expect(styled.appearance?.geometryOwner).toBe("navigation-plan");
    expect(styled.appearance?.primary).toMatchObject({
      anatomy: "floating-dock",
      labels: "always",
      activeTreatment: "icon-fill",
      surface: "solid",
      containerHeightPx: 60,
      maxWidthPx: 300,
      horizontalInsetPx: 18,
    });
    expect(shell).toContain('data-navigation-layout="floating-content-dock"');
    expect(shell).toContain("--dg-navigation-anatomy-height:60px");
    expect(shell).toContain("calc(100% - (2 * 18px))");
    expect(shell).toContain("border-radius:18px");
    expect(shell).toContain("border-radius:var(--dg-radii-pill,9999px)");
  });

  it("does not overwrite a planner-selected fixed glass rail with generic floating token defaults", () => {
    const productPlan = normalizeNavigationPlan({
      navigationPlan: {
        ...v2Plan([
          { id: "today", label: "Today", icon: "activity", role: "Daily activity", linkedScreenName: "Today" },
          { id: "workouts", label: "Workouts", icon: "dumbbell", role: "Workout library", linkedScreenName: "Workouts" },
          { id: "progress", label: "Progress", icon: "chart-line", role: "Progress analysis", linkedScreenName: "Progress" },
        ], "project-native", "fixed-tab-rail"),
        visualBrief: "Use a fixed-tab rail with a glass surface; a floating dock was rejected because labels need the width.",
        design: {
          ...design("fixed-tab-rail"),
          width: "full",
          surface: "glass",
          activeTreatment: "underline",
          radiusPx: 0,
        },
      },
      screens: [
        { name: "Today", type: "root", description: "Today" },
        { name: "Workouts", type: "root", description: "Workouts" },
        { name: "Progress", type: "root", description: "Progress" },
      ],
      navigationArchitecture: architecture,
    });
    const styled = applyReferenceNavigationAppearance({
      navigationPlan: productPlan,
      designTokens: {
        tokens: {
          navigation: {
            anatomy: "floating-dock",
            width: "inset",
            labels: "always",
            active_treatment: "tint",
            surface_material: "solid",
            container_height: "72px",
            horizontal_inset: "24px",
            horizontal_padding: "8px",
            vertical_padding: "4px",
          },
        },
      },
    });

    expect(styled.appearance?.primary).toMatchObject({
      anatomy: "fixed-tab-rail",
      width: "full",
      surface: "glass",
      activeTreatment: "underline",
      radiusPx: 0,
    });
    const shell = renderDeterministicNavigationShell(styled);
    expect(shell).toContain('data-navigation-layout="attached-edge-rail"');
    expect(shell).toContain("width:100%");
    expect(shell).toContain("border-radius:0");
    expect(shell).toContain('data-navigation-active-treatment="underline"');
  });

  it("uses active content color for tint so a transparent active surface cannot erase the tab", () => {
    const productPlan = normalizeNavigationPlan({
      navigationPlan: {
        ...v2Plan([
          { id: "home", label: "Home", icon: "home", role: "Dashboard", linkedScreenName: "Home" },
          { id: "products", label: "Products", icon: "archive", role: "Inventory", linkedScreenName: "Products" },
          { id: "profile", label: "Profile", icon: "user", role: "Account", linkedScreenName: "Profile" },
        ]),
        design: { ...design(), activeTreatment: "tint" },
      },
      screens: [
        { name: "Home", type: "root", description: "Dashboard" },
        { name: "Products", type: "root", description: "Inventory" },
        { name: "Profile", type: "root", description: "Account" },
      ],
      navigationArchitecture: architecture,
    });
    const shell = renderDeterministicNavigationShell(
      applyReferenceNavigationAppearance({ navigationPlan: productPlan }),
    );

    expect(shell).toContain(
      '.dg-nav-item[data-active="true"]{color:var(--dg-navigation-active-content,var(--dg-color-action-primary,#111827));}',
    );
    expect(shell).not.toContain(
      '.dg-nav-item[data-active="true"]{color:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));}',
    );
  });

  it.each([
    ["fixed-tab-rail", "attached-edge-rail"],
    ["floating-dock", "floating-content-dock"],
    ["glass-dock", "inset-glass-ribbon"],
    ["compact-icon-rail", "compact-icon-capsule"],
    ["center-action-dock", "lifted-center-action"],
  ] as Array<[NavigationAnatomy, string]>)
  ("keeps the V3 %s anatomy as a distinct construction", (anatomy, layout) => {
    const productPlan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "today", label: "Today", icon: "activity", role: "Daily activity", linkedScreenName: "Today" },
        { id: "progress", label: "Progress", icon: "chart-line", role: "Progress analysis", linkedScreenName: "Progress" },
        { id: "profile", label: "Profile", icon: "user", role: "Manage profile", linkedScreenName: "Profile" },
      ], "project-native", anatomy),
      screens: [
        { name: "Today", type: "root", description: "Today" },
        { name: "Progress", type: "root", description: "Progress" },
        { name: "Profile", type: "root", description: "Profile" },
      ],
      navigationArchitecture: architecture,
    });
    const styled = applyReferenceNavigationAppearance({ navigationPlan: productPlan });
    const shell = renderDeterministicNavigationShell(styled);

    expect(styled.version).toBe(3);
    expect(styled.appearance?.primary?.anatomy).toBe(anatomy);
    expect(shell).toContain(`data-navigation-layout="${layout}"`);
    expect(shell).toContain("--dg-navigation-visual-height:var(--dg-navigation-anatomy-height)");
    if (anatomy === "fixed-tab-rail") expect(shell).toContain("width:100%;");
    if (anatomy === "glass-dock") expect(shell).toContain("backdrop-filter:blur(12px)");
    if (anatomy === "compact-icon-rail") expect(shell).toContain('data-navigation-labels="hidden"');
    if (anatomy === "center-action-dock") expect(shell).toContain("dg-nav-item-center-action");
  });

  it("does not combine explicit back chrome with persistent navigation", () => {
    const screens: ScreenPlan[] = [
      { name: "Home", type: "root", description: "Home" },
      {
        name: "Create Link",
        type: "root",
        description: "Focused form flow",
        chromePolicy: { chrome: "top-bar-back", showPrimaryNavigation: false, showsBackButton: true },
      },
      { name: "Clients", type: "root", description: "Clients" },
    ];
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "home", label: "Home", icon: "home", role: "Home overview", linkedScreenName: "Home" },
        { id: "create", label: "Create", icon: "plus", role: "Create payment link", linkedScreenName: "Create Link" },
        { id: "clients", label: "Clients", icon: "users", role: "Client list", linkedScreenName: "Clients" },
      ]),
      screens,
      navigationArchitecture: architecture,
    });
    expect(plan.screenChrome.find((item) => item.screenName === "Create Link")).toMatchObject({
      chrome: "top-bar-back",
      navigationItemId: null,
    });
  });

  it("rejects duplicate and filler destinations instead of collapsing to one item", () => {
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "one", label: "Portfolio", icon: "wallet", role: "Portfolio overview", linkedScreenName: "Portfolio" },
        { id: "two", label: "Portfolio", icon: "wallet", role: "Portfolio overview", linkedScreenName: "Portfolio" },
        { id: "three", label: "Tab 3", icon: "circle", role: "Generic destination", linkedScreenName: null },
      ]),
      screens: [{ name: "Portfolio", type: "root", description: "Portfolio" }],
      navigationArchitecture: architecture,
    });

    expect(plan.enabled).toBe(false);
    expect(plan.items).toEqual([]);
    expect(renderDeterministicNavigationShell(plan)).toBe("");
  });

  it("never activates navigation on immersive or detail screens", () => {
    const screens: ScreenPlan[] = [
      { name: "Ride Dashboard", type: "root", description: "Taxi dashboard" },
      { name: "Login", type: "root", description: "Authentication" },
      { name: "Trip Detail", type: "detail", description: "Receipt detail" },
    ];
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "book", label: "Book", icon: "car", role: "Book rides", linkedScreenName: "Ride Dashboard" },
        { id: "access", label: "Access", icon: "log-in", role: "Authenticate rider", linkedScreenName: "Login" },
        { id: "receipt", label: "Receipt", icon: "receipt", role: "Inspect a receipt", linkedScreenName: "Trip Detail" },
        { id: "trips", label: "Trips", icon: "clock", role: "Review trip history", linkedScreenName: null },
      ]),
      screens,
      navigationArchitecture: architecture,
    });

    expect(plan.screenChrome.find((entry) => entry.screenName === "Login")).toMatchObject({ chrome: "immersive", navigationItemId: null });
    expect(plan.screenChrome.find((entry) => entry.screenName === "Trip Detail")?.navigationItemId).toBeNull();
    expect(plan.items.find((item) => item.id === "access")?.availability).toBe("planned");
  });

  it("does not treat a hero section as an immersive screen", () => {
    const resolved = resolveScreenChromePolicy({
      screenPlan: { name: "Portfolio Dashboard", type: "root", description: "Premium balance hero section" },
      navigationArchitecture: architecture,
    });
    expect(resolved.chrome).toBe("bottom-tabs");
    expect(resolved.showPrimaryNavigation).toBe(true);
  });

  it.each([
    "fixed-tab-rail",
    "floating-dock",
    "glass-dock",
    "compact-icon-rail",
    "center-action-dock",
  ] as NavigationAnatomy[])("renders valid %s anatomy at 3, 4, and 5 items", (anatomy) => {
    for (const count of [3, 4, 5]) {
      const items = Array.from({ length: count }, (_, index) => ({
        id: index === 0 ? "book" : "area-" + (index + 1),
        label: index === 0 ? "Book" : "Area " + (index + 1),
        icon: index === 0 ? "car" : "circle",
        role: index === 0 ? "Book rides" : "Product area " + (index + 1),
        availability: index === 0 ? "generated" as const : "planned" as const,
        linkedScreenName: index === 0 ? "Ride Dashboard" : null,
      }));
      const plan = normalizeNavigationPlan({
        navigationPlan: v2Plan(items, "project-native", anatomy),
        screens: [{ name: "Ride Dashboard", type: "root", description: "Taxi dashboard" }],
        navigationArchitecture: architecture,
      });
      const shell = renderDeterministicNavigationShell(plan);
      expect(validateNavigationShell(shell, plan)).toBe(true);
      expect(shell).toContain('data-navigation-anatomy="' + anatomy + '"');
      expect(shell).toContain(`data-navigation-layout="${({
        "fixed-tab-rail": "attached-edge-rail",
        "floating-dock": "floating-content-dock",
        "glass-dock": "inset-glass-ribbon",
        "compact-icon-rail": "compact-icon-capsule",
        "center-action-dock": "lifted-center-action",
      } as Record<NavigationAnatomy, string>)[anatomy]}"`);
      expect(shell.match(/data-nav-item-id=/g)).toHaveLength(count);
      expect(shell).toContain("--dg-navigation-visual-height:clamp(64px");
      expect(shell).toMatch(/\.dg-nav-item\{[^}]*border-radius:(?:\d+px|var\(--dg-radii-pill,9999px\))/);
      expect(shell).toContain("border-radius:var(--dg-radii-pill,9999px)");
      expect(shell).toContain(`--dg-navigation-overlap-buffer:${anatomy === "center-action-dock" ? 20 : 8}px`);
      if (anatomy === "fixed-tab-rail") expect(shell).toContain("width:100%;");
      if (anatomy === "compact-icon-rail") expect(shell).toContain("--dg-navigation-anatomy-height:58px");
      if (anatomy === "glass-dock") expect(shell).toContain("backdrop-filter:blur(18px)");
      if (anatomy === "center-action-dock") expect(shell).toContain("dg-nav-item-center-action");
    }
  });

  it("reconciles the legacy schema-example dock with stronger visual-brief evidence", () => {
    const legacyExample = design("floating-dock");
    legacyExample.radiusPx = 28;

    expect(normalizeNavigationDesignContract(legacyExample, "A frosted glass ribbon with active-only labels")).toMatchObject({
      anatomy: "glass-dock",
      width: "inset",
      labels: "active-only",
      surface: "glass",
    });
    expect(normalizeNavigationDesignContract(legacyExample, "A full-width attached tab rail with an underline")).toMatchObject({
      anatomy: "fixed-tab-rail",
      width: "full",
      activeTreatment: "underline",
      radiusPx: 0,
    });
  });

  it("repairs the duplicate clearance structure from project 66e193d9 without exposing a second band", () => {
    const source = [
      '<div class="min-h-screen dg-bg-primary">',
      '  <section class="bg-white overflow-y-auto pb-[calc(var(--dg-sizing-bottom-nav-height)+24px)]"><div>Transactions</div></section>',
      '  <!-- Bottom navigation clearance spacer -->',
      '  <div class="h-[var(--dg-sizing-bottom-nav-height)] shrink-0"></div>',
      "</div>",
    ].join("\n");
    const normalized = normalizeSharedNavigationClearanceHtml({ code: source, enabled: true });

    expect(normalized.diagnostics.spacerRemovedCount).toBe(1);
    expect(normalized.diagnostics.legacyPaddingReplacedCount).toBe(1);
    expect(normalized.code).toContain('class="bg-white overflow-y-auto dg-shared-nav-clearance"');
    expect(normalized.code).toContain('data-drawgle-nav-clearance-owner="true"');
    expect(normalized.code).not.toContain("h-[var(--dg-sizing-bottom-nav-height)]");
    expect(normalized.code).not.toContain("pb-[calc(");
    expect(normalized.code.match(/data-drawgle-nav-clearance-owner="true"/g)).toHaveLength(1);

    const normalizedAgain = normalizeSharedNavigationClearanceHtml({
      code: normalized.code,
      enabled: true,
    });
    expect(normalizedAgain.code).toBe(normalized.code);
    expect(normalizedAgain.diagnostics.changed).toBe(false);
  });

  it("repairs the safe-area spacer structure from project 894fe207 while preserving real content", () => {
    const source = [
      '<main class="min-h-screen overflow-y-auto pb-[calc(var(--dg-mobile-layout-safe-area-bottom)+112px)]">',
      "  <section>Payment history</section>",
      '  <div class="h-[calc(var(--dg-mobile-layout-safe-area-bottom)+96px)]" aria-label="bottom navigation spacer"></div>',
      '  <div class="h-8" data-purpose="decorative breathing room"></div>',
      "</main>",
    ].join("\n");
    const normalized = normalizeSharedNavigationClearanceHtml({ code: source, enabled: true });

    expect(normalized.code).toContain("Payment history");
    expect(normalized.code).toContain('class="h-8"');
    expect(normalized.code).not.toContain("112px");
    expect(normalized.code).not.toContain("96px");
    expect(normalized.code.match(/dg-shared-nav-clearance/g)).toHaveLength(1);
    expect(normalized.diagnostics.spacerRemovedCount).toBe(1);
  });

  it("leaves screens without shared navigation unchanged", () => {
    const source = '<main class="pb-[calc(var(--dg-mobile-layout-safe-area-bottom)+112px)]">Detail</main>';
    expect(normalizeSharedNavigationClearanceHtml({ code: source, enabled: false }).code).toBe(source);
  });

  it("removes a high-confidence dock but preserves a single contextual CTA", () => {
    const screen: ScreenPlan = {
      name: "Dashboard",
      type: "root",
      description: "Dashboard",
      navigationItemId: "home",
      chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    };
    const dock = '<main>Content</main><!-- Floating Navigation Pill --><div class="fixed bottom-[16px]"><button><i data-lucide="home"></i>Home</button><button><i data-lucide="search"></i>Search</button></div>';
    const cta = '<main>Checkout</main><footer class="fixed bottom-0 inset-x-0"><button>Pay securely</button></footer>';

    const sanitizedDock = sanitizeScreenCodeForSharedNavigation(dock, screen, { projectNavigationEnabled: true });
    const sanitizedCta = sanitizeScreenCodeForSharedNavigation(cta, screen, { projectNavigationEnabled: true });
    expect(detectLocalNavigationMarkup(sanitizedDock).hasLocalNavigation).toBe(false);
    expect(sanitizedCta).toContain("Pay securely");
    expect(detectLocalNavigationMarkup(sanitizedCta).hasLocalNavigation).toBe(false);
  });

  it("preserves an absolute vehicle-control overlay with multiple icon buttons", () => {
    const screen: ScreenPlan = {
      name: "Remote Controls / Vehicle Interaction",
      type: "root",
      description: "A car surrounded by six remote control nodes.",
      navigationItemId: "controls",
      chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    };
    const controls = [
      ["car-front", "Frunk"],
      ["car", "Trunk"],
      ["lightbulb", "Flash"],
      ["megaphone", "Horn"],
      ["lock", "Driver Door"],
      ["lock", "Passenger Door"],
    ].map(([icon, label]) =>
      `<button type="button"><i data-lucide="${icon}"></i><span>${label}</span></button>`,
    ).join("");
    const source = [
      '<main class="min-h-screen">',
      '  <section class="relative h-[420px]">',
      '    <img alt="Top-down vehicle">',
      `    <div class="absolute inset-0">${controls}</div>`,
      "  </section>",
      "</main>",
    ].join("");

    const sanitized = sanitizeScreenCodeForSharedNavigation(source, screen, {
      projectNavigationEnabled: true,
    });

    expect(sanitized).toContain('class="absolute inset-0"');
    expect(sanitized).toContain("Frunk");
    expect(sanitized).toContain("Passenger Door");
    expect((sanitized.match(/<button/g) ?? [])).toHaveLength(6);
    expect(detectLocalNavigationMarkup(sanitized).hasLocalNavigation).toBe(false);
  });

  it("still removes a bottom-anchored multi-button navigation dock", () => {
    const screen: ScreenPlan = {
      name: "Dashboard",
      type: "root",
      description: "Dashboard",
      navigationItemId: "home",
      chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    };
    const source = [
      "<main>Dashboard</main>",
      '<div class="absolute inset-x-0 bottom-4">',
      '  <button><i data-lucide="home"></i><span>Home</span></button>',
      '  <button><i data-lucide="settings"></i><span>Settings</span></button>',
      '  <button><i data-lucide="user"></i><span>Profile</span></button>',
      "</div>",
    ].join("");

    expect(sanitizeScreenCodeForSharedNavigation(source, screen, {
      projectNavigationEnabled: true,
    })).toBe("<main>Dashboard</main>");
  });

  it("preserves a bottom-anchored contextual action bar", () => {
    const screen: ScreenPlan = {
      name: "Trip Planning",
      type: "root",
      description: "Plan a vehicle trip.",
      navigationItemId: "trips",
      chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    };
    const source = [
      "<main>Trip details</main>",
      '<footer class="fixed inset-x-0 bottom-0">',
      '  <button><i data-lucide="x"></i><span>Cancel</span></button>',
      '  <button><i data-lucide="send"></i><span>Send to car</span></button>',
      "</footer>",
    ].join("");

    const sanitized = sanitizeScreenCodeForSharedNavigation(source, screen, {
      projectNavigationEnabled: true,
    });

    expect(sanitized).toBe(source);
    expect(detectLocalNavigationMarkup(sanitized).hasLocalNavigation).toBe(false);
  });

  it("keeps project 6f5db1c9-0a24-445c-b37a-b0fe0fdae29f readable as V1 until explicit repair", () => {
    const stored = parseStoredNavigationPlan({
      enabled: true,
      kind: "bottom-tabs",
      items: [{ id: "home", label: "Home", icon: "home", role: "Ride dashboard", linkedScreenName: "Home" }],
      visualBrief: "Legacy taxi dock",
      screenChrome: [{ screenName: "Home", chrome: "bottom-tabs", navigationItemId: "home" }],
    });
    expect(stored.version).toBe(1);
    expect(stored.enabled).toBe(true);
    expect(stored.items).toHaveLength(1);
  });

  it("repairs project 76e82cc8-8ced-48ed-93c8-3d09bea3dc31 without losing future product destinations", () => {
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "home", label: "Home", icon: "home", role: "Portfolio dashboard", linkedScreenName: "Portfolio Dashboard" },
        { id: "markets", label: "Markets", icon: "trending-up", role: "Market discovery", linkedScreenName: "Market Overview" },
        { id: "swap", label: "Swap", icon: "repeat", role: "Exchange assets", linkedScreenName: "Asset Detail" },
        { id: "wallet", label: "Wallet", icon: "wallet", role: "Manage assets", linkedScreenName: "Portfolio Dashboard" },
      ]),
      screens: [
        { name: "Portfolio Dashboard", type: "root", description: "Balance overview" },
        { name: "Asset Detail", type: "detail", description: "Asset chart" },
        { name: "Market Overview", type: "root", description: "Markets" },
      ],
      navigationArchitecture: architecture,
    });
    expect(plan.items).toHaveLength(4);
    expect(plan.items.filter((item) => item.availability === "generated")).toHaveLength(2);
    expect(plan.items.filter((item) => item.availability === "planned")).toHaveLength(2);
  });

  it("keeps project e87bdb35-6a9c-4b94-ac19-2cb3134d4729 as one shared three-tab shell", () => {
    const plan = normalizeNavigationPlan({
      navigationPlan: v2Plan([
        { id: "plan", label: "Plan", icon: "utensils", role: "Meal planning", linkedScreenName: "Meal Plan" },
        { id: "journal", label: "Journal", icon: "calendar", role: "Nutrition journal", linkedScreenName: "Journal" },
        { id: "learn", label: "Learn", icon: "book-open", role: "Nutrition learning", linkedScreenName: "Learning" },
      ]),
      screens: [
        { name: "Meal Plan", type: "root", description: "Meal planning" },
        { name: "Journal", type: "root", description: "Daily journal" },
        { name: "Learning", type: "root", description: "Learning library" },
      ],
      navigationArchitecture: architecture,
    });
    const shell = renderDeterministicNavigationShell(plan);
    expect(plan.screenChrome.map((entry) => entry.navigationItemId)).toEqual(["plan", "journal", "learn"]);
    expect(shell.match(/<nav\b[^>]*data-drawgle-primary-nav/g)).toHaveLength(1);
  });
  it("edits V2 navigation through the typed design contract", () => {
    const source = v2Plan([
      { id: "book", label: "Book", icon: "car", role: "Book rides", linkedScreenName: "Ride Dashboard" },
      { id: "trips", label: "Trips", icon: "clock", role: "Review trips", linkedScreenName: null },
      { id: "pay", label: "Pay", icon: "wallet", role: "Manage payments", linkedScreenName: null },
    ]);
    const edited = applyNavigationDesignEdit(source, "Make it a glass dock with active-only labels, no shadow, and rename Pay to Wallet");

    expect(edited.design).toMatchObject({
      anatomy: "glass-dock",
      surface: "glass",
      labels: "active-only",
      elevation: "none",
    });
    expect(edited.items.find((item) => item.id === "pay")?.label).toBe("Wallet");
    expect(validateNavigationShell(renderDeterministicNavigationShell(edited), edited)).toBe(true);
  });
  it("reads V1 rows and disables malformed V2 rows", () => {
    const v1 = parseStoredNavigationPlan({
      enabled: true,
      kind: "bottom-tabs",
      items: [
        { id: "home", label: "Home", icon: "home", role: "Overview", linkedScreenName: "Home" },
        { id: "settings", label: "Settings", icon: "settings", role: "Preferences", linkedScreenName: "Settings" },
      ],
      visualBrief: "Existing V1",
      screenChrome: [],
    });
    const malformed = parseStoredNavigationPlan({
      version: 2,
      decision: "project-native",
      evidence: { source: "product-architecture", reason: "Peer areas" },
      enabled: true,
      items: [{ id: "home", label: "Home", icon: "home", role: "Overview", linkedScreenName: "Home" }],
      screenChrome: [],
    });

    expect(parseStoredNavigationPlan({ ...v1, items: [v1.items[0]] }).enabled).toBe(true);
    expect(v1.version).toBe(1);
    expect(v1.enabled).toBe(true);
    expect(malformed.enabled).toBe(false);
  });
});

describe("Drawgle DOM root safety", () => {
  const code = '<div data-drawgle-id="root"><h1 data-drawgle-id="title">Hello</h1><p data-drawgle-id="desc">Text</p></div>';

  it("allows child changes", () => {
    expect(applyDeleteElement(code, "desc")).not.toContain("desc");
    expect(applyDuplicateElement(code, "title").match(/Hello/g)).toHaveLength(2);
  });

  it("rejects root changes", () => {
    expect(() => applyDeleteElement(code, "root")).toThrow();
    expect(() => applyDuplicateElement(code, "root")).toThrow();
  });
});
