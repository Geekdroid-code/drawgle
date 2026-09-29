import sharp from "sharp";
import type { Browser } from "playwright";

import { buildStandaloneHtmlExport } from "@/lib/export-pipeline";
import type { CuratedStylePreset } from "@/lib/generation/curated-style-presets";
import { applyReferenceNavigationStyle, renderDeterministicNavigationShell } from "@/lib/project-navigation";
import type { NavigationPlan, PromptImagePayload, ScreenData } from "@/lib/types";

import { buildContactSheet, SCREEN_VIEWPORT } from "../design-eval/render";

/**
 * What the founder looks at before approving a preset: the reference, the specimen the recreate builder
 * made from its richest phone with the bar the renderer will draw under it, and every component extracted
 * from it, drawn with the preset's tokens. The components are what every project's builder will copy, so
 * they are shown as they will be.
 */

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const EMPTY_BODY: Record<string, { contentType: string; body: string }> = {
  script: { contentType: "application/javascript", body: "" },
  stylesheet: { contentType: "text/css", body: "" },
  font: { contentType: "font/woff2", body: "" },
};

/** Ordinary destinations: the sheet shows how the reference's bar is built, not what a product puts in it. */
const SAMPLE_DESTINATIONS = [
  ["home", "Home", "house"], ["explore", "Explore", "compass"], ["activity", "Activity", "activity"],
  ["calendar", "Calendar", "calendar"], ["profile", "Profile", "user"],
] as const;

/** The bar every project built on this preset gets, built the way the reference's own bar is built. */
export function presetNavigationPlan(preset: CuratedStylePreset): NavigationPlan | null {
  const evidence = preset.navigation;
  if (!evidence?.present) return null;
  const count = Math.min(5, Math.max(2, evidence.itemCount || 4));
  const plan: NavigationPlan = {
    version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs",
    evidence: { source: "approved-scope", reason: "A sample bar, to show how the reference's is built." },
    items: SAMPLE_DESTINATIONS.slice(0, count).map(([id, label, icon]) => ({
      id, label, icon, role: `${label} area of the app`, availability: "generated" as const, linkedScreenName: label,
    })),
    design: null, visualBrief: "", screenChrome: [],
  };
  return applyReferenceNavigationStyle(plan, evidence);
}

/** The document a screen is drawn in on the canvas and in exports, with the preset's tokens. */
export function presetDocument(preset: CuratedStylePreset, code: string, { navigation = false }: { navigation?: boolean } = {}) {
  const plan = navigation ? presetNavigationPlan(preset) : null;
  return buildStandaloneHtmlExport({
    screen: { code } as ScreenData,
    // the export replaces any bar the screen drew itself, as generation does with the shared navigation
    navigationCode: plan ? renderDeterministicNavigationShell(plan) : "",
    activeNavigationItemId: plan?.items[0]?.id ?? "",
    designTokens: preset.tokens,
  });
}

/** Every extracted component on one page, each under its name and the note on when to use it. */
export const componentSheetCode = (preset: CuratedStylePreset) => [
  '<div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col gap-6 px-4 py-6">',
  ...preset.components.map((component) => [
    "<section>",
    `<p style="margin:0 0 6px;font:600 11px/1.3 system-ui,sans-serif;opacity:.65">${escapeHtml(component.name)} — ${escapeHtml(component.use)}</p>`,
    component.html,
    "</section>",
  ].join("")),
  preset.components.length === 0 ? '<p class="dg-type-body">No component was extracted.</p>' : "",
  "</div>",
].join("");

async function screenshotDocument(browser: Browser, html: string, offline: boolean) {
  const context = await browser.newContext({ viewport: { ...SCREEN_VIEWPORT }, deviceScaleFactor: 2 });
  if (offline) {
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("about:")) return route.continue();
      const stub = EMPTY_BODY[route.request().resourceType()];
      return stub ? route.fulfill({ status: 200, ...stub }) : route.abort();
    });
  }
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: offline ? "domcontentloaded" : "networkidle", timeout: 60_000 });
    await page.evaluate("document.fonts.ready.then(() => true)");
    await page.waitForTimeout(offline ? 50 : 700);
    const scrollHeight = await page.evaluate("document.documentElement.scrollHeight") as number;
    const height = Math.min(1800, Math.max(SCREEN_VIEWPORT.height, scrollHeight));
    const png = await page.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: 0, width: SCREEN_VIEWPORT.width, height } });
    return { png, height };
  } finally {
    await context.close();
  }
}

/** The cropped phone at the width a screen is drawn at, for the sheet. */
async function phoneCell(image: PromptImagePayload) {
  const png = await sharp(Buffer.from(image.data, "base64")).resize({ width: SCREEN_VIEWPORT.width * 2 }).png().toBuffer();
  const { height = SCREEN_VIEWPORT.height * 2 } = await sharp(png).metadata();
  return { png, height: Math.round(height / 2) };
}

export async function renderPresetPreview({
  browser,
  preset,
  specimenHtml,
  specimenLabel,
  specimenReference = null,
  reference,
  referenceLabel,
  title,
  offline = false,
}: {
  browser: Browser;
  preset: CuratedStylePreset;
  specimenHtml: string;
  specimenLabel: string;
  /** The one phone the specimen recreates, cropped out of the reference: the side-by-side to judge it against. */
  specimenReference?: PromptImagePayload | null;
  /** The reference image: the whole thing, so that the specimen can be judged against its phone. */
  reference: PromptImagePayload;
  referenceLabel: string;
  title: string;
  offline?: boolean;
}): Promise<Buffer> {
  const specimen = await screenshotDocument(browser, presetDocument(preset, specimenHtml, { navigation: true }), offline);
  const components = await screenshotDocument(browser, presetDocument(preset, componentSheetCode(preset)), offline);
  const extension = reference.mimeType.includes("png") ? "png" : reference.mimeType.includes("webp") ? "webp" : "jpg";
  const phone = specimenReference ? await phoneCell(specimenReference) : null;
  return buildContactSheet(browser, {
    title,
    reference: { bytes: Buffer.from(reference.data, "base64"), extension },
    referenceLabel,
    screens: [
      ...(phone ? [{ label: "Reference phone", detail: "the phone the specimen recreates", ...phone }] : []),
      { label: specimenLabel, detail: "recreate build with its components marked, and the bar the renderer draws", png: specimen.png, height: specimen.height },
      { label: "Extracted components", detail: `${preset.components.length} of at most 10, as every project's builder will see them`, png: components.png, height: components.height },
    ],
  });
}
