import type { NormalizedBox } from "@/lib/generation/reference-palette";
import type {
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceAnalysisResult,
  ReferenceScreenAnalysis,
} from "@/lib/types";

/**
 * An analysis of an image of several screens can count them all and describe some: on a curated reference
 * it saw one phone of three. Accepting that as it is means every screen it did not describe is built from a
 * placeholder that says "look at the image". This asks for the missing screens only, each cropped out of the
 * image by its own box, and merges them in, so the analysis is complete and the model is not asked to repeat
 * what it already did well.
 *
 * Every model call is a function handed in, so the orchestration and its refusals are tested without one.
 */

export type ScreenBox = { index: number; box: NormalizedBox };

export type ReferenceCompletionDeps = {
  /** Boxes for the screens of the image, numbered left to right, given the boxes of those already described. */
  locate(input: { image: PromptImagePayload; count: number; known: ScreenBox[] }): Promise<ScreenBox[]>;
  /** The one screen in `crop`, described in the analysis' own shape. Null when nothing usable came back. */
  describe(input: { crop: PromptImagePayload; index: number; count: number; box: NormalizedBox }): Promise<ReferenceScreenAnalysis | null>;
  crop(image: PromptImagePayload, box: NormalizedBox): Promise<PromptImagePayload>;
};

/** More missing screens than this is not a partial analysis but a failed one; it stays as it is. */
export const MAX_COMPLETED_SCREENS = 8;
/** A located box that covers a described screen this much is that screen again, not a missing one. */
const DUPLICATE_OVERLAP = 0.6;
/** Smallest fraction of the image a screen can fill and still be a screen. */
const MIN_BOX_SIDE = 0.05;

const COUNT_MISMATCH_ISSUE = "screenCountEstimate must equal the number of screenReferences entries.";
const NO_SCREENS_ISSUE = "No usable screenReferences array was present.";

const boxOf = (screen: ReferenceScreenAnalysis): NormalizedBox | null => {
  const box = screen.boundingBox;
  return box && [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value)) ? box : null;
};

const overlap = (a: NormalizedBox, b: NormalizedBox) => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / Math.min(a.width * a.height, b.width * b.height);
};

const usableBox = (box: NormalizedBox) =>
  [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width >= MIN_BOX_SIDE && box.height >= MIN_BOX_SIDE;

/**
 * The screens the analysis counted but did not describe. `described` is what the model returned, not the
 * placeholders a salvage fills in for it; the numbers not taken by a described screen are the missing ones.
 */
export function missingScreenIndexes(described: ReferenceScreenAnalysis[], count: number): number[] {
  const taken = new Set(described.map((screen) => screen.index).filter((index) => index >= 1 && index <= count));
  const missing: number[] = [];
  for (let index = 1; index <= count; index += 1) if (!taken.has(index)) missing.push(index);
  // Repeated or out-of-range numbers must not ask for more screens than are missing.
  return missing.slice(0, Math.max(0, count - described.length));
}

export function needsCompletion(result: ReferenceAnalysisResult) {
  const count = result.analysis?.screenCountEstimate ?? 0;
  return Boolean(result.analysis) && count > 0 && (result.screenReferenceCount ?? 0) < count;
}

/**
 * Describes the screens the analysis left out and merges them in. Returns the result unchanged when nothing
 * more can be learned (no box for a missing screen, a failed call): the analysis stays partial and says so.
 */
export async function completeReferenceAnalysis({
  image,
  result,
  deps,
}: {
  image: PromptImagePayload;
  result: ReferenceAnalysisResult;
  deps: ReferenceCompletionDeps;
}): Promise<ReferenceAnalysisResult> {
  const analysis = result.analysis;
  if (!analysis || !needsCompletion(result)) return result;
  const count = analysis.screenCountEstimate;
  // A salvage that found no descriptions fills in placeholders for every screen; those describe nothing.
  const described = (result.screenReferenceCount ?? 0) > 0 ? analysis.screenReferences : [];
  const missing = missingScreenIndexes(described, count);
  if (missing.length === 0 || missing.length > MAX_COMPLETED_SCREENS) return result;

  const notes: string[] = [];
  const knownBoxes = described.flatMap((screen) => { const box = boxOf(screen); return box ? [{ index: screen.index, box }] : []; });

  // One screen with nothing described is the whole image: there is nothing to locate.
  let located: ScreenBox[];
  if (count === 1) {
    located = [{ index: 1, box: { x: 0, y: 0, width: 1, height: 1 } }];
  } else {
    try {
      located = await deps.locate({ image, count, known: knownBoxes });
    } catch (error) {
      return { ...result, diagnostics: [...result.diagnostics, `Locating the missing screens failed: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  const targets = missing.flatMap((index) => {
    const found = located.find((entry) => entry.index === index && usableBox(entry.box));
    if (!found) {
      notes.push(`no box was found for screen ${index}`);
      return [];
    }
    if (knownBoxes.some((known) => overlap(found.box, known.box) >= DUPLICATE_OVERLAP)) {
      notes.push(`the box found for screen ${index} covers a screen that is already described`);
      return [];
    }
    return [found];
  });

  const settled = await Promise.allSettled(targets.map(async ({ index, box }) => {
    const crop = await deps.crop(image, box);
    const screen = await deps.describe({ crop, index, count, box });
    return screen ? { ...screen, index, boundingBox: box } : null;
  }));
  const added: ReferenceScreenAnalysis[] = [];
  settled.forEach((outcome, position) => {
    const index = targets[position].index;
    if (outcome.status === "fulfilled" && outcome.value) added.push(outcome.value);
    else notes.push(`screen ${index} could not be described`);
  });
  if (added.length === 0) {
    return { ...result, diagnostics: [...result.diagnostics, ...(notes.length ? [`Completing the analysis: ${notes.join("; ")}.`] : [])] };
  }

  const screenReferences = [...described, ...added].sort((left, right) => left.index - right.index);
  const complete = screenReferences.length >= count;
  const issues = (result.validationIssues ?? []).filter((issue) => !complete || (issue !== COUNT_MISMATCH_ISSUE && issue !== NO_SCREENS_ISSUE));
  return {
    ...result,
    analysis: { ...analysis, screenReferences } as ReferenceAnalysis,
    screenReferenceCount: screenReferences.length,
    confidence: complete && issues.length === 0 ? "high" : result.confidence,
    source: complete && issues.length === 0 ? "full_analysis" : result.source,
    diagnostics: [
      ...result.diagnostics,
      `Described ${added.length} missing screen${added.length === 1 ? "" : "s"} (${added.map((screen) => screen.index).join(", ")}) from crops of the image.`,
      ...(notes.length ? [`Completing the analysis: ${notes.join("; ")}.`] : []),
    ],
    validationIssues: issues,
  };
}
