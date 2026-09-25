import "server-only";
import { chromium } from "playwright";
import { buildStandaloneHtmlExport } from "@/lib/export-pipeline";
import { renderDeterministicNavigationShell } from "@/lib/project-navigation";
import type { DesignTokens, NavigationPlan, ScreenData } from "@/lib/types";

export type ViewportIssue = { width: number; height: number; code: "horizontal_overflow" | "control_collision" | "primary_action_clipped" | "navigation_occlusion" | "navigation_assignment" | "duplicate_navigation"; detail: string };

export async function inspectScreenViewport(input: {
  code: string; tokens: DesignTokens | null; navigationPlan: NavigationPlan | null;
  navigationItemId: string | null;
}): Promise<ViewportIssue[]> {
  const navigationCode = input.navigationPlan?.enabled ? renderDeterministicNavigationShell(input.navigationPlan) : "";
  const html = buildStandaloneHtmlExport({ screen: { code: input.code } as ScreenData,
    navigationCode, activeNavigationItemId: input.navigationItemId, designTokens: input.tokens });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const issues: ViewportIssue[] = [];
    for (const [width, height] of [[390, 844], [320, 640]] as const) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      try {
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.evaluate(() => document.fonts.ready);
        const found = await page.evaluate((expectedNavigationItemId) => {
          const issues: Array<{ code: ViewportIssue["code"]; detail: string }> = [];
          const root = document.documentElement;
          const body = document.body;
          const escapedContent = [...document.querySelectorAll("#drawgle-export-root main,#drawgle-export-root button,#drawgle-export-root input,#drawgle-export-root section")]
            .some(element => { const rect = element.getBoundingClientRect(); return rect.width > 8 && rect.right > root.clientWidth + 7; });
          if (Math.max(root.scrollWidth, body.scrollWidth) > root.clientWidth + 7 || escapedContent) {
            issues.push({ code: "horizontal_overflow", detail: "Document exceeds the mobile viewport by at least 8px." });
          }
          const nav = document.querySelector("[data-drawgle-primary-nav]");
          if (nav && expectedNavigationItemId) {
            const active = [...nav.querySelectorAll('[data-nav-item-id][data-active="true"]')];
            if (active.length !== 1 || active[0]?.getAttribute("data-nav-item-id") !== expectedNavigationItemId) {
              issues.push({ code: "navigation_assignment", detail: "The shared navigation has no single correct active destination." });
            }
          }
          const visible = (element: Element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.05
              && rect.width >= 8 && rect.height >= 8;
          };
          const actions = [...document.querySelectorAll("button,a[href],[role=button],input")].filter(element =>
            visible(element) && !element.closest("[data-drawgle-primary-nav]"));
          const primary = actions.filter(element => element.matches("[data-primary-action],button[class*='bg-'],a[class*='bg-']"));
          const scroll = document.scrollingElement;
          if (scroll) scroll.scrollTop = scroll.scrollHeight;
          const scrolledNavRect = nav?.getBoundingClientRect();
          for (const element of primary) {
            const rect = element.getBoundingClientRect();
            if (rect.bottom > innerHeight + 6 && (scroll?.scrollHeight ?? 0) <= innerHeight + 6) {
              issues.push({ code: "primary_action_clipped", detail: "A primary action extends below the visible, non-scrollable screen." });
              break;
            }
            if (scrolledNavRect && rect.bottom > scrolledNavRect.top + 10 && rect.top < scrolledNavRect.bottom - 10
              && rect.left < scrolledNavRect.right && rect.right > scrolledNavRect.left) {
              issues.push({ code: "navigation_occlusion", detail: "A primary action overlaps shared navigation at the end of the screen." });
              break;
            }
          }
          const controls = actions.filter(element => element.matches("button,input,[role=button]")).slice(0, 80);
          outer: for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i], b = controls[j];
            if (a.contains(b) || b.contains(a)) continue;
            const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            const overlap = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left))
              * Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
            if (overlap > Math.min(ar.width * ar.height, br.width * br.height) * 0.4) {
              issues.push({ code: "control_collision", detail: "Two separate interactive controls overlap substantially." });
              break outer;
            }
          }
          return issues;
        }, input.navigationItemId);
        issues.push(...found.map(issue => ({ ...issue, width, height })));
      } finally {
        await page.close();
      }
    }
    return issues;
  } finally {
    await browser.close();
  }
}
