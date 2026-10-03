/**
 * Proves the clean export renders as the old one. For each screen it builds both exports from the same input, renders
 * them in Chromium at 390 x 844, and compares every element's computed style (its ::before and ::after too), its
 * box and the full-page pixels. The only elements the clean export may lack are ones the old one did not render (the
 * hidden copy of each kit tab). Writes scripts/export-fidelity/out/report.json and report.md. No model calls.
 *
 * Screens: the exports in public/screens, out/corpus-db.json (from collect.ts) when present, and any export files
 * given as arguments.
 *
 *   pnpm exec tsx --conditions=react-server scripts/export-fidelity/compare.ts [--only=name ...] [--save] [export.html ...]
 *
 * --save also writes each screen's old and clean export to out/pages/<screen>.old.html and .clean.html.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { chromium, type Browser } from "playwright";
import sharp from "sharp";

import { buildDrawgleExportRuntimeCss, buildDrawgleTailwindConfigScript } from "@/lib/drawgle-html-runtime";
import {
  buildCleanHtmlExport,
  buildCleanScreenOnlyHtmlExport,
  buildCompiledExportSnapshot,
  buildStandaloneHtmlExport,
  resolveScreenNavigationCode,
  type ExportProjectContext,
} from "@/lib/export-pipeline";
import { LUCIDE_DRAW_ICONS_CALL, LUCIDE_NAME_REPAIR_SCRIPT } from "@/lib/lucide-runtime";
import type { DesignTokens, ScreenData } from "@/lib/types";

// The export builders parse markup with DOMParser, as they do in the browser. jsdom ships no types; this is all it needs.
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html: string) => { window: { DOMParser: typeof DOMParser } } };
globalThis.DOMParser = new JSDOM("").window.DOMParser;

const root = process.cwd();
const outDirectory = path.join(root, "scripts", "export-fidelity", "out");

type BuildInput = Parameters<typeof buildCompiledExportSnapshot>[0];
type Case = { name: string; source: string; input: BuildInput };

const screen = (name: string, code: string): ScreenData => ({
  id: name, projectId: "fidelity", userId: "fidelity", name, code, prompt: "", x: 0, y: 0, createdAt: "", updatedAt: "",
});

/** Reads an old standalone export back into the input that built it. */
function parseExport(html: string, name: string, source: string): Case | null {
  const style = /<style>([\s\S]*?)<\/style>/.exec(html.slice(0, html.indexOf("<body")))?.[1];
  const rootAt = html.indexOf('<div id="drawgle-export-root">');
  const scriptAt = html.lastIndexOf("<script>");
  if (!style || rootAt < 0 || scriptAt < rootAt) return null;
  const baseAt = style.indexOf("html, body {");
  const content = html.slice(rootAt + '<div id="drawgle-export-root">'.length, html.lastIndexOf("</div>", scriptAt));
  const navigationAt = content.indexOf('<div id="drawgle-export-navigation">');
  const head = html.slice(0, html.indexOf("<body"));
  return {
    name, source,
    input: {
      screen: screen(name, navigationAt < 0 ? content : content.slice(0, navigationAt)),
      navigationCode: navigationAt < 0 ? "" : content.slice(navigationAt + '<div id="drawgle-export-navigation">'.length, content.lastIndexOf("</div>")),
      activeNavigationItemId: /=== "([^"]*)"/.exec(html.slice(scriptAt))?.[1] ?? "",
      tokenCss: (baseAt < 0 ? style : style.slice(0, baseAt)).trim(),
      googleFontAssetLinks: (head.match(/<link\b[^>]*>/g) ?? []).join("\n"),
    },
  };
}

