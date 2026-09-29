import { createHash } from "node:crypto";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { CuratedStyleReference } from "@/lib/generation/curated-style-catalog";
import {
  curatedStylePresetSchema,
  curatedStyleEntryHash,
  type CuratedStylePreset,
} from "@/lib/generation/curated-style-presets";
import { measureReferencePalette } from "@/lib/generation/reference-palette";
import { boxOf, cropToBox, pickSpecimenScreen, SpecimenIncompleteError } from "@/lib/generation/specimen-build";
import { extractStyleComponents } from "@/lib/generation/style-component-extraction";
import { MAX_STYLE_COMPONENTS, styleComponentsFit } from "@/lib/generation/style-components";
import type {
  DesignTokens,
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceAnalysisResult,
  ReferenceScreenAnalysis,
  StyleComponent,
} from "@/lib/types";

/**
 * Builds the preset of a curated reference, offline, once. Every step is a function handed in, so that
 * the orchestration and its refusals can be tested without a model, and the script hands in the real ones.
 *
 * It refuses instead of salvaging. A preset is used for every project that picks the reference, so a
 * partial analysis (one phone of three, a missing radius class) or a specimen that yields no components is
 * an error to fix here, not something to carry into a project.
 */

export type PresetBuildStage = "analysis" | "palette" | "tokens" | "specimen" | "preset";

export class PresetBuildError extends Error {
  constructor(readonly stage: PresetBuildStage, message: string) {
    super(`The ${stage} step failed: ${message}`);
    this.name = "PresetBuildError";
  }
}

export type PresetBuildDeps = {
  /** The full analysis, from the strongest configured model. */
  analyze(input: { reference: CuratedStyleReference; image: PromptImagePayload }): Promise<ReferenceAnalysisResult>;
  /** Calibrated tokens for the reference, made without any preset. */
  generateTokens(input: { reference: CuratedStyleReference; image: PromptImagePayload; analysis: ReferenceAnalysis }): Promise<DesignTokens>;
  /** The recreate build of one phone, with its reusable components marked. Returns the screen's HTML. */
  buildSpecimen(input: {
    reference: CuratedStyleReference;
    /** The one phone, cropped out of the reference. */
    image: PromptImagePayload;
    screen: ReferenceScreenAnalysis;
    analysis: ReferenceAnalysis;
    tokens: DesignTokens;
  }): Promise<string>;
};

/** One phone of the reference, rebuilt with its reusable components marked. */
export type PresetSpecimen = { screenIndex: number; screenName: string; html: string; image: PromptImagePayload };

export type PresetBuildResult = {
  preset: CuratedStylePreset;
  /** The phones that were rebuilt, in the order their components were taken. */
  specimens: PresetSpecimen[];
  skipped: Array<{ name: string; reason: string }>;
  /** Things worth a look before approving, which are not errors. */
  notes: string[];
};

// The phone is chosen and cropped the same way for an uploaded reference (see specimen-build.ts).
export { cropToBox, pickSpecimenScreen };

/**
 * More phones than this in one reference would cost more builds than their components are worth. A preset is
 * made once, so it learns from every phone of the reference, not from the one with the most components: a
 * reference's vocabulary (a media card, a calendar strip, a stat tile, a mood row) is spread over its phones.
 */
export const MAX_SPECIMEN_PHONES = 4;

/** The phones to learn from: those with a box, the richest first, and at most `MAX_SPECIMEN_PHONES`. */
export function specimenScreens(analysis: ReferenceAnalysis): ReferenceScreenAnalysis[] {
  const area = (screen: ReferenceScreenAnalysis) => {
    const box = boxOf(screen);
    return box ? box.width * box.height : 0;
  };
  return analysis.screenReferences
    .filter((screen) => boxOf(screen))
    .sort((left, right) => right.components.length - left.components.length || area(right) - area(left) || left.index - right.index)
    .slice(0, MAX_SPECIMEN_PHONES);
}

