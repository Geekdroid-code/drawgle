import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { renderDeterministicNavigationShell, validateNavigationShell } from "@/lib/project-navigation";
import type { NavigationAnatomy, NavigationPlan } from "@/lib/types";

const anatomies: NavigationAnatomy[] = [
  "fixed-tab-rail",
  "floating-dock",
  "glass-dock",
  "compact-icon-rail",
  "center-action-dock",
];
const widths = [320, 390, 430];
const outputDirectory = path.join(process.env.TEMP || "C:/tmp", "drawgle-navigation-v2-visual");

const planFor = (anatomy: NavigationAnatomy, itemCount: number): NavigationPlan => ({
  version: 2,
  decision: "project-native",
  evidence: { source: "product-architecture", reason: "Visual regression fixture" },
  enabled: true,
  kind: "bottom-tabs",
  items: Array.from({ length: itemCount }, (_, index) => ({
    id: index === 0 ? "overview" : "area-" + (index + 1),
    label: index === 0 ? "Overview" : index === itemCount - 1 ? "Long Label" : "Area " + (index + 1),
    icon: index === 0 ? "layout-dashboard" : "circle",
    role: index === 0 ? "Primary overview" : "Product destination " + (index + 1),
    availability: index === 0 ? "generated" : "planned",
    linkedScreenName: index === 0 ? "Overview" : null,
  })),
  design: {
    anatomy,
    width: anatomy === "fixed-tab-rail" ? "inset" : "content",
    labels: anatomy === "compact-icon-rail" ? "hidden" : "always",
    activeTreatment: anatomy === "fixed-tab-rail" ? "tint" : "icon-fill",
    surface: anatomy === "glass-dock" ? "glass" : "solid",
    radiusPx: anatomy === "fixed-tab-rail" ? 18 : 28,
    safeAreaOffsetPx: 12,
    itemGapPx: 4,
    iconSizePx: 20,
    border: true,
    elevation: anatomy === "fixed-tab-rail" ? "none" : "low",
    centerActionItemId: anatomy === "center-action-dock" ? "area-3" : null,
  },
  visualBrief: "Visual regression fixture",
  screenChrome: [{ screenName: "Overview", chrome: "bottom-tabs", navigationItemId: "overview" }],
});

const main = async () => {
  await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const width of widths) {
    for (const theme of ["light", "dark"] as const) {
      for (const anatomy of anatomies) {
        const plan = planFor(anatomy, 5);
        const shell = renderDeterministicNavigationShell(plan);
        if (!validateNavigationShell(shell, plan)) throw new Error("Invalid shell for " + anatomy);

        const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
        await page.setContent(
          '<!doctype html><html><head><style>' +
          ':root{--dg-color-action-primary:#2563eb;--dg-color-action-on-primary-text:#fff;--dg-color-text-low-emphasis:' +
          (theme === "dark" ? "#94a3b8" : "#64748b") +
          ';--dg-color-surface-card:' + (theme === "dark" ? "#171717" : "#fff") +
          ';--dg-color-border-divider:' + (theme === "dark" ? "#3f3f46" : "#e5e7eb") +
          ';}*{box-sizing:border-box}body{margin:0;background:' + (theme === "dark" ? "#09090b" : "#f4f4f5") +
          ';font-family:Arial,sans-serif}.screen{height:844px;padding:24px;color:' + (theme === "dark" ? "#fafafa" : "#18181b") +
          '}.host{position:fixed;left:0;right:0;bottom:0}</style></head><body><main class="screen"><h1>Account overview</h1><p>Stable visual fixture content.</p></main><div class="host">' +
          shell +
          '</div></body></html>',
        );
        await page.locator('[data-nav-item-id="overview"]').evaluate((element) => {
          element.setAttribute("data-active", "true");
          element.setAttribute("aria-current", "page");
        });

        const metrics = await page.evaluate(() => {
          const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-drawgle-primary-nav]"));
          const root = roots[0];
          const items = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-item-id]"));
          const rootRect = root?.getBoundingClientRect();
          return {
            rootCount: roots.length,
            itemCount: items.length,
            visiblePixels: root ? Math.round(rootRect.width * rootRect.height) : 0,
            rootLeft: rootRect?.left ?? -1,
            rootRight: rootRect?.right ?? -1,
            itemWidths: items.map((item) => item.getBoundingClientRect().width),
            activeCount: items.filter((item) => item.dataset.active === "true").length,
          };
        });

        if (metrics.rootCount !== 1 || metrics.itemCount !== 5 || metrics.activeCount !== 1) {
          throw new Error("Invalid navigation structure for " + anatomy + " at " + width);
        }
        if (metrics.visiblePixels < 5000 || metrics.rootLeft < 0 || metrics.rootRight > width + 0.5) {
          throw new Error("Navigation escaped or rendered blank for " + anatomy + " at " + width);
        }
        if (metrics.itemWidths.some((itemWidth) => itemWidth < 44)) {
          throw new Error("Navigation touch target below 44px for " + anatomy + " at " + width);
        }

        await page.screenshot({
          path: path.join(outputDirectory, anatomy + "-" + width + "-" + theme + ".png"),
          fullPage: true,
        });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

  console.log("Navigation V2 visual smoke passed. Screenshots: " + outputDirectory);
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});