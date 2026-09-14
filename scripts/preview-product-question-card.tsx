// Local visual smoke test. No application routes, credentials or DB writes.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";
import { ProductQuestionCard } from "@/components/product-planning/ProductQuestionCard";

// tsx respects the Next JSX-preserve setting; provide React for this CLI renderer.
Object.assign(globalThis, { React });

async function main() {
  const markup = renderToStaticMarkup(<ProductQuestionCard messageId="11111111-1111-4111-8111-111111111111" active onSubmit={async () => true} questions={[{
    question: "What should onboarding help shoppers do?", consequence: "This shapes the steps before they reach your T-shirts.", choices: [
      { label: "Meet the brand, then shop", description: "A short, skippable welcome introduces Tacozz and gets shoppers to products quickly." },
      { label: "Find products that fit", description: "Ask size preferences only if they help shoppers find available products." },
      { label: "Start with the collection", description: "Show products immediately and introduce the brand within the shop." },
    ],
  }]} />);
  const from = join(process.cwd(), "app/globals.css");
  const css = await postcss([tailwind()]).process(await readFile(from, "utf8"), { from });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 790, height: 750 }, deviceScaleFactor: 1 });
    const html = `<html><head><style>${css.css}</style></head><body style="background:#eee;display:flex;gap:20px;padding:10px;font-family:Arial">
      ${["", "dark"].map(theme => `<div class="${theme}"><div class="dg-chat-shell" style="width:375px;padding-top:16px;padding-bottom:16px">${markup}</div></div>`).join("")}</body></html>`;
    const output = join(tmpdir(), "drawgle-product-question-card.png");
    await writeFile(join(tmpdir(), "drawgle-product-question-card.html"), html);
    await page.setContent(html);
    await page.screenshot({ path: output, fullPage: true });
    console.log(output);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
