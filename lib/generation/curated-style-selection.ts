import { z } from "zod";

import {
  CURATED_STYLE_ASSET_BIASES,
  CURATED_STYLE_COMPOSITIONS,
  CURATED_STYLE_COLOR_CHARACTERS,
  CURATED_STYLE_DENSITIES,
  CURATED_STYLE_GEOMETRIES,
  CURATED_STYLE_INTERACTION_ARCHETYPES,
  CURATED_STYLE_MATERIALS,
  CURATED_STYLE_MOODS,
  CURATED_STYLE_NAVIGATION,
  CURATED_STYLE_PRODUCT_ARCHETYPES,
  CURATED_STYLE_REFERENCES,
  CURATED_STYLE_THEMES,
  CURATED_STYLE_TYPOGRAPHY_CHARACTERS,
  type CuratedStyleReference,
} from "@/lib/generation/curated-style-catalog";
import type { LlmLogFn, PlanningMode, ProjectCharter } from "@/lib/types";

const MIN_CONFIDENCE = 60;
const MIN_MARGIN = 8;
const MIN_MATCHED_DIMENSIONS = 2;

const StyleSelectionIntentSchema = z.object({
  explicitStyleStrength: z.enum(["none", "partial", "strong"]),
  theme: z.union([z.enum(CURATED_STYLE_THEMES), z.literal("unspecified")]),
  productArchetypes: z.array(z.enum(CURATED_STYLE_PRODUCT_ARCHETYPES)).max(3),
  interactionArchetypes: z.array(z.enum(CURATED_STYLE_INTERACTION_ARCHETYPES)).max(5),
  compositionNeeds: z.array(z.enum(CURATED_STYLE_COMPOSITIONS)).max(5),
  materials: z.array(z.enum(CURATED_STYLE_MATERIALS)).max(4),
  geometries: z.array(z.enum(CURATED_STYLE_GEOMETRIES)).max(4),
  navigation: z.union([z.enum(CURATED_STYLE_NAVIGATION), z.literal("unspecified")]),
  density: z.union([z.enum(CURATED_STYLE_DENSITIES), z.literal("unspecified")]),
  assetBias: z.union([z.enum(CURATED_STYLE_ASSET_BIASES), z.literal("unspecified")]),
  colorCharacter: z.array(z.enum(CURATED_STYLE_COLOR_CHARACTERS)).max(4),
  typographyCharacter: z.array(z.enum(CURATED_STYLE_TYPOGRAPHY_CHARACTERS)).max(3),
  moods: z.array(z.enum(CURATED_STYLE_MOODS)).max(5),
  mustAvoid: z.array(z.string().trim().min(1).max(60)).max(8),
});

export type CuratedStyleSelectionIntent = z.infer<typeof StyleSelectionIntentSchema>;

export type RankedCuratedStyleReference = {
  reference: CuratedStyleReference;
  score: number;
  matchedTags: string[];
  matchedDimensions: number;
  disqualifiedReasons: string[];
};

export type CuratedStyleReferenceMatch = RankedCuratedStyleReference & {
  intent: CuratedStyleSelectionIntent;
  runnerUp: { referenceId: string; score: number } | null;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = <T extends string>(items: T[]) => Array.from(new Set(items));

const parseJsonResponse = (text: string): unknown => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Style selector did not return valid JSON.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
};

const projectContextText = (charter?: ProjectCharter | null) =>
  [
    charter?.appType,
    charter?.targetAudience,
    charter?.navigationModel,
    charter?.keyFeatures?.join(" "),
    charter?.designRationale,
    charter?.creativeDirection?.conceptName,
    charter?.creativeDirection?.styleEssence,
    charter?.creativeDirection?.surfaceLanguage,
  ].filter(Boolean).join(" ");

const containsAny = (input: string, aliases: string[]) => aliases.some((alias) => {
  const normalized = normalizeText(alias);
  return normalized && new RegExp(`(?:^|\\s)${normalized.replace(/ /g, "\\s+")}(?:$|\\s)`).test(input);
});

