import sharp from "sharp";
import type { Browser, BrowserContext } from "playwright";

import { buildStandaloneHtmlExport, resolveScreenNavigationCode } from "@/lib/export-pipeline";
import { hasSharedNavigation } from "@/lib/project-navigation";
import type { ScreenData } from "@/lib/types";

import { flowHasNavigation, referenceElevationOf, type ProjectBundle, type ReferenceImage } from "./bundle";
import {
  evaluateScreen,
  PROBE_EXPRESSION,
  type CheckContext,
  type ProbeFacts,
  type ReferenceElevation,
  type ScreenCheckResult,
} from "./checks";

/** The size Drawgle's canvas draws a screen at. */
export const SCREEN_VIEWPORT = { width: 390, height: 844 } as const;
export const MAX_SCREEN_HEIGHT = 1800;

export type RenderedScreen = {
  screen: ScreenData;
  png: Buffer;
  facts: ProbeFacts;
  sharedNavigation: boolean;
  height: number;
};

export type RenderOptions = {
  /** Serve empty responses for every network request. For tests, where Tailwind's CDN is not reachable. */
  offline?: boolean;
  /** Extra settle time after the page is idle, for the Tailwind runtime and icon script. */
  settleMs?: number;
};

export const screensInSortOrder = (bundle: ProjectBundle) =>
  bundle.screens
    .filter((screen) => screen.code?.trim())
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.createdAt.localeCompare(b.createdAt));

/** The same document the canvas and the exports render: screen code, shared navigation and token CSS. */
export function buildScreenHtml(bundle: ProjectBundle, screen: ScreenData) {
  const sharedNavigation = hasSharedNavigation({ screen, projectNavigation: bundle.navigation });
  const navigationCode = sharedNavigation ? resolveScreenNavigationCode(screen, bundle.navigation) : "";
  return {
    sharedNavigation,
    html: buildStandaloneHtmlExport({
      screen,
      navigationCode,
      activeNavigationItemId: sharedNavigation ? screen.navigationItemId ?? "" : "",
      designTokens: bundle.project.designTokens,
    }),
  };
}

const EMPTY_BODY: Record<string, { contentType: string; body: string }> = {
  script: { contentType: "application/javascript", body: "" },
  stylesheet: { contentType: "text/css", body: "" },
  font: { contentType: "font/woff2", body: "" },
};

async function newRenderContext(browser: Browser, options: RenderOptions, scale = 2): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { ...SCREEN_VIEWPORT }, deviceScaleFactor: scale });
  if (options.offline) {
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("about:")) return route.continue();
      const stub = EMPTY_BODY[route.request().resourceType()];
      return stub ? route.fulfill({ status: 200, ...stub }) : route.abort();
    });
  }
  return context;
}

export async function renderBundle(browser: Browser, bundle: ProjectBundle, options: RenderOptions = {}): Promise<RenderedScreen[]> {
  const context = await newRenderContext(browser, options);
  const rendered: RenderedScreen[] = [];
  try {
    for (const screen of screensInSortOrder(bundle)) {
      const { html, sharedNavigation } = buildScreenHtml(bundle, screen);
      const page = await context.newPage();
      try {
        await page.setContent(html, { waitUntil: options.offline ? "domcontentloaded" : "networkidle", timeout: 60_000 });
        await page.evaluate("document.fonts.ready.then(() => true)");
        await page.waitForTimeout(options.settleMs ?? (options.offline ? 50 : 700));
        const facts = await page.evaluate(PROBE_EXPRESSION) as ProbeFacts;
        const height = Math.min(MAX_SCREEN_HEIGHT, Math.max(SCREEN_VIEWPORT.height, facts.scrollHeight));
        const png = await page.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: 0, width: SCREEN_VIEWPORT.width, height } });
        rendered.push({ screen, png, facts, sharedNavigation, height });
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }
  return rendered;
}

export type CheckOverrides = {
  elevation?: ReferenceElevation;
  expected?: { background?: string | null; card?: string | null } | null;
};

