import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildPublicDesignMdDocument } from "@/lib/design-md";
import {
  buildAgentHandoffPrompt,
  buildAgentPackFiles,
  buildAgentPackZip,
  buildNativeScaffoldZip,
  buildCompiledExportSnapshot,
  buildStandaloneHtmlExport,
  sanitizeHtmlForExport,
} from "@/lib/export-pipeline";
import type { DesignTokens, ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";

const designTokens: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#101010", secondary: "#181818" },
      surface: { card: "#202020" },
      text: { high_emphasis: "#FFFFFF", medium_emphasis: "#B0B0B0", low_emphasis: "#777777" },
      action: { primary: "#5EE1A2", on_primary_text: "#08110C", secondary: "#303030" },
      border: { divider: "#333333", focused: "#5EE1A2" },
    },
    typography: { font_family: "Inter" },
    mobile_layout: { screen_margin: "20px", section_gap: "24px", element_gap: "12px" },
    radii: { app: "22px", pill: "9999px" },
  },
};

const project: ProjectData = {
  id: "project-1",
  userId: "user-1",
  name: "Finance App",
  prompt: "Build a calm finance app.",
  status: "completed",
  designTokens,
  charter: {
    originalPrompt: "Build a calm finance app.",
    appType: "personal finance app",
    targetAudience: "busy professionals",
    navigationModel: "bottom tabs",
    keyFeatures: ["Balance overview", "Expense tracking"],
    designRationale: "Quiet hierarchy with confident actions.",
  },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const screens: ScreenData[] = [
  {
    id: "home",
    projectId: project.id,
    userId: project.userId,
    name: "Home",
    code: '<main data-drawgle-id="secret-home"><h1>Home balance</h1></main>',
    prompt: "Show the balance.",
    summary: "Balance overview.",
    chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    navigationItemId: "home",
    x: 0,
    y: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "insights",
    projectId: project.id,
    userId: project.userId,
    name: "Insights",
    code: "<main><h1>Private insights marker</h1></main>",
    prompt: "Show trends.",
    chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    navigationItemId: "insights",
    x: 500,
    y: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

const projectNavigation: ProjectNavigationData = {
  id: "nav",
  projectId: project.id,
  ownerId: project.userId,
  plan: {
    enabled: true,
    kind: "bottom-tabs",
    items: [
      { id: "home", label: "Home", icon: "home", role: "Overview", linkedScreenName: "Home" },
      { id: "insights", label: "Insights", icon: "chart", role: "Trends", linkedScreenName: "Insights" },
    ],
    visualBrief: "Floating compact navigation.",
    screenChrome: [
      { screenName: "Home", chrome: "bottom-tabs", navigationItemId: "home" },
      { screenName: "Insights", chrome: "bottom-tabs", navigationItemId: "insights" },
    ],
  },
  shellCode: '<nav data-drawgle-primary-nav><button data-nav-item-id="home">Home Tab</button><button data-nav-item-id="insights">Insights Tab</button></nav>',
  status: "ready",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const context = { project, screens, projectNavigation, designTokens };

describe("export pipeline", () => {
  it("sanitizes editor metadata from exported HTML", () => {
    expect(sanitizeHtmlForExport(screens[0].code)).toBe("<main><h1>Home balance</h1></main>");
  });

  it("builds standalone HTML with the selected screen navigation state", () => {
    const html = buildStandaloneHtmlExport({
      screen: screens[0],
      navigationCode: projectNavigation.shellCode,
      activeNavigationItemId: "home",
      designTokens,
    });

    expect(html).toContain("Home balance");
    expect(html).toContain("Home Tab");
    expect(html).toContain('=== "home"');
    expect(html).not.toContain("secret-home");
  });

  it("builds a target-specific prompt containing the compiled visual source for only the selected screen", () => {
    const prompt = buildAgentHandoffPrompt({ context, screen: screens[0], target: "swiftui" });

    expect(prompt).toContain("Implement this screen in SwiftUI");
    expect(prompt).toContain("## Standalone HTML visual source");
    expect(prompt).not.toContain("## Selected screen");
    expect(prompt).not.toContain("## Universal design tokens");
    expect(prompt).not.toContain("## Navigation plan");
    expect(prompt).toContain("<!DOCTYPE html>");
    expect(prompt).toContain("Home balance");
    expect(prompt).not.toContain("Private insights marker");
    expect(prompt).not.toContain("secret-home");
    expect(prompt).toContain("Quiet hierarchy with confident actions.");
  });

  it("builds a reusable compiled snapshot with live token CSS precedence", () => {
    const snapshot = buildCompiledExportSnapshot({
      screen: screens[0],
      navigationCode: projectNavigation.shellCode,
      activeNavigationItemId: "home",
      designTokens,
      tokenCss: ":root { --dg-color-background-primary: #223344; }",
    });

    expect(snapshot.standaloneHtml).toContain("--dg-color-background-primary: #223344;");
    expect(snapshot.standaloneHtml).toContain("background: var(--dg-color-background-primary, #ffffff);");
    expect(snapshot.cleanScreenHtml).toContain("Home balance");
    expect(snapshot.cleanScreenHtml).not.toContain("secret-home");
    expect(snapshot.cleanNavigationHtml).toContain("data-nav-item-id");
  });

  it("preserves canvas-authored classes and uses the shared runtime before Tailwind", () => {
    const html = buildStandaloneHtmlExport({
      screen: {
        ...screens[0],
        code: `<main data-drawgle-id="wrap"><section data-drawgle-id="driver" class="dg-surface-card bg-[var(--dg-color-background-secondary)] rounded-[var(--dg-radii-app)] text-screen-title">Fare Split</section></main>`,
      },
      designTokens,
    });

    expect(html.indexOf("tailwind.config")).toBeGreaterThan(-1);
    expect(html.indexOf("https://cdn.tailwindcss.com")).toBeGreaterThan(-1);
    expect(html.indexOf("tailwind.config")).toBeLessThan(html.indexOf("https://cdn.tailwindcss.com"));
    expect(html).toContain("dg-surface-card bg-[var(--dg-color-background-secondary)] rounded-[var(--dg-radii-app)] text-screen-title");
    expect(html).toContain("--dg-color-surface-card: #202020;");
    expect(html).toContain("--surface-muted: var(--dg-color-background-secondary, #F5F5F5);");
    expect(html).toContain('background: "var(--background, var(--dg-color-background-primary))"');
    expect(html).not.toContain("data-drawgle-id");
    expect(html).not.toContain(".bg-tint-gray { background-color");
  });
  it("reuses the shared Design.md builder in handoff files", () => {
    const files = buildAgentPackFiles({ context });
    const designMd = buildPublicDesignMdDocument({ project, projectNavigation, tokenDraft: designTokens });

    expect(files[".drawgle/design.md"]).toBe(designMd);
  });

  it("builds a project pack with every screen and no native, asset, or root instruction files", () => {
    const files = buildAgentPackFiles({ context, target: "auto" });
    const paths = Object.keys(files);

    expect(paths).toContain(".drawgle/screens/home.html");
    expect(paths).toContain(".drawgle/screens/insights.html");
    expect(paths).toContain(".agents/skills/drawgle-ui-handoff/SKILL.md");
    expect(paths).toContain(".claude/skills/drawgle-ui-handoff/SKILL.md");
    expect(paths).not.toContain("AGENTS.md");
    expect(paths).not.toContain("CLAUDE.md");
    expect(paths.some((path) => /assets|\.swift$|\.kt$|\.tsx$|\.dart$/i.test(path))).toBe(false);
  });

  it("keeps Agent Pack screen HTML free of duplicated shared navigation", () => {
    const files = buildAgentPackFiles({ context, target: "auto" });
    const homeHtml = files[".drawgle/screens/home.html"];
    const navPaths = Object.keys(files).filter((path) => path === ".drawgle/navigation.html");

    expect(navPaths).toHaveLength(1);
    expect(files[".drawgle/navigation.html"]).toContain("Home Tab");
    expect(files[".drawgle/navigation.html"]).toContain("Insights Tab");
    expect(homeHtml).toContain("<!DOCTYPE html>");
    expect(homeHtml).toContain("Home balance");
    expect(homeHtml).not.toContain("data-drawgle-primary-nav");
    expect(homeHtml).not.toContain("data-nav-item-id");
    expect(homeHtml).not.toContain("Home Tab");
    expect(homeHtml).not.toContain("Insights Tab");
  });

  it("creates native scaffold ZIPs with separate React Native screen, nav, shell, and theme files", () => {
    const result = buildNativeScaffoldZip({
      screen: screens[0],
      target: "reactnative",
      navigationCode: projectNavigation.shellCode,
      designTokens,
    });

    expect(result.error).toBeNull();
    const zip = unzipSync(result.bytes!);
    expect(zip["src/theme/AppTheme.ts"]).toBeTruthy();
    expect(zip["src/screens/HomeScreen.tsx"]).toBeTruthy();
    expect(zip["src/navigation/DrawgleBottomNavigation.tsx"]).toBeTruthy();
    expect(zip["src/navigation/AppShell.tsx"]).toBeTruthy();
    expect(strFromU8(zip["src/screens/HomeScreen.tsx"])).not.toContain("DrawgleBottomNavigation");
    expect(strFromU8(zip["src/navigation/AppShell.tsx"])).toContain("activeTab");
  });

  it("creates native scaffold ZIPs with separate Flutter screen, nav, shell, and theme files", () => {
    const result = buildNativeScaffoldZip({
      screen: screens[0],
      target: "flutter",
      navigationCode: projectNavigation.shellCode,
      designTokens,
    });

    expect(result.error).toBeNull();
    const zip = unzipSync(result.bytes!);
    expect(zip["lib/theme/app_theme.dart"]).toBeTruthy();
    expect(zip["lib/screens/home_screen.dart"]).toBeTruthy();
    expect(zip["lib/navigation/drawgle_bottom_navigation.dart"]).toBeTruthy();
    expect(zip["lib/navigation/app_shell.dart"]).toBeTruthy();
    expect(strFromU8(zip["lib/screens/home_screen.dart"])).not.toContain("DrawgleBottomNavigation");
    expect(strFromU8(zip["lib/navigation/app_shell.dart"])).toContain("activeTab");
  });
  it("creates a readable ZIP matching the project pack", () => {
    const zip = unzipSync(buildAgentPackZip({ context }));
    const manifest = JSON.parse(strFromU8(zip[".drawgle/manifest.json"]));

    expect(manifest.project.name).toBe("Finance App");
    expect(strFromU8(zip[".drawgle/screens/home.html"])).toContain("<!DOCTYPE html>");
    expect(strFromU8(zip[".drawgle/screens/home.html"])).toContain("Home balance");
    expect(strFromU8(zip[".drawgle/screens/insights.html"])).toContain("Private insights marker");
  });
});
