import "server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  CURATED_STYLE_REFERENCES,
  type CuratedStyleReference,
} from "@/lib/generation/curated-style-catalog";
import {
  buildCuratedStyleRetrievalDocument,
  chunkCuratedStyleQuery,
  CURATED_STYLE_EMBEDDING_DIMENSIONS,
  CURATED_STYLE_EMBEDDING_MODEL,
  CURATED_STYLE_INDEX_VERSION,
  extractExplicitStyleConstraints,
  mergeNormalizedEmbeddings,
  normalizeEmbedding,
  rankCuratedStyleReferencesByEmbedding,
  selectCuratedStyleReferenceByEmbedding,
  type CuratedStyleEmbeddingEntry,
  type CuratedStyleIndexManifest,
  type ExplicitStyleConstraints,
  type RankedCuratedStyleEmbedding,
} from "@/lib/generation/curated-style-index-core";
import curatedStyleIndexJson from "@/lib/generation/generated/curated-style-embeddings.json";
import { generateEmbeddings } from "@/lib/generation/embeddings";
import type { LlmLogFn, PlanningMode, ProjectCharter } from "@/lib/types";

export type RankedCuratedStyleReference = RankedCuratedStyleEmbedding;

export type CuratedStyleReferenceMatch = RankedCuratedStyleReference & {
  score: number;
  runnerUp: { referenceId: string; similarity: number } | null;
  constraints: ExplicitStyleConstraints;
  catalogHash: string;
};

export type RuntimeIndexEntry = CuratedStyleEmbeddingEntry;

export type RuntimeIndex = {
  catalogHash: string;
  entries: RuntimeIndexEntry[];
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const contentHashForReference = (reference: CuratedStyleReference) =>
  sha256(buildCuratedStyleRetrievalDocument(reference));

const expectedCatalogHash = () =>
  sha256(
    CURATED_STYLE_REFERENCES
      .map((reference) => `${reference.id}:${contentHashForReference(reference)}`)
      .join("\n"),
  );

const decodeVector = (encoded: string) => {
  const buffer = Buffer.from(encoded, "base64");
  const expectedBytes = CURATED_STYLE_EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(`Curated style vector has ${buffer.byteLength} bytes; expected ${expectedBytes}.`);
  }
  const vector = new Float32Array(CURATED_STYLE_EMBEDDING_DIMENSIONS);
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = buffer.readFloatLE(index * Float32Array.BYTES_PER_ELEMENT);
  }
  return vector;
};

let runtimeIndex: RuntimeIndex | null | undefined;

function loadRuntimeIndex(): RuntimeIndex | null {
  if (runtimeIndex !== undefined) return runtimeIndex;

  try {
    const manifest = curatedStyleIndexJson as CuratedStyleIndexManifest;
    if (
      manifest.version !== CURATED_STYLE_INDEX_VERSION
      || manifest.model !== CURATED_STYLE_EMBEDDING_MODEL
      || manifest.dimensions !== CURATED_STYLE_EMBEDDING_DIMENSIONS
      || manifest.catalogHash !== expectedCatalogHash()
    ) {
      throw new Error("Curated style embedding index metadata is stale.");
    }

    const references = new Map(CURATED_STYLE_REFERENCES.map((reference) => [reference.id, reference]));
    const entries = manifest.entries.map((entry) => {
      const reference = references.get(entry.id);
      if (!reference) throw new Error(`Curated style index contains unknown reference ${entry.id}.`);
      if (entry.contentHash !== contentHashForReference(reference)) {
        throw new Error(`Curated style index entry is stale for ${entry.id}.`);
      }
      return { reference, vector: decodeVector(entry.vector) };
    });
    if (entries.length !== CURATED_STYLE_REFERENCES.length) {
      throw new Error("Curated style embedding index does not cover the complete catalogue.");
    }

    runtimeIndex = { catalogHash: manifest.catalogHash, entries };
  } catch (error) {
    console.error("[curated-style-reference] Embedding index unavailable", error);
    runtimeIndex = null;
  }
  return runtimeIndex;
}

function resolveCuratedStyleReferenceByEmbedding({
  prompt,
  queryVector,
  index,
}: {
  prompt: string;
  queryVector: Float32Array;
  index: RuntimeIndex;
}): CuratedStyleReferenceMatch | null {
  const result = selectCuratedStyleReferenceByEmbedding({
    prompt,
    queryVector,
    entries: index.entries,
  });
  if (!result.match) return null;

  return {
    ...result.match,
    score: Math.round(result.match.similarity * 100),
    runnerUp: result.runnerUp
      ? { referenceId: result.runnerUp.reference.id, similarity: result.runnerUp.similarity }
      : null,
    constraints: extractExplicitStyleConstraints(prompt),
    catalogHash: index.catalogHash,
  };
}

export async function matchCuratedStyleReference(input: {
  prompt: string;
  planningMode?: PlanningMode;
  existingCharter?: ProjectCharter | null;
  llmLog?: LlmLogFn;
}): Promise<CuratedStyleReferenceMatch | null> {
  const prompt = input.prompt.trim();
  if (!prompt) return null;

  const index = loadRuntimeIndex();
  if (!index) {
    input.llmLog?.("[CURATED STYLE SELECTION] unavailable", {
      selector: "embedding-v1",
      reason: "index_unavailable",
    });
    return null;
  }

  try {
    const chunks = chunkCuratedStyleQuery(prompt);
    const rawEmbeddings = await generateEmbeddings(chunks, "RETRIEVAL_QUERY");
    const queryVector = mergeNormalizedEmbeddings(rawEmbeddings.map(normalizeEmbedding));
    const selection = selectCuratedStyleReferenceByEmbedding({
      prompt,
      queryVector,
      entries: index.entries,
    });
    const match = resolveCuratedStyleReferenceByEmbedding({ prompt, queryVector, index });
    const best = selection.best;
    const runnerUp = selection.runnerUp;
    const rejectionReason = match ? null : selection.rejectionReason;

    input.llmLog?.("[CURATED STYLE SELECTION] resolved", {
      selector: "embedding-v1",
      model: CURATED_STYLE_EMBEDDING_MODEL,
      catalogHash: index.catalogHash,
      queryChunks: chunks.length,
      referenceId: match?.reference.id ?? null,
      topCandidateId: best?.reference.id ?? null,
      similarity: match?.similarity ?? best?.similarity ?? null,
      runnerUp: match?.runnerUp ?? (
        runnerUp ? { referenceId: runnerUp.reference.id, similarity: runnerUp.similarity } : null
      ),
      constraints: extractExplicitStyleConstraints(prompt),
      rejectionReason,
    });
    return match;
  } catch (error) {
    console.warn("[curated-style-reference] Embedding query failed", error);
    input.llmLog?.("[CURATED STYLE SELECTION] unavailable", {
      selector: "embedding-v1",
      model: CURATED_STYLE_EMBEDDING_MODEL,
      catalogHash: index.catalogHash,
      reason: "embedding_query_failed",
    });
    return null;
  }
}
