import { describe, expect, it } from "vitest";
import { resolveScreenChromePolicy } from "@/lib/navigation";
import {
  normalizeNavigationPlan,
  createFallbackNavigationPlan,
  detectLocalNavigationMarkup,
  renderDeterministicNavigationShell,
  sanitizeScreenCodeForSharedNavigation,
} from "@/lib/project-navigation";
import { applyDeleteElement, applyDuplicateElement } from "@/lib/drawgle-dom";
import type { ScreenPlan, NavigationArchitecture, NavigationPlan } from "@/lib/types";

describe("Navigation Logic Improvement Tests", () => {
  const defaultArchitecture: NavigationArchitecture = {
    kind: "bottom-tabs-app",
    primaryNavigation: "bottom-tabs",
    rootChrome: "bottom-tabs",
    detailChrome: "top-bar-back",
    consistencyRules: [],
    rationale: "Default architecture",
  };

  describe("resolveScreenChromePolicy", () => {
    it("should respect screen explicit chrome opt-out", () => {
      const loginScreen: ScreenPlan = {
        name: "Login",
        type: "root",
        description: "Login screen",
        chromePolicy: {
          chrome: "immersive",
          showPrimaryNavigation: false,
          showsBackButton: false,
        },
      };

      const resolved = resolveScreenChromePolicy({
        screenPlan: loginScreen,
        navigationArchitecture: defaultArchitecture,
      });

      expect(resolved.chrome).toBe("immersive");
      expect(resolved.showPrimaryNavigation).toBe(false);
    });

    it("should default to bottom-tabs for root screens without explicit opt-out", () => {
      const homeScreen: ScreenPlan = {
        name: "Home",
        type: "root",
        description: "Home screen",
      };

      const resolved = resolveScreenChromePolicy({
        screenPlan: homeScreen,
        navigationArchitecture: defaultArchitecture,
      });

      expect(resolved.chrome).toBe("bottom-tabs");
      expect(resolved.showPrimaryNavigation).toBe(true);
    });
  });

  describe("normalizeNavigationPlan", () => {
    it("should not assign navigationItemId to immersive screens", () => {
      const screens: ScreenPlan[] = [
        {
          name: "Home",
          type: "root",
          description: "Home screen",
        },
        {
          name: "Login",
          type: "root",
          description: "Login screen",
          chromePolicy: {
            chrome: "immersive",
            showPrimaryNavigation: false,
            showsBackButton: false,
          },
        },
        {
          name: "Settings",
          type: "root",
          description: "Settings screen",
        },
      ];

      const navPlan = normalizeNavigationPlan({
        screens,
        navigationArchitecture: defaultArchitecture,
        requiresBottomNav: true,
      });

      const homeChrome = navPlan.screenChrome.find((sc) => sc.screenName === "Home");
      const loginChrome = navPlan.screenChrome.find((sc) => sc.screenName === "Login");

      expect(homeChrome?.navigationItemId).not.toBeNull();
      expect(loginChrome?.navigationItemId).toBeNull();
    });
  });

  describe("createFallbackNavigationPlan", () => {
    it("should exclude login and chat screens from default tabs", () => {
      const screens: ScreenPlan[] = [
        { name: "Home", type: "root", description: "Home" },
        { name: "Login", type: "root", description: "Login" },
        { name: "AI Assistant", type: "root", description: "AI Assistant" },
        { name: "Settings", type: "root", description: "Settings" },
      ];

      const fallback = createFallbackNavigationPlan({
        screens,
        navigationArchitecture: defaultArchitecture,
        requiresBottomNav: true,
      });

      const tabLabels = fallback.items.map((item) => item.linkedScreenName);
      expect(tabLabels).toContain("Home");
      expect(tabLabels).toContain("Settings");
      expect(tabLabels).not.toContain("Login");
      expect(tabLabels).not.toContain("AI Assistant");
    });
  });

  describe("renderDeterministicNavigationShell", () => {
    it("renders two-item navigation without full-width active pills", () => {
      const plan: NavigationPlan = {
        enabled: true,
        kind: "bottom-tabs",
        items: [
          { id: "home", label: "Home", icon: "home", role: "Home", linkedScreenName: "Home" },
          { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", role: "Dashboard", linkedScreenName: "Dashboard" },
        ],
        visualBrief: "Compact premium dock",
        screenChrome: [],
      };

      const code = renderDeterministicNavigationShell(plan);

      expect(code).toContain('data-nav-item-id="home"');
      expect(code).toContain('data-nav-item-id="dashboard"');
      expect(code).toContain('var(--dg-color-surface-card');
      expect(code).toContain('var(--dg-radii-pill');
      expect(code).toContain('.dg-nav-item[data-active="true"] .dg-nav-icon{background:var(--dg-color-action-primary');
      expect(code).not.toContain('.dg-nav-item[data-active="true"]{background:var(--dg-color-action-primary');
    });
  });

  describe("applyDeleteElement", () => {
    it("should successfully delete a child element", () => {
      const code = `<div class="root" data-drawgle-id="dg-root">
        <h1 data-drawgle-id="dg-title">Hello World</h1>
        <p data-drawgle-id="dg-desc">Some description</p>
      </div>`;

      const result = applyDeleteElement(code, "dg-desc");
      expect(result).not.toContain("dg-desc");
      expect(result).not.toContain("Some description");
      expect(result).toContain("dg-title");
    });

    it("should reject deleting a root-level element", () => {
      const code = `<div class="root" data-drawgle-id="dg-root">
        <h1 data-drawgle-id="dg-title">Hello World</h1>
      </div>`;

      expect(() => {
        applyDeleteElement(code, "dg-root");
      }).toThrow("Deleting the root-level screen container is not allowed.");
    });
  });

  describe("applyDuplicateElement", () => {
    it("should successfully duplicate a child element and strip data-drawgle-id on the clone", () => {
      const code = `<div class="root" data-drawgle-id="dg-root">
        <h1 data-drawgle-id="dg-title">Hello World</h1>
      </div>`;

      const result = applyDuplicateElement(code, "dg-title");
      // Check that it contains "Hello World" twice (the original and the clone)
      const matches = result.match(/Hello World/g);
      expect(matches?.length).toBe(2);
      
      // The clone should not carry data-drawgle-id="dg-title"
      // Verify that there is exactly one instance of data-drawgle-id="dg-title"
      const idMatches = result.match(/data-drawgle-id="dg-title"/g);
      expect(idMatches?.length).toBe(1);
    });

    it("should reject duplicating a root-level element", () => {
      const code = `<div class="root" data-drawgle-id="dg-root">
        <h1 data-drawgle-id="dg-title">Hello World</h1>
      </div>`;

      expect(() => {
        applyDuplicateElement(code, "dg-root");
      }).toThrow("Duplicating the root-level screen container is not allowed.");
    });
  });

  describe("force immersive chrome for chat and assistant screens", () => {
    it("should resolve to immersive for AI Chat Assistant screen", () => {
      const assistantScreen: ScreenPlan = {
        name: "AI Chat Assistant",
        type: "root",
        description: "An AI chat assistant screen",
      };

      const resolved = resolveScreenChromePolicy({
        screenPlan: assistantScreen,
        navigationArchitecture: defaultArchitecture,
      });

      expect(resolved.chrome).toBe("immersive");
      expect(resolved.showPrimaryNavigation).toBe(false);
    });

    it("should normalize navigation plan to suppress navigationItemId for AI Chat Assistant screen", () => {
      const screens: ScreenPlan[] = [
        {
          name: "Home",
          type: "root",
          description: "Home screen",
        },
        {
          name: "AI Chat Assistant",
          type: "root",
          description: "Chat assistant screen",
        },
      ];

      const navPlan = normalizeNavigationPlan({
        screens,
        navigationArchitecture: defaultArchitecture,
        requiresBottomNav: true,
      });

      const assistantChrome = navPlan.screenChrome.find((sc) => sc.screenName === "AI Chat Assistant");
      expect(assistantChrome?.chrome).toBe("immersive");
      expect(assistantChrome?.navigationItemId).toBeNull();
    });

    it("does not force root tab screens immersive just because the brief mentions a hero section", () => {
      const dashboardScreen: ScreenPlan = {
        name: "Portfolio Dashboard",
        type: "root",
        description: "Use a premium balance hero section with cards below it.",
      };

      const resolved = resolveScreenChromePolicy({
        screenPlan: dashboardScreen,
        navigationArchitecture: defaultArchitecture,
      });

      expect(resolved.chrome).toBe("bottom-tabs");
      expect(resolved.showPrimaryNavigation).toBe(true);
    });

    it("disables shared navigation instead of rendering a one-item bottom nav", () => {
      const screens: ScreenPlan[] = [
        { name: "Onboarding", type: "root", description: "Welcome onboarding screen" },
        { name: "Home", type: "root", description: "Ride booking dashboard" },
      ];

      const navPlan = normalizeNavigationPlan({
        navigationPlan: {
          enabled: true,
          kind: "bottom-tabs",
          items: [
            { id: "home", label: "Home", icon: "home", role: "Primary dashboard", linkedScreenName: "Home" },
          ],
          visualBrief: "Floating taxi app dock",
          screenChrome: [
            { screenName: "Onboarding", chrome: "immersive", navigationItemId: null },
            { screenName: "Home", chrome: "bottom-tabs", navigationItemId: "home" },
          ],
        },
        screens,
        navigationArchitecture: defaultArchitecture,
        requiresBottomNav: true,
      });

      expect(navPlan.enabled).toBe(false);
      expect(navPlan.items).toHaveLength(0);
      expect(renderDeterministicNavigationShell(navPlan)).toBe("");
      expect(navPlan.screenChrome.find((screen) => screen.screenName === "Home")?.chrome).toBe("top-bar");
    });

    it("keeps only unique root destinations in shared navigation", () => {
      const screens: ScreenPlan[] = [
        { name: "Portfolio Dashboard", type: "root", description: "Balance hero and market summary" },
        { name: "Asset Detail", type: "detail", description: "Detailed asset chart" },
        { name: "Market Overview", type: "root", description: "Markets list" },
      ];

      const navPlan = normalizeNavigationPlan({
        navigationPlan: {
          enabled: true,
          kind: "bottom-tabs",
          items: [
            { id: "home", label: "Home", icon: "home", role: "Dashboard", linkedScreenName: "Portfolio Dashboard" },
            { id: "swap", label: "Swap", icon: "repeat", role: "Exchange", linkedScreenName: "Asset Detail" },
            { id: "wallet", label: "Wallet", icon: "wallet", role: "Wallet", linkedScreenName: "Portfolio Dashboard" },
            { id: "markets", label: "Markets", icon: "trending-up", role: "Markets", linkedScreenName: "Market Overview" },
          ],
          visualBrief: "Floating market dock",
          screenChrome: [],
        },
        screens,
        navigationArchitecture: defaultArchitecture,
        requiresBottomNav: true,
      });

      expect(navPlan.enabled).toBe(true);
      expect(navPlan.items.map((item) => item.id)).toEqual(["home", "markets"]);
      expect(navPlan.screenChrome.find((screen) => screen.screenName === "Portfolio Dashboard")?.navigationItemId).toBe("home");
      expect(navPlan.screenChrome.find((screen) => screen.screenName === "Market Overview")?.navigationItemId).toBe("markets");
      expect(navPlan.screenChrome.find((screen) => screen.screenName === "Asset Detail")?.navigationItemId).toBeNull();
    });

    it("strips local placeholder docks whenever a project shared nav exists", () => {
      const code = `<div class="w-full min-h-screen dg-bg-primary">
        <main>Content</main>
        <!-- Floating Navigation Pill (Visual Placeholder for Shared Shell) -->
        <div class="fixed bottom-[16px] left-4 right-4 h-[72px]">
          <button><i data-lucide="home"></i>Home</button>
          <button><i data-lucide="search"></i>Search</button>
        </div>
      </div>`;

      const sanitized = sanitizeScreenCodeForSharedNavigation(
        code,
        {
          name: "Portfolio Dashboard",
          type: "root",
          description: "Dashboard",
          chromePolicy: { chrome: "immersive", showPrimaryNavigation: false, showsBackButton: false },
          navigationItemId: null,
        },
        { projectNavigationEnabled: true },
      );

      expect(sanitized).not.toContain("Floating Navigation Pill");
      expect(sanitized).not.toContain("fixed bottom-[16px]");
      expect(sanitized).toContain("<main>Content</main>");
      expect(detectLocalNavigationMarkup(sanitized).hasLocalNavigation).toBe(false);
    });
  });
});
