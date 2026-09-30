import { boxOf, buildCompleteSpecimen, cropToBox, pickSpecimenScreen, specimenBuildInput } from "@/lib/generation/specimen-build";
import { extractStyleComponents } from "@/lib/generation/style-component-extraction";
import { usableStyleComponents } from "@/lib/generation/style-components";
import type {
  BuildScreenInput,
  DesignTokens,
  GenerationReferencePolicy,
  ProjectCharter,
  PromptImagePayload,
  ReferenceAnalysis,
  ReferenceMode,
  ReferenceSpecimen,
} from "@/lib/types";

/**
 * An uploaded style reference is learned once, at the project's first generation, the way a curated preset is
 * learned offline: its main screen is rebuilt by the recreate builder with the reusable components marked, and
 * the components are read back out as markup. They go on the project's reference DNA, which every later batch
 * reuses, so that each screen's builder copies the reference's own components instead of a prose description.
 *
 * It costs one extra build, runs beside planning, and is never required: a project without a specimen builds as
 * it did before.
 */

export type UploadSpecimenInput = {
  /** The whole upload. */
  image: PromptImagePayload;
  analysis: ReferenceAnalysis;
  /** The project's calibrated tokens: the specimen is drawn with them, as every screen will be. */
  tokens: DesignTokens;
  /** Where the upload is stored: recorded on the specimen, so that a later preparation of it reuses the specimen. */
  imagePath?: string | null;
};

/**
 * How long a caller waits for the specimen once its own planning is done. The build runs beside planning, so it is
 * usually done by then; one that is not is left behind, and the screens are built without it rather than kept
 * waiting. A first guess, to be set from how long a live build takes.
 */
export const UPLOAD_SPECIMEN_WAIT_MS = 60_000;

/** The specimen, or null when it is not ready within `ms`. The build itself is not stopped. */
export async function withinUploadSpecimenWait(
  specimen: Promise<ReferenceSpecimen | null>,
  ms = UPLOAD_SPECIMEN_WAIT_MS,
  onTimeout?: () => void,
): Promise<ReferenceSpecimen | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      onTimeout?.();
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([specimen, late]);
  } finally {
    clearTimeout(timer);
  }
}

export type UploadSpecimenResult = { specimen: ReferenceSpecimen | null; notes: string[] };

export type UploadSpecimenBuilder = (input: BuildScreenInput) => Promise<{ code: string }>;

/** A component library of at least this many is a fair sample of a reference's vocabulary. */
const FAIR_COMPONENT_COUNT = 4;

export function shouldBuildUploadSpecimen({
  referencePolicy,
  referenceMode,
  isNewProject,
  screenScoped,
  image,
  analysis,
  tokens,
  existing,
  plannedAhead = false,
}: {
  referencePolicy: GenerationReferencePolicy;
  referenceMode: ReferenceMode;
  /** True for the first generation of a project only. */
  isNewProject?: boolean;
  /** An attachment to one screen is that screen's reference, not the project's. */
  screenScoped: boolean;
  image?: PromptImagePayload | null;
  analysis?: ReferenceAnalysis | null;
  tokens?: DesignTokens | null;
  /** The specimen the project already carries. */
  existing?: ReferenceSpecimen | null;
  /**
   * The plan was prepared while the person read the approval card. Its preparation owns the specimen, so a
   * generation that found it without one does not make the person wait for a second attempt.
   */
  plannedAhead?: boolean;
}) {
  return referencePolicy === "user_upload"
    && referenceMode === "user_style"
    && isNewProject === true
    && !plannedAhead
    && !screenScoped
    && Boolean(image?.data)
    && (analysis?.screenReferences.length ?? 0) > 0
    && Boolean(tokens?.tokens)
    && !existing;
}

/**
 * Rebuilds the upload's main screen and reads its components out. `specimen` is null, with the reason in `notes`,
 * when there is nothing to learn from: an image of several screens with no box to crop one by, or a build that
 * marked no usable component. An error from the build itself is the caller's to catch.
 */
