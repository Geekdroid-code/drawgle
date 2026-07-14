import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { GENERATION_V2_BENCHMARK_CASES } from "@/lib/generation/benchmark-cases";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const widths = [320, 390, 430];

const main = async () => {
  const v1Directory = argument("--v1");
  const v2Directory = argument("--v2");
  const outputDirectory = argument("--out") ?? path.join(process.env.TEMP || "C:/tmp", "drawgle-generation-v2-benchmark");
  if (!v1Directory || !v2Directory) throw new Error("Usage: --v1 <html-dir> --v2 <html-dir> [--out <dir>]");
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const rows: string[] = [];
  const metrics: Array<Record<string, unknown>> = [];
  try {
    for (const benchmarkCase of GENERATION_V2_BENCHMARK_CASES) {
      const v1Path = path.join(v1Directory, `${benchmarkCase.id}.html`);
      const v2Path = path.join(v2Directory, `${benchmarkCase.id}.html`);
      let v1Html: string;
      let v2Html: string;
      try {
        [v1Html, v2Html] = await Promise.all([readFile(v1Path, "utf8"), readFile(v2Path, "utf8")]);
      } catch {
        continue;
      }

      const images: string[] = [];
      for (const [version, html] of [["v1", v1Html], ["v2", v2Html]] as const) {
        for (const width of widths) {
          const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
          await page.setContent(html, { waitUntil: "networkidle" });
          const screenMetrics = await page.evaluate(() => ({
            bodyWidth: document.body.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            visibleTextLength: document.body.innerText.trim().length,
            imageCount: document.images.length,
            brokenImages: Array.from(document.images).filter((image) => !image.complete || image.naturalWidth === 0).length,
          }));
          const filename = `${benchmarkCase.id}-${version}-${width}.png`;
          await page.screenshot({ path: path.join(outputDirectory, filename), fullPage: false });
          await page.close();
          images.push(filename);
          metrics.push({ caseId: benchmarkCase.id, version, width, ...screenMetrics, horizontalOverflow: screenMetrics.bodyWidth > screenMetrics.viewportWidth + 1 });
        }
      }
      rows.push(`<section><h2>${escapeHtml(benchmarkCase.id)}: ${escapeHtml(benchmarkCase.prompt)}</h2><div class="grid">${images.map((image) => `<figure><img src="${image}" alt="${escapeHtml(image)}"><figcaption>${escapeHtml(image)}</figcaption></figure>`).join("")}</div></section>`);
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(outputDirectory, "metrics.json"), JSON.stringify(metrics, null, 2));
  await writeFile(path.join(outputDirectory, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Drawgle V1/V2 benchmark</title><style>body{font-family:Arial,sans-serif;margin:24px;background:#eee;color:#111}section{margin:0 0 36px}h2{font-size:16px}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}figure{margin:0}img{display:block;width:100%;background:#fff}figcaption{font-size:10px;margin-top:4px}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body><h1>Drawgle V1/V2 benchmark</h1>${rows.join("")}</body></html>`);
  console.log(`Rendered ${metrics.length} benchmark screenshots to ${outputDirectory}`);
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