function assertCompleteAnalysis(result: ReferenceAnalysisResult): ReferenceAnalysis {
  const analysis = result.analysis;
  const problems: string[] = [];
  if (!analysis) problems.push(`no analysis came back (${result.source})`);
  else {
    if (result.source !== "full_analysis") problems.push(`the analysis was ${result.source.replace("_", " ")}, not a full one`);
    if (analysis.screenReferences.length !== analysis.screenCountEstimate) {
      problems.push(`it counts ${analysis.screenCountEstimate} phones and describes ${analysis.screenReferences.length}`);
    }
    for (const screen of analysis.screenReferences) {
      if (!boxOf(screen)) problems.push(`screen ${screen.index} has no bounding box`);
    }
    if (!analysis.radiusClass) problems.push("it does not classify the card radius");
    if (!analysis.surfaceElevation) problems.push("it does not classify how cards separate from the page");
  }
  problems.push(...(result.validationIssues ?? []));
  if (problems.length > 0 || !analysis) {
    throw new PresetBuildError("analysis", `${[...new Set(problems)].join("; ")}. Run it again, or use a stronger model; nothing is salvaged.`);
  }
  return analysis;
}

type Skipped = PresetBuildResult["skipped"];

/**
 * Rebuilds the phones of the reference, each with its reusable components marked, and takes the components out
 * of them: the richest phone's first, one of each name, ten at most. A phone whose build fails is left out and
 * said so; the step fails only when no phone gives a usable component.
 */
export async function buildPresetComponents({
  reference,
  image,
  analysis,
  tokens,
  deps,
}: {
  reference: CuratedStyleReference;
  image: PromptImagePayload;
  analysis: ReferenceAnalysis;
  tokens: DesignTokens;
  deps: Pick<PresetBuildDeps, "buildSpecimen">;
}): Promise<{ specimens: PresetSpecimen[]; components: StyleComponent[]; skipped: Skipped; notes: string[] }> {
  const screens = specimenScreens(analysis);
  const notes: string[] = [];
  const settled = await Promise.allSettled(screens.map(async (screen): Promise<PresetSpecimen> => {
    const specimenImage = await cropToBox(image, boxOf(screen)!);
    const html = await deps.buildSpecimen({ reference, image: specimenImage, screen, analysis, tokens });
    return { screenIndex: screen.index, screenName: screen.suggestedRole, html, image: specimenImage };
  }));
  const specimens: PresetSpecimen[] = [];
  settled.forEach((outcome, position) => {
    // Provider errors can carry request details; only that a phone's build failed is kept.
    if (outcome.status === "fulfilled") specimens.push(outcome.value);
    else if (outcome.reason instanceof SpecimenIncompleteError) notes.push(`the build of phone ${screens[position].index} (${screens[position].suggestedRole}) was cut short twice and is left out`);
    else notes.push(`the build of phone ${screens[position].index} (${screens[position].suggestedRole}) failed and is left out`);
  });
  if (specimens.length === 0) {
    throw new PresetBuildError("specimen", screens.length === 0 ? "no phone of the reference has a box to crop it by" : `none of the ${screens.length} phone builds succeeded`);
  }

  const skipped: Skipped = [];
  // One of each name, the richest phone's first; then each phone's list in turn, so that every phone has a say in the
  // vocabulary, until ten are chosen or the block a screen build is given has no room for another.
  const taken = new Set<string>();
  const lists = specimens.map((specimen) => {
    const label = `phone ${specimen.screenIndex}`;
    const extracted = extractStyleComponents(specimen.html);
    for (const item of extracted.skipped) {
      if (!skipped.some((known) => known.name === item.name && known.reason === item.reason)) skipped.push(item);
      notes.push(`${label}: skipped ${item.name}: ${item.reason}`);
    }
    const ownComponents: StyleComponent[] = [];
    for (const component of extracted.components) {
      if (taken.has(component.name)) continue;
      taken.add(component.name);
      ownComponents.push(component);
    }
    return { label, components: ownComponents };
  });
  const components: StyleComponent[] = [];
  const leftOut: string[] = [];
  for (let round = 0; lists.some((list) => round < list.components.length); round += 1) {
    for (const list of lists) {
      const component = list.components[round];
      if (!component) continue;
      if (components.length >= MAX_STYLE_COMPONENTS) leftOut.push(`${list.label}: left out ${component.name}, ${MAX_STYLE_COMPONENTS} components are the most`);
      else if (!styleComponentsFit([...components, component])) leftOut.push(`${list.label}: left out ${component.name}, the block a screen build is given has no room for it`);
      else components.push(component);
    }
  }
  notes.push(...leftOut);
  if (components.length === 0) {
    throw new PresetBuildError("specimen", `${specimens.length === 1 ? `the build of "${specimens[0].screenName}"` : `the builds of ${specimens.length} phones`} marked no usable component${skipped.length ? ` (${skipped.map((item) => `${item.name}: ${item.reason}`).join("; ")})` : ""}`);
  }
  if (components.length < 4) notes.push(`only ${components.length} component${components.length === 1 ? " was" : "s were"} marked: a second run may serve better`);
  return { specimens, components, skipped, notes };
}

