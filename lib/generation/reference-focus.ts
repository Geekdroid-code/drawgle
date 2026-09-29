import { Buffer } from "node:buffer";

import sharp from "sharp";

import type { NormalizedBox } from "@/lib/generation/reference-palette";
import { boxOf, cropToBox } from "@/lib/generation/specimen-build";
import type { PromptImagePayload, ReferenceAnalysis, ReferenceNavigationEvidence, TypefaceClass } from "@/lib/types";

/**
 * Two things a model reads wrongly from a picture of three phones, and reads right from a close-up of one: what
 * the letters of the headings are (a serif or a sans), and whether the bottom bar is attached to the edges of the
 * screen or floats above them. The mindfulness reference was read as "an elegant serif" by one pass and as a
 * geometric sans by another, and its attached bar as a floating capsule by both. A close-up of each phone's top
 * and of its bottom is a question with one answer, and the phones vote.
 *
 * It is for the offline preset build, where a few small calls cost a cent and a person reviews the result. A
 * failed or unclear answer leaves the analysis as it was.
 */

export type FocusAsk = (request: { instruction: string; image: PromptImagePayload }) => Promise<unknown>;

const WIDE_ENOUGH_PX = 900;
const TOP_SHARE = 0.4;
const BOTTOM_SHARE = 0.22;
const MAX_PHONES = 4;

/** The strip of a phone a close-up question is about: its top (greeting and headline) or its bottom (navigation). */
export async function focusCrop(image: PromptImagePayload, box: NormalizedBox, part: "top" | "bottom"): Promise<PromptImagePayload> {
  const strip = part === "top"
    ? { ...box, height: box.height * TOP_SHARE }
    : { ...box, y: box.y + box.height * (1 - BOTTOM_SHARE), height: box.height * BOTTOM_SHARE };
  const cropped = await cropToBox(image, strip);
  const bytes = Buffer.from(cropped.data, "base64");
  const { width = 0 } = await sharp(bytes).metadata();
  if (width >= WIDE_ENOUGH_PX) return cropped;
  // enlarged, so that the shapes of letters and the edges of a bar are legible to the model
  const enlarged = await sharp(bytes).resize({ width: WIDE_ENOUGH_PX, kernel: "lanczos3" }).png().toBuffer();
  return { data: enlarged.toString("base64"), mimeType: "image/png" };
}

export const TYPEFACE_QUESTION = [
  "This is the top part of a mobile app screen. Look only at the shapes of the letters: the largest heading, and the smaller text.",
  "Serif faces have small feet or flared ends on the strokes of their letters. If the letters end plainly, the typeface is a sans-serif. Do not judge by the mood or the style of the app.",
  "Return strictly valid JSON only:",
  '{ "headingClass": "sans | serif | display | mono", "kind": "geometric | grotesque | humanist | rounded | transitional | didone | slab | other", "bodyClass": "sans | serif | mono", "sameTypefaceForBody": true, "weights": "one weight | a light word beside a bold word | several weights" }',
  "- display means a decorative face made for large sizes, not a plain text face.",
  "- sameTypefaceForBody is true when the smaller text is set in the same typeface as the heading, in other weights.",
].join("\n");

export const NAVIGATION_QUESTION = [
  "This is the bottom part of a mobile app screen, in a phone mockup. Describe its persistent bottom navigation bar. If there is none, return { \"present\": false }.",
  "Return strictly valid JSON only:",
  '{ "present": true, "attachment": "attached | floating", "topCorners": "rounded | square", "itemCount": 5, "icons": ["house", "trophy"], "labels": "always | active-only | hidden", "activeTreatment": "icon-fill | tint | underline | compact-chip", "inactiveTreatment": "plain | well", "activeFill": "solid | gradient", "material": "solid | translucent | glass", "geometry": "one short sentence" }',
  "- attached: the bar's bottom edge and both side edges reach the edges of the screen, so that it touches the phone's frame on both sides and merges into its bottom edge, even when its top corners are rounded.",
  "- floating: page background is visible between the bar and the screen's edges, on its sides and below it.",
  "- The rounded outer corners of a phone frame are not a gap. Judge the bar against the screen's own edges.",
  "- Count every icon of the bar, even when it has no labels. icons lists them in order, by what they show.",
  "- activeTreatment is icon-fill when the active icon sits inside a filled circle or capsule and the other icons are plain.",
].join("\n");

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const oneOf = <Value extends string>(value: unknown, allowed: readonly Value[]): Value | null => {
  const text = lower(value);
  return (allowed as readonly string[]).includes(text) ? text as Value : null;
};
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const short = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, max) : null);

