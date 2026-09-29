import { describe, expect, it } from "vitest";

import { applyDeleteElement, applyDuplicateElement } from "@/lib/drawgle-dom";
import { normalizeReferenceAnalysis } from "@/lib/generation/scope-contract";
import { normalizeSharedNavigationClearanceHtml } from "@/lib/generation/screen-quality";
import { resolveScreenChromePolicy } from "@/lib/navigation";
import {
  applyReferenceNavigationRolesToScreens,
  applyReferenceNavigationStyle,
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
  it("never fabricates default navigation", () => {
    const screens: ScreenPlan[] = [{ name: "Dashboard", type: "root", description: "Focused dashboard" }];
    expect(createFallbackNavigationPlan({ screens, navigationArchitecture: architecture, requiresBottomNav: true }).enabled).toBe(false);
    expect(normalizeNavigationPlan({ screens, navigationArchitecture: architecture, requiresBottomNav: true }).items).toEqual([]);
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
      expect(shell).toContain("border-radius:var(--dg-radii-inner,");
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

describe("reference-built navigation", () => {
  const items = ["today", "calendar", "projects", "profile"].map((id, index) => ({
    id,
    label: id,
    icon: "circle",
    role: `Product area ${index + 1}`,
    availability: "generated" as const,
    linkedScreenName: `Area ${index + 1}`,
  }));
  const screens: ScreenPlan[] = items.map((_, index) => ({ name: `Area ${index + 1}`, type: "root", description: "Root product area" }));

  it("draws active-only chip navigation as an expanding capsule with round targets", () => {
    const plan = normalizeNavigationPlan({
      navigationPlan: { ...v2Plan(items), design: { ...design(), labels: "active-only", activeTreatment: "compact-chip", radiusPx: 36, inactiveTreatment: "well" } },
      screens,
      navigationArchitecture: architecture,
    });
    const shell = renderDeterministicNavigationShell(plan);

    expect(validateNavigationShell(shell, plan)).toBe(true);
    expect(shell).toContain('data-navigation-layout="expanding-capsule"');
    expect(shell).toContain("width:fit-content");
    expect(shell).toContain('.dg-nav-item[data-active="true"]{width:auto;padding:0 18px 0 14px;gap:8px;}');
    expect(shell).toContain('.dg-nav-item:not([data-active="true"]) .dg-nav-icon{background:color-mix(');
  });

  it("builds a style reference's visible navigation while keeping the product's destinations", () => {
    const analysis = normalizeReferenceAnalysis({
      overallVisualStyle: "Soft cobalt productivity UI",
      screenCountEstimate: 1,
      screenReferences: [{ index: 1, suggestedRole: "Task dashboard" }],
      primaryNavigation: {
        present: true,
        anatomy: "floating-dock",
        labels: "active-only",
        activeTreatment: "compact-chip",
        inactiveTreatment: "well",
        width: "content",
        material: "solid",
        geometry: "White pill hugging four items with 8px padding.",
        activeState: "Cobalt capsule holding the icon and label.",
        elevation: "Soft ambient shadow, no border.",
      },
    });
    const planned = normalizeNavigationPlan({ navigationPlan: v2Plan(items), screens, navigationArchitecture: architecture });
    const plan = applyReferenceNavigationStyle(planned, analysis.analysis?.primaryNavigation);

    expect(plan.items.map((item) => item.id)).toEqual(["today", "calendar", "projects", "profile"]);
    expect(plan.design).toMatchObject({
      anatomy: "floating-dock",
      labels: "active-only",
      activeTreatment: "compact-chip",
      inactiveTreatment: "well",
      width: "content",
      surface: "solid",
    });
    expect(applyReferenceNavigationStyle(planned, null)).toBe(planned);
  });
});

describe("an attached, icon-only bar with the active item in a filled circle", () => {
  const areas = ["today", "pets", "routines", "family"].map((id, index) => ({
    id, label: id, icon: id === "pets" ? "paw-print" : "circle", role: `Area ${index + 1}`,
    availability: "generated" as const, linkedScreenName: `Area ${index + 1}`,
  }));
  const screens: ScreenPlan[] = areas.map((_, index) => ({ name: `Area ${index + 1}`, type: "root", description: "Root area" }));
  const bar = (overrides: Partial<NonNullable<NavigationPlan["design"]>> = {}) => normalizeNavigationPlan({
    navigationPlan: { ...v2Plan(areas, "project-native", "fixed-tab-rail"),
      design: { ...design("fixed-tab-rail"), width: "full", labels: "hidden", activeTreatment: "icon-fill", radiusPx: 24, border: false, elevation: "none", ...overrides } },
    screens, navigationArchitecture: architecture,
  });
  const activeIcon = '.dg-nav-item[data-active="true"] .dg-nav-icon{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));';

  it("draws it attached to the bottom edge with rounded top corners and no labels", () => {
    const plan = bar();
    const shell = renderDeterministicNavigationShell(plan);
    expect(validateNavigationShell(shell, plan)).toBe(true);
    expect(shell).toContain('data-navigation-layout="attached-edge-rail"');
    expect(shell).toContain("width:100%;");
    // only the top corners round: the bottom edge is the screen's
    expect(shell).toContain("border-radius:24px 24px 0 0;");
    expect(shell).toContain(".dg-nav-label{max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;display:none;}");
    expect(shell).toContain('aria-label="pets"');
    expect(shell).toContain('data-lucide="paw-print"');
  });

  it("runs the attached bar flush to the bottom edge, with the home indicator's room inside it, and leaves a dock floating", () => {
    const shell = renderDeterministicNavigationShell(bar());
    expect(shell).toContain("margin:0 auto;padding:7px 12px calc(5px + var(--dg-effective-safe-area-bottom));");
    expect(shell).not.toContain("margin:0 auto calc(var(--dg-navigation-safe-offset)");
    const dock = renderDeterministicNavigationShell(bar({ anatomy: "floating-dock", labels: "always", width: "content" }));
    expect(dock).toContain("margin:0 auto calc(var(--dg-navigation-safe-offset) + var(--dg-effective-safe-area-bottom));");
  });

  it("draws the active item as a solid circle by default and as the action gradient when the reference's is one", () => {
    const solid = renderDeterministicNavigationShell(bar());
    expect(solid).toContain(`${activeIcon}color:var(--dg-navigation-active-content`);
    expect(solid).toContain("border-radius:var(--dg-radii-pill,9999px);background:transparent;");
    expect(solid).not.toContain("--dg-gradient-action-primary");

    const gradient = renderDeterministicNavigationShell(bar({ activeFill: "gradient" }));
    expect(gradient).toContain(`${activeIcon}background-image:var(--dg-gradient-action-primary);color:var(--dg-navigation-active-content`);
    // the bar has no labels to share the room with: the icons draw larger, in a circle twice their size
    expect(gradient).toContain(".dg-nav-icon{display:flex;height:44px;width:44px;flex:0 0 44px;");
    expect(gradient).toContain(".dg-nav-icon svg{height:22px;width:22px;stroke-width:2;}");
    expect(gradient).toContain("--dg-navigation-anatomy-height:74px;");
    // a design that asks for bigger icons gets them
    const large = renderDeterministicNavigationShell(bar({ iconSizePx: 24 }));
    expect(large).toContain(".dg-nav-icon{display:flex;height:48px;width:48px;flex:0 0 48px;");
    expect(large).toContain("--dg-navigation-anatomy-height:78px;");
  });

  it("fills the other active treatments with the gradient too, but not a tint", () => {
    expect(renderDeterministicNavigationShell(bar({ activeTreatment: "compact-chip", activeFill: "gradient" })))
      .toContain('.dg-nav-item[data-active="true"]{background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));background-image:var(--dg-gradient-action-primary);color:');
    expect(renderDeterministicNavigationShell(bar({ activeTreatment: "underline", activeFill: "gradient" })))
      .toContain('::after{content:"";position:absolute;left:24%;right:24%;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827));background-image:var(--dg-gradient-action-primary);}');
    // a tint is a wash of the action colour behind the item, not a fill
    expect(renderDeterministicNavigationShell(bar({ activeTreatment: "tint", activeFill: "gradient" })))
      .toContain('.dg-nav-item[data-active="true"]{color:var(--dg-navigation-content,var(--dg-color-action-primary,#111827));background:color-mix(in srgb,var(--dg-navigation-active-surface,var(--dg-color-action-primary,#111827)) 10%,transparent);}');
    const center = normalizeNavigationPlan({
      navigationPlan: { ...v2Plan(areas, "project-native", "center-action-dock"), design: { ...design("center-action-dock"), centerActionItemId: "pets", activeFill: "gradient" } },
      screens, navigationArchitecture: architecture,
    });
    expect(renderDeterministicNavigationShell(center)).toContain(".dg-nav-item-center-action .dg-nav-icon{height:48px;");
    expect(renderDeterministicNavigationShell(center)).toContain("background-image:var(--dg-gradient-action-primary);");
  });

  it("keeps a square attached bar square, and its icon well the size it was with labels", () => {
    const shell = renderDeterministicNavigationShell(bar({ radiusPx: 0, labels: "always" }));
    expect(shell).toContain("border-radius:0;");
    expect(shell).not.toContain("24px 24px 0 0");
    expect(shell).toContain(".dg-nav-icon{display:flex;height:26px;width:26px;flex:0 0 26px;");
    expect(shell).toContain("--dg-navigation-anatomy-height:68px;");
    // no other anatomy takes the attached bar's corners
    expect(renderDeterministicNavigationShell(bar({ anatomy: "floating-dock", labels: "always" }))).not.toContain("24px 24px 0 0");
  });

  it("keeps the fill in the stored design, and drops one it does not know", () => {
    expect(normalizeNavigationDesignContract({ ...design("fixed-tab-rail"), activeFill: "gradient" }).activeFill).toBe("gradient");
    expect(normalizeNavigationDesignContract({ ...design("fixed-tab-rail"), activeFill: "solid" })).not.toHaveProperty("activeFill");
    expect(normalizeNavigationDesignContract({ ...design("fixed-tab-rail"), activeFill: "rainbow" as never })).not.toHaveProperty("activeFill");
    expect(normalizeNavigationDesignContract(design("fixed-tab-rail"))).not.toHaveProperty("activeFill");
    const stored = parseStoredNavigationPlan({ ...bar({ activeFill: "gradient" }) });
    expect(stored.design?.activeFill).toBe("gradient");
  });

  describe("built from the reference's evidence", () => {
    const evidence = (extra: Record<string, unknown>) => normalizeReferenceAnalysis({
      overallVisualStyle: "Warm wellness UI", screenCountEstimate: 1, screenReferences: [{ index: 1, suggestedRole: "Today" }],
      primaryNavigation: { present: true, anatomy: "fixed-tab-rail", labels: "hidden", activeTreatment: "icon-fill", width: "full", material: "solid",
        geometry: "Icon-only bar attached to the bottom edge", activeState: "A gradient circle behind the icon", elevation: "Flat", ...extra },
    }).analysis?.primaryNavigation;
    const planned = () => bar({ anatomy: "floating-dock", radiusPx: 30, labels: "always", activeTreatment: "tint" });

    it("reads how the reference fills its active item and rounds its attached bar", () => {
      expect(evidence({ activeFill: "gradient", corners: "rounded" })).toMatchObject({ activeFill: "gradient", corners: "rounded" });
      expect(evidence({ active_fill: "solid", cornerShape: "square" })).toMatchObject({ activeFill: "solid", corners: "square" });
      expect(evidence({ activeFill: "sparkly", corners: "pointy" })).toMatchObject({ activeFill: null, corners: null });
    });

    it("draws the bar as the reference does: attached, rounded on top, icon-only, a gradient circle", () => {
      const plan = applyReferenceNavigationStyle(planned(), evidence({ activeFill: "gradient", corners: "rounded" }));
      expect(plan.design).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden", activeTreatment: "icon-fill", width: "full", radiusPx: 24, activeFill: "gradient" });
      const shell = renderDeterministicNavigationShell(plan);
      expect(shell).toContain('data-navigation-layout="attached-edge-rail"');
      expect(shell).toContain("border-radius:24px 24px 0 0;");
      expect(shell).toContain("background-image:var(--dg-gradient-action-primary);");
      expect(plan.items.map((item) => item.id)).toEqual(["today", "pets", "routines", "family"]);
    });

    it("draws a square attached bar square, and a bar whose corners the reference does not describe with the rail's own", () => {
      expect(applyReferenceNavigationStyle(planned(), evidence({ corners: "square" })).design?.radiusPx).toBe(0);
      expect(applyReferenceNavigationStyle(planned(), evidence({})).design?.radiusPx).toBe(0);
      expect(applyReferenceNavigationStyle(planned(), evidence({})).design).not.toHaveProperty("activeFill");
    });

    it("does not carry a dock's offset, gaps or shadow onto a bar attached to the bottom edge", () => {
      const dock = { ...design("floating-dock"), safeAreaOffsetPx: 24, itemGapPx: 12, elevation: "medium" as const, border: false, radiusPx: 30 };
      const floating = normalizeNavigationPlan({ navigationPlan: { ...v2Plan(areas, "project-native"), design: dock }, screens, navigationArchitecture: architecture });
      const attached = applyReferenceNavigationStyle(floating, evidence({ corners: "rounded" }));
      expect(attached.design).toMatchObject({ anatomy: "fixed-tab-rail", safeAreaOffsetPx: 4, itemGapPx: 0, elevation: "none", border: true, radiusPx: 24 });
      // the same construction, kept, when the reference is built the way the planner built it
      const same = applyReferenceNavigationStyle(floating, evidence({ anatomy: "floating-dock", labels: "always" }));
      expect(same.design).toMatchObject({ anatomy: "floating-dock", safeAreaOffsetPx: 24, itemGapPx: 12, elevation: "medium", border: false, radiusPx: 30 });
    });

    it("never lets an attached bar's corners change a dock's radius", () => {
      const dock = evidence({ anatomy: "floating-dock", corners: "rounded", activeFill: "solid" });
      const plan = applyReferenceNavigationStyle(planned(), dock);
      expect(plan.design).toMatchObject({ anatomy: "floating-dock", radiusPx: 30 });
      // a solid fill is the default, so it is not written into the design
      expect(plan.design).not.toHaveProperty("activeFill");
    });
  });
});

describe("a bar the person approved with the flow", () => {
  const two = [
    { id: "today", label: "Today", icon: "sun", role: "See the day", availability: "generated" as const, linkedScreenName: "Today" },
    { id: "pets", label: "Pets", icon: "paw-print", role: "Every pet", availability: "generated" as const, linkedScreenName: "Pet Library" },
  ];
  const screens: ScreenPlan[] = [{ name: "Today", type: "root", description: "Today" }, { name: "Pet Library", type: "root", description: "Pets" }];
  const source = (source: "approved-scope" | "product-architecture"): NavigationPlan => ({
    ...v2Plan(two), evidence: { source, reason: "Two peer areas" },
  });

  it("keeps two destinations, where a bar the planner chose needs three", () => {
    const approved = normalizeNavigationPlan({ navigationPlan: source("approved-scope"), screens, navigationArchitecture: architecture });
    expect(approved.enabled).toBe(true);
    expect(approved.items).toHaveLength(2);
    expect(approved.evidence?.source).toBe("approved-scope");
    expect(validateNavigationShell(renderDeterministicNavigationShell(approved), approved)).toBe(true);
    const chosen = normalizeNavigationPlan({ navigationPlan: source("product-architecture"), screens, navigationArchitecture: architecture });
    expect(chosen.enabled).toBe(false);
    expect(validateNavigationShell(renderDeterministicNavigationShell({ ...chosen, ...source("product-architecture") }), source("product-architecture"))).toBe(false);
  });

  it("is read back from storage with its evidence, and stays enabled", () => {
    const stored = parseStoredNavigationPlan(JSON.parse(JSON.stringify(source("approved-scope"))));
    expect(stored).toMatchObject({ enabled: true, decision: "project-native", evidence: { source: "approved-scope" } });
    expect(stored.items).toHaveLength(2);
    expect(parseStoredNavigationPlan(JSON.parse(JSON.stringify(source("product-architecture")))).enabled).toBe(false);
  });

  it("keeps an approved decision of no navigation as none, with the evidence that it was decided", () => {
    const none = normalizeNavigationPlan({
      navigationPlan: { ...v2Plan([], "none"), enabled: false, kind: "none", design: null, evidence: { source: "approved-scope", reason: "One flow, one task." } },
      screens, navigationArchitecture: architecture,
    });
    expect(none).toMatchObject({ enabled: false, decision: "none", items: [], evidence: { source: "approved-scope", reason: "One flow, one task." } });
    expect(parseStoredNavigationPlan(JSON.parse(JSON.stringify(none)))).toMatchObject({ enabled: false, evidence: { source: "approved-scope" } });
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
