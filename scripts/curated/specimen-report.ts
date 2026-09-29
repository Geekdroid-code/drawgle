import type { Browser } from "playwright";

import type { CuratedStylePreset } from "@/lib/generation/curated-style-presets";

import { SCREEN_VIEWPORT } from "../design-eval/render";
import { presetDocument } from "./preview";

/**
 * What the founder can read off a rebuilt phone without judging a picture: the numbers a preset hands to every
 * project built on it. They are facts about the render, with a few flags for things that are wrong in any
 * design: a title built as a screen title inside a top bar, a circle stretched into an oval, a heading set in a
 * font the page never loaded. A flag is a prompt to look, never a verdict, and nothing here changes a preset.
 */

export type SpecimenReport = {
  screenHeight: number;
  /** The first heading of the screen, when it has one. */
  title: {
    text: string;
    roles: string[];
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lines: number;
    /** The family is a generic keyword: the browser draws its own default. */
    generic: boolean;
    /** The page has the family, so that the title is drawn in it and not in a fallback. */
    available: boolean;
    /** A back, close or menu control sits in the same row: the title is a top-bar title. */
    inTopBar: boolean;
  } | null;
  bodyFont: { fontFamily: string; generic: boolean; available: boolean };
  /** The space between the screen's blocks, top to bottom, in CSS px at the phone's width. */
  gaps: number[];
  tallestBlock: { name: string; height: number; ratioToWidth: number } | null;
  /** Round controls that are not round: a 40px by 48px "circle". */
  ovals: number;
};

export const SPECIMEN_REPORT_PROBE = `(() => {
  const root = document.querySelector("#drawgle-export-root") || document.body;
  const content = root.querySelector(".min-h-screen") || root.firstElementChild || root;
  const rectOf = (element) => { const rect = element.getBoundingClientRect(); return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY, height: rect.height, width: rect.width }; };
  const round = (value) => Math.round(value * 10) / 10;
  const generics = ["serif", "sans-serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif", "cursive", "fantasy"];
  const canvas = document.createElement("canvas").getContext("2d");
  const widthOf = (font) => { canvas.font = font; return canvas.measureText("mmmmmmmmmmlli").width; };
  const primaryFamily = (stack) => {
    const first = String(stack || "").split(",")[0] || "";
    return first.split('"').join("").split("'").join("").trim();
  };
  const familyFacts = (stack) => {
    const family = primaryFamily(stack);
    const generic = generics.indexOf(family.toLowerCase()) >= 0;
    // a font is on the page when text set in it measures differently from the fallback alone, whichever fallback
    const available = !generic && family !== "" && (
      widthOf('72px "' + family + '", monospace') !== widthOf("72px monospace") ||
      widthOf('72px "' + family + '", serif') !== widthOf("72px serif")
    );
    return { fontFamily: family, generic: generic, available: available };
  };

  const navigation = document.querySelector("[data-drawgle-primary-nav]");
  const blocks = Array.from(content.children).filter((element) => {
    if (navigation && (element === navigation || element.contains(navigation))) return false;
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height > 0 && style.position !== "fixed" && style.position !== "absolute";
  }).sort((a, b) => rectOf(a).top - rectOf(b).top);
  const gaps = [];
  for (let index = 1; index < blocks.length; index++) gaps.push(round(rectOf(blocks[index]).top - rectOf(blocks[index - 1]).bottom));

  let tallest = null;
  for (const block of blocks) {
    const height = rectOf(block).height;
    if (!tallest || height > tallest.height) {
      const named = block.querySelector("[data-dg-component]");
      const label = block.getAttribute("data-dg-component") || (named && named.getAttribute("data-dg-component")) || (block.getAttribute("class") || "").split(" ").slice(0, 2).join(" ") || block.tagName.toLowerCase();
      tallest = { name: label, height: round(height), ratioToWidth: round(height / window.innerWidth) };
    }
  }

  const heading = content.querySelector("h1") || content.querySelector("h2") || content.querySelector('[class*="dg-type-nav-title"], [class*="dg-type-screen-title"], [class*="dg-type-hero-title"]');
  let title = null;
  if (heading) {
    const style = getComputedStyle(heading);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    const facts = familyFacts(style.fontFamily);
    const row = heading.parentElement;
    let inTopBar = false;
    if (row) {
      for (const icon of Array.from(row.querySelectorAll("[data-lucide]"))) {
        const name = icon.getAttribute("data-lucide") || "";
        if (name.indexOf("arrow-left") >= 0 || name.indexOf("chevron-left") >= 0 || name === "x" || name === "menu" || name.indexOf("close") >= 0) inTopBar = true;
      }
    }
    title = {
      text: (heading.textContent || "").trim().slice(0, 48),
      roles: (heading.getAttribute("class") || "").split(" ").filter((name) => name.indexOf("dg-type-") === 0),
      fontFamily: facts.fontFamily, fontSize: round(fontSize), fontWeight: parseInt(style.fontWeight, 10) || 400,
      lines: Math.max(1, Math.round(heading.getBoundingClientRect().height / lineHeight)),
      generic: facts.generic, available: facts.available, inTopBar: inTopBar,
    };
  }

  let ovals = 0;
  for (const element of Array.from(content.querySelectorAll("*"))) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24 || rect.width > 80 || rect.height > 80) continue;
    const style = getComputedStyle(element);
    const first = String(style.borderTopLeftRadius || "0").split(" ")[0];
    const radius = first.slice(-1) === "%" ? (parseFloat(first) / 100) * Math.min(rect.width, rect.height) : parseFloat(first) || 0;
    if (radius < Math.min(rect.width, rect.height) * 0.45) continue;
    const skew = Math.abs(rect.width - rect.height) / Math.max(rect.width, rect.height);
    if (skew >= 0.04 && skew <= 0.4) ovals++;
  }

  return {
    screenHeight: round(Math.max(document.documentElement.scrollHeight, content.getBoundingClientRect().height)),
    title: title,
    bodyFont: familyFacts(getComputedStyle(content).fontFamily),
    gaps: gaps,
    tallestBlock: tallest,
    ovals: ovals,
  };
})()`;

