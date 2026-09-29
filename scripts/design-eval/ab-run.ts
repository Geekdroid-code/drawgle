import { styleComponentsOf } from "@/lib/generation/style-components";
import type { BuildScreenInput, PromptImagePayload, ReferenceMode, ReferenceSource, ScreenData } from "@/lib/types";

import type { ProjectBundle, ReferenceImage } from "./bundle";
import { costOf, formatCost, type ModelPrice, type Usage } from "./cost";

/**
 * An A/B of the screen build's model and thinking level on a saved project: the same builds, the same inputs, one
 * setting different, with the tokens, the time and the cost of each recorded and the result rendered by the harness.
 * The model and the thinking level are environment settings read when the model policy is first imported, so one
 * run is one arm; `--report` puts the arms side by side.
 *
 * The inputs approximate what the generation task gives the builder: the project's tokens, reference, family
 * contract, style components and navigation, and the screen's stored brief. They leave out the project memory and
 * the asset manifest. Every arm gets the same input, which is what a comparison needs; the absolute look of a
 * build is not the point.
 */

export const emptyUsage = (): Usage => ({ inputTokens: null, outputTokens: null, thinkingTokens: null });

/** The token counts a provider chunk carries. Gemini sends them on its last chunk and may repeat them earlier. */
export function usageOfChunk(chunk: unknown): Partial<Usage> {
  const meta = (chunk as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!meta || typeof meta !== "object") return {};
  const count = (key: string) => {
    const value = meta[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
  return {
    inputTokens: count("promptTokenCount"),
    outputTokens: count("candidatesTokenCount"),
    thinkingTokens: count("thoughtsTokenCount"),
  };
}

/** Later counts replace earlier ones; a chunk that carries none leaves them as they were. */
export const mergeUsage = (current: Usage, next: Partial<Usage>): Usage => ({
  inputTokens: next.inputTokens ?? current.inputTokens,
  outputTokens: next.outputTokens ?? current.outputTokens,
  thinkingTokens: next.thinkingTokens ?? current.thinkingTokens,
});

const MIME: Record<string, string> = { png: "image/png", webp: "image/webp", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg" };

export const referencePayload = (image: ReferenceImage | null): PromptImagePayload | null =>
  image ? { data: image.bytes.toString("base64"), mimeType: MIME[image.extension.toLowerCase()] ?? "image/jpeg" } : null;

const isRoot = (screen: ScreenData) => screen.chromePolicy?.chrome === "bottom-tabs" || screen.chromePolicy?.chrome === "top-bar";

/** The build input for one stored screen. */
export function bundleBuildInput({
  bundle,
  screen,
  image,
}: {
  bundle: ProjectBundle;
  screen: ScreenData;
  image: ReferenceImage | null;
}): BuildScreenInput {
  const charter = bundle.project.charter;
  const dna = charter?.referenceDna ?? null;
  const reference = bundle.reference;
  const payload = referencePayload(image);
  const referenceMode: ReferenceMode = payload ? (reference.source === "curated" ? "curated_style" : "user_style") : "internal_style";
  const referenceSource: ReferenceSource | null = payload ? (reference.source === "curated" ? "curated" : "user_upload") : null;
  const plan = bundle.navigation?.plan ?? null;
  return {
    screenPlan: {
      name: screen.name,
      type: isRoot(screen) ? "root" : "detail",
      description: screen.prompt,
      chromePolicy: screen.chromePolicy ?? null,
      navigationItemId: screen.navigationItemId ?? null,
    },
    prompt: bundle.project.prompt,
    designTokens: bundle.project.designTokens,
    image: payload,
    referenceScope: "project",
    referenceMode,
    referenceSource,
    referenceId: reference.id,
    screenFamilyContract: dna?.screenFamilyContract ?? null,
    styleComponents: styleComponentsOf(dna),
    requiresBottomNav: Boolean(plan?.enabled && screen.chromePolicy?.showPrimaryNavigation),
    navigationArchitecture: charter?.navigationArchitecture ?? null,
    navigationPlan: plan,
  };
}

/**
 * The screens to build: the project's parent screens that have a brief, in canvas order. `only` names them ("Today",
 * or the number the contact sheet gives them); without it, the first `limit`.
 */
export function pickScreens({ bundle, only, limit = 3 }: { bundle: ProjectBundle; only?: string[]; limit?: number }): ScreenData[] {
  const parents = [...bundle.screens]
    .filter((screen) => !screen.stateKey && !screen.parentScreenId && screen.prompt?.trim())
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.createdAt.localeCompare(b.createdAt));
  if (!only?.length) return parents.slice(0, Math.max(1, limit));
  const picked = only.flatMap((wanted) => {
    const token = wanted.trim();
    if (/^\d+$/.test(token)) return parents[Number(token) - 1] ?? [];
    return parents.find((screen) => screen.name.toLowerCase() === token.toLowerCase())
      ?? parents.find((screen) => screen.name.toLowerCase().includes(token.toLowerCase()))
      ?? [];
  });
  if (picked.length === 0) throw new Error(`None of ${only.join(", ")} is a screen of this project: ${parents.map((screen, index) => `${index + 1}. ${screen.name}`).join("; ")}.`);
  return [...new Set(picked)];
}

/** A typical build, for a rough estimate before anything is spent: the plan's 9k tokens in and 3k out. */
export const TYPICAL_BUILD: Usage = { inputTokens: 9000, outputTokens: 3000, thinkingTokens: 0 };

/**
 * What a run would do and roughly cost, said before it does anything. A run makes one live model call per
 * screen on the account of whoever runs it, so it starts only when it is told to.
 */
export function describeRun({
  label,
  model,
  thinking,
  screens,
  price,
}: {
  label: string;
  model: string;
  thinking: string;
  screens: ScreenData[];
  price: ModelPrice | null;
}): string {
  const count = screens.length;
  const typical = costOf(TYPICAL_BUILD, price);
  return [
    `${label}: ${model}, thinking ${thinking}`,
    `It would build ${count} screen${count === 1 ? "" : "s"} (${screens.map((screen) => screen.name).join(", ")}): ${count} live model call${count === 1 ? "" : "s"}, `
      + (typical === null
        ? "at a cost this model's price is not known for (pass --price)."
        : `about ${formatCost(typical * count)} at a typical 9k tokens in and 3k out per build.`),
  ].join("\n");
}

export type BuildRecord = {
  screen: string;
  seconds: number;
  usage: Usage;
  codeChars: number;
  costUsd: number | null;
  error?: string;
};

export type BuildStream = (input: BuildScreenInput) => AsyncIterable<string>;

/** Builds the screens one after another, so that each build's time is its own, and records what each cost. */
export async function runBuilds({
  bundle,
  image,
  screens,
  buildScreen,
  finish,
  price,
  now = Date.now,
}: {
  bundle: ProjectBundle;
  image: ReferenceImage | null;
  screens: ScreenData[];
  buildScreen: BuildStream;
  /** Turns the model's raw text into the screen's code. */
  finish: (raw: string) => string;
  price: ModelPrice | null;
  now?: () => number;
}): Promise<{ records: BuildRecord[]; rebuilt: ProjectBundle }> {
  const records: BuildRecord[] = [];
  const rebuilt: ScreenData[] = [];
  for (const screen of screens) {
    let usage = emptyUsage();
    const started = now();
    try {
      let raw = "";
      const input: BuildScreenInput = {
        ...bundleBuildInput({ bundle, screen, image }),
        onResponseChunk: (chunk) => { usage = mergeUsage(usage, usageOfChunk(chunk)); },
      };
      for await (const text of buildScreen(input)) raw += text;
      const code = finish(raw);
      records.push({ screen: screen.name, seconds: (now() - started) / 1000, usage, codeChars: code.length, costUsd: costOf(usage, price) });
      rebuilt.push({ ...screen, code });
    } catch {
      // Provider errors can carry request details; only that the build failed is printed or saved.
      records.push({
        screen: screen.name, seconds: (now() - started) / 1000, usage, codeChars: 0, costUsd: null,
        error: "The build failed; no error details were saved.",
      });
    }
  }
  return { records, rebuilt: { ...bundle, screens: rebuilt } };
}

export type ArmFile = {
  version: 1;
  label: string;
  model: string;
  thinking: string;
  bundle: string;
  price: ModelPrice | null;
  records: BuildRecord[];
};

const mean = (values: Array<number | null>) => {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
};

const whole = (value: number | null) => (value === null ? "n/a" : Math.round(value).toLocaleString("en-US"));

export type ArmSummary = {
  builds: number;
  failed: number;
  seconds: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  costUsd: number | null;
  totalCostUsd: number | null;
};

/** Means over the builds that finished; the total cost over those with a known cost. */
export function summarizeArm(records: BuildRecord[]): ArmSummary {
  const done = records.filter((record) => !record.error);
  const costs = done.map((record) => record.costUsd);
  return {
    builds: done.length,
    failed: records.length - done.length,
    seconds: mean(done.map((record) => record.seconds)),
    inputTokens: mean(done.map((record) => record.usage.inputTokens)),
    outputTokens: mean(done.map((record) => record.usage.outputTokens)),
    thinkingTokens: mean(done.map((record) => record.usage.thinkingTokens)),
    costUsd: mean(costs),
    totalCostUsd: costs.some((cost) => cost !== null) ? costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null,
  };
}

/** One arm's builds as a markdown table. */
export function formatArmMarkdown(arm: ArmFile): string {
  const rows = arm.records.map((record) => [
    record.screen,
    record.error ? "failed" : `${record.seconds.toFixed(1)}s`,
    whole(record.usage.inputTokens),
    whole(record.usage.outputTokens),
    whole(record.usage.thinkingTokens),
    record.error ? "n/a" : whole(record.codeChars),
    formatCost(record.costUsd),
  ]);
  const summary = summarizeArm(arm.records);
  return [
    `# ${arm.label}: ${arm.model}, thinking ${arm.thinking}`,
    "",
    "| Screen | Time | Tokens in | Tokens out | Thinking | Code chars | Cost |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    `Mean per build: ${summary.seconds === null ? "n/a" : `${summary.seconds.toFixed(1)}s`}, ${formatCost(summary.costUsd)}; total ${formatCost(summary.totalCostUsd)} over ${summary.builds} build${summary.builds === 1 ? "" : "s"}${summary.failed ? `, ${summary.failed} failed` : ""}.`,
    arm.price ? `Priced at $${arm.price.input}/M in and $${arm.price.output}/M out (thinking tokens as output).` : "No price is known for this model: pass --price to see a cost.",
    "",
  ].join("\n");
}

/** The arms side by side: what each cost per build and how long each took. */
export function formatComparison(arms: ArmFile[]): string {
  const rows = arms.map((arm) => {
    const summary = summarizeArm(arm.records);
    return [
      arm.label, arm.model, arm.thinking, `${summary.builds}${summary.failed ? ` (+${summary.failed} failed)` : ""}`,
      summary.seconds === null ? "n/a" : `${summary.seconds.toFixed(1)}s`,
      whole(summary.inputTokens), whole(summary.outputTokens), whole(summary.thinkingTokens),
      formatCost(summary.costUsd), formatCost(summary.totalCostUsd),
    ];
  });
  return [
    "| Arm | Model | Thinking | Builds | Time | In | Out | Thinking | Cost per build | Total |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}
