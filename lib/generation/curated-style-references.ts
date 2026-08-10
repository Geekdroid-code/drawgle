import "server-only";

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import {
  CURATED_STYLE_REFERENCES,
  type CuratedStyleReference,
} from "@/lib/generation/curated-style-catalog";
import type { PromptImagePayload } from "@/lib/types";

export { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";
export {
  matchCuratedStyleReference,
} from "@/lib/generation/curated-style-selection";
export type {
  CuratedStyleReferenceMatch,
  RankedCuratedStyleReference,
} from "@/lib/generation/curated-style-selection";

export { getCuratedStyleReferenceById } from "@/lib/generation/curated-style-catalog";

const mimeTypeForPath = (path: string) => {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
};

const fetchStyleReferenceImage = async (imageUrl: string): Promise<PromptImagePayload> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load curated style reference image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: response.headers.get("content-type") || mimeTypeForPath(imageUrl),
  };
};

const publicAssetBaseUrlCandidates = () => {
  const candidates = [
    process.env.CURATED_REFERENCE_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://drawgle.vercel.app",
  ];

  return Array.from(new Set(candidates.filter((value): value is string => Boolean(value?.trim()))))
    .map((value) => value.replace(/\/+$/, ""));
};

const loadPublicStyleReferenceImage = async (publicPath: string): Promise<PromptImagePayload> => {
  const normalizedPath = publicPath.replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.includes("..")) {
    throw new Error(`Invalid curated public image path: ${publicPath}`);
  }

  try {
    const filePath = join(process.cwd(), "public", normalizedPath);
    const data = await readFile(filePath);
    return {
      data: Buffer.from(data).toString("base64"),
      mimeType: mimeTypeForPath(filePath),
    };
  } catch (localError) {
    let lastFetchError: unknown = localError;

    for (const baseUrl of publicAssetBaseUrlCandidates()) {
      try {
        return await fetchStyleReferenceImage(`${baseUrl}/${normalizedPath}`);
      } catch (fetchError) {
        lastFetchError = fetchError;
      }
    }

    throw lastFetchError instanceof Error
      ? lastFetchError
      : new Error(`Unable to load curated public image path: ${publicPath}`);
  }
};

export async function loadCuratedStyleReferenceImage(reference: CuratedStyleReference): Promise<PromptImagePayload | null> {
  try {
    if (reference.imageUrl.startsWith("/")) {
      return await loadPublicStyleReferenceImage(reference.imageUrl);
    }

    return await fetchStyleReferenceImage(reference.imageUrl);
  } catch (error) {
    console.warn("[curated-style-reference] Unable to load image", {
      referenceId: reference.id,
      imageUrl: reference.imageUrl,
      error,
    });
    return null;
  }
}
