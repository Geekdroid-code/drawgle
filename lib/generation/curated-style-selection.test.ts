import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  assertCuratedStyleCatalog,
  CURATED_STYLE_REFERENCES,
} from "@/lib/generation/curated-style-catalog";
import {
  buildCuratedStyleRetrievalDocument,
  chunkCuratedStyleQuery,
  CURATED_STYLE_EMBEDDING_DIMENSIONS,
  CURATED_STYLE_EMBEDDING_MODEL,
  CURATED_STYLE_INDEX_VERSION,
  extractExplicitStyleConstraints,
  isReferenceCompatibleWithPrompt,
  normalizeEmbedding,
  promptExplicitlyRequestsTerm,
  rankCuratedStyleReferencesByEmbedding,
  selectCuratedStyleReferenceByEmbedding,
  type CuratedStyleEmbeddingEntry,
} from "@/lib/generation/curated-style-index-core";
import curatedStyleIndexJson from "@/lib/generation/generated/curated-style-embeddings.json";

const vectorWithSimilarity = (similarity: number) => {
  const vector = new Float32Array(CURATED_STYLE_EMBEDDING_DIMENSIONS);
  vector[0] = similarity;
  vector[1] = Math.sqrt(1 - similarity ** 2);
  return normalizeEmbedding(vector);
};

const queryVector = vectorWithSimilarity(1);

describe("curated style embedding selection", () => {
  it("keeps the expanded catalogue valid and fully represented in the generated index", () => {
    expect(CURATED_STYLE_REFERENCES.length).toBeGreaterThanOrEqual(56);
    expect(() => assertCuratedStyleCatalog(CURATED_STYLE_REFERENCES)).not.toThrow();
    expect(curatedStyleIndexJson.version).toBe(CURATED_STYLE_INDEX_VERSION);
    expect(curatedStyleIndexJson.model).toBe(CURATED_STYLE_EMBEDDING_MODEL);
    expect(curatedStyleIndexJson.dimensions).toBe(CURATED_STYLE_EMBEDDING_DIMENSIONS);
    expect(curatedStyleIndexJson.entries).toHaveLength(CURATED_STYLE_REFERENCES.length);
    expect(new Set(curatedStyleIndexJson.entries.map((entry) => entry.id)).size)
      .toBe(CURATED_STYLE_REFERENCES.length);

    for (const entry of curatedStyleIndexJson.entries) {
      expect(Buffer.from(entry.vector, "base64").byteLength)
        .toBe(CURATED_STYLE_EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT);
    }
  });

  it("builds retrieval text from authored visual metadata without URLs or negative tags", () => {
    const reference = CURATED_STYLE_REFERENCES.find(
      (candidate) => candidate.id === "finance-light-soft-banking-home",
    )!;
    const document = buildCuratedStyleRetrievalDocument(reference);

    expect(document).toContain(reference.styleIntent);
    expect(document).toContain("Suitable product archetypes");
    expect(document).not.toContain(reference.imageUrl);
    expect(document).not.toContain("incompatible");
    expect(document).not.toContain("professional");
  });

  it("preserves a long submitted prompt in at most two embedding chunks", () => {
    const prompt = Array.from({ length: 600 }, (_, index) => `requirement-${index}`).join(" ");
    const chunks = chunkCuratedStyleQuery(prompt);

    expect(chunks).toHaveLength(2);
    expect(chunks.join(" ")).toBe(prompt);
    expect(chunks.every((chunk) => chunk.length <= 5000)).toBe(true);
  });

  it("extracts only stable explicit theme and density constraints", () => {
    expect(extractExplicitStyleConstraints("Build a dark, information-dense monitoring dashboard."))
      .toEqual({ theme: "dark", density: "dense" });
    expect(extractExplicitStyleConstraints("Create the app without deciding light or dark mode."))
      .toEqual({ theme: "unspecified", density: "unspecified" });
  });

  it("does not treat a negated term as a requested incompatibility", () => {
    expect(promptExplicitlyRequestsTerm("Use glassmorphism", "glassmorphism")).toBe(true);
    expect(promptExplicitlyRequestsTerm("Use no glassmorphism", "glassmorphism")).toBe(false);
    expect(promptExplicitlyRequestsTerm("Avoid heavy shadows", "heavy-shadows")).toBe(false);
  });

  it("rejects explicit theme, density, and authored incompatibility conflicts", () => {
    const finance = CURATED_STYLE_REFERENCES.find(
      (candidate) => candidate.id === "finance-light-soft-banking-home",
    )!;

    expect(isReferenceCompatibleWithPrompt(finance, "A dark personal finance app")).toBe(false);
    expect(isReferenceCompatibleWithPrompt(finance, "An airy personal finance app")).toBe(false);
    expect(isReferenceCompatibleWithPrompt(finance, "A professional personal finance app")).toBe(false);
    expect(isReferenceCompatibleWithPrompt(finance, "A friendly personal finance app")).toBe(true);
  });

  it("ranks compatible candidates by cosine similarity", () => {
    const darkReferences = CURATED_STYLE_REFERENCES.filter(
      (reference) => reference.selectionProfile.theme === "dark",
    ).slice(0, 2);
    const ranked = rankCuratedStyleReferencesByEmbedding({
      prompt: "Create a dark interface",
      queryVector,
      entries: [
        { reference: darkReferences[0], vector: vectorWithSimilarity(0.82) },
        { reference: darkReferences[1], vector: vectorWithSimilarity(0.71) },
      ],
    });

    expect(ranked.map((candidate) => candidate.reference.id))
      .toEqual(darkReferences.map((reference) => reference.id));
  });

  it("accepts a strong winner and fails closed for weak or ambiguous matches", () => {
    const darkReferences = CURATED_STYLE_REFERENCES.filter(
      (reference) => reference.selectionProfile.theme === "dark",
    ).slice(0, 2);
    const buildEntries = (best: number, runnerUp: number): CuratedStyleEmbeddingEntry[] => [
        { reference: darkReferences[0], vector: vectorWithSimilarity(best) },
        { reference: darkReferences[1], vector: vectorWithSimilarity(runnerUp) },
      ];

    expect(selectCuratedStyleReferenceByEmbedding({
      prompt: "Create a dark interface",
      queryVector,
      entries: buildEntries(0.78, 0.70),
    }).match?.reference.id).toBe(darkReferences[0].id);

    expect(selectCuratedStyleReferenceByEmbedding({
      prompt: "Create a dark interface",
      queryVector,
      entries: buildEntries(0.54, 0.40),
    }).match).toBeNull();

    expect(selectCuratedStyleReferenceByEmbedding({
      prompt: "Create a dark interface",
      queryVector,
      entries: buildEntries(0.78, 0.77),
    }).match).toBeNull();
  });
});
