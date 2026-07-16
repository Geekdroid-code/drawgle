import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { CURATED_STYLE_REFERENCES } from "../lib/generation/curated-style-catalog";
import {
  buildCuratedStyleRetrievalDocument,
  CURATED_STYLE_EMBEDDING_DIMENSIONS,
  CURATED_STYLE_EMBEDDING_MODEL,
  CURATED_STYLE_INDEX_VERSION,
  normalizeEmbedding,
  type CuratedStyleIndexEntry,
  type CuratedStyleIndexManifest,
} from "../lib/generation/curated-style-index-core";
import { generateEmbeddings } from "../lib/generation/embeddings";

const INDEX_PATH = resolve(
  process.cwd(),
  "lib/generation/generated/curated-style-embeddings.json",
);
const CHECK_ONLY = process.argv.includes("--check");
const BATCH_SIZE = 32;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const vectorToBase64 = (vector: Float32Array) => {
  const buffer = Buffer.allocUnsafe(vector.length * Float32Array.BYTES_PER_ELEMENT);
  vector.forEach((value, index) => buffer.writeFloatLE(value, index * Float32Array.BYTES_PER_ELEMENT));
  return buffer.toString("base64");
};

const parseManifest = async (): Promise<CuratedStyleIndexManifest | null> => {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, "utf8")) as CuratedStyleIndexManifest;
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
};

const documents = CURATED_STYLE_REFERENCES.map((reference) => {
  const document = buildCuratedStyleRetrievalDocument(reference);
  return {
    id: reference.id,
    document,
    contentHash: sha256(document),
  };
});

const catalogHash = sha256(
  documents.map(({ id, contentHash }) => `${id}:${contentHash}`).join("\n"),
);

const validateManifest = (manifest: CuratedStyleIndexManifest | null) => {
  if (!manifest) return ["index file is missing or invalid"];
  const issues: string[] = [];
  if (manifest.version !== CURATED_STYLE_INDEX_VERSION) issues.push("index version is stale");
  if (manifest.model !== CURATED_STYLE_EMBEDDING_MODEL) issues.push("embedding model is stale");
  if (manifest.dimensions !== CURATED_STYLE_EMBEDDING_DIMENSIONS) issues.push("embedding dimensions are stale");
  if (manifest.catalogHash !== catalogHash) issues.push("catalog hash is stale");

  const entries = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  for (const document of documents) {
    const entry = entries.get(document.id);
    if (!entry) issues.push(`missing reference: ${document.id}`);
    else if (entry.contentHash !== document.contentHash) issues.push(`changed reference: ${document.id}`);
    else if (!entry.vector) issues.push(`empty vector: ${document.id}`);
  }
  for (const entry of manifest.entries) {
    if (!documents.some((document) => document.id === entry.id)) {
      issues.push(`deleted reference remains indexed: ${entry.id}`);
    }
  }
  return issues;
};

const sleep = (milliseconds: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const embedBatch = async (texts: string[]) => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await generateEmbeddings(texts, "RETRIEVAL_DOCUMENT");
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
};

async function main() {
  const previous = await parseManifest();
  const issues = validateManifest(previous);
  if (CHECK_ONLY) {
    if (issues.length > 0) {
      throw new Error(`Curated style embedding index is stale:\n- ${issues.join("\n- ")}`);
    }
    console.log(`Curated style embedding index is current (${documents.length} references).`);
    return;
  }

  const reusable = new Map<string, CuratedStyleIndexEntry>();
  if (
    previous?.version === CURATED_STYLE_INDEX_VERSION
    && previous.model === CURATED_STYLE_EMBEDDING_MODEL
    && previous.dimensions === CURATED_STYLE_EMBEDDING_DIMENSIONS
  ) {
    for (const entry of previous.entries) reusable.set(entry.id, entry);
  }

  const entries = new Map<string, CuratedStyleIndexEntry>();
  const pending = documents.filter((document) => {
    const entry = reusable.get(document.id);
    if (entry?.contentHash === document.contentHash && entry.vector) {
      entries.set(document.id, entry);
      return false;
    }
    return true;
  });

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    console.log(`Embedding curated styles ${start + 1}-${start + batch.length} of ${pending.length} changed entries...`);
    const embeddings = await embedBatch(batch.map((item) => item.document));
    embeddings.forEach((values, index) => {
      const item = batch[index];
      entries.set(item.id, {
        id: item.id,
        contentHash: item.contentHash,
        vector: vectorToBase64(normalizeEmbedding(values)),
      });
    });
  }

  const manifest: CuratedStyleIndexManifest = {
    version: CURATED_STYLE_INDEX_VERSION,
    model: CURATED_STYLE_EMBEDDING_MODEL,
    dimensions: CURATED_STYLE_EMBEDDING_DIMENSIONS,
    catalogHash,
    entries: documents.map((document) => {
      const entry = entries.get(document.id);
      if (!entry) throw new Error(`Unable to build embedding entry for ${document.id}.`);
      return entry;
    }),
  };

  await mkdir(dirname(INDEX_PATH), { recursive: true });
  const temporaryPath = `${INDEX_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporaryPath, INDEX_PATH);
  console.log(
    pending.length > 0
      ? `Updated curated style embedding index: ${pending.length} embedded, ${documents.length - pending.length} reused.`
      : `Curated style embedding index already current (${documents.length} references).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
