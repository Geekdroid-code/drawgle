import type {
  CuratedStyleDensity,
  CuratedStyleReference,
  CuratedStyleTheme,
} from "@/lib/generation/curated-style-catalog";

export const CURATED_STYLE_EMBEDDING_MODEL = "gemini-embedding-001";
export const CURATED_STYLE_EMBEDDING_DIMENSIONS = 768;
export const CURATED_STYLE_INDEX_VERSION = 1;
export const CURATED_STYLE_MIN_SIMILARITY = 0.55;
export const CURATED_STYLE_MIN_MARGIN = 0.015;

export type CuratedStyleIndexEntry = {
  id: string;
  contentHash: string;
  vector: string;
};

export type CuratedStyleIndexManifest = {
  version: number;
  model: string;
  dimensions: number;
  catalogHash: string;
  entries: CuratedStyleIndexEntry[];
};

export type ExplicitStyleConstraints = {
  theme: CuratedStyleTheme | "unspecified";
  density: CuratedStyleDensity | "unspecified";
};

export type CuratedStyleEmbeddingEntry = {
  reference: CuratedStyleReference;
  vector: Float32Array;
};

export type RankedCuratedStyleEmbedding = {
  reference: CuratedStyleReference;
  similarity: number;
};

const readableTags = (values: readonly string[]) =>
  values.map((value) => value.replace(/-/g, " ")).join(", ");

export function buildCuratedStyleRetrievalDocument(reference: CuratedStyleReference) {
  const profile = reference.selectionProfile;
  return [
    `Reference: ${reference.id.replace(/-/g, " ")}.`,
    `Visual and spatial style: ${reference.styleIntent.trim()}`,
    `Theme: ${profile.theme}. Density: ${profile.density}.`,
    `Suitable product archetypes: ${readableTags(profile.productArchetypes)}.`,
    `Suitable interaction archetypes: ${readableTags(profile.interactionArchetypes)}.`,
    `Composition: ${readableTags(profile.compositions)}.`,
    `Materials and depth: ${readableTags(profile.materials)}.`,
    `Geometry: ${readableTags(profile.geometries)}.`,
    `Navigation: ${readableTags(profile.navigation)}.`,
    `Asset emphasis: ${profile.assetBias.replace(/-/g, " ")}.`,
    `Color character: ${readableTags(profile.colorCharacter)}.`,
    `Typography character: ${readableTags(profile.typographyCharacter)}.`,
    `Mood: ${readableTags(profile.moods)}.`,
  ].join("\n");
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeConstraintText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isNegatedMatch = (input: string, matchIndex: number) => {
  const clauseStart = Math.max(input.lastIndexOf(".", matchIndex - 1), input.lastIndexOf(";", matchIndex - 1)) + 1;
  const prefix = input.slice(clauseStart, matchIndex);
  const negations = [...prefix.matchAll(/\b(?:no|not|without|avoid|exclude|do not|dont)\b/g)];
  const lastNegation = negations.at(-1);
  if (!lastNegation || lastNegation.index === undefined) return false;

  const afterNegation = prefix.slice(lastNegation.index + lastNegation[0].length);
  if (afterNegation.length > 100) return false;
  return !/(?:,\s*|\b(?:but|however|instead)\b[^,.;]{0,20}\b)(?:use|with|choose|make|prefer|switch|apply|include)\b/.test(
    afterNegation,
  );
};

const hasPositivePattern = (input: string, pattern: RegExp) => {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  for (const match of input.matchAll(new RegExp(pattern.source, flags))) {
    if (!isNegatedMatch(input, match.index ?? 0)) {
      return true;
    }
  }
  return false;
};

export function extractExplicitStyleConstraints(prompt: string): ExplicitStyleConstraints {
  const input = normalizeConstraintText(prompt);
  const hasDark = hasPositivePattern(
    input,
    /\b(?:dark mode|dark theme|dark (?:ui|interface|background|canvas|surface)|black (?:background|canvas|surface)|deep charcoal (?:background|canvas|surface)|dark(?:\s+|,\s*)(?!(?:brown|blue|green|red|navy|purple|pink|orange|yellow|gold|bronze|chocolate|typography|text|icons?|accents?|photography|photos?|images?)\b)(?:[a-z0-9]+\s+){0,3}(?:app|application|dashboard|wallet|interface|ui|screen|experience))\b/,
  );
  const hasLight = hasPositivePattern(
    input,
    /\b(?:light mode|light theme|light (?:ui|interface|background|canvas|surface)|white (?:background|canvas|surface)|off white (?:background|canvas|surface)|cream (?:background|canvas|surface)|ivory (?:background|canvas|surface)|light(?:\s+|,\s*)(?!(?:blue|green|red|navy|purple|pink|orange|yellow|gold|bronze|brown|typography|text|icons?|accents?|photography|photos?|images?)\b)(?:[a-z0-9]+\s+){0,3}(?:app|application|dashboard|wallet|interface|ui|screen|experience))\b/,
  );
  const hasDense = hasPositivePattern(
    input,
    /\b(?:dense|data dense|information dense|compact layout|compact density)\b/,
  );
  const hasAiry = hasPositivePattern(
    input,
    /\b(?:airy|spacious|generous whitespace|lots of whitespace)\b/,
  );

  return {
    theme: hasDark === hasLight ? "unspecified" : hasDark ? "dark" : "light",
    density: hasDense === hasAiry ? "unspecified" : hasDense ? "dense" : "airy",
  };
}

export function promptExplicitlyRequestsTerm(prompt: string, term: string) {
  const input = normalizeConstraintText(prompt);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  const termTokens = normalizedTerm.split(" ");
  const lastToken = termTokens.at(-1)!;
  if (!lastToken.endsWith("s")) {
    termTokens[termTokens.length - 1] = `${lastToken}s?`;
  }

  const pattern = new RegExp(
    `(?:^|[\\s.,;])${termTokens.join("\\s+")}(?:$|[\\s.,;])`,
    "g",
  );
  for (const match of input.matchAll(pattern)) {
    if (!isNegatedMatch(input, match.index ?? 0)) {
      return true;
    }
  }
  return false;
}

export function isReferenceCompatibleWithPrompt(
  reference: CuratedStyleReference,
  prompt: string,
  constraints = extractExplicitStyleConstraints(prompt),
) {
  const profile = reference.selectionProfile;
  if (
    constraints.theme !== "unspecified"
    && profile.theme !== "mixed"
    && profile.theme !== constraints.theme
  ) {
    return false;
  }
  if (constraints.density !== "unspecified" && profile.density !== constraints.density) {
    return false;
  }
  const stableConstraintTerms = new Set(["light", "dark", "mixed", "airy", "balanced", "dense"]);
  return !profile.incompatibleWith.some((term) =>
    !stableConstraintTerms.has(term) && promptExplicitlyRequestsTerm(prompt, term));
}

export function normalizeEmbedding(values: ArrayLike<number>) {
  let squaredMagnitude = 0;
  for (let index = 0; index < values.length; index += 1) {
    squaredMagnitude += values[index] * values[index];
  }
  const magnitude = Math.sqrt(squaredMagnitude);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Embedding vector has no usable magnitude.");
  }
  return Float32Array.from(values, (value) => value / magnitude);
}