export const inferCuratedStyleSelectionIntent = (
  prompt: string,
  existingCharter?: ProjectCharter | null,
): CuratedStyleSelectionIntent => {
  const input = normalizeText(`${prompt} ${projectContextText(existingCharter)}`);
  const products: CuratedStyleSelectionIntent["productArchetypes"] = [];
  const interactions: CuratedStyleSelectionIntent["interactionArchetypes"] = [];
  const compositions: CuratedStyleSelectionIntent["compositionNeeds"] = [];
  const materials: CuratedStyleSelectionIntent["materials"] = [];
  const geometries: CuratedStyleSelectionIntent["geometries"] = [];
  const colorCharacter: CuratedStyleSelectionIntent["colorCharacter"] = [];
  const typographyCharacter: CuratedStyleSelectionIntent["typographyCharacter"] = [];
  const moods: CuratedStyleSelectionIntent["moods"] = [];

  const addWhen = <T extends string>(target: T[], value: T, aliases: string[]) => {
    if (containsAny(input, aliases)) target.push(value);
  };

  addWhen(products, "security-utility", ["password", "vault", "cybersecurity", "privacy", "breach"]);
  addWhen(products, "device-control", ["smart home", "iot", "thermostat", "appliance", "device control"]);
  addWhen(products, "monitoring-operations", ["monitor", "monitoring", "sensor", "inspection", "hive", "beekeep"]);
  addWhen(products, "consumer-commerce", ["ecommerce", "e commerce", "shopping", "storefront", "fashion", "retail app"]);
  addWhen(products, "commerce-operations", ["inventory", "seller", "merchant", "store admin", "orders dashboard"]);
  addWhen(products, "health-tracking", ["medicine", "medication", "calorie", "meal tracking", "period", "fertility", "wellness tracker"]);
  addWhen(products, "health-analytics", ["sleep tracking", "recovery", "biometrics", "health analytics", "fitness analytics"]);
  addWhen(products, "wellness", ["meditation", "breathing", "mindfulness", "mood check"]);
  addWhen(products, "personal-finance", ["banking", "budget", "personal finance", "expense", "wallet"]);
  addWhen(products, "trading", ["crypto", "exchange", "trading", "swap", "bitcoin"]);
  addWhen(products, "productivity", ["project management", "tasks", "team workload", "productivity"]);
  addWhen(products, "education", ["university", "student", "classes", "exam", "course"]);
  addWhen(products, "booking", ["booking", "appointment", "reservation", "reschedule"]);
  addWhen(products, "editorial-content", ["writing", "writer", "editorial", "article", "reading"]);
  addWhen(products, "social-discovery", ["dating", "social", "matches", "community"]);
  addWhen(products, "travel", ["travel", "trip", "itinerary", "destination"]);
  addWhen(products, "media", ["music", "audio", "podcast", "video", "player", "playlist"]);

  addWhen(interactions, "status-overview", ["overview", "status", "readiness", "next medicine", "health"]);
  addWhen(interactions, "metric-dashboard", ["dashboard", "metrics", "analytics", "score", "balance", "progress", "macro", "calorie", "water intake"]);
  addWhen(interactions, "monitoring", ["monitor", "monitoring", "alerts", "inspection", "sensor"]);
  addWhen(interactions, "control-panel", ["control", "thermostat", "lights", "appliance", "configure"]);
  addWhen(interactions, "catalog-discovery", ["discover", "discovery", "catalog", "products", "destinations", "profiles"]);
  addWhen(interactions, "product-detail", ["product detail", "details", "item detail"]);
  addWhen(interactions, "transaction-flow", ["pay", "payment", "transfer", "swap", "checkout", "transaction"]);
  addWhen(interactions, "form-workflow", ["form", "input", "checkout", "booking flow"]);
  addWhen(interactions, "timeline-history", ["timeline", "history", "log", "streak", "recent"]);
  addWhen(interactions, "schedule", ["schedule", "calendar", "appointment", "classes", "deadline"]);
  addWhen(interactions, "content-feed", ["feed", "articles", "journal", "recommendations"]);
  addWhen(interactions, "text-workspace", ["writing", "editor", "manuscript", "document"]);
  addWhen(interactions, "media-player", ["now playing", "music player", "audio controls", "queue", "playlist"]);
  addWhen(interactions, "settings-list", ["settings", "accounts", "preferences"]);
  addWhen(interactions, "profile", ["profile", "account"]);
  addWhen(interactions, "social-feed", ["social feed", "community", "family status", "caregivers"]);

  addWhen(compositions, "dominant-metric-hero", ["large score", "readiness score", "total balance", "next medicine", "hero metric"]);
  addWhen(compositions, "bento-grid", ["bento", "widget grid", "dashboard cards"]);
  addWhen(compositions, "stacked-list", ["list", "rows", "recent", "upcoming"]);
  addWhen(compositions, "split-plane", ["split", "two pane", "two currency"]);
  addWhen(compositions, "editorial-flow", ["editorial", "magazine", "storytelling", "content led"]);
  addWhen(compositions, "full-bleed-media", ["full bleed", "photo led", "large photography", "immersive media"]);
  addWhen(compositions, "edge-to-edge", ["edge to edge", "full width"]);
  addWhen(compositions, "inset-sheet", ["sheet", "inset panel"]);
  addWhen(compositions, "modular-grid", ["grid", "modules", "widgets"]);
  addWhen(compositions, "data-dense", ["data dense", "information dense", "compact metrics"]);
  addWhen(compositions, "asymmetric", ["asymmetric", "asymmetrical", "staggered"]);
  addWhen(compositions, "centered-focus", ["centered", "single focus", "timer"]);

  addWhen(materials, "flat", ["flat", "no shadows"]);
  addWhen(materials, "soft-elevated", ["soft shadow", "soft elevated"]);
  addWhen(materials, "glass", ["glass", "frosted", "blur"]);
  addWhen(materials, "tactile", ["tactile", "machined", "physical controls"]);
  addWhen(materials, "layered", ["layered", "overlap", "depth"]);
  addWhen(materials, "high-contrast", ["high contrast", "accessible", "field friendly"]);
  addWhen(materials, "atmospheric", ["atmospheric", "glow", "ambient", "immersive"]);
  addWhen(materials, "photographic", ["photo", "photography", "image led"]);
  addWhen(materials, "illustrated", ["illustrated", "illustration", "graphic"]);

  addWhen(geometries, "rounded", ["rounded"]);
  addWhen(geometries, "capsule", ["pill", "capsule"]);
  addWhen(geometries, "sharp", ["sharp", "square", "angular"]);
  addWhen(geometries, "organic", ["organic", "wavy", "fluid"]);
  addWhen(geometries, "sheet-connected", ["connected sheet", "sheet connected"]);
  addWhen(geometries, "inset", ["inset"]);
  addWhen(geometries, "edge-to-edge", ["edge to edge"]);

  addWhen(colorCharacter, "restrained-neutral", ["restrained color", "neutral palette", "muted palette"]);
  addWhen(colorCharacter, "pastel", ["pastel"]);
  addWhen(colorCharacter, "vivid-accent", ["vivid", "bright accent", "saturated accent"]);
  addWhen(colorCharacter, "neon-accent", ["neon", "electric accent", "chartreuse"]);
  addWhen(colorCharacter, "monochrome", ["monochrome", "black and white"]);
  addWhen(colorCharacter, "warm-organic", ["warm palette", "earthy", "organic color"]);
  addWhen(colorCharacter, "cool-clinical", ["cool palette", "clinical color"]);
  addWhen(colorCharacter, "multicolor", ["multicolor", "colour coded", "color coded"]);

  addWhen(typographyCharacter, "neutral-sans", ["neutral sans", "system font"]);
  addWhen(typographyCharacter, "geometric-sans", ["geometric sans", "geometric type"]);
  addWhen(typographyCharacter, "humanist-sans", ["humanist sans", "friendly type"]);
  addWhen(typographyCharacter, "editorial-serif", ["editorial serif", "serif typography", "serif font"]);
  addWhen(typographyCharacter, "technical-mono", ["monospace", "technical mono", "terminal type"]);
  addWhen(typographyCharacter, "display-led", ["display type", "oversized typography", "expressive typography"]);

  addWhen(moods, "calm", ["calm"]);
  addWhen(moods, "precise", ["precise", "technical"]);
  addWhen(moods, "premium", ["premium", "luxury"]);
  addWhen(moods, "energetic", ["energetic", "dynamic"]);
  addWhen(moods, "playful", ["playful", "fun"]);
  addWhen(moods, "serious", ["serious"]);
  addWhen(moods, "clinical", ["clinical", "medical"]);
  addWhen(moods, "friendly", ["friendly", "approachable"]);
  addWhen(moods, "focused", ["focused", "focus"]);
  addWhen(moods, "futuristic", ["futuristic", "future"]);
  addWhen(moods, "cozy", ["cozy", "warm"]);
  addWhen(moods, "disciplined", ["disciplined", "rigorous"]);
  addWhen(moods, "trustworthy", ["trustworthy", "trust"]);
  addWhen(moods, "bold", ["bold"]);
  addWhen(moods, "serene", ["serene", "peaceful"]);
  addWhen(moods, "professional", ["professional", "b2b"]);
  addWhen(moods, "accessible", ["accessible", "elderly", "highly legible"]);

  const theme = containsAny(input, ["dark", "dark mode", "black interface"])
    ? "dark"
    : containsAny(input, ["light", "light mode", "white interface"])
      ? "light"
      : "unspecified";
  const density = containsAny(input, ["dense", "compact", "information rich"])
    ? "dense"
    : containsAny(input, ["airy", "spacious", "lots of whitespace"])
      ? "airy"
      : "unspecified";
  const navigation = containsAny(input, ["floating dock", "floating navigation"])
    ? "floating-dock"
    : containsAny(input, ["bottom tabs", "tab bar"])
      ? "fixed-tabs"
      : containsAny(input, ["minimal chrome", "immersive"])
        ? "minimal-chrome"
        : containsAny(input, ["top bar", "back button"])
          ? "top-bar"
          : "unspecified";
  const assetBias = containsAny(input, ["photo", "photography", "image led", "profiles"])
    ? "photo"
    : containsAny(input, ["chart", "analytics", "metrics", "score", "timeline"])
      ? "data"
      : containsAny(input, ["control", "thermostat", "lights", "form"])
        ? "control"
        : containsAny(input, ["writing", "editor", "reading", "article"])
          ? "text"
          : containsAny(input, ["product", "shopping", "storefront"])
            ? "product"
            : "unspecified";
  const explicitSignalCount = Number(theme !== "unspecified") + Number(density !== "unspecified")
    + materials.length + geometries.length + colorCharacter.length + typographyCharacter.length
    + moods.length + Number(navigation !== "unspecified");

  return {
    explicitStyleStrength: explicitSignalCount >= 4 ? "strong" : explicitSignalCount > 0 ? "partial" : "none",
    theme,
    productArchetypes: unique(products).slice(0, 3),
    interactionArchetypes: unique(interactions).slice(0, 5),
    compositionNeeds: unique(compositions).slice(0, 5),
    materials: unique(materials).slice(0, 4),
    geometries: unique(geometries).slice(0, 4),
    navigation,
    density,
    assetBias,
    colorCharacter: unique(colorCharacter).slice(0, 4),
    typographyCharacter: unique(typographyCharacter).slice(0, 3),
    moods: unique(moods).slice(0, 5),
    mustAvoid: [],
  };
};

