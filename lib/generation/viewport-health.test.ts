import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { inspectScreenViewport } from "./viewport-health";
import type { NavigationPlan } from "@/lib/types";

const navigationPlan: NavigationPlan = { version: 2, enabled: true, kind: "bottom-tabs", decision: "project-native",
  evidence: { source: "product-architecture", reason: "Two top-level destinations" },
  items: ["today", "calendar"].map(id => ({ id, label: id, icon: "circle", role: "Root", availability: "generated" as const,
    linkedScreenName: id })), visualBrief: "Simple dock", screenChrome: [],
  design: { anatomy: "fixed-tab-rail", width: "full", labels: "always", activeTreatment: "tint", surface: "solid",
    radiusPx: 0, safeAreaOffsetPx: 0, itemGapPx: 0, iconSizePx: 20, border: false, elevation: "none", centerActionItemId: null } };

describe("rendered mobile viewport health", () => {
  it("finds severe overflow at 390 and 320 pixels", async () => {
    const issues = await inspectScreenViewport({ code: `<main style="width:450px;min-height:100vh"><button style="width:120px">Save</button></main>`,
      tokens: null, navigationPlan: null, navigationItemId: null });
    expect(issues.filter(issue => issue.code === "horizontal_overflow").map(issue => issue.width)).toEqual([390, 320]);
  }, 30_000);
  it("finds a primary button hidden behind the shared navigation shell", async () => {
    const issues = await inspectScreenViewport({ code: `<main style="min-height:100vh"><button data-primary-action
      style="position:fixed;bottom:0;left:12px;width:180px;height:60px;background:#333;color:white">Continue</button></main>`,
    tokens: null, navigationPlan, navigationItemId: "today" });
    expect(issues.some(issue => issue.code === "navigation_occlusion")).toBe(true);
  }, 30_000);
  it("checks the active shared destination on the rendered screen", async () => {
    const issues = await inspectScreenViewport({ code: `<main style="min-height:100vh">Today</main>`,
      tokens: null, navigationPlan, navigationItemId: "missing" });
    expect(issues.some(issue => issue.code === "navigation_assignment")).toBe(true);
  }, 30_000);
});
