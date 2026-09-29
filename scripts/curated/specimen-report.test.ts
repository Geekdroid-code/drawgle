// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import { presetFixture } from "@/lib/generation/curated-style-preset-fixtures";

import { formatSpecimenReport, measureSpecimen, specimenFlags } from "./specimen-report";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

/** Inline styles only: the page is measured offline, without the Tailwind runtime. */
const screen = (blocks: string) => `<div class="w-full min-h-screen dg-bg-primary" style="min-height:100vh;display:flex;flex-direction:column;padding:0 16px">${blocks}</div>`;
const backBar = (titleClass: string, title = "Meditation & Mindfulness") =>
  `<div style="display:flex;align-items:center;gap:12px;height:56px"><button style="width:48px;height:48px;border-radius:9999px"><i data-lucide="arrow-left"></i></button><h1 class="${titleClass}" style="margin:0">${title}</h1></div>`;

const measure = (html: string) => measureSpecimen({ browser, preset: presetFixture(), html, offline: true });

describe("what the report says of a rebuilt phone", () => {
  it("reads the title's role, size and lines, and that it sits in a top bar", async () => {
    const report = await measure(screen(backBar("dg-type-nav-title")));
    expect(report.title).toMatchObject({ text: "Meditation & Mindfulness", roles: ["dg-type-nav-title"], fontSize: 17, inTopBar: true, lines: 1 });
    expect(specimenFlags(report)).toEqual(expect.not.arrayContaining([expect.stringContaining("sits in a top bar")]));
  });

  it("flags a screen title built inside a top bar, the failure of the first mindfulness build", async () => {
    const report = await measure(screen(backBar("dg-type-screen-title")));
    expect(report.title).toMatchObject({ roles: ["dg-type-screen-title"], inTopBar: true });
    expect(report.title!.fontSize).toBeGreaterThan(20);
    expect(specimenFlags(report).join("\n")).toContain("sits in a top bar but is built as dg-type-screen-title, not dg-type-nav-title");
  });

  it("does not flag a screen title that opens a screen with no back control beside it", async () => {
    const report = await measure(screen('<h1 class="dg-type-screen-title" style="margin:0">Today Your Activities</h1>'));
    expect(report.title?.inTopBar).toBe(false);
    expect(specimenFlags(report).join("\n")).not.toContain("top bar");
  });

  it("flags a title that wraps in a top bar", async () => {
    const report = await measure(screen(backBar("dg-type-screen-title", "A very long title that cannot fit beside the back button in one line")));
    expect(report.title!.lines).toBeGreaterThan(1);
    expect(specimenFlags(report).join("\n")).toContain("wraps onto");
  });

  it("measures the space between the blocks of the screen, top to bottom", async () => {
    const block = (margin: number) => `<div style="height:60px;margin-top:${margin}px">Block</div>`;
    const report = await measure(screen(`${block(0)}${block(16)}${block(24)}${block(12)}`));
    expect(report.gaps).toEqual([16, 24, 12]);
    expect(report.tallestBlock).toMatchObject({ height: 60 });
  });

  it("names the tallest block and how tall it is against the screen's width", async () => {
    const report = await measure(screen('<div style="height:40px">Bar</div><div data-dg-component="media-hero-card" style="height:393px">Card</div>'));
    expect(report.tallestBlock).toMatchObject({ name: "media-hero-card", height: 393, ratioToWidth: 1 });
  });

  it("counts round controls stretched into ovals, and only those", async () => {
    const control = (width: number, height: number) => `<button style="width:${width}px;height:${height}px;border-radius:9999px">x</button>`;
    // a 40x48 "circle" is an oval; a real circle and a wide chip are not
    const report = await measure(screen(`${control(40, 48)}${control(48, 48)}${control(120, 48)}${control(44, 52)}`));
    expect(report.ovals).toBe(2);
    expect(specimenFlags(report).join("\n")).toContain("2 round controls are stretched into an oval");
  });

  it("knows a generic keyword and a font that is not on the page", async () => {
    const generic = await measure(screen('<h1 style="font-family:serif;margin:0">Title</h1>'));
    expect(generic.title).toMatchObject({ fontFamily: "serif", generic: true });
    expect(specimenFlags(generic).join("\n")).toContain('generic keyword "serif"');

    const missing = await measure(screen('<h1 style="font-family:\'ZzNotAFontAtAll\', sans-serif;margin:0">Title</h1>'));
    expect(missing.title).toMatchObject({ fontFamily: "ZzNotAFontAtAll", generic: false, available: false });
    expect(specimenFlags(missing).join("\n")).toContain('"ZzNotAFontAtAll" is not on the page');
  });

  it("prints its numbers as lines, and the checks after them", async () => {
    const lines = formatSpecimenReport(await measure(screen(backBar("dg-type-screen-title"))));
    expect(lines[0]).toContain('title "Meditation & Mindfulness": dg-type-screen-title');
    expect(lines.some((line) => line.startsWith("space between blocks"))).toBe(true);
    expect(lines.some((line) => line.startsWith("CHECK: the title"))).toBe(true);
  });
});