const selectionInstruction = ({
  prompt,
  planningMode,
  existingContext,
}: {
  prompt: string;
  planningMode?: PlanningMode;
  existingContext: string;
}) => `Classify a mobile UI request for selecting one optional curated visual/spatial style reference.
Return JSON only. Do not choose a reference and do not invent a fashionable style the user did not request.

Separate explicit visual decisions from product/interaction inference:
- explicitStyleStrength is strong only when the user supplies several concrete visual decisions; partial for one or two; otherwise none.
- theme, materials, geometries, navigation, density, colorCharacter, typographyCharacter, moods, and mustAvoid must come from explicit user wording or unavoidable accessibility requirements.
- productArchetypes describe the product category.
- interactionArchetypes and compositionNeeds may be inferred from requested screen functions and information hierarchy.
- mustAvoid must contain only exact values from the allowed vocabularies below, never prose.
- Use "unspecified" when the prompt does not provide enough evidence.

Allowed productArchetypes: ${CURATED_STYLE_PRODUCT_ARCHETYPES.join(", ")}.
Allowed interactionArchetypes: ${CURATED_STYLE_INTERACTION_ARCHETYPES.join(", ")}.
Allowed compositionNeeds: ${CURATED_STYLE_COMPOSITIONS.join(", ")}.
Allowed materials: ${CURATED_STYLE_MATERIALS.join(", ")}.
Allowed geometries: ${CURATED_STYLE_GEOMETRIES.join(", ")}.
Allowed theme: ${CURATED_STYLE_THEMES.join(", ")}, unspecified.
Allowed navigation: ${CURATED_STYLE_NAVIGATION.join(", ")}, unspecified.
Allowed density: ${CURATED_STYLE_DENSITIES.join(", ")}, unspecified.
Allowed assetBias: ${CURATED_STYLE_ASSET_BIASES.join(", ")}, unspecified.
Allowed colorCharacter: ${CURATED_STYLE_COLOR_CHARACTERS.join(", ")}.
Allowed typographyCharacter: ${CURATED_STYLE_TYPOGRAPHY_CHARACTERS.join(", ")}.
Allowed moods: ${CURATED_STYLE_MOODS.join(", ")}.

Exact JSON shape:
{
  "explicitStyleStrength": "none|partial|strong",
  "theme": "allowed value",
  "productArchetypes": [],
  "interactionArchetypes": [],
  "compositionNeeds": [],
  "materials": [],
  "geometries": [],
  "navigation": "allowed value",
  "density": "allowed value",
  "assetBias": "allowed value",
  "colorCharacter": [],
  "typographyCharacter": [],
  "moods": [],
  "mustAvoid": []
}

Request kind: ${planningMode === "single-screen" ? "one additional project screen" : "new project or multi-screen plan"}.
User prompt: ${JSON.stringify(prompt.slice(0, 10_000))}
Existing project context: ${JSON.stringify(existingContext.slice(0, 3_000))}`;

