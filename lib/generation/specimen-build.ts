import { Buffer } from "node:buffer";

import sharp from "sharp";

import type { NormalizedBox } from "@/lib/generation/reference-palette";
import { validateSourceCompletion } from "@/lib/generation/screen-quality";
import type {
  BuildScreenInput,
  DesignTokens,
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceScreenAnalysis,
} from "@/lib/types";

/**
 * A specimen is one screen of a reference rebuilt by the recreate builder with its reusable components
 * marked, so that the components can be read back out as markup. A curated preset makes one offline, once.
 * A project's component kit (component-kit.ts) is built and checked the same way.
 */

export const boxOf = (screen: ReferenceScreenAnalysis): NormalizedBox | null => {
  const box = screen.boundingBox;
  return box && [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value)) ? box : null;
};

/** The phone with the most components to learn from; the larger one, then the first, on a tie. */
export function pickSpecimenScreen(analysis: ReferenceAnalysis): ReferenceScreenAnalysis {
  const area = (screen: ReferenceScreenAnalysis) => {
    const box = boxOf(screen);
    return box ? box.width * box.height : 0;
  };
  return [...analysis.screenReferences].sort((left, right) =>
    right.components.length - left.components.length || area(right) - area(left) || left.index - right.index)[0];
}

/** One phone out of the reference, with a hair of margin so that its rounded corners are not clipped. */
export async function cropToBox(image: PromptImagePayload, box: NormalizedBox): Promise<PromptImagePayload> {
  const bytes = Buffer.from(image.data, "base64");
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const margin = 0.005;
  const left = Math.max(0, Math.floor((box.x - margin) * width));
  const top = Math.max(0, Math.floor((box.y - margin) * height));
  const right = Math.min(width, Math.ceil((box.x + box.width + margin) * width));
  const bottom = Math.min(height, Math.ceil((box.y + box.height + margin) * height));
  if (right - left < 16 || bottom - top < 16) throw new Error("The screen's box is too small to crop.");
  const cropped = await sharp(bytes).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
  return { data: cropped.toString("base64"), mimeType: "image/png" };
}

/**
 * The recreate build of one phone with its components marked. It reproduces the phone, not the product: the
 * prompt is the reference's own style, so nothing of the project's request bleeds into the specimen.
 */
export function specimenBuildInput({
  image,
  screen,
  tokens,
  intent,
}: {
  /** The one phone, cropped out of the reference. */
  image: PromptImagePayload;
  screen: ReferenceScreenAnalysis;
  tokens: DesignTokens;
  /** What the reference is, in its own words. */
  intent: string;
}): BuildScreenInput {
  return {
    screenPlan: {
      name: screen.suggestedRole,
      type: "root",
      description: [
        screen.layoutSummary,
        screen.visualHierarchy,
        `Components: ${screen.components.join(", ")}`,
        `Styling: ${screen.stylingCues.join("; ")}`,
      ].join("\n"),
    },
    prompt: intent,
    designTokens: tokens,
    image,
    referenceMode: "user_recreate",
    referenceScope: "project",
    requiresBottomNav: false,
    specimenMarking: true,
  };
}

/** A specimen build that stopped before it finished, more than once. */
export class SpecimenIncompleteError extends Error {
  constructor(readonly issue: string) {
    super(`the build was cut short: ${issue}`);
    this.name = "SpecimenIncompleteError";
  }
}

/**
 * Builds a specimen and insists that it is whole. A model that stops in the middle of a tag leaves markup whose
 * last component is a stump, and the components are read out of that markup, so an unfinished build is never
 * used. It is asked once more, and after that the error says so: a preset leaves the phone out, and a project
 * goes on without a kit.
 */
export async function buildCompleteSpecimen<Built extends { code: string }>(
  build: (input: BuildScreenInput) => Promise<Built>,
  input: BuildScreenInput,
  { attempts = 2, onIncomplete }: { attempts?: number; onIncomplete?: (issue: string, attempt: number) => void } = {},
): Promise<Built> {
  let issue = "the build did not finish";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const built = await build(input);
    const completion = validateSourceCompletion({ code: built.code, requireSentinel: true });
    if (completion.valid) return built;
    issue = completion.issues[0] ?? issue;
    onIncomplete?.(issue, attempt);
  }
  throw new SpecimenIncompleteError(issue);
}