export function checkContextFor(bundle: ProjectBundle, screen: ScreenData, overrides: CheckOverrides = {}): CheckContext {
  const chrome = screen.chromePolicy?.chrome ?? null;
  return {
    screenName: screen.name,
    brief: screen.prompt ?? "",
    elevation: overrides.elevation ?? referenceElevationOf(bundle.project.charter),
    expected: overrides.expected ?? null,
    sharedNavigationEnabled: Boolean(bundle.navigation?.plan.enabled),
    flowHasNavigation: flowHasNavigation(bundle.project.productPlanning),
    isRoot: !screen.stateKey && (chrome === "bottom-tabs" || chrome === "top-bar"),
    showsSharedNavigation: hasSharedNavigation({ screen, projectNavigation: bundle.navigation }),
  };
}

export const runChecks = (bundle: ProjectBundle, rendered: RenderedScreen[], overrides: CheckOverrides = {}): ScreenCheckResult[] =>
  rendered.map((item) => evaluateScreen(item.facts, checkContextFor(bundle, item.screen, overrides)));

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type ContactSheetInput = {
  title: string;
  reference: ReferenceImage | null;
  referenceLabel: string;
  screens: Array<{ label: string; detail: string; png: Buffer; height: number }>;
};

/** The reference on the left, then every screen in sort order, on one neutral sheet. */
export async function buildContactSheet(browser: Browser, input: ContactSheetInput): Promise<Buffer> {
  const gap = 20;
  const padding = 24;
  const cellHeight = Math.max(SCREEN_VIEWPORT.height, ...input.screens.map((screen) => screen.height));
  const referenceHeight = Math.min(cellHeight, 900);
  let referenceWidth = 0;
  let referenceCell = "";
  if (input.reference) {
    const metadata = await sharp(input.reference.bytes).metadata();
    referenceWidth = Math.round((referenceHeight * (metadata.width ?? 4)) / (metadata.height ?? 3));
    const mime = input.reference.extension === "jpg" ? "jpeg" : input.reference.extension;
    referenceCell = `<figure style="width:${referenceWidth}px"><img alt="reference" style="display:block;width:${referenceWidth}px;height:${referenceHeight}px" src="data:image/${mime};base64,${input.reference.bytes.toString("base64")}"><figcaption><b>Reference</b><br>${escapeHtml(input.referenceLabel)}</figcaption></figure>`;
  }
  const cells = input.screens.map((screen) =>
    `<figure style="width:${SCREEN_VIEWPORT.width}px"><img alt="${escapeHtml(screen.label)}" style="display:block;width:${SCREEN_VIEWPORT.width}px;height:${screen.height}px;box-shadow:0 0 0 1px rgba(0,0,0,.12)" src="data:image/png;base64,${screen.png.toString("base64")}"><figcaption><b>${escapeHtml(screen.label)}</b><br>${escapeHtml(screen.detail)}</figcaption></figure>`,
  ).join("");
  const width = padding * 2 + (referenceCell ? referenceWidth + gap : 0) + input.screens.length * SCREEN_VIEWPORT.width
    + Math.max(0, input.screens.length - 1) * gap;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#E7E5E0;color:#1C1917;font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
    .sheet{display:flex;gap:${gap}px;padding:${padding}px;align-items:flex-start;width:${width - padding * 2}px}
    h1{margin:0;padding:${padding}px ${padding}px 0;font-size:15px;font-weight:600}
    figure{margin:0;flex:none}figcaption{margin-top:8px;color:#57534E}figcaption b{color:#1C1917}
  </style></head><body><h1>${escapeHtml(input.title)}</h1><div class="sheet">${referenceCell}${cells}</div></body></html>`;

  const context = await browser.newContext({ viewport: { width, height: 400 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const sheet = await page.screenshot({ type: "png", fullPage: true });
    // A palette PNG keeps the committed baseline small without visible loss on flat UI.
    return await sharp(sheet).png({ palette: true, quality: 90, effort: 8, compressionLevel: 9 }).toBuffer();
  } finally {
    await context.close();
  }
}