async function loadCases(extraFiles: string[]) {
  const cases: Case[] = [];
  const showcase = path.join(root, "public", "screens");
  for (const folder of await readdir(showcase)) {
    if (!existsSync(path.join(showcase, folder)) || folder.includes(".")) continue;
    for (const file of (await readdir(path.join(showcase, folder))).filter((entry) => entry.endsWith(".html"))) {
      const parsed = parseExport(await readFile(path.join(showcase, folder, file), "utf8"), `${folder}/${file}`, "showcase");
      if (parsed) cases.push(parsed);
      else console.warn(`Could not read ${folder}/${file}`);
    }
  }
  for (const file of extraFiles) {
    const parsed = parseExport(await readFile(file, "utf8"), path.basename(file), "file");
    if (parsed) cases.push(parsed);
    else console.warn(`Could not read ${file}`);
  }
  const corpus = path.join(outDirectory, "corpus-db.json");
  if (existsSync(corpus)) {
    const contexts = JSON.parse(await readFile(corpus, "utf8")) as ExportProjectContext[];
    for (const context of contexts) {
      for (const item of context.screens) {
        cases.push({
          name: `${context.project.name} / ${item.name}`, source: "project",
          input: {
            screen: item,
            navigationCode: resolveScreenNavigationCode(item, context.projectNavigation),
            activeNavigationItemId: item.navigationItemId,
            designTokens: context.designTokens as DesignTokens | null,
          },
        });
      }
    }
  }
  return cases;
}

