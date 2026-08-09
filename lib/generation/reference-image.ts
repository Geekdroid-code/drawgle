import { createHash } from "node:crypto";

import sharp from "sharp";

import type {
  PromptImagePayload,
  ReferenceImageAttachmentDecision,
  ReferenceMode,
  ScreenLayoutRegion,
  ReferenceTransferContract,
} from "@/lib/types";

const STYLE_REFERENCE_MODES = new Set<ReferenceMode>(["user_style", "curated_style", "internal_style"]);

export const resolveReferenceImageAttachment = ({
  image,
  referenceMode,
  referenceTransfer,
  screenLayoutRegions = [],
  featureEnabled = process.env.DRAWGLE_STYLE_REFERENCE_CALIBRATION_ENABLED !== "false",
}: {
  engineVersion?: "v1" | "v2";
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceTransfer?: ReferenceTransferContract | null;
  screenLayoutRegions?: ScreenLayoutRegion[];
  featureEnabled?: boolean;
}): ReferenceImageAttachmentDecision => {
  if (!image) {
    return {
      attach: false,
      role: null,
      reason: "No reference image is available for the builder.",
      calibrationContractVersion: null,
      featureEnabled,
    };
  }

  if (referenceMode === "user_recreate") {
    return {
      attach: true,
      role: "structural-reference",
      reason: "Image-to-UI mode uses the uploaded image as structural evidence.",
      calibrationContractVersion: null,
      featureEnabled,
    };
  }

  if (!referenceMode || !STYLE_REFERENCE_MODES.has(referenceMode)) {
    return {
      attach: false,
      role: null,
      reason: "Prompt-only builder modes cannot receive reference images.",
      calibrationContractVersion: null,
      featureEnabled,
    };
  }

  if (!featureEnabled) {
    return {
      attach: false,
      role: null,
      reason: "Style calibration image attachment is disabled by the production kill switch.",
      calibrationContractVersion: referenceTransfer?.version ?? null,
      featureEnabled,
    };
  }

  if (
    referenceTransfer?.version !== 2
    || referenceTransfer.layoutSource !== "screen-purpose"
    || screenLayoutRegions.length === 0
  ) {
    return {
      attach: false,
      role: null,
      reason: "Style image withheld because no valid version-2 screen-purpose calibration contract with named target regions was available.",
      calibrationContractVersion: referenceTransfer?.version ?? null,
      featureEnabled,
    };
  }

  return {
    attach: true,
    role: "style-calibration",
    reason: "Style image attached as region-scoped visual calibration evidence.",
    calibrationContractVersion: 2,
    featureEnabled,
  };
};

export const shouldAttachReferenceImage = ({
  engineVersion,
  image,
  referenceMode,
  referenceTransfer,
  screenLayoutRegions,
  featureEnabled,
}: {
  engineVersion: "v1" | "v2";
  image?: PromptImagePayload | null;
  referenceMode?: ReferenceMode | null;
  referenceTransfer?: ReferenceTransferContract | null;
  screenLayoutRegions?: ScreenLayoutRegion[];
  featureEnabled?: boolean;
}) => resolveReferenceImageAttachment({
  engineVersion,
  image,
  referenceMode,
  referenceTransfer,
  screenLayoutRegions,
  featureEnabled,
}).attach;

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
