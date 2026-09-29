// @vitest-environment node
import { readFile } from "node:fs/promises";

import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import {
  presetComponents,
  presetFixture,
} from "@/lib/generation/curated-style-preset-fixtures";

import { componentSheetCode, presetDocument, presetNavigationPlan, renderPresetPreview } from "./preview";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const reference = async () => ({
  data: (await readFile(new URL("../../lib/generation/__fixtures__/mindfulness-meditation-beige-light.jpg", import.meta.url))).toString("base64"),
  mimeType: "image/jpeg",
});

const specimen = `<div class="w-full min-h-screen dg-bg-primary dg-text-high" style="min-height:100vh;padding:16px">
  <div class="dg-surface-card dg-radius-app" style="padding:16px;margin-bottom:12px">Calendar strip</div>
  <div class="dg-surface-inset dg-radius-inner" style="padding:16px">Stat tile</div>
</div>`;

describe("the preset preview", () => {
  it("draws the components with the preset's tokens, each under its name and use", () => {
    const code = componentSheetCode(presetFixture());
    for (const component of presetComponents()) {
      expect(code).toContain(component.html);
      expect(code).toContain(`${component.name} —`);
    }
    expect(componentSheetCode(presetFixture({ components: [] }))).toContain("No component was extracted.");
    // escaped: a name or a use is never markup
    const risky = presetFixture({ components: [{ name: "a<b>", use: "x & y", html: "<i></i>" }] });
    expect(componentSheetCode(risky)).toContain("a&lt;b&gt; — x &amp; y");
    expect(presetDocument(presetFixture(), "<p>hi</p>")).toContain("--dg-color-surface-card: #F7F4E8");
  });

  it("draws the specimen with the bar the renderer will build for it, in the reference's own construction", () => {
    const plan = presetNavigationPlan(presetFixture())!;
    expect(plan.items).toHaveLength(4);
    expect(plan.design).toMatchObject({ anatomy: "fixed-tab-rail", labels: "hidden", activeTreatment: "icon-fill", activeFill: "gradient", radiusPx: 24 });
    const html = presetDocument(presetFixture(), specimen, { navigation: true });
    expect(html).toContain('data-navigation-layout="attached-edge-rail"');
    expect(html).toContain("border-radius:24px 24px 0 0;");
    expect(html).toContain('data-nav-item-id="home"');
    // the components are drawn without it
    const bar = /<nav\b[^>]*data-drawgle-primary-nav/;
    expect(presetDocument(presetFixture(), specimen)).not.toMatch(bar);
    // a reference with no bar of its own has no sample bar
    expect(presetNavigationPlan(presetFixture({ navigation: null }))).toBeNull();
    expect(presetDocument(presetFixture({ navigation: null }), specimen, { navigation: true })).not.toMatch(bar);
  });

  it("replaces the bar the specimen drew itself, never doubles it", () => {
    const own = `${specimen}<nav class="fixed bottom-0 inset-x-0"><button data-nav-item-id="x"><i data-lucide="home"></i></button><button data-nav-item-id="y"><i data-lucide="user"></i></button></nav>`;
    const html = presetDocument(presetFixture(), own, { navigation: true });
    expect(html.match(/<nav\b[^>]*data-drawgle-primary-nav/g)).toHaveLength(1);
    expect(html).not.toContain('data-nav-item-id="x"');
  });

  it("puts the reference, the specimen and the components on one contact sheet", async () => {
    const png = await renderPresetPreview({
      browser,
      preset: presetFixture(),
      specimenHtml: specimen,
      specimenLabel: "Phone 2: History",
      specimenReference: { data: (await sharp(Buffer.from((await reference()).data, "base64")).extract({ left: 400, top: 100, width: 350, height: 700 }).png().toBuffer()).toString("base64"), mimeType: "image/png" },
      reference: await reference(),
      referenceLabel: "mindfulness-meditation-beige-light",
      title: "mindfulness-meditation-beige-light · curated style preset (unapproved)",
      offline: true,
    });
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    // the reference, the phone it recreates, the specimen and the components, side by side
    expect(meta.width).toBeGreaterThan(390 * 3 + 300);
    expect(meta.height).toBeGreaterThan(844);
  }, 60_000);
});
