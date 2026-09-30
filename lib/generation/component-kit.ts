import { createHash } from "node:crypto";

import { resolveCuratedStylePreset } from "@/lib/generation/curated-style-presets";
import { buildCompleteSpecimen } from "@/lib/generation/specimen-build";
import { extractStyleComponents } from "@/lib/generation/style-component-extraction";
import { usableStyleComponents } from "@/lib/generation/style-components";
import type { FunctionalItem } from "@/lib/product-planning/functional-plan";
import { activeFacts, type ProductPlanning } from "@/lib/product-planning/model";
import type {
  BuildScreenInput,
  DesignStylePack,
  DesignTokens,
  ProjectCharter,
  PromptImagePayload,
  ReferenceMode,
  ReferenceSpecimen,
  StyleComponent,
} from "@/lib/types";

/**
 * Every screen of a project used to be designed on its own. The tokens and the reference image were all they
 * shared, so each drew its own header, its own card for an invoice and its own avatar: the first live project had an
 * invoice as a card on one screen and as a row on another, and client photos on one screen and icons on the next.
 *
 * A designer settles those once, in a component kit, and builds every screen from it. This makes that kit: one
 * build, beside planning, of one page that shows each shared component once, marked, and read back out as markup.
 * The brief planner is given the kit's component names, so that a brief names the same component for the same
 * content, and every screen's builder is given the markup to copy (the STYLE COMPONENTS block).
 */

export type ComponentKitScreen = { name: string; purpose: string };

export type ComponentKitInput = {
  /** What the product is, in the user's words. */
  prompt: string;
  /** The screens the project will have, with what each is for. */
  screens: ComponentKitScreen[];
  tokens: DesignTokens;
  /** The style reference, when the project has one, prepared the way every screen's build gets it. */
  image?: PromptImagePayload | null;
  referenceMode: ReferenceMode;
  referenceId?: string | null;
  /** Which reference the image is (its stored path, or the curated reference's id): part of what a kit is made from. */
  referenceKey?: string | null;
  designStyle?: DesignStylePack | null;
  /** The product's own content, so that the kit's samples are this product's kinds of item. */
  productContent?: string | null;
};

export type ComponentKitResult = { kit: ReferenceSpecimen | null; notes: string[] };

export type ComponentKitBuilder = (input: BuildScreenInput) => Promise<{ code: string }>;

export const COMPONENT_KIT_SCREEN_NAME = "Component kit";

/**
 * How long the briefs wait for the kit once the blueprint is done. The kit is built beside the blueprint planning,
 * so it is often ready by then; one that is not is left out of the briefs rather than kept waiting for.
 */
export const COMPONENT_KIT_WAIT_MS = 60_000;

/**
 * How much longer the screens wait for it once their briefs are written. The builds are where the kit matters most,
 * so they wait for a slow one; past this, the project is built without it, as it was before there were kits.
 */
export const COMPONENT_KIT_BUILD_WAIT_MS = 60_000;

/** A kit of fewer components than this is thin: noted, and still used. */
const FAIR_COMPONENT_COUNT = 5;

/** The screens of an approved flow, as the kit is told about them. */
export const kitScreensOf = (manifest: readonly FunctionalItem[] | null | undefined): ComponentKitScreen[] =>
  (manifest ?? [])
    .filter((item) => item.kind === "screen")
    .map((item) => ({ name: item.name, purpose: (item.information || item.description || "").replace(/\s+/g, " ").trim() }));

/** What the product is, as the kit's build is told: the product's identity and the approved flow's goal. */
export function componentKitPromptOf(state: ProductPlanning | null | undefined, fallback = ""): string {
  const identity = state ? activeFacts(state, "identity").map((fact) => fact.detail).join(" ") : "";
  return [identity, state?.scope?.goal].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 600) || fallback;
}

/**
 * What a kit is made from: the screens, the tokens, the reference and the style. A later preparation or build with
 * the same basis can reuse a kit instead of paying for the same build again; any change makes a new one.
 */
export function componentKitBasis(input: ComponentKitInput): string {
  return createHash("sha256").update(JSON.stringify({
    screens: input.screens.map((screen) => [screen.name.trim().toLowerCase(), screen.purpose]).sort(),
    tokens: input.tokens.tokens ?? null,
    referenceMode: input.referenceMode,
    reference: input.referenceKey ?? input.referenceId ?? null,
    style: input.designStyle?.id ?? null,
  })).digest("hex");
}