export async function measureSpecimen({
  browser,
  preset,
  html,
  offline = false,
}: {
  browser: Browser;
  preset: CuratedStylePreset;
  html: string;
  /** No network: utility classes and fonts are not loaded, so only what the inline styles say is measured. */
  offline?: boolean;
}): Promise<SpecimenReport> {
  const context = await browser.newContext({ viewport: { ...SCREEN_VIEWPORT } });
  try {
    if (offline) {
      await context.route("**/*", (route) => (route.request().url().startsWith("data:") || route.request().url().startsWith("about:") ? route.continue() : route.abort()));
    }
    const page = await context.newPage();
    await page.setContent(presetDocument(preset, html, { navigation: true }), { waitUntil: offline ? "domcontentloaded" : "networkidle", timeout: 60_000 });
    await page.evaluate("document.fonts.ready.then(() => true)");
    await page.waitForTimeout(offline ? 50 : 700);
    return await page.evaluate(SPECIMEN_REPORT_PROBE) as SpecimenReport;
  } finally {
    await context.close();
  }
}

/** Things that are wrong in any design, in words. Empty when the numbers show none. */
export function specimenFlags(report: SpecimenReport): string[] {
  const flags: string[] = [];
  const { title } = report;
  if (title) {
    if (title.inTopBar && title.roles.some((role) => role === "dg-type-screen-title" || role === "dg-type-hero-title")) {
      flags.push(`the title "${title.text}" sits in a top bar but is built as ${title.roles.join(" ")}, not dg-type-nav-title`);
    }
    if (title.inTopBar && title.lines > 1) flags.push(`the top-bar title wraps onto ${title.lines} lines`);
    if (title.generic) flags.push(`the title's font is the generic keyword "${title.fontFamily}", so the browser draws its own default`);
    else if (!title.available) flags.push(`the title's font "${title.fontFamily}" is not on the page, so a fallback is drawn`);
  }
  if (report.bodyFont.generic) flags.push(`the body font is the generic keyword "${report.bodyFont.fontFamily}"`);
  else if (!report.bodyFont.available) flags.push(`the body font "${report.bodyFont.fontFamily}" is not on the page`);
  if (report.ovals > 0) flags.push(`${report.ovals} round control${report.ovals === 1 ? " is" : "s are"} stretched into an oval`);
  return flags;
}

/** The report as the lines the script prints under each rebuilt phone. */
export function formatSpecimenReport(report: SpecimenReport): string[] {
  const { title, tallestBlock } = report;
  const lines = [
    title
      ? `title "${title.text}": ${title.roles.join(" ") || "no dg-type class"}, ${title.fontSize}px, weight ${title.fontWeight}, ${title.lines} line${title.lines === 1 ? "" : "s"}, ${title.fontFamily}`
      : "no heading found",
    `body font: ${report.bodyFont.fontFamily}`,
    `space between blocks, top to bottom: ${report.gaps.length ? report.gaps.join(", ") : "none"} px`,
    tallestBlock ? `tallest block: ${tallestBlock.name}, ${tallestBlock.height}px (${tallestBlock.ratioToWidth} x the screen width)` : "no block",
    `screen height: ${report.screenHeight}px`,
  ];
  return [...lines, ...specimenFlags(report).map((flag) => `CHECK: ${flag}`)];
}