export type TypefaceRead = {
  headingClass: TypefaceClass;
  kind: string | null;
  bodyClass: "sans" | "serif" | "mono" | null;
  sameTypeface: boolean | null;
  weights: string | null;
};

export function parseTypefaceRead(raw: unknown): TypefaceRead | null {
  if (!isRecord(raw)) return null;
  // a model writes "sans-serif" for a sans as often as "sans"
  const named = (value: unknown) => lower(value).replace("sans-serif", "sans");
  const headingClass = oneOf(named(raw.headingClass ?? raw.heading_class), ["sans", "serif", "display", "mono"] as const);
  if (!headingClass) return null;
  return {
    headingClass,
    kind: short(raw.kind, 20)?.toLowerCase() ?? null,
    bodyClass: oneOf(named(raw.bodyClass ?? raw.body_class), ["sans", "serif", "mono"] as const),
    sameTypeface: typeof raw.sameTypefaceForBody === "boolean" ? raw.sameTypefaceForBody : null,
    weights: short(raw.weights, 60)?.toLowerCase() ?? null,
  };
}

export type NavigationRead = {
  present: boolean;
  attachment: "attached" | "floating" | null;
  topCorners: "rounded" | "square" | null;
  itemCount: number | null;
  icons: string[];
  labels: "always" | "active-only" | "hidden" | null;
  activeTreatment: "icon-fill" | "tint" | "underline" | "compact-chip" | null;
  inactiveTreatment: "plain" | "well" | null;
  activeFill: "solid" | "gradient" | null;
  material: "solid" | "translucent" | "glass" | null;
  geometry: string | null;
};

export function parseNavigationRead(raw: unknown): NavigationRead | null {
  if (!isRecord(raw)) return null;
  const count = typeof raw.itemCount === "number" && Number.isFinite(raw.itemCount) ? Math.min(5, Math.max(0, Math.round(raw.itemCount))) : null;
  return {
    present: raw.present === true,
    attachment: oneOf(raw.attachment, ["attached", "floating"] as const),
    topCorners: oneOf(raw.topCorners ?? raw.top_corners, ["rounded", "square"] as const),
    itemCount: count,
    icons: Array.isArray(raw.icons) ? raw.icons.flatMap((icon) => short(icon, 40) ?? []).slice(0, 5) : [],
    labels: oneOf(raw.labels, ["always", "active-only", "hidden"] as const),
    activeTreatment: oneOf(raw.activeTreatment ?? raw.active_treatment, ["icon-fill", "tint", "underline", "compact-chip"] as const),
    inactiveTreatment: oneOf(raw.inactiveTreatment ?? raw.inactive_treatment, ["plain", "well"] as const),
    activeFill: oneOf(raw.activeFill ?? raw.active_fill, ["solid", "gradient"] as const),
    material: oneOf(raw.material, ["solid", "translucent", "glass"] as const),
    geometry: short(raw.geometry, 300),
  };
}

/** The answer that more than half of the phones which gave one agree on, or null. */
export function consensus<Answer>(answers: ReadonlyArray<Answer | null | undefined>): Answer | null {
  const given = answers.filter((answer): answer is Answer => answer !== null && answer !== undefined);
  if (given.length === 0) return null;
  const counts = new Map<Answer, number>();
  for (const answer of given) counts.set(answer, (counts.get(answer) ?? 0) + 1);
  const [top, count] = [...counts].sort((left, right) => right[1] - left[1])[0];
  return count * 2 > given.length ? top : null;
}

