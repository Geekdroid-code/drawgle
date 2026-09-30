// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

import { evaluateScreen, PROBE_EXPRESSION, PROBE_SOURCE, type ProbeFacts } from "./checks";

// Real Chromium, no network: the fixtures use inline styles instead of Tailwind.
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const probe = async (html: string): Promise<ProbeFacts> => {
  const page: Page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0}*{box-sizing:border-box}</style></head><body>${html}</body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    return await page.evaluate(PROBE_EXPRESSION) as ProbeFacts;
  } finally {
    await page.close();
  }
};

const screen = (content: string, navigation = "") =>
  `<div id="drawgle-export-root" style="min-height:100vh;background:#ECE9D6">${content}${navigation ? `<div id="drawgle-export-navigation">${navigation}</div>` : ""}</div>`;

describe("design evaluation probe", () => {
  it("is plain source text that runs without Node or bundler helpers", () => {
    expect(typeof PROBE_SOURCE).toBe("string");
    expect(PROBE_SOURCE).not.toContain("__name");
    expect(() => new Function(`"use strict"; return (${PROBE_SOURCE});`)()).not.toThrow();
  });

  it("measures radius, pills, fills, shadows and the page background", async () => {
    const facts = await probe(screen(`
      <div class="card" style="margin:16px;width:358px;height:160px;background:#FFFFFF;border-radius:32px;box-shadow:0 4px 20px rgba(45,41,38,0.04)">Card</div>
      <button class="chip" style="margin:0 16px;width:96px;height:40px;background:#FFC068;border:0;border-radius:9999px">Chip</button>
      <div class="avatar" style="margin:16px;width:44px;height:44px;background:#EFE9D9;border-radius:50%"></div>
      <div class="ghost" style="margin:16px;width:200px;height:100px;border-radius:40px"></div>
    `));

    expect(facts.viewport).toEqual({ width: 390, height: 844 });
    expect(facts.pageBackground).toMatchObject({ r: 236, g: 233, b: 214 });

    const byClass = (name: string) => facts.elements.find((item) => item.label.includes(name))!;
    const card = byClass("card");
    expect(card).toMatchObject({ radius: 32, pill: false, width: 358, height: 160 });
    expect(card.bg).toMatchObject({ r: 255, g: 255, b: 255, a: 1 });
    expect(card.shadow).toContain("20px");
    expect(card.text).toBe("Card");

    const chip = byClass("chip");
    expect(chip.pill).toBe(true);
    expect(chip.radius).toBeGreaterThanOrEqual(20);
    expect(byClass("avatar").pill).toBe(true);
    // a transparent, borderless element paints no rounding
    expect(byClass("ghost").bg).toBeNull();
  });

  it("resolves modern colour syntaxes through the canvas", async () => {
    const facts = await probe(screen(
      `<div class="mixed" style="margin:16px;width:200px;height:80px;background:color-mix(in srgb, #ffffff 50%, #000000);border-radius:12px"></div>`,
    ));
    const mixed = facts.elements.find((item) => item.label.includes("mixed"))!;
    expect(mixed.bg!.r).toBeGreaterThan(120);
    expect(mixed.bg!.r).toBeLessThan(136);
    expect(mixed.bg!.r).toBe(mixed.bg!.g);
  });

  it("separates the shared navigation from a tab bar the screen drew itself", async () => {
    const icon = `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>`;
    const tabs = (count: number) => Array.from({ length: count }, () => `<button style="width:60px;height:48px">${icon}</button>`).join("");
    const local = await probe(screen(`
      <main style="min-height:1200px">Content</main>
      <div style="position:fixed;left:0;right:0;bottom:0;height:64px;display:flex;justify-content:space-around;background:#fff">${tabs(4)}</div>
      <nav style="margin:16px">${tabs(2)}</nav>
    `));
    expect(local.localNavigation.length).toBe(2);
    expect(local.localNavigation.some((entry) => entry.reason.includes("bottom bar with 4 icon controls"))).toBe(true);
    expect(local.localNavigation.some((entry) => entry.reason === "nav element")).toBe(true);
    expect(local.sharedNavigation.present).toBe(false);

    const shared = await probe(screen(
      `<main style="min-height:900px">Content</main>`,
      `<nav data-drawgle-primary-nav style="position:fixed;bottom:0;left:0;right:0">${
        ["a", "b", "c"].map((id) => `<button data-nav-item-id="${id}" style="width:60px;height:48px">${icon}</button>`).join("")}</nav>`,
    ));
    expect(shared.localNavigation).toEqual([]);
    expect(shared.sharedNavigation).toEqual({ present: true, itemCount: 3 });
    expect(shared.elements.some((item) => item.inNav)).toBe(true);
  });

  it("counts bitmap placeholders and slots", async () => {
    const facts = await probe(screen(`
      <div data-asset-slot="true" data-asset-placeholder="true" data-asset-requirement-id="pets" style="width:80px;height:80px;background:#ddd"></div>
      <div data-asset-slot="true" data-asset-requirement-id="hero" style="width:80px;height:80px"></div>
    `));
    expect(facts.assets).toMatchObject({ slots: 2, placeholders: 1, images: 0 });
  });

  it("produces facts the pure evaluation turns into the expected findings", async () => {
    const facts = await probe(screen(`
      <div style="margin:16px;width:358px;height:160px;background:#FFFFFF;border-radius:32px;box-shadow:0 4px 20px rgba(45,41,38,0.04)">Card</div>
    `));
    const result = evaluateScreen(facts, {
      screenName: "Fixture",
      brief: "A 32px card.",
      elevation: "flat-tone",
      expected: { background: "#ECE9D6", card: "#F7F5E9" },
      sharedNavigationEnabled: false,
      flowHasNavigation: null,
      isRoot: true,
      showsSharedNavigation: false,
    });
    expect(result.flags).toEqual(expect.arrayContaining(["radius", "shadow", "tone", "brief-values"]));
    expect(result.tone).toMatchObject({ page: "#ECE9D6", card: "#FFFFFF" });
  });
});