/** The Agent Pack screen file as it was built before, for comparison. */
function oldScreenOnlyHtml(input: BuildInput) {
  const snapshot = buildCompiledExportSnapshot(input);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${buildDrawgleTailwindConfigScript()}
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    ${snapshot.googleFontAssetLinks}
    <style>
${buildDrawgleExportRuntimeCss(snapshot.tokenCss, { includeNavigation: false })}
    </style>
  </head>
  <body>
    <div id="drawgle-export-root">
${snapshot.cleanScreenHtml}
    </div>
    <script>
      ${LUCIDE_NAME_REPAIR_SCRIPT}
      ${LUCIDE_DRAW_ICONS_CALL}
    </script>
  </body>
</html>`;
}

/** Numbers every start tag outside style, script and textarea contents, so the two pages' elements can be paired. */
function tagElements(html: string, counter: { next: number }) {
  const protectedRegion = /(<(?:style|script|textarea)\b[^>]*>)[\s\S]*?<\/(?:style|script|textarea)\s*>|<!--[\s\S]*?-->/gi;
  const tag = (markup: string) => markup.replace(/<([A-Za-z][\w:-]*)(?=[\s/>])/g, (whole) => `${whole} x-fid="${counter.next++}"`);
  let result = "";
  let last = 0;
  for (const region of html.matchAll(protectedRegion)) {
    const index = region.index ?? 0;
    result += tag(html.slice(last, index)) + (region[1] ? tag(region[1]) + region[0].slice(region[1].length) : region[0]);
    last = index + region[0].length;
  }
  return result + tag(html.slice(last));
}

function tagged(input: BuildInput): BuildInput {
  const counter = { next: 1 };
  return { ...input, screen: { ...input.screen, code: tagElements(input.screen.code, counter) }, navigationCode: tagElements(input.navigationCode ?? "", counter) };
}

// Kept as source text: a function given to page.evaluate would carry the bundler's __name helper into the page.
const COLLECT = `(() => {
  const styleOf = (style) => { const values = {}; for (let index = 0; index < style.length; index += 1) { const name = style.item(index); values[name] = style.getPropertyValue(name); } return values; };
  const elements = {};
  for (const element of document.querySelectorAll("[x-fid]")) {
    const box = element.getBoundingClientRect();
    const pseudo = {};
    for (const which of ["::before", "::after"]) {
      const style = getComputedStyle(element, which);
      if (style.content && style.content !== "none" && style.content !== "normal") pseudo[which] = styleOf(style);
    }
    elements[element.getAttribute("x-fid")] = {
      tag: element.tagName.toLowerCase(),
      rendered: element.getClientRects().length > 0,
      box: [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100),
      style: styleOf(getComputedStyle(element)),
      pseudo,
    };
  }
  return elements;
})()`;

type Rendered = { elements: Record<string, { tag: string; rendered: boolean; box: number[]; style: Record<string, string>; pseudo: Record<string, Record<string, string>> }>; png: Buffer };

async function render(browser: Browser, html: string): Promise<Rendered> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => page.waitForTimeout(2_000));
    await page.evaluate("document.fonts.ready");
    await page.waitForTimeout(400);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(150);
    const elements = await page.evaluate(COLLECT) as Rendered["elements"];
    const png = await page.screenshot({ fullPage: true });
    return { elements, png };
  } finally {
    await page.close();
  }
}

async function pixelDifference(first: Buffer, second: Buffer) {
  const [a, b] = await Promise.all([first, second].map((png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { pixels: -1, size: `${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}` };
  }
  let pixels = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (a.data[offset] !== b.data[offset] || a.data[offset + 1] !== b.data[offset + 1] || a.data[offset + 2] !== b.data[offset + 2] || a.data[offset + 3] !== b.data[offset + 3]) pixels += 1;
  }
  return { pixels, size: `${a.info.width}x${a.info.height}` };
}

type Difference = { element: string; tag: string; what: string; before: string; after: string };

/**
 * Chromium lists every variable an element inherits in its computed style, so each variable the clean export leaves
 * out shows on every element. Those are counted, not failed: a variable something used would change a real property
 * or a pixel, and both are compared. A variable whose value changed, or that appears, is a difference.
 */
function compareElements(before: Rendered["elements"], after: Rendered["elements"]) {
  const differences: Difference[] = [];
  const unusedVariables = new Set<string>();
  let removedUnrendered = 0;
  for (const [id, old] of Object.entries(before)) {
    const next = after[id];
    if (!next) {
      if (old.rendered) differences.push({ element: id, tag: old.tag, what: "element", before: "rendered", after: "missing" });
      else removedUnrendered += 1;
      continue;
    }
    if (old.box.join() !== next.box.join()) differences.push({ element: id, tag: old.tag, what: "box", before: old.box.join(), after: next.box.join() });
    for (const [property, value] of Object.entries(old.style)) {
      if (property.startsWith("--") && !(property in next.style)) unusedVariables.add(property);
      else if (next.style[property] !== value) differences.push({ element: id, tag: old.tag, what: property, before: value, after: next.style[property] ?? "" });
    }
    for (const property of Object.keys(next.style)) {
      if (!(property in old.style)) differences.push({ element: id, tag: old.tag, what: property, before: "", after: next.style[property] });
    }
    for (const [which, style] of Object.entries(old.pseudo)) {
      for (const [property, value] of Object.entries(style)) {
        const nextStyle = next.pseudo[which] ?? {};
        if (property.startsWith("--") && !(property in nextStyle)) unusedVariables.add(property);
        else if (nextStyle[property] !== value) differences.push({ element: id, tag: old.tag, what: `${which} ${property}`, before: value, after: nextStyle[property] ?? "" });
      }
    }
  }
  for (const [id, next] of Object.entries(after)) {
    if (!before[id]) differences.push({ element: id, tag: next.tag, what: "element", before: "missing", after: "rendered" });
  }
  return { differences, removedUnrendered, unusedVariables: unusedVariables.size, elements: Object.keys(before).length };
}

type Result = {
  name: string; source: string; variant: "standalone" | "screen-only";
  oldBytes: number; newBytes: number; elements: number; removedUnrendered: number; unusedVariables: number;
  differences: Difference[]; pixels: number; size: string; error?: string;
};

async function compareCase(browser: Browser, item: Case, variant: Result["variant"]): Promise<Result> {
  const build = (input: BuildInput) => variant === "standalone"
    ? { before: buildStandaloneHtmlExport(input), after: buildCleanHtmlExport(input) }
    : { before: oldScreenOnlyHtml(input), after: buildCleanScreenOnlyHtmlExport(input) };
  const plain = build(item.input);
  const base = { name: item.name, source: item.source, variant, oldBytes: Buffer.byteLength(plain.before), newBytes: Buffer.byteLength(plain.after) };
  try {
    const pages = build(tagged(item.input));
    let [before, after] = [await render(browser, pages.before), await render(browser, pages.after)];
    let compared = compareElements(before.elements, after.elements);
    let pixels = await pixelDifference(before.png, after.png);
    // Web fonts and images arrive on their own time, more so with several pages loading at once: a page that differs
    // is rendered again, up to twice, before a difference is reported.
    for (let retry = 0; retry < 2 && (compared.differences.length || pixels.pixels !== 0); retry += 1) {
      [before, after] = [await render(browser, pages.before), await render(browser, pages.after)];
      compared = compareElements(before.elements, after.elements);
      pixels = await pixelDifference(before.png, after.png);
    }
    return { ...base, ...compared, ...pixels };
  } catch (failure) {
    return { ...base, elements: 0, removedUnrendered: 0, unusedVariables: 0, differences: [], pixels: -1, size: "", error: failure instanceof Error ? failure.message : String(failure) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((arg) => arg.startsWith("--only=")).map((arg) => arg.slice("--only=".length).toLowerCase());
  const cases = (await loadCases(args.filter((arg) => !arg.startsWith("--"))))
    .filter((item) => !only.length || only.some((name) => item.name.toLowerCase().includes(name)));
  console.log(`Comparing ${cases.length} screens, each as a standalone page and as an Agent Pack screen...`);
  if (args.includes("--save")) {
    // Each screen's old and clean export side by side, for reading or opening in a browser.
    await mkdir(path.join(outDirectory, "pages"), { recursive: true });
    for (const item of cases) {
      const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      await writeFile(path.join(outDirectory, "pages", `${slug}.old.html`), buildStandaloneHtmlExport(item.input));
      await writeFile(path.join(outDirectory, "pages", `${slug}.clean.html`), buildCleanHtmlExport(item.input));
    }
  }
  const browser = await chromium.launch();
  const results: Result[] = [];
  const queue = cases.flatMap((item) => [[item, "standalone"], [item, "screen-only"]] as const);
  let done = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const result = await compareCase(browser, next[0], next[1]);
      results.push(result);
      done += 1;
      const verdict = result.error ? `error: ${result.error}` : result.differences.length || result.pixels ? `${result.differences.length} style differences, ${result.pixels} pixels` : "identical";
      console.log(`[${done}/${cases.length * 2}] ${result.variant.padEnd(11)} ${result.name}: ${verdict}`);
    }
  }));
  await browser.close();

  results.sort((a, b) => a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant));
  const failed = results.filter((result) => result.error || result.differences.length || result.pixels !== 0);
  const total = (key: "oldBytes" | "newBytes", variant: Result["variant"]) => results.filter((result) => result.variant === variant).reduce((sum, result) => sum + result[key], 0);
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  const lines = [
    "# Export fidelity",
    "",
    `${cases.length} screens (${cases.filter((item) => item.source === "showcase").length} showcase exports, ${cases.filter((item) => item.source === "project").length} project screens, ${cases.filter((item) => item.source === "file").length} files), each compared as a standalone page and as an Agent Pack screen, in Chromium at 390 x 844.`,
    "",
    `- Identical: ${results.length - failed.length} of ${results.length} pages: every element's computed style, ::before and ::after, box, and every pixel.`,
    `- Elements compared: ${results.reduce((sum, result) => sum + result.elements, 0)}; left out because the old page did not render them (hidden kit tab copies): ${results.reduce((sum, result) => sum + result.removedUnrendered, 0)}. Unused variables left out, per page on average: ${Math.round(results.reduce((sum, result) => sum + result.unusedVariables, 0) / Math.max(1, results.length))}.`,
    `- Standalone pages: ${kb(total("oldBytes", "standalone"))} → ${kb(total("newBytes", "standalone"))} (${Math.round((1 - total("newBytes", "standalone") / total("oldBytes", "standalone")) * 100)}% smaller).`,
    `- Agent Pack screens: ${kb(total("oldBytes", "screen-only"))} → ${kb(total("newBytes", "screen-only"))} (${Math.round((1 - total("newBytes", "screen-only") / total("oldBytes", "screen-only")) * 100)}% smaller).`,
    "",
    "| Screen | Page | Old | New | Elements | Result |",
    "|---|---|---|---|---|---|",
    ...results.map((result) => `| ${result.name} | ${result.variant} | ${kb(result.oldBytes)} | ${kb(result.newBytes)} | ${result.elements} | ${result.error ? `error: ${result.error}` : result.differences.length || result.pixels ? `${result.differences.length} style differences, ${result.pixels} pixels` : "identical"} |`),
  ];
  if (failed.length) {
    lines.push("", "## Differences", "");
    for (const result of failed) {
      lines.push(`### ${result.name} (${result.variant})`, "", ...result.differences.slice(0, 25).map((difference) => `- element ${difference.element} <${difference.tag}> ${difference.what}: \`${difference.before}\` → \`${difference.after}\``), "");
    }
  }
  await mkdir(outDirectory, { recursive: true });
  await writeFile(path.join(outDirectory, "report.json"), JSON.stringify(results, null, 2));
  await writeFile(path.join(outDirectory, "report.md"), `${lines.join("\n")}\n`);
  console.log(`\n${lines.slice(2, 7).join("\n")}\nReport: scripts/export-fidelity/out/report.md`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.stack : failure);
  process.exit(1);
});
