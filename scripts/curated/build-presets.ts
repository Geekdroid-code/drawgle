/**
 * Builds the curated style presets, offline, with the founder's own keys, once per reference.
 *
 *   pnpm curated:presets --id <reference id>       build one preset, unapproved, with a preview to look at
 *   pnpm curated:presets --id <id> --components    make the components of a built preset again (a build per phone),
 *                                                  keeping its analysis, palette and tokens; unapproves it
 *   pnpm curated:presets --id <id> --closeups      read the close-ups of a built preset again (six small calls), keeping
 *                                                  its tokens, components and specimens; unapproves it
 *   pnpm curated:presets --all                     build every reference that has no preset yet
 *   pnpm curated:presets --all --rebuild           ...and those that have one (a rebuild un-approves it)
 *   pnpm curated:presets --approve <reference id>  approve a built preset, after looking at its preview
 *
 * A build is one full analysis (every phone, no salvage) corrected by a close-up of the top and the bottom of each
 * phone (the letters of the headings, and whether the bottom bar is attached or floating), the measured palette,
 * the calibrated tokens, and a specimen of each phone: the recreate builder on it, with each reusable component
 * marked, read back out of the markup. A specimen that stops before it finishes is built again once, and left out
 * if it stops again. It writes lib/generation/generated/curated-style-presets.json and a preview to
 * scripts/curated/out/<id>.png (git-ignored). Nothing is used at run time until a preset is approved, and only
 * while its catalogue entry is unchanged. See lib/generation/curated-style-presets.ts.
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

import { chromium, type Browser } from "playwright";

import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
import {
  PresetBuildError,
  buildCuratedPreset,
  rebuildPresetComponents,
  specimenScreens,
  type PresetBuildDeps,
  type PresetBuildResult,
  type PresetSpecimen,
} from "@/lib/generation/curated-preset-builder";
import { enforceSansTypography } from "@/lib/design-tokens";
import type { PromptImagePayload } from "@/lib/types";
import {
  curatedPresetReport,
  curatedStylePresetSchema,
  serializeCuratedPresets,
  withCuratedPreset,
  withCuratedPresetApproval,
  type CuratedStylePreset,
} from "@/lib/generation/curated-style-presets";
import { geminiFocusAsk, refineAnalysisFromCrops } from "@/lib/generation/reference-focus";
import { boxOf, buildCompleteSpecimen, cropToBox, specimenBuildInput } from "@/lib/generation/specimen-build";

import { renderPresetPreview } from "./preview";
import { formatSpecimenReport, measureSpecimen } from "./specimen-report";

const PRESETS_PATH = path.join("lib", "generation", "generated", "curated-style-presets.json");
const OUT_DIR = path.join("scripts", "curated", "out");

const usage = `Usage:
  curated:presets --id <reference id> [--components | --closeups] | --all [--rebuild] [--model <id>] [--build-model <id>]
  curated:presets --approve <reference id>`;

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    all: { type: "boolean", default: false },
    rebuild: { type: "boolean", default: false },
    components: { type: "boolean", default: false },
    closeups: { type: "boolean", default: false },
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

  const askAboutCloseUp = await geminiFocusAsk();

  return {
    analyze: async ({ reference, image }) => {
      const result = await analyzeReferenceImageForScope({
        prompt: reference.styleIntent, image, referenceMode: "curated_style", referenceId: null,
      });
      if (!result.analysis || result.source !== "full_analysis") return result;
      // A picture of three phones leaves the letters and the bottom bar to chance; a close-up of each phone does not.
      const refined = await refineAnalysisFromCrops({ image, analysis: result.analysis, ask: askAboutCloseUp });
      for (const note of refined.notes) console.log(`  close-up: ${note}`);
      return { ...result, analysis: refined.analysis };
    },
    generateTokens: ({ reference, image, analysis }) => generateDesignTokens({
      prompt: reference.styleIntent, image, referenceMode: "curated_style", referenceId: reference.id,
      referenceAnalysis: analysis, ignorePreset: true,
    }),
    buildSpecimen: async ({ reference, image, screen, tokens }) => {
      const built = await buildCompleteSpecimen(
        buildScreenCode,
        specimenBuildInput({ image, screen, tokens, intent: reference.styleIntent }),
        { onIncomplete: (issue, attempt) => console.log(`  phone ${screen.index}: the build was cut short (${issue}); ${attempt < 2 ? "building it again" : "leaving it out"}`) },
      );
      return built.code;
    },
  };
}

async function approve(id: string) {
  await writePresets(withCuratedPresetApproval(await readPresets(), id));
  console.log(`Approved the preset for ${id}. It is used from the next generation on, while its catalogue entry is unchanged.`);
}

/** The saved preset of a reference, whatever its approval, or an error that says what to do. */
async function savedPreset(id: string): Promise<CuratedStylePreset> {
  const entry = (await readPresets() as Record<string, unknown>)[id];
  const parsed = curatedStylePresetSchema.safeParse(entry);
  if (!entry || !parsed.success) throw new Error(`There is no preset for ${id} to make the components of. Build it first.`);
  return parsed.data as unknown as CuratedStylePreset;
}