export function cosineSimilarityNormalized(left: Float32Array, right: Float32Array) {
  if (left.length !== right.length) {
    throw new Error(`Embedding dimension mismatch: ${left.length} !== ${right.length}`);
  }
  let score = 0;
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

export function mergeNormalizedEmbeddings(vectors: readonly Float32Array[]) {
  if (vectors.length === 0) {
    throw new Error("At least one embedding is required.");
  }
  if (vectors.length === 1) return vectors[0];

  const dimensions = vectors[0].length;
  const merged = new Float32Array(dimensions);
  for (const vector of vectors) {
    if (vector.length !== dimensions) {
      throw new Error("Cannot merge embeddings with different dimensions.");
    }
    for (let index = 0; index < dimensions; index += 1) {
      merged[index] += vector[index] / vectors.length;
    }
  }
  return normalizeEmbedding(merged);
}

export function chunkCuratedStyleQuery(prompt: string, maxChars = 5000) {
  const input = prompt.replace(/\s+/g, " ").trim();
  if (!input) return [];
  if (input.length <= maxChars) return [input];
  if (input.length > maxChars * 2) {
    throw new Error(`Curated style query exceeds the supported ${maxChars * 2}-character limit.`);
  }

  const midpoint = Math.ceil(input.length / 2);
  const forwardBreak = input.indexOf(" ", midpoint);
  const backwardBreak = input.lastIndexOf(" ", midpoint);
  const breakAt = forwardBreak > 0 && forwardBreak <= maxChars
    ? forwardBreak
    : backwardBreak > 0
      ? backwardBreak
      : midpoint;
  return [input.slice(0, breakAt).trim(), input.slice(breakAt).trim()];
}

export function rankCuratedStyleReferencesByEmbedding({
  prompt,
  queryVector,
  entries,
}: {
  prompt: string;
  queryVector: Float32Array;
  entries: CuratedStyleEmbeddingEntry[];
}): RankedCuratedStyleEmbedding[] {
  const constraints = extractExplicitStyleConstraints(prompt);
  return entries
    .filter(({ reference }) => isReferenceCompatibleWithPrompt(reference, prompt, constraints))
    .map(({ reference, vector }) => ({
      reference,
      similarity: cosineSimilarityNormalized(queryVector, vector),
    }))
    .sort((left, right) =>
      right.similarity - left.similarity
      || left.reference.id.localeCompare(right.reference.id));
}

export function selectCuratedStyleReferenceByEmbedding({
  prompt,
  queryVector,
  entries,
}: {
  prompt: string;
  queryVector: Float32Array;
  entries: CuratedStyleEmbeddingEntry[];
}) {
  const ranked = rankCuratedStyleReferencesByEmbedding({ prompt, queryVector, entries });
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  if (!best) {
    return { match: null, best, runnerUp, rejectionReason: "no_compatible_reference" as const };
  }
  if (best.similarity < CURATED_STYLE_MIN_SIMILARITY) {
    return { match: null, best, runnerUp, rejectionReason: "below_similarity_threshold" as const };
  }
  if (runnerUp && best.similarity - runnerUp.similarity < CURATED_STYLE_MIN_MARGIN) {
    return { match: null, best, runnerUp, rejectionReason: "insufficient_margin" as const };
  }
  return { match: best, best, runnerUp, rejectionReason: null };
}
