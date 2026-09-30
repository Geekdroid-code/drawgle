import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Browser } from "playwright";

import type { ProjectBundle, ReferenceImage } from "./bundle";
import { formatCheckMarkdown, formatCheckTable, type ScreenCheckResult } from "./checks";
import {
  buildContactSheet,
  renderBundle,
  runChecks,
  type CheckOverrides,
  type RenderOptions,
} from "./render";

export type SnapshotResult = {
  outDir: string;
  results: ScreenCheckResult[];
  contactSheetPath: string;
  checksPath: string;
  table: string;
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "screen";

/**
 * Renders every screen of a bundle at 390×844 @2x, runs the checks on the rendered
 * DOM and writes the contact sheet, the per-screen PNGs and the check report.
 */
export async function snapshotBundle({
  browser,
  bundle,
  image,
  outDir,
  title,
  overrides = {},
  options = {},
}: {
  browser: Browser;
  bundle: ProjectBundle;
  image: ReferenceImage | null;
  outDir: string;
  title?: string;
  overrides?: CheckOverrides;
  options?: RenderOptions;
}): Promise<SnapshotResult> {
  await mkdir(path.join(outDir, "screens"), { recursive: true });
  const rendered = await renderBundle(browser, bundle, options);
  const results = runChecks(bundle, rendered, overrides);
  const heading = title ?? `${bundle.project.name} (${bundle.project.id.slice(0, 8)})`;

  await Promise.all(rendered.map((item, index) =>
    writeFile(path.join(outDir, "screens", `${String(index + 1).padStart(2, "0")}-${slug(item.screen.name)}.png`), item.png)));

  const contactSheet = await buildContactSheet(browser, {
    title: heading,
    reference: image,
    referenceLabel: bundle.reference.id ?? (bundle.reference.source === "upload" ? "uploaded image" : "none"),
    screens: rendered.map((item, index) => ({
      label: `${index + 1}. ${item.screen.name}`,
      detail: [
        item.sharedNavigation ? "shared nav" : "no shared nav",
        ...results[index].flags,
      ].join(" · "),
      png: item.png,
      height: item.height,
    })),
  });
  const contactSheetPath = path.join(outDir, "contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);

  const checksPath = path.join(outDir, "checks.md");
  await writeFile(checksPath, formatCheckMarkdown(heading, results));
  await writeFile(path.join(outDir, "checks.json"), JSON.stringify(results, null, 2));

  return { outDir, results, contactSheetPath, checksPath, table: formatCheckTable(results) };
}
