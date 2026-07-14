import { createHash } from "node:crypto";

import sharp from "sharp";

import type { PromptImagePayload, ReferenceMode } from "@/lib/types";

export const shouldAttachReferenceImage = ({
  engineVersion,
  image,
  referenceMode,
}: {
  engineVersion: "v1" | "v2";
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
}) => engineVersion === "v2" ? Boolean(image) : referenceMode === "user_recreate" && Boolean(image);

export async function normalizeReferenceImage(image: PromptImagePayload): Promise<{
  image: PromptImagePayload;
  sha256: string;
}> {
  const input = Buffer.from(image.data, "base64");
  const normalized = await sharp(input)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();

  return {
    image: { data: normalized.toString("base64"), mimeType: "image/webp" },
    sha256: createHash("sha256").update(normalized).digest("hex"),
  };
}
