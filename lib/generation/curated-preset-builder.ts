import { createHash } from "node:crypto";

import { normalizeDesignTokens } from "@/lib/design-tokens";
import type { CuratedStyleReference } from "@/lib/generation/curated-style-catalog";
import {
  curatedStylePresetSchema,
  curatedStyleEntryHash,
  type CuratedStylePreset,
} from "@/lib/generation/curated-style-presets";
import { measureReferencePalette } from "@/lib/generation/reference-palette";
import { boxOf, cropToBox, pickSpecimenScreen } from "@/lib/generation/specimen-build";
import { extractStyleComponents } from "@/lib/generation/style-component-extraction";
import type {
  DesignTokens,
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceAnalysisResult,
  ReferenceScreenAnalysis,
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

export type PresetBuildResult = {
  preset: CuratedStylePreset;
  specimen: { screenIndex: number; screenName: string; html: string; image: PromptImagePayload };
  skipped: Array<{ name: string; reason: string }>;
  /** Things worth a look before approving, which are not errors. */
  notes: string[];
};

// The phone is chosen and cropped the same way for an uploaded reference (see specimen-build.ts).
export { cropToBox, pickSpecimenScreen };

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
  const notes: string[] = [];
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

  const screen = pickSpecimenScreen(analysis);
  const screenBox = boxOf(screen)!;
  const specimenImage = await cropToBox(image, screenBox);
  const html = await deps.buildSpecimen({ reference, image: specimenImage, screen, analysis, tokens });
  const { components, skipped } = extractStyleComponents(html);
  if (components.length === 0) {
    throw new PresetBuildError("specimen", `the build of "${screen.suggestedRole}" marked no usable component${skipped.length ? ` (${skipped.map((item) => `${item.name}: ${item.reason}`).join("; ")})` : ""}`);
  }
  if (components.length < 4) notes.push(`only ${components.length} components were marked: a richer phone or a second run may serve better`);
  for (const item of skipped) notes.push(`skipped ${item.name}: ${item.reason}`);

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
    specimen: { screenIndex: screen.index, screenName: screen.suggestedRole, html, image: specimenImage },
    skipped,
    notes,
  };
}
