"use client";

import { useState } from "react";

import { ExportMenu } from "@/components/ExportMenu";
import { Button } from "@/components/ui/button";
import type { DesignTokens, ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";

const designTokens: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#F4F7F5", secondary: "#FFFFFF" },
      surface: { card: "#FFFFFF" },
      text: { high_emphasis: "#14211B", medium_emphasis: "#5E6E66", low_emphasis: "#89958F" },
      action: { primary: "#183E2D", on_primary_text: "#FFFFFF", secondary: "#DCEAE2" },
      border: { divider: "#DCE5E0", focused: "#4C9A70" },
    },
    typography: { font_family: "Inter" },
    mobile_layout: { screen_margin: "20px", section_gap: "24px", element_gap: "12px" },
    radii: { app: "24px", pill: "9999px" },
    shadows: { surface: "0 14px 40px rgba(20,33,27,.10)", overlay: "0 20px 55px rgba(20,33,27,.16)" },
  },
};

const project: ProjectData = {
  id: "export-smoke-project",
  userId: "export-smoke-user",
  name: "Calm Finance",
  prompt: "Create a calm personal-finance app for busy professionals.",
  status: "completed",
  designTokens,
  charter: {
    originalPrompt: "Create a calm personal-finance app for busy professionals.",
    appType: "personal finance app",
    targetAudience: "busy professionals",
    navigationModel: "bottom tabs",
    keyFeatures: ["Balance overview", "Plan expenses", "Monthly insights"],
    designRationale: "Use quiet surfaces, confident typography, and a restrained green action color.",
  },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const screens: ScreenData[] = [
  {
    id: "dashboard",
    projectId: project.id,
    userId: project.userId,
    name: "Dashboard",
    code: `<main class="dg-bg-primary min-h-screen p-5">
  <section class="dg-surface-card dg-radius-app p-5 shadow-[var(--dg-shadows-surface)]">
    <p class="dg-text-medium text-sm">Available balance</p>
    <h1 class="dg-text-high mt-2 text-4xl font-bold">$12,480</h1>
    <button class="dg-action-primary dg-radius-pill mt-6 px-5 py-3">Plan expenses</button>
  </section>
</main>`,
    prompt: "Show the balance and a planning action.",
    summary: "Primary account overview with a focused expense-planning action.",
    chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    navigationItemId: "dashboard",
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
    code: '<main class="dg-bg-primary min-h-screen p-5"><h1 class="dg-text-high text-3xl font-bold">Monthly insights</h1></main>',
    prompt: "Show monthly insights.",
    chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true, showsBackButton: false },
    navigationItemId: "insights",
    x: 500,
    y: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

const projectNavigation: ProjectNavigationData = {
  id: "export-smoke-navigation",
  projectId: project.id,
  ownerId: project.userId,
  plan: {
    enabled: true,
    kind: "bottom-tabs",
    items: [
      { id: "dashboard", label: "Home", icon: "home", role: "Primary overview", linkedScreenName: "Dashboard" },
      { id: "insights", label: "Insights", icon: "chart-no-axes-column", role: "Monthly trends", linkedScreenName: "Insights" },
    ],
    visualBrief: "A restrained floating bottom dock.",
    screenChrome: [
      { screenName: "Dashboard", chrome: "bottom-tabs", navigationItemId: "dashboard" },
      { screenName: "Insights", chrome: "bottom-tabs", navigationItemId: "insights" },
    ],
  },
  shellCode: '<nav data-drawgle-primary-nav><button data-nav-item-id="dashboard">Home</button><button data-nav-item-id="insights">Insights</button></nav>',
  status: "ready",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

export function ExportSmokeFixture() {
  const [open, setOpen] = useState(true);
  const [initialScreenId, setInitialScreenId] = useState<string | null>("dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center gap-3 bg-slate-100 p-6">
      <Button variant="outline" onClick={() => {
        setInitialScreenId("insights");
        setOpen(true);
      }}>Open for Insights</Button>
      <ExportMenu
        open={open}
        onOpenChange={setOpen}
        project={project}
        screens={screens}
        initialScreenId={initialScreenId}
        projectNavigation={projectNavigation}
        designTokens={designTokens}
        trigger={<Button onClick={() => setInitialScreenId("dashboard")}>Export</Button>}
      />
    </main>
  );
}
