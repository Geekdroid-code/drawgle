import { describe, expect, it } from "vitest";
import { resolveScreenChromePolicy } from "@/lib/navigation";
import { normalizeNavigationPlan, createFallbackNavigationPlan } from "@/lib/project-navigation";
import { applyDeleteElement, applyDuplicateElement } from "@/lib/drawgle-dom";
import type { ScreenPlan, NavigationArchitecture } from "@/lib/types";

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
  });
});
