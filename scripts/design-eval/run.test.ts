// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";

import type { ProjectBundle } from "./bundle";
import { buildScreenHtml, screensInSortOrder } from "./render";
import { snapshotBundle } from "./run";

let browser: Browser;
const directories: string[] = [];

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

const designTokens: DesignTokens = {
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: { primary: "#ECE9D6", secondary: "#E6E2CD" },
      surface: { card: "#FFFFFF" },
      text: { high_emphasis: "#111827", medium_emphasis: "#4B5563", low_emphasis: "#6B7280" },
      action: { primary: "#FFC068", on_primary_text: "#111827" },
    },
  },
};

const screen = (overrides: Partial<ScreenData> & Pick<ScreenData, "id" | "name" | "code">): ScreenData => ({
  projectId: "0ce99a06-1111-4222-8333-444444444444",
  userId: "user",
  prompt: "A screen.",
  x: 0,
  y: 0,
  sortIndex: 0,
  status: "ready",
  createdAt: "2026-09-29T00:00:00.000Z",
  updatedAt: "2026-09-29T00:00:00.000Z",
  ...overrides,
});

// Inline styles only: the standalone document loads Tailwind from a CDN, which the offline test cannot reach.
const card = (radius: number, shadow = "none") =>
  `<div style="margin:16px;height:120px;background:#FFFFFF;border-radius:${radius}px;box-shadow:${shadow}">Card</div>`;
const root = (content: string) =>
  `<div class="w-full min-h-screen dg-bg-primary dg-text-high" style="min-height:100vh">${content}</div>`;

const bundle = (screens: ScreenData[], navigation: ProjectNavigationData | null = null): ProjectBundle => ({
  version: 1,
  fetchedAt: "2026-09-29T00:00:00.000Z",
  project: {
    id: "0ce99a06-1111-4222-8333-444444444444",
    name: "Fixture family app",
    prompt: "An app for families with multiple pets",
    designTokens,
    charter: null,
    productPlanning: { experience: { navigation: "persistent bottom bar with five distinct icons" } },
  },
  screens,
  navigation,
  reference: { source: "none", id: null, imageUrl: null, imagePath: null, file: null },
});

describe("snapshot harness", () => {
  it("renders a project, checks it and writes the contact sheet and report", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "design-eval-out-"));
    directories.push(outDir);
    const fixture = bundle([
      screen({
        id: "b", name: "Pet Library", sortIndex: 2,
        code: root(card(16) + `<nav style="position:fixed;left:0;right:0;bottom:0;display:flex;height:60px;background:#fff">${
          [1, 2, 3, 4].map(() => `<button style="width:60px;height:48px"><svg width="20" height="20"><circle cx="10" cy="10" r="8"/></svg></button>`).join("")}</nav>`),
        chromePolicy: { chrome: "top-bar", showPrimaryNavigation: false, showsBackButton: false },
      }),
      screen({
        id: "a", name: "Daily Care Dashboard", sortIndex: 1,
        prompt: "Every card uses a 32px radius on a #F9F6F0 base.",
        code: root(card(32, "0 4px 20px rgba(45,41,38,0.04)") + card(32, "0 4px 20px rgba(45,41,38,0.04)")),
        chromePolicy: { chrome: "top-bar", showPrimaryNavigation: false, showsBackButton: false },
      }),
      screen({ id: "c", name: "Empty draft", sortIndex: 3, code: "   " }),
    ]);

    expect(screensInSortOrder(fixture).map((item) => item.name)).toEqual(["Daily Care Dashboard", "Pet Library"]);
    expect(buildScreenHtml(fixture, fixture.screens[0]).sharedNavigation).toBe(false);

    const reference = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#ECE9D6" } }).jpeg().toBuffer();
    const result = await snapshotBundle({
      browser,
      bundle: fixture,
      image: { bytes: reference, extension: "jpg" },
      outDir,
      overrides: { elevation: "flat-tone", expected: { background: "#ECE9D6", card: "#F7F5E9" } },
      options: { offline: true },
    });

    expect(result.results.map((item) => item.screen)).toEqual(["Daily Care Dashboard", "Pet Library"]);
    const dashboard = result.results[0];
    expect(dashboard.flags).toEqual(expect.arrayContaining(["radius", "shadow", "tone", "brief-values"]));
    expect(dashboard.radius.offenders).toBe(2);
    expect(dashboard.tone.page).toBe("#ECE9D6");
    const library = result.results[1];
    expect(library.flags).toEqual(expect.arrayContaining(["local-nav", "no-shared-nav"]));
    expect(library.radius.offenders).toBe(0);

    const sheet = sharp(await readFile(result.contactSheetPath));
    const metadata = await sheet.metadata();
    expect(metadata.format).toBe("png");
    // reference (4:3 at the sheet height) + two 390px screens + gaps and padding
    expect(metadata.width).toBeGreaterThan(2 * 390 + 2 * 24);
    expect(metadata.height).toBeGreaterThan(844);
    expect((await stat(result.contactSheetPath)).size).toBeLessThan(1_500_000);

    const checks = await readFile(result.checksPath, "utf8");
    expect(checks).toContain("Daily Care Dashboard");
    expect(checks).toContain("radius");
    expect(result.table).toContain("screens pass every applicable check");
    for (const name of ["01-daily-care-dashboard.png", "02-pet-library.png"]) {
      expect((await stat(path.join(outDir, "screens", name))).size).toBeGreaterThan(1000);
    }
    // per-screen PNGs are 2x
    expect((await sharp(path.join(outDir, "screens", "01-daily-care-dashboard.png")).metadata()).width).toBe(780);
  }, 90_000);
});