export async function buildUploadSpecimen({
  image,
  analysis,
  tokens,
  imagePath,
  buildScreen,
}: UploadSpecimenInput & { buildScreen: UploadSpecimenBuilder }): Promise<UploadSpecimenResult> {
  const notes: string[] = [];
  if (analysis.screenReferences.length === 0) return { specimen: null, notes: ["the analysis describes no screen"] };

  const screen = pickSpecimenScreen(analysis);
  const box = boxOf(screen);
  let phone = image;
  if (box) {
    phone = await cropToBox(image, box);
  } else if (analysis.screenReferences.length > 1) {
    // The whole image would be rebuilt as a collage of phones, which is not a screen to learn components from.
    return { specimen: null, notes: [`the image shows ${analysis.screenReferences.length} screens and "${screen.suggestedRole}" has no box to crop it by`] };
  }

  const built = await buildCompleteSpecimen(buildScreen, specimenBuildInput({
    image: phone,
    screen,
    tokens,
    intent: analysis.overallVisualStyle.slice(0, 600),
  }));
  const { components, skipped } = extractStyleComponents(built.code);
  for (const item of skipped) notes.push(`skipped ${item.name}: ${item.reason}`);
  const usable = usableStyleComponents(components);
  if (usable.length === 0) {
    return { specimen: null, notes: [...notes, `the build of "${screen.suggestedRole}" marked no usable component`] };
  }
  if (usable.length < FAIR_COMPONENT_COUNT) notes.push(`only ${usable.length} component${usable.length === 1 ? " was" : "s were"} marked`);
  return { specimen: { source: "upload", components: usable, ...(imagePath ? { imagePath } : {}) }, notes };
}

/**
 * Starts the specimen when the project has an uploaded style reference to learn, and answers null when it does
 * not apply or fails. The caller awaits it after planning, so the two run side by side, and a failure costs the
 * generation nothing.
 */
export function startUploadSpecimen({
  applies,
  input,
  buildScreen,
  reuse,
  onSettled,
}: {
  applies: Parameters<typeof shouldBuildUploadSpecimen>[0];
  input: () => UploadSpecimenInput;
  buildScreen: UploadSpecimenBuilder;
  /**
   * A specimen already built from the same upload, by an earlier preparation of this project. Each revision of the
   * approval card prepares the plan again, and would otherwise pay for the same build again.
   */
  reuse?: () => Promise<ReferenceSpecimen | null>;
  onSettled?: (event: { specimen: ReferenceSpecimen | null; notes: string[]; error?: unknown; reused?: boolean }) => void;
}): Promise<ReferenceSpecimen | null> {
  if (!shouldBuildUploadSpecimen(applies)) return Promise.resolve(null);
  const build = () => buildUploadSpecimen({ ...input(), buildScreen }).then(
    (result) => {
      onSettled?.(result);
      return result.specimen;
    },
    (error: unknown) => {
      onSettled?.({ specimen: null, notes: [], error });
      return null;
    },
  );
  if (!reuse) return build();
  return reuse().catch(() => null).then((earlier) => {
    const components = usableStyleComponents(earlier?.components);
    if (!earlier || components.length === 0) return build();
    onSettled?.({ specimen: earlier, notes: ["reused the specimen an earlier preparation built from this upload"], reused: true });
    return earlier;
  });
}

/** The charter with the specimen on its reference DNA. A DNA that already has one, or none, is left as it is. */
export function withReferenceSpecimen(charter: ProjectCharter, specimen: ReferenceSpecimen | null): ProjectCharter {
  const dna = charter.referenceDna;
  if (!specimen || !dna || dna.specimen) return charter;
  const components = usableStyleComponents(specimen.components);
  return components.length > 0
    ? {
        ...charter,
        referenceDna: { ...dna, specimen: { source: specimen.source, components, ...(specimen.imagePath ? { imagePath: specimen.imagePath } : {}) } },
      }
    : charter;
}
