/**
 * Builds the curated style presets, offline, with the founder's own keys, once per reference.
 *
 *   pnpm curated:presets --id <reference id>       build one preset, unapproved, with a preview to look at
 *   pnpm curated:presets --all                     build every reference that has no preset yet
 *   pnpm curated:presets --all --rebuild           ...and those that have one (a rebuild un-approves it)
 *   pnpm curated:presets --approve <reference id>  approve a built preset, after looking at its preview
 *
 * A build is one full analysis (every phone, no salvage), the measured palette, the calibrated tokens, and
 * a specimen: the recreate builder on the phone with the most components, with each reusable component
 * marked, read back out of the markup. It writes lib/generation/generated/curated-style-presets.json and a
 * preview to scripts/curated/out/<id>.png (git-ignored). Nothing is used at run time until a preset is
 * approved, and only while its catalogue entry is unchanged. See lib/generation/curated-style-presets.ts.
 *
 * Options:
 *   --model <id>        the model for the analysis and the tokens (default: the configured planner model)
 *   --build-model <id>  the model for the specimen build (default: the configured build model)
 *
 * Provider credentials come only from the process environment through the app's env helpers. Nothing
 * here reads or prints env files.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
import { PresetBuildError, buildCuratedPreset, type PresetBuildDeps } from "@/lib/generation/curated-preset-builder";
import {
  curatedPresetReport,
  serializeCuratedPresets,
  withCuratedPreset,
  withCuratedPresetApproval,
} from "@/lib/generation/curated-style-presets";
import { specimenBuildInput } from "@/lib/generation/specimen-build";

import { renderPresetPreview } from "./preview";

const PRESETS_PATH = path.join("lib", "generation", "generated", "curated-style-presets.json");
const OUT_DIR = path.join("scripts", "curated", "out");

const usage = `Usage:
  curated:presets --id <reference id> | --all [--rebuild] [--model <id>] [--build-model <id>]
  curated:presets --approve <reference id>`;

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    all: { type: "boolean", default: false },
    rebuild: { type: "boolean", default: false },
    approve: { type: "string" },
    model: { type: "string" },
    "build-model": { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

const readPresets = async (): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(PRESETS_PATH, "utf8"));
  } catch {
    return {};
  }
};

const writePresets = (raw: unknown) => writeFile(PRESETS_PATH, serializeCuratedPresets(raw), "utf8");

/**
 * The model policy reads its models from the environment when it is first imported, so the generation
 * modules are imported here, after --model has been applied, and not at the top of the file.
 */
async function realDeps(): Promise<PresetBuildDeps> {
  if (values.model) process.env.DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL = values.model;
  if (values["build-model"]) process.env.DRAWGLE_GEMINI_FULL_BUILD_MODEL = values["build-model"];
  const [{ analyzeReferenceImageForScope }, { buildScreenCode, generateDesignTokens }, { geminiModelForTask }] = await Promise.all([
    import("@/lib/generation/scope-contract"),
    import("@/lib/generation/service"),
    import("@/lib/ai/model-policy"),
  ]);
  console.log(`Models: ${geminiModelForTask("project_planning")} for the analysis and tokens, ${geminiModelForTask("screen_build")} for the specimen.`);

  return {
    analyze: ({ reference, image }) => analyzeReferenceImageForScope({
      prompt: reference.styleIntent, image, referenceMode: "curated_style", referenceId: null,
    }),
    generateTokens: ({ reference, image, analysis }) => generateDesignTokens({
      prompt: reference.styleIntent, image, referenceMode: "curated_style", referenceId: reference.id,
      referenceAnalysis: analysis, ignorePreset: true,
    }),
    buildSpecimen: async ({ reference, image, screen, tokens }) => {
      const built = await buildScreenCode(specimenBuildInput({ image, screen, tokens, intent: reference.styleIntent }));
      return built.code;
    },
  };
}

async function approve(id: string) {
  await writePresets(withCuratedPresetApproval(await readPresets(), id));
  console.log(`Approved the preset for ${id}. It is used from the next generation on, while its catalogue entry is unchanged.`);
}

async function buildAll(ids: string[]) {
  const deps = await realDeps();
  const { loadCuratedStyleReferenceImage } = await import("@/lib/generation/curated-style-references");
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  try {
    for (const id of ids) {
      const reference = CURATED_STYLE_REFERENCES.find((entry) => entry.id === id)!;
      console.log(`\n${id}`);
      try {
        const image = await loadCuratedStyleReferenceImage(reference);
        if (!image) throw new PresetBuildError("analysis", "the reference image could not be loaded");
        const result = await buildCuratedPreset({ reference, image, deps });
        await writePresets(withCuratedPreset(await readPresets(), id, result.preset));
        const preview = await renderPresetPreview({
          browser,
          preset: result.preset,
          specimenHtml: result.specimen.html,
          specimenLabel: `Phone ${result.specimen.screenIndex}: ${result.specimen.screenName}`,
          specimenReference: result.specimen.image,
          reference: image,
          referenceLabel: id,
          title: `${id} · curated style preset (unapproved)`,
        });
        await writeFile(path.join(OUT_DIR, `${id}.png`), preview);
        await writeFile(path.join(OUT_DIR, `${id}.specimen.html`), result.specimen.html, "utf8");
        console.log(`  built: ${result.preset.analysis.screenCountEstimate} phones, ${result.preset.components.length} components, card radius ${result.preset.tokens.tokens?.radii?.app}`);
        for (const note of result.notes) console.log(`  note: ${note}`);
        console.log(`  look at ${path.join(OUT_DIR, `${id}.png`)}, then: pnpm curated:presets --approve ${id}`);
      } catch (error) {
        failures.push(id);
        console.error(`  ${error instanceof PresetBuildError ? error.message : "The build failed; no sensitive error details were printed. Check the provider key and try again."}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${ids.length} builds failed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

async function main() {
  if (values.help) {
    console.log(usage);
    return;
  }
  if (values.approve) {
    await approve(values.approve);
    return;
  }
  const known = new Set(CURATED_STYLE_REFERENCES.map((reference) => reference.id));
  if (values.id && !known.has(values.id)) throw new Error(`"${values.id}" is not in the curated style catalogue.`);
  if (!values.id && !values.all) throw new Error(usage);

  const ids = values.id
    ? [values.id]
    : curatedPresetReport(await readPresets()).statuses
      .filter((entry) => values.rebuild || !["approved", "unapproved"].includes(entry.status))
      .map((entry) => entry.id);
  if (ids.length === 0) {
    console.log("Every reference already has a preset. Use --rebuild to make them again.");
    return;
  }
  await buildAll(ids);
}

main().catch((error) => {
  // Only messages written in this script are safe to show; provider and database errors may carry details.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Usage:|"[^"]+" is not in|There is no preset|The preset for|The (?:analysis|palette|tokens|specimen|preset) step failed)/;
  console.error(safe.test(message) ? message : "The presets script failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