/** At most `max` characters of a text, ending on a whole word. */
const clipped = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:(-]+$/, "")}…`;
};

/**
 * What the kit build is asked to draw. Generic on purpose: the screens and the product say what it needs. The product
 * itself reaches the build as its prompt.
 */
export function componentKitBrief({ screens }: Pick<ComponentKitInput, "screens">): string {
  return [
    "This is not a screen of the app. It is the product's component kit: one page that shows, once each, the components its screens are built from, so that every screen uses the same header, the same card or row for the same kind of item, and the same controls.",
    `The product's screens: ${screens.slice(0, 16).map((screen) => `${screen.name}${screen.purpose ? ` (${clipped(screen.purpose, 180)})` : ""}`).join("; ")}.`,
    "Show only the components these screens need, each once, with short sample content, one under another:",
    "- the header of a main screen, and the top bar of a detail screen with its back control and one action;",
    "- for each kind of item the screens list or show (for example an order, a person or a message), the one card or row that shows it on every screen, with its avatar, status badge and trailing detail where the item has them;",
    "- a summary tile for a key figure, a section header with its action, a text field, filter chips or a segmented control, and the primary and secondary buttons.",
    "A person is shown the same way everywhere, so draw one avatar, a frame that holds their photo, and use it in every row and card that shows a person.",
  ].join("\n");
}

/** The one instruction added to the kit's build, in place of a screen's usual job. */
export const COMPONENT_KIT_MARKING_INSTRUCTION = [
  "COMPONENT KIT: this build is the source of every screen's components.",
  'Mark the root element of each component with data-dg-component="<kebab-name>" and data-dg-use="<when to use it, under 12 words>",',
  'for example data-dg-component="order-row" data-dg-use="one order in any list of orders".',
  "Name a component by what it is, never by its sample content. Mark ten at most, and never the same look twice.",
  "Mark composed units: a whole card or row with its avatar, badge and buttons inside it is one component. Mark an avatar, badge or button on its own only when it appears outside every unit you marked.",
  "Keep each marked element's markup under about 900 characters, styled with the token classes and variables only, never raw hex colours.",
  "Do not draw a status bar or a bottom navigation: the renderer adds the navigation.",
].join(" ");

export function componentKitBuildInput(input: ComponentKitInput): BuildScreenInput {
  return {
    screenPlan: { name: COMPONENT_KIT_SCREEN_NAME, type: "root", description: componentKitBrief(input) },
    prompt: input.prompt,
    designTokens: input.tokens,
    image: input.image ?? null,
    referenceMode: input.referenceMode,
    referenceId: input.referenceId ?? null,
    referenceScope: "project",
    designStyle: input.designStyle ?? null,
    productContent: input.productContent ?? null,
    requiresBottomNav: false,
    specimenMarking: "kit",
  };
}

export function shouldBuildComponentKit({
  referenceMode,
  isNewProject,
  screenScoped,
  tokens,
  existing,
  screenCount,
  plannedAhead = false,
}: {
  referenceMode: ReferenceMode;
  /** True for the first generation of a project only. */
  isNewProject?: boolean;
  /** An attachment to one screen is that screen's reference, not the project's. */
  screenScoped: boolean;
  tokens?: DesignTokens | null;
  /** Components the project already has: a kit, or an approved preset's. */
  existing?: readonly StyleComponent[] | null;
  /** How many screens the approved flow has. One screen has nothing to be consistent with. */
  screenCount: number;
  /**
   * The plan was prepared while the person read the approval card. Its preparation owns the kit, so a generation
   * that found it without one does not make the person wait for a second attempt.
   */
  plannedAhead?: boolean;
}) {
  return referenceMode !== "user_recreate"
    && isNewProject === true
    && !plannedAhead
    && !screenScoped
    && Boolean(tokens?.tokens)
    && (existing?.length ?? 0) === 0
    && screenCount >= 2;
}

/**
 * Builds the kit and reads its components out. `kit` is null, with the reason in `notes`, when the build marked no
 * usable component. An error from the build itself is the caller's to catch.
 */
export async function buildComponentKit({
  buildScreen,
  ...input
}: ComponentKitInput & { buildScreen: ComponentKitBuilder }): Promise<ComponentKitResult> {
  const built = await buildCompleteSpecimen(buildScreen, componentKitBuildInput(input));
  const { components, skipped } = extractStyleComponents(built.code);
  const notes = skipped.map((item) => `skipped ${item.name}: ${item.reason}`);
  const usable = usableStyleComponents(components);
  if (usable.length === 0) return { kit: null, notes: [...notes, "the kit build marked no usable component"] };
  if (usable.length < FAIR_COMPONENT_COUNT) notes.push(`only ${usable.length} component${usable.length === 1 ? " was" : "s were"} marked`);
  return { kit: { source: "kit", components: usable, basis: componentKitBasis(input) }, notes };
}

