/**
 * An A/B of the screen build's model and thinking level, on a saved project, judged by looking and by cost.
 * One run is one arm (the model policy reads its settings when it is first imported), so an A/B is two or
 * more runs with different labels and a report over them:
 *
 *   pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label flash-low
 *   pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label flash-high --thinking high
 *   pnpm design:ab --bundle scripts/design-eval/out/baseline/pets-family --label pro-low --model <the provider's current Pro id>
 *   pnpm design:ab --report scripts/design-eval/out/ab/flash-low scripts/design-eval/out/ab/flash-high scripts/design-eval/out/ab/pro-low
 *
 * Each run rebuilds the same screens of the saved project with the same input, records the tokens, the time
 * and the cost of every build (builds.json, builds.md), and renders the results into a contact sheet and a check
 * table like the rest of the harness. It calls the model with the credentials in the process environment, through
 * the app's env helpers; nothing here reads or prints env files, and a failed build saves no error details.
 * See scripts/design-eval/ab-run.ts for what the input includes.
 *
 * It spends real money, one live model call per screen, so a run without --yes only says what it would build and
 * what that would roughly cost.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { describeRun, formatArmMarkdown, formatComparison, pickScreens, runBuilds, type ArmFile } from "./ab-run";
import { readBundle } from "./bundle";
import { parsePrice, priceOf } from "./cost";
import { snapshotBundle } from "./run";

const LEVELS = ["minimal", "low", "medium", "high"] as const;

const usage = `Usage:
  design:ab --bundle <dir> --label <name> [--model <id>] [--thinking minimal|low|medium|high]
            [--screens "Today,3"] [--limit 3] [--price "0.5,3"] [--out <dir>] [--offline] [--yes]
  design:ab --report <arm dir> <arm dir> ...

A run makes one live model call per screen, on the account whose credentials are in the environment. Without --yes
it only says what it would build and roughly what that would cost, and calls nothing.

Options:
  --yes             Actually run the builds and spend what they cost
  --bundle <dir>    A saved harness bundle (see design:eval), which holds the project's screens, tokens and reference
  --label <name>    Names the arm; the default output is scripts/design-eval/out/ab/<label>
  --model <id>      The screen build model for this run (DRAWGLE_GEMINI_FULL_BUILD_MODEL); default: the configured one
  --thinking <lvl>  The screen build thinking level (DRAWGLE_GEMINI_SCREEN_BUILD_THINKING); default: the configured one
  --screens <list>  Screens to build, by name or by their number on the contact sheet; default: the first --limit
  --limit <n>       How many screens when --screens is not given (default 3)
  --price <in,out>  Dollars per million input and output tokens, for a model the price table does not know
  --offline         Do not reach the network while rendering (no Tailwind: for tests only)
  --report          Compare the arms whose directories follow`;

const { values, positionals } = parseArgs({
  options: {
    bundle: { type: "string" },
    label: { type: "string" },
    model: { type: "string" },
    thinking: { type: "string" },
    screens: { type: "string" },
    limit: { type: "string" },
    price: { type: "string" },
    out: { type: "string" },
    offline: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    report: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
  strict: true,
});

async function report(directories: string[]) {
  if (directories.length === 0) throw new Error(usage);
  const arms = await Promise.all(directories.map(async (directory) =>
    JSON.parse(await readFile(path.join(directory, "builds.json"), "utf8")) as ArmFile));
  console.log(formatComparison(arms));
}

async function run() {
  if (!values.bundle || !values.label) throw new Error(usage);
  if (values.thinking && !(LEVELS as readonly string[]).includes(values.thinking.toLowerCase())) {
    throw new Error(`--thinking must be one of ${LEVELS.join(", ")}.`);
  }
  // The model policy reads these when it is first imported, so the generation modules are imported after them.
  if (values.model?.trim()) process.env.DRAWGLE_GEMINI_FULL_BUILD_MODEL = values.model.trim();
  if (values.thinking) process.env.DRAWGLE_GEMINI_SCREEN_BUILD_THINKING = values.thinking.toLowerCase();
  const [{ buildScreenStream, extractCode }, { geminiConfigForTask, geminiModelForTask }, { getScreenBuilderProvider }] = await Promise.all([
    import("@/lib/generation/service"),
    import("@/lib/ai/model-policy"),
    import("@/lib/env/server"),
  ]);
  if (getScreenBuilderProvider() !== "gemini") {
    throw new Error("This compares Gemini's model and thinking level, and DRAWGLE_SCREEN_BUILDER_PROVIDER is not gemini.");
  }
  const model = geminiModelForTask("screen_build");
  const thinking = String(geminiConfigForTask("screen_build").thinkingConfig?.thinkingLevel ?? "default");
  const price = values.price ? parsePrice(values.price) : priceOf(model);

  const { bundle, image } = await readBundle(values.bundle);
  const screens = pickScreens({
    bundle,
    only: values.screens?.split(",").map((part) => part.trim()).filter(Boolean),
    limit: values.limit ? Number(values.limit) : 3,
  });
  console.log(describeRun({ label: values.label, model, thinking, screens, price }));
  if (!values.yes) {
    console.log("\nNothing has been called. Run it again with --yes to spend it.");
    return;
  }

  const { records, rebuilt } = await runBuilds({ bundle, image, screens, buildScreen: buildScreenStream, finish: extractCode, price });
  const arm: ArmFile = { version: 1, label: values.label, model, thinking, bundle: values.bundle, price, records };
  const outDir = values.out ?? path.join("scripts", "design-eval", "out", "ab", values.label);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "builds.json"), JSON.stringify(arm, null, 2));
  await writeFile(path.join(outDir, "builds.md"), formatArmMarkdown(arm));
  console.log(`\n${formatArmMarkdown(arm)}`);

  if (rebuilt.screens.length > 0) {
    const browser = await chromium.launch({ headless: true });
    try {
      const result = await snapshotBundle({
        browser, bundle: rebuilt, image, outDir,
        title: `${values.label}: ${model}, thinking ${thinking}`,
        options: { offline: values.offline },
      });
      console.log(`${result.table}\n\n  contact sheet: ${result.contactSheetPath}\n  builds:        ${path.join(outDir, "builds.md")}`);
    } finally {
      await browser.close();
    }
  }
}

async function main() {
  if (values.help) {
    console.log(usage);
    return;
  }
  if (values.report) await report(positionals);
  else await run();
}

main().catch((error) => {
  // Only messages written in this script are safe to show; provider and database errors may carry details.
  const message = error instanceof Error ? error.message : "";
  const safe = /^(Usage:|--|This compares|None of|Unsupported bundle|The .+ could not be)/;
  console.error(safe.test(message) ? message : "The A/B failed; no sensitive error details were printed.");
  process.exitCode = 1;
});
