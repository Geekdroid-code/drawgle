/**
 * Visual eval harness: one command turns a project id into a contact sheet and a
 * check table, so a change to the generation pipeline can be judged by looking.
 *
 *   pnpm design:eval --project 0ce99a06 --label baseline
 *   pnpm design:eval --set docs/design-eval/baseline/projects.json --label baseline
 *   pnpm design:eval --bundle scripts/design-eval/out/baseline/pets-family
 *
 * Credentials come only from the process environment through the app's env
 * helpers. Nothing here reads or prints env files.
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { normalizeRadiusClass } from "@/lib/generation/design-classes";

import {
  loadProjectBundle,
  loadReferenceImage,
  readBundle,
  saveBundle,
  type ProjectBundle,
  type ReferenceImage,
} from "./bundle";
import type { ReferenceElevation } from "./checks";
import { prepareSnapshot } from "./prepare";
import { snapshotBundle } from "./run";

const ELEVATIONS = ["flat-tone", "hairline", "soft-shadow", "strong-shadow", "unknown"] as const;

const usage = `Usage:
  design:eval --project <id|prefix> [--case <id>] [--label <name>] [--out <dir>]
  design:eval --set <projects.json>   ({ "<case id>": "<project id>", ... })
  design:eval --bundle <dir>          (replay a saved bundle without the database)

Options:
  --label <name>            Run label; the default output is scripts/design-eval/out/<label>/<case or project>
  --out <dir>               Output directory (with --project or --bundle)
  --publish <dir>           Copy contact-sheet.png and checks.md there (into <dir>/<case id> with --set). Commit only these small files.
  --elevation <class>       flat-tone | hairline | soft-shadow | strong-shadow | unknown (default: from the reference DNA)
  --expect-background <hex> Reference page colour for the tone match (default: measured from the reference image)
  --expect-card <hex>       Reference card colour for the tone match (default: measured from the reference image)
  --retoken                 What-if: render the existing screens under tokens calibrated the way generation now
                            calibrates them (radius cap, flat elevation, measured page and card). Nothing is saved.
  --radius-class <class>    square | soft | rounded | very-rounded, for --retoken (default: from the reference DNA)
  --reference <file>        Use this image as the reference instead of the stored one
  --offline                 Do not reach the network while rendering (no Tailwind: for tests only)`;

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    set: { type: "string" },
    bundle: { type: "string" },
    case: { type: "string" },
    label: { type: "string", default: "adhoc" },
    out: { type: "string" },
    publish: { type: "string" },
    elevation: { type: "string" },
    "expect-background": { type: "string" },
    "expect-card": { type: "string" },
    retoken: { type: "boolean", default: false },
    "radius-class": { type: "string" },
    reference: { type: "string" },
    offline: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

type Overrides = {
  elevation?: ReferenceElevation;
  expected?: { background?: string | null; card?: string | null } | null;
};

const overrides = (): Overrides => {
  if (values.elevation && !(ELEVATIONS as readonly string[]).includes(values.elevation)) {
    throw new Error(`--elevation must be one of ${ELEVATIONS.join(", ")}.`);
  }
  return {
    ...(values.elevation ? { elevation: values.elevation as ReferenceElevation } : {}),
    ...(values["expect-background"] || values["expect-card"]
      ? { expected: { background: values["expect-background"] ?? null, card: values["expect-card"] ?? null } }
      : {}),
  };
};

async function createAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Database credentials are not present in the process environment. Use --bundle to replay a saved snapshot.");
  }
  // Loaded lazily: it imports server-only modules that need --conditions=react-server.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function snapshotOne({
  browser,
  projectRef,
  bundleDir,
  caseId,
  publishDir,
}: {
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  projectRef: string | null;
  bundleDir: string | null;
  caseId: string | null;
  publishDir: string | null;
}) {
  let bundle: ProjectBundle;
  let image: ReferenceImage | null;
  let outDir: string;

  if (bundleDir) {
    ({ bundle, image } = await readBundle(bundleDir));
    outDir = values.out ?? bundleDir;
  } else if (projectRef) {
    const admin = await createAdmin();
    bundle = await loadProjectBundle(admin, projectRef);
    image = await loadReferenceImage(admin, bundle.reference).catch((error: unknown) => {
      console.warn(`  reference image unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    });
    outDir = values.out ?? path.join("scripts", "design-eval", "out", values.label ?? "adhoc", caseId ?? bundle.project.id.slice(0, 8));
    bundle = (await saveBundle(outDir, bundle, image)) ?? bundle;
  } else {
    throw new Error(usage);
  }

  if (values.reference) {
    const bytes = await readFile(values.reference);
    image = { bytes, extension: path.extname(values.reference).slice(1).toLowerCase() || "jpg" };
  }

  console.log(`\n${caseId ? `${caseId} · ` : ""}${bundle.project.name} (${bundle.project.id})`);
  console.log(`  ${bundle.screens.length} screens, reference: ${bundle.reference.id ?? bundle.reference.source}, shared navigation: ${bundle.navigation?.plan.enabled ? "on" : "off"}`);
  const radiusClass = values["radius-class"] ? normalizeRadiusClass(values["radius-class"]) : null;
  if (values["radius-class"] && !radiusClass) throw new Error("--radius-class must be square, soft, rounded or very-rounded.");
  const prepared = await prepareSnapshot({ bundle, image, overrides: overrides(), retoken: values.retoken, radiusClass });
  prepared.notes.forEach((note) => console.log(`  ${note}`));
  const title = [
    caseId ? `${caseId} · ${prepared.bundle.project.name} (${prepared.bundle.project.id.slice(0, 8)}) · ${values.label}` : null,
    values.retoken ? "what-if: re-tokened" : null,
  ].filter(Boolean).join(" · ");
  const result = await snapshotBundle({
    browser,
    bundle: prepared.bundle,
    image,
    outDir,
    title: title || undefined,
    overrides: prepared.overrides,
    options: { offline: values.offline },
  });
  console.log(`\n${result.table}\n\n  contact sheet: ${result.contactSheetPath}\n  report:        ${result.checksPath}`);

  if (publishDir) {
    await mkdir(publishDir, { recursive: true });
    await copyFile(result.contactSheetPath, path.join(publishDir, "contact-sheet.png"));
    await copyFile(result.checksPath, path.join(publishDir, "checks.md"));
    console.log(`  published:     ${publishDir}`);
  }
  return result;
}

async function main() {
  if (values.help) {
    console.log(usage);
    return;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    if (values.set) {
      const mapping = JSON.parse(await readFile(values.set, "utf8")) as Record<string, string>;
      for (const [caseId, projectId] of Object.entries(mapping)) {
        if (!projectId || projectId.startsWith("<")) {
          console.log(`\n${caseId}: no project recorded yet, skipped.`);
          continue;
        }
        await snapshotOne({
          browser,
          projectRef: projectId,
          bundleDir: null,
          caseId,
          publishDir: values.publish ? path.join(values.publish, caseId) : null,
        });
      }
      return;
    }
    await snapshotOne({
      browser,
      projectRef: values.project ?? null,
      bundleDir: values.bundle ?? null,
      caseId: values.case ?? null,
      publishDir: values.publish ?? null,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  // Only messages written in this harness are safe to show; database errors may carry details.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Usage:|Database credentials|"[^"]+" is not a project id|No project id starts|More than one project|The project|--elevation|--radius-class|The curated|The stored|Unsupported bundle)/;
  console.error(safe.test(message) ? message : "The design eval failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