export type ComponentKitSettled = { kit: ReferenceSpecimen | null; notes: string[]; error?: unknown; reused?: boolean };

/**
 * Starts the kit when the project needs one, and answers null when it does not or the build fails. The caller
 * hands the promise to the planning, which waits for it before the briefs are written; a failure costs the
 * generation nothing, since the project is then built as it was before the kit.
 */
export function startComponentKit({
  applies,
  input,
  buildScreen,
  reuse,
  onSettled,
}: {
  applies: Parameters<typeof shouldBuildComponentKit>[0];
  input: () => ComponentKitInput | Promise<ComponentKitInput>;
  buildScreen: ComponentKitBuilder;
  /**
   * A kit an earlier preparation or build of this project made from the same basis. Each revision of the approval
   * card prepares the plan again, and a build that missed its preparation plans again, and would otherwise pay for
   * the same kit again.
   */
  reuse?: (basis: string) => Promise<ReferenceSpecimen | null>;
  onSettled?: (event: ComponentKitSettled) => void;
}): Promise<ReferenceSpecimen | null> {
  if (!shouldBuildComponentKit(applies)) return Promise.resolve(null);
  const settle = (event: ComponentKitSettled) => {
    try {
      onSettled?.(event);
    } catch {
      // a report that fails never fails the kit
    }
    return event.kit;
  };
  return (async () => {
    try {
      const request = await input();
      const basis = componentKitBasis(request);
      const earlier = reuse ? await reuse(basis).catch(() => null) : null;
      if (earlier?.basis === basis && usableStyleComponents(earlier.components).length > 0) {
        return settle({ kit: earlier, notes: ["reused the kit made earlier for the same screens, tokens and reference"], reused: true });
      }
      return settle(await buildComponentKit({ ...request, buildScreen }));
    } catch (error) {
      return settle({ kit: null, notes: [], error });
    }
  })();
}

/** The kit, or null when it is not ready within `ms`. The build itself is not stopped. */
export async function withinComponentKitWait(
  kit: Promise<ReferenceSpecimen | null> | ReferenceSpecimen | null | undefined,
  ms = COMPONENT_KIT_WAIT_MS,
  onTimeout?: () => void,
): Promise<ReferenceSpecimen | null> {
  if (!kit) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      onTimeout?.();
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(kit), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The charter with the kit on it. A charter that already has one, or a kit with nothing usable, is left as it is. */
export function withComponentKit(charter: ProjectCharter, kit: ReferenceSpecimen | null | undefined): ProjectCharter {
  if (!kit || charter.componentKit) return charter;
  const components = usableStyleComponents(kit.components);
  return components.length > 0
    ? { ...charter, componentKit: { source: kit.source, components, ...(kit.basis ? { basis: kit.basis } : {}) } }
    : charter;
}

/**
 * The components every screen of a project is built from: its kit, or the components on its reference DNA (an
 * approved preset's). Empty for a project that has neither.
 */
export const projectComponents = (charter: ProjectCharter | null | undefined): StyleComponent[] => {
  const kit = usableStyleComponents(charter?.componentKit?.components);
  return kit.length > 0 ? kit : usableStyleComponents(charter?.referenceDna?.specimen?.components);
};

/** The same components as a brief planner reads them: each name with when to use it, and no markup. */
export const projectComponentSummaries = (charter: ProjectCharter | null | undefined): string[] =>
  projectComponents(charter).map((component) => `${component.name} (${component.use.slice(0, 100)})`);

/**
 * The components a project has before it is planned: those on its charter, or those of the approved curated preset
 * it is about to be given. A project that has them is built from them, and needs no kit of its own.
 */
export function existingProjectComponents({
  charter,
  referenceMode,
  referenceId,
}: {
  charter?: ProjectCharter | null;
  referenceMode: ReferenceMode;
  referenceId?: string | null;
}): StyleComponent[] {
  const onCharter = projectComponents(charter);
  if (onCharter.length > 0) return onCharter;
  const preset = referenceMode === "curated_style" ? resolveCuratedStylePreset(referenceId) : null;
  return usableStyleComponents(preset?.components);
}