export async function classifyCuratedStyleSelectionIntent({
  prompt,
  planningMode,
  existingCharter,
  llmLog,
}: {
  prompt: string;
  planningMode?: PlanningMode;
  existingCharter?: ProjectCharter | null;
  llmLog?: LlmLogFn;
}): Promise<CuratedStyleSelectionIntent> {
  const fallback = inferCuratedStyleSelectionIntent(prompt, existingCharter);
  if (!prompt.trim()) return fallback;

  try {
    const [{ createGeminiClient }, { geminiPolicyForTask }] = await Promise.all([
      import("@/lib/ai/gemini"),
      import("@/lib/ai/model-policy"),
    ]);
    const policy = geminiPolicyForTask("style_selection", {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 900,
    });
    const instruction = selectionInstruction({
      prompt,
      planningMode,
      existingContext: projectContextText(existingCharter),
    });
    llmLog?.("[LLM INPUT] curated-style-selection", {
      model: policy.model,
      promptLength: prompt.length,
    });
    const response = await createGeminiClient().models.generateContent({
      model: policy.model,
      contents: instruction,
      config: policy.config,
    });
    const parsed = StyleSelectionIntentSchema.safeParse(parseJsonResponse(response.text || "{}"));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

const overlap = (requested: readonly string[], available: readonly string[]) => {
  if (requested.length === 0) return { ratio: 0, matches: [] as string[] };
  const availableSet = new Set(available);
  const matches = requested.filter((item) => availableSet.has(item));
  return { ratio: matches.length / requested.length, matches };
};

const referenceTraits = (reference: CuratedStyleReference) => {
  const profile = reference.selectionProfile;
  return unique([
    profile.theme,
    profile.density,
    profile.assetBias,
    ...profile.colorCharacter,
    ...profile.typographyCharacter,
    ...profile.productArchetypes,
    ...profile.interactionArchetypes,
    ...profile.compositions,
    ...profile.materials,
    ...profile.geometries,
    ...profile.navigation,
    ...profile.moods,
  ]);
};

export function rankCuratedStyleReferences(intent: CuratedStyleSelectionIntent): RankedCuratedStyleReference[] {
  const requestedTraits = unique([
    ...(intent.theme === "unspecified" ? [] : [intent.theme]),
    ...(intent.density === "unspecified" ? [] : [intent.density]),
    ...(intent.assetBias === "unspecified" ? [] : [intent.assetBias]),
    ...intent.colorCharacter,
    ...intent.typographyCharacter,
    ...intent.productArchetypes,
    ...intent.interactionArchetypes,
    ...intent.compositionNeeds,
    ...intent.materials,
    ...intent.geometries,
    ...(intent.navigation === "unspecified" ? [] : [intent.navigation]),
    ...intent.moods,
  ]);

  return CURATED_STYLE_REFERENCES.map((reference) => {
    const profile = reference.selectionProfile;
    const traits = referenceTraits(reference);
    const disqualifiedReasons: string[] = [];
    const requestedProducts = intent.productArchetypes.filter((value) => value !== "other");
    const avoided = overlap(intent.mustAvoid.map(normalizeText), traits.map(normalizeText)).matches;
    const incompatible = overlap(requestedTraits.map(normalizeText), profile.incompatibleWith.map(normalizeText)).matches;
    if (avoided.length > 0) disqualifiedReasons.push(`must-avoid:${avoided.join(",")}`);
    if (incompatible.length > 0) disqualifiedReasons.push(`incompatible:${incompatible.join(",")}`);
    if (requestedProducts.length > 0 && overlap(requestedProducts, profile.productArchetypes).matches.length === 0) {
      disqualifiedReasons.push("product-archetype");
    }
    if (
      intent.explicitStyleStrength !== "none"
      && intent.theme !== "unspecified"
      && profile.theme !== "mixed"
      && profile.theme !== intent.theme
    ) {
      disqualifiedReasons.push(`theme:${profile.theme}`);
    }

    let earned = 0;
    let possible = 0;
    let matchedDimensions = 0;
    const matchedTags: string[] = [];
    const addArrayDimension = (label: string, requested: readonly string[], available: readonly string[], weight: number) => {
      if (requested.length === 0) return;
      possible += weight;
      const result = overlap(requested, available);
      earned += weight * result.ratio;
      if (result.matches.length > 0) {
        matchedDimensions += 1;
        matchedTags.push(...result.matches.map((value) => `${label}:${value}`));
      }
    };
    const addScalarDimension = (label: string, requested: string, available: string, weight: number) => {
      if (requested === "unspecified") return;
      possible += weight;
      if (requested === available || available === "mixed") {
        earned += weight;
        matchedDimensions += 1;
        matchedTags.push(`${label}:${requested}`);
      }
    };

    addArrayDimension("product", requestedProducts, profile.productArchetypes, 14);
    addArrayDimension("interaction", intent.interactionArchetypes, profile.interactionArchetypes, 24);
    addArrayDimension("composition", intent.compositionNeeds, profile.compositions, 18);
    addArrayDimension("material", intent.materials, profile.materials, 12);
    addArrayDimension("geometry", intent.geometries, profile.geometries, 8);
    addArrayDimension("mood", intent.moods, profile.moods, 5);
    addArrayDimension("color", intent.colorCharacter, profile.colorCharacter, 8);
    addArrayDimension("typography", intent.typographyCharacter, profile.typographyCharacter, 6);
    addScalarDimension("theme", intent.theme, profile.theme, 12);
    addScalarDimension("density", intent.density, profile.density, 4);
    addScalarDimension("asset", intent.assetBias, profile.assetBias, 5);
    addArrayDimension(
      "navigation",
      intent.navigation === "unspecified" ? [] : [intent.navigation],
      profile.navigation,
      4,
    );

    const score = possible > 0 && disqualifiedReasons.length === 0 ? Math.round((earned / possible) * 100) : 0;
    return { reference, score, matchedTags, matchedDimensions, disqualifiedReasons };
  }).sort((a, b) => b.score - a.score || b.matchedDimensions - a.matchedDimensions || a.reference.id.localeCompare(b.reference.id));
}

export function selectCuratedStyleReference(intent: CuratedStyleSelectionIntent): CuratedStyleReferenceMatch | null {
  const ranked = rankCuratedStyleReferences(intent);
  const best = ranked[0];
  const runnerUp = ranked[1] ?? null;
  if (!best || best.score < MIN_CONFIDENCE || best.matchedDimensions < MIN_MATCHED_DIMENSIONS) return null;
  if (runnerUp && best.score - runnerUp.score < MIN_MARGIN) return null;

  return {
    ...best,
    intent,
    runnerUp: runnerUp ? { referenceId: runnerUp.reference.id, score: runnerUp.score } : null,
  };
}

export async function matchCuratedStyleReference(input: {
  prompt: string;
  planningMode?: PlanningMode;
  existingCharter?: ProjectCharter | null;
  llmLog?: LlmLogFn;
}): Promise<CuratedStyleReferenceMatch | null> {
  const intent = await classifyCuratedStyleSelectionIntent(input);
  const match = selectCuratedStyleReference(intent);
  input.llmLog?.("[CURATED STYLE SELECTION] resolved", {
    referenceId: match?.reference.id ?? null,
    score: match?.score ?? null,
    runnerUp: match?.runnerUp ?? null,
    matchedTags: match?.matchedTags ?? [],
    intent,
  });
  return match;
}
