import { createHash } from "node:crypto";

import sharp from "sharp";

import type { PromptImagePayload, ReferenceMode } from "@/lib/types";

export const shouldAttachReferenceImage = ({
  engineVersion,
  screenGuidance = false,
  familyAnchor = false,
  image,
  referenceMode,
}: {
  engineVersion: "v1" | "v2";
  screenGuidance?: boolean;
  familyAnchor?: boolean;
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
}) => {
  // One first-screen style anchor lets the builder see the actual visual
  // evidence. Later siblings use the accepted family, avoiding repeated image
  // input and layout copying across the whole batch.
  return (referenceMode === "user_recreate" || screenGuidance
    || (familyAnchor && engineVersion === "v2"
      && (referenceMode === "curated_style" || referenceMode === "user_style")))
    && Boolean(image);
};

export async function normalizeReferenceImage(image: PromptImagePayload, mode: "style" | "recreate" = "style"): Promise<{
  image: PromptImagePayload;
  sha256: string;
}> {
  const input = Buffer.from(image.data, "base64");
  if (mode === "recreate") {
    // Preserve source pixels: composites otherwise lose each frame's typography
    // when the entire upload is squeezed into a 1024px preview. No upscaling.
    const source = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().webp({ lossless: true, effort: 0 }).toBuffer();
    if (source.length > 18_000_000) throw new Error("This reference is too large to inspect reliably. Supply separate screen images or a smaller composite.");
    return { image: { data: source.toString("base64"), mimeType: "image/webp" }, sha256: createHash("sha256").update(source).digest("hex") };
  }
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