export async function buildCuratedPreset({
  reference,
  image,
  deps,
  builtAt = new Date().toISOString(),
}: {
  reference: CuratedStyleReference;
  image: PromptImagePayload;
  deps: PresetBuildDeps;
  builtAt?: string;
}): Promise<PresetBuildResult> {
  const bytes = Buffer.from(image.data, "base64");

  const analysis = assertCompleteAnalysis(await deps.analyze({ reference, image }));
  const boxes = analysis.screenReferences.flatMap((screen) => boxOf(screen) ?? []);

  let measured;
  try {
    measured = await measureReferencePalette(bytes, boxes);
  } catch (error) {
    throw new PresetBuildError("palette", error instanceof Error ? error.message : "the palette could not be measured");
  }

  const tokens = normalizeDesignTokens(await deps.generateTokens({ reference, image, analysis }));

  const { specimens, components, skipped, notes } = await buildPresetComponents({ reference, image, analysis, tokens, deps });

  // A reference with no navigation of its own carries none; the analysis's evidence is otherwise the preset's.
  const evidence = analysis.primaryNavigation;
  const navigation = evidence?.present ? evidence : null;
  if (!navigation) notes.push("the reference shows no persistent navigation");

  const parsed = curatedStylePresetSchema.safeParse({
    catalogHash: curatedStyleEntryHash(reference),
    approved: false,
    analysis: { ...analysis, primaryNavigation: navigation },
    measured,
    tokens,
    navigation,
    components,
    builtAt,
    sourceImageSha256: createHash("sha256").update(bytes).digest("hex"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PresetBuildError("preset", `${issue?.path.join(".") || "preset"}: ${issue?.message ?? "not valid"}`);
  }

  return {
    preset: parsed.data as unknown as CuratedStylePreset,
    specimens,
    skipped,
    notes,
  };
}

/**
 * Makes the components of a built preset again, from its own analysis, palette and tokens, and changes nothing
 * else. It is the cheap way to try another idea for the components (or to redo them after the tokens were
 * corrected by hand): a build per phone, and no analysis or token call. The result is unapproved.
 */
export async function rebuildPresetComponents({
  reference,
  image,
  preset,
  deps,
  builtAt = new Date().toISOString(),
}: {
  reference: CuratedStyleReference;
  image: PromptImagePayload;
  preset: CuratedStylePreset;
  deps: Pick<PresetBuildDeps, "buildSpecimen">;
  builtAt?: string;
}): Promise<PresetBuildResult> {
  if (preset.catalogHash !== curatedStyleEntryHash(reference)) {
    throw new PresetBuildError("preset", "it was built from an older version of the catalogue entry; build it again, in full");
  }
  const { specimens, components, skipped, notes } = await buildPresetComponents({
    reference, image, analysis: preset.analysis, tokens: preset.tokens, deps,
  });
  const parsed = curatedStylePresetSchema.safeParse({ ...preset, approved: false, components, builtAt });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PresetBuildError("preset", `${issue?.path.join(".") || "preset"}: ${issue?.message ?? "not valid"}`);
  }
  return { preset: parsed.data as unknown as CuratedStylePreset, specimens, skipped, notes };
}