/** Writes the sheet of a preset from the specimens it was built from, and prints what each rebuilt phone measures. */
async function writeSheet({ browser, id, preset, image, specimens }: {
  browser: Browser;
  id: string;
  preset: CuratedStylePreset;
  image: PromptImagePayload;
  specimens: PresetSpecimen[];
}) {
  const preview = await renderPresetPreview({
    browser,
    preset,
    specimens: specimens.map((specimen) => ({
      html: specimen.html, label: `Phone ${specimen.screenIndex}: ${specimen.screenName}`, reference: specimen.image,
    })),
    reference: image,
    referenceLabel: id,
    title: `${id} · curated style preset (unapproved)`,
  });
  await writeFile(path.join(OUT_DIR, `${id}.png`), preview);
  // The numbers behind each rebuilt phone, so that the sheet is not judged by eye alone.
  for (const specimen of specimens) {
    const report = await measureSpecimen({ browser, preset, html: specimen.html });
    console.log(`  phone ${specimen.screenIndex} (${specimen.screenName}):`);
    for (const line of formatSpecimenReport(report)) console.log(`    ${line}`);
  }
}

/**
 * Reads the close-ups of a built preset again: what the letters of the headings are, and how the bottom bar is
 * built. It keeps the preset's tokens (a serif or monospaced font is replaced when the letters read as a sans),
 * its components and its specimens, so it costs six small calls where a build costs about twelve.
 */
async function readCloseUpsAgain(id: string) {
  if (values.model) process.env.DRAWGLE_GEMINI_PROJECT_PLANNER_MODEL = values.model;
  const [{ loadCuratedStyleReferenceImage }, { geminiModelForTask }] = await Promise.all([
    import("@/lib/generation/curated-style-references"),
    import("@/lib/ai/model-policy"),
  ]);
  const reference = CURATED_STYLE_REFERENCES.find((entry) => entry.id === id)!;
  console.log(`
${id}
Model: ${geminiModelForTask("project_planning")} for the close-up questions.`);
  const image = await loadCuratedStyleReferenceImage(reference);
  if (!image) throw new PresetBuildError("analysis", "the reference image could not be loaded");
  const preset = await savedPreset(id);
  const refined = await refineAnalysisFromCrops({ image, analysis: preset.analysis, ask: await geminiFocusAsk() });
  for (const note of refined.notes) console.log(`  close-up: ${note}`);

  const navigation = refined.analysis.primaryNavigation?.present ? refined.analysis.primaryNavigation : null;
  const parsed = curatedStylePresetSchema.safeParse({
    ...preset,
    approved: false,
    builtAt: new Date().toISOString(),
    analysis: { ...refined.analysis, primaryNavigation: navigation },
    navigation,
    tokens: refined.analysis.typefaceClass === "sans" ? enforceSansTypography(preset.tokens) : preset.tokens,
  });
  if (!parsed.success) throw new PresetBuildError("preset", `${parsed.error.issues[0]?.path.join(".") || "preset"}: ${parsed.error.issues[0]?.message ?? "not valid"}`);
  const next = parsed.data as unknown as CuratedStylePreset;
  await writePresets(withCuratedPreset(await readPresets(), id, next));

  // the sheet, from the specimens the last build saved
  const specimens: PresetSpecimen[] = [];
  for (const screen of specimenScreens(next.analysis)) {
    try {
      const html = await readFile(path.join(OUT_DIR, `${id}.specimen-${screen.index}.html`), "utf8");
      specimens.push({ screenIndex: screen.index, screenName: screen.suggestedRole, html, image: await cropToBox(image, boxOf(screen)!) });
    } catch {
      console.log(`  no saved specimen for phone ${screen.index}: it is left off the sheet`);
    }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    await writeSheet({ browser, id, preset: next, image, specimens });
  } finally {
    await browser.close();
  }
  console.log(`  close-ups read again: bar ${navigation ? `${navigation.anatomy}, ${navigation.itemCount} icons` : "none"}, headings ${refined.analysis.typefaceClass ?? "unchanged"}`);
  console.log(`  look at ${path.join(OUT_DIR, `${id}.png`)}, then: pnpm curated:presets --approve ${id}`);
}

async function buildAll(ids: string[], componentsOnly = false) {
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
        const result: PresetBuildResult = componentsOnly
          ? await rebuildPresetComponents({ reference, image, preset: await savedPreset(id), deps })
          : await buildCuratedPreset({ reference, image, deps });
        await writePresets(withCuratedPreset(await readPresets(), id, result.preset));
        for (const specimen of result.specimens) {
          await writeFile(path.join(OUT_DIR, `${id}.specimen-${specimen.screenIndex}.html`), specimen.html, "utf8");
        }
        await writeSheet({ browser, id, preset: result.preset, image, specimens: result.specimens });
        console.log(`  ${componentsOnly ? "components made again" : "built"}: ${result.preset.analysis.screenCountEstimate} phones, ${result.specimens.length} rebuilt, ${result.preset.components.length} components, card radius ${result.preset.tokens.tokens?.radii?.app}`);
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
  if (values.components && !values.id) throw new Error(`--components makes the components of one built preset: give it an --id.\n${usage}`);
  if (values.closeups && !values.id) throw new Error(`--closeups reads the close-ups of one built preset: give it an --id.\n${usage}`);
  if (values.closeups && values.components) throw new Error(`Give --closeups or --components, not both.\n${usage}`);
  if (values.closeups) {
    await readCloseUpsAgain(values.id!);
    return;
  }

  const ids = values.id
    ? [values.id]
    : curatedPresetReport(await readPresets()).statuses
      .filter((entry) => values.rebuild || !["approved", "unapproved"].includes(entry.status))
      .map((entry) => entry.id);
  if (ids.length === 0) {
    console.log("Every reference already has a preset. Use --rebuild to make them again.");
    return;
  }
  await buildAll(ids, values.components);
}

main().catch((error) => {
  // Only messages written in this script are safe to show; provider and database errors may carry details.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Usage:|--components|--closeups|Give --closeups|"[^"]+" is not in|There is no preset|The preset for|The (?:analysis|palette|tokens|specimen|preset) step failed)/;
  console.error(safe.test(message) ? message : "The presets script failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