async function askAbout<Read>(
  ask: FocusAsk,
  image: PromptImagePayload,
  box: NormalizedBox,
  part: "top" | "bottom",
  instruction: string,
  parse: (raw: unknown) => Read | null,
): Promise<Read | null> {
  // A provider's error text can carry request details, so a failed question is only a missing answer.
  try {
    return parse(await ask({ instruction, image: await focusCrop(image, box, part) }));
  } catch {
    return null;
  }
}

const CLASS_LABEL: Record<TypefaceClass, string> = { sans: "sans-serif", serif: "serif", display: "display", mono: "monospaced" };

/** The typography line of the analysis, written from what the close-ups showed. */
const typographySentence = (heading: TypefaceClass, reads: TypefaceRead[]) => {
  const kind = consensus(reads.filter((read) => read.headingClass === heading).map((read) => read.kind));
  const same = consensus(reads.map((read) => read.sameTypeface));
  const bodyClass = consensus(reads.map((read) => read.bodyClass));
  const weights = consensus(reads.map((read) => read.weights));
  return [
    `${kind && kind !== "other" ? `${kind[0].toUpperCase()}${kind.slice(1)} ` : ""}${CLASS_LABEL[heading]} headings`,
    same === true
      ? ", and the smaller text is set in the same typeface in other weights"
      : bodyClass ? `, with ${CLASS_LABEL[bodyClass]} text for the smaller sizes` : "",
    weights === "a light word beside a bold word" ? ". A light word may sit beside a bold one in a heading: that is one typeface in two weights" : "",
    ".",
  ].join("").replace("..", ".");
};

const FLOATING_ANATOMIES = ["floating-dock", "glass-dock", "center-action-dock", "compact-icon-rail"] as const;

const refineNavigation = (
  analysis: ReferenceAnalysis,
  reads: NavigationRead[],
  notes: string[],
): ReferenceNavigationEvidence | null | undefined => {
  const present = reads.filter((read) => read.present);
  if (present.length * 2 <= reads.length || present.length === 0) return undefined;

  const existing = analysis.primaryNavigation ?? null;
  const attachment = consensus(present.map((read) => read.attachment));
  const itemCount = consensus(present.map((read) => read.itemCount)) ?? existing?.itemCount ?? null;
  const counted = itemCount === null ? undefined : present.find((read) => read.icons.length === itemCount);
  const matching = present.filter((read) => read.attachment === attachment);
  const next: ReferenceNavigationEvidence = {
    present: true,
    repeatedAcrossScreens: present.length >= 2,
    itemCount: itemCount ?? 0,
    items: counted ? counted.icons.map((icon) => ({ label: null, icon })) : existing?.items ?? [],
    anatomy: existing?.anatomy ?? null,
    geometry: existing?.geometry ?? "",
    labels: consensus(present.map((read) => read.labels)) ?? existing?.labels ?? null,
    activeState: existing?.activeState ?? "",
    elevation: existing?.elevation ?? "",
    safeAreaRelationship: existing?.safeAreaRelationship ?? "",
    activeItemByScreen: existing?.activeItemByScreen ?? [],
    activeTreatment: consensus(present.map((read) => read.activeTreatment)) ?? existing?.activeTreatment ?? null,
    inactiveTreatment: consensus(present.map((read) => read.inactiveTreatment)) ?? existing?.inactiveTreatment ?? null,
    width: existing?.width ?? null,
    material: consensus(present.map((read) => read.material)) ?? existing?.material ?? null,
    activeFill: consensus(present.map((read) => read.activeFill)) ?? existing?.activeFill ?? null,
    corners: existing?.corners ?? null,
  };

  if (attachment === "attached") {
    next.anatomy = "fixed-tab-rail";
    next.width = "full";
    next.corners = consensus(matching.map((read) => read.topCorners)) ?? existing?.corners ?? "rounded";
    next.geometry = matching.find((read) => read.geometry)?.geometry ?? "A bar attached to the bottom edge of the screen, full width.";
    next.safeAreaRelationship = "Attached to the bottom edge of the screen.";
  } else if (attachment === "floating") {
    next.anatomy = existing?.anatomy && (FLOATING_ANATOMIES as readonly string[]).includes(existing.anatomy) ? existing.anatomy : "floating-dock";
    next.width = existing?.width === "content" ? "content" : "inset";
    next.corners = null;
    next.geometry = matching.find((read) => read.geometry)?.geometry ?? existing?.geometry ?? "A bar floating above the bottom edge.";
  }

  const was = existing?.anatomy ?? "none";
  notes.push(
    attachment
      ? `bottom bar: ${attachment}${attachment === "attached" ? ` with ${next.corners ?? "square"} top corners` : ""}, ${next.itemCount} icon${next.itemCount === 1 ? "" : "s"} (${matching.length} of ${present.length} phones)${was !== next.anatomy ? `; the first read said ${was}` : ""}`
      : `bottom bar: the phones disagree about whether it is attached, so the first read (${was}) stands`,
  );
  return next;
};

