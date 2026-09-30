import { Buffer } from "node:buffer";

import { describeSurfaceClasses } from "@/lib/generation/design-classes";
import { measureReferencePalette, type MeasuredPalette, type NormalizedBox } from "@/lib/generation/reference-palette";
import type { ReferenceAnalysis, ReferenceMode, PromptImagePayload } from "@/lib/types";

/** What the token model is told about the reference's colours. Hex belongs here: tokens are hex. */
export function formatMeasuredColors(
  palette: MeasuredPalette,
  classes: Pick<ReferenceAnalysis, "radiusClass" | "surfaceElevation"> = {},
) {
  const shape = describeSurfaceClasses(classes);
  return [
    "MEASURED COLORS (from the reference pixels; authoritative).",
    "Assign token roles from these colours and do not invent hues. Explicit user colours in the requirements override them for the roles the user named.",
    `- Theme: ${palette.theme}`,
    `- Page (color.background.primary): ${palette.background.hex}`,
    palette.raised
      ? `- Raised card surface (color.surface.card): ${palette.raised.hex}, one tone step from the page`
      : "- Raised card surface: none measured; use a neutral one tone step from the page",
    palette.inset
      ? `- Inset tile or field inside a card (color.surface.inset): ${palette.inset.hex}`
      : "- Inset tile or field: none measured; use one tone step from the card",
    palette.accents.length > 0
      ? `- Accent colours, most prominent first (action colours, tints, focal fills): ${palette.accents.map((accent) => accent.hex).join(", ")}`
      : "- Accent colours: none measured; keep the accent restrained",
    `- Darkest ink: ${palette.ink.hex}`,
    ...(shape.length > 0
      ? [`- Shape and depth (words only; code sets the radius and the shadows): ${shape.join("; ")}`]
      : []),
  ].join("\n");
}

const isFiniteBox = (box: unknown): box is NormalizedBox => {
  const value = box as Partial<NormalizedBox> | null | undefined;
  return Boolean(value) && [value?.x, value?.y, value?.width, value?.height].every((part) => typeof part === "number" && Number.isFinite(part));
};

/**
 * Measures a style reference for the token step. Image-to-UI reproduces its source
 * instead of borrowing a style, and prompt-only projects have no image, so both
 * get no palette. A measurement that cannot be made is not an error: the token
 * model then works from the analysis alone, as before.
 */
export async function measureStyleReferencePalette({
  image,
  referenceMode,
  referenceAnalysis,
  onError,
}: {
  image?: PromptImagePayload | null;
  referenceMode: ReferenceMode;
  referenceAnalysis?: ReferenceAnalysis | null;
  onError?: (message: string) => void;
}): Promise<MeasuredPalette | null> {
  if (!image?.data || referenceMode === "user_recreate" || referenceMode === "internal_style") return null;
  const boxes = (referenceAnalysis?.screenReferences ?? []).map((screen) => screen.boundingBox).filter(isFiniteBox);
  try {
    return await measureReferencePalette(Buffer.from(image.data, "base64"), boxes);
  } catch (error) {
    onError?.(error instanceof Error ? error.message : "The reference palette could not be measured.");
    return null;
  }
}