/**
 * Looks at the top and the bottom of every phone, up to four, and lets them vote. What comes back is the analysis
 * with its typeface class, its typography line and its bottom bar corrected where the close-ups agree, and the
 * notes that say what changed. Nothing else in the analysis is touched.
 */
export async function refineAnalysisFromCrops({
  image,
  analysis,
  ask,
}: {
  image: PromptImagePayload;
  analysis: ReferenceAnalysis;
  ask: FocusAsk;
}): Promise<{ analysis: ReferenceAnalysis; notes: string[] }> {
  const phones = analysis.screenReferences.flatMap((screen) => {
    const box = boxOf(screen);
    return box ? [{ index: screen.index, box }] : [];
  }).slice(0, MAX_PHONES);
  if (phones.length === 0) return { analysis, notes: ["no phone has a box to look at closely"] };

  const reads = await Promise.all(phones.map(async ({ box }) => ({
    typeface: await askAbout(ask, image, box, "top", TYPEFACE_QUESTION, parseTypefaceRead),
    navigation: await askAbout(ask, image, box, "bottom", NAVIGATION_QUESTION, parseNavigationRead),
  })));

  const notes: string[] = [];
  let refined: ReferenceAnalysis = analysis;

  const typefaces = reads.flatMap((read) => read.typeface ?? []);
  const heading = consensus(typefaces.map((read) => read.headingClass));
  if (heading) {
    refined = {
      ...refined,
      typefaceClass: heading,
      designSystemSignals: { ...refined.designSystemSignals, typography: typographySentence(heading, typefaces) },
    };
    notes.push(`headings: ${CLASS_LABEL[heading]} (${typefaces.filter((read) => read.headingClass === heading).length} of ${typefaces.length} phones)`);
  } else {
    notes.push(typefaces.length === 0 ? "headings: no close-up gave an answer, so the first read stands" : "headings: the phones disagree, so the first read stands");
  }

  const navigation = refineNavigation(refined, reads.flatMap((read) => read.navigation ?? []), notes);
  if (navigation) {
    refined = { ...refined, primaryNavigation: navigation };
  } else if (reads.every((read) => read.navigation === null)) {
    notes.push("bottom bar: no close-up gave an answer, so the first read stands");
  }
  return { analysis: refined, notes };
}

/** The model call the close-up questions use, at temperature 0 and with the planner's model. */
export async function geminiFocusAsk(): Promise<FocusAsk> {
  const [{ createGeminiClient }, { geminiPolicyForTask }] = await Promise.all([
    import("@/lib/ai/gemini"),
    import("@/lib/ai/model-policy"),
  ]);
  const ai = createGeminiClient();
  return async ({ instruction, image }) => {
    const policy = geminiPolicyForTask("project_planning", { responseMimeType: "application/json", temperature: 0 });
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: instruction }] },
      config: policy.config,
    });
    const text = (response.text || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(text);
    } catch {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      return first >= 0 && last > first ? JSON.parse(text.slice(first, last + 1)) : {};
    }
  };
}
