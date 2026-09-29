import { measureReferencePalette, type MeasuredPalette } from "@/lib/generation/reference-palette";
import type { RadiusClass } from "@/lib/types";

import {
  referenceBoxesOf,
  referenceElevationOf,
  referenceRadiusClassOf,
  type ProjectBundle,
  type ReferenceImage,
} from "./bundle";
import type { CheckOverrides } from "./render";
import { retokenBundle } from "./retoken";

export type PreparedSnapshot = {
  bundle: ProjectBundle;
  overrides: CheckOverrides;
  measured: MeasuredPalette | null;
  notes: string[];
};

/**
 * Decides what a snapshot is judged against. Measured reference colours enable the
 * tone match by default, and --retoken swaps in tokens calibrated the way
 * generation now calibrates them, without touching the stored project.
 */
export async function prepareSnapshot({
  bundle,
  image,
  overrides = {},
  retoken = false,
  radiusClass = null,
}: {
  bundle: ProjectBundle;
  image: ReferenceImage | null;
  overrides?: CheckOverrides;
  retoken?: boolean;
  radiusClass?: RadiusClass | null;
}): Promise<PreparedSnapshot> {
  const notes: string[] = [];
  const charter = bundle.project.charter;
  const measured = image
    ? await measureReferencePalette(image.bytes, referenceBoxesOf(charter)).catch(() => null)
    : null;

  const elevation = overrides.elevation ?? referenceElevationOf(charter);
  const expected = overrides.expected
    ?? (measured ? { background: measured.background.hex, card: measured.raised?.hex ?? null } : null);
  if (!overrides.expected && measured) {
    notes.push(`expected colours measured from the reference: page ${measured.background.hex}, card ${measured.raised?.hex ?? "none"}`);
  }

  let prepared = bundle;
  if (retoken) {
    const classified = radiusClass ?? referenceRadiusClassOf(charter);
    prepared = retokenBundle(bundle, {
      palette: measured,
      radiusClass: classified,
      surfaceElevation: elevation === "unknown" ? null : elevation,
    });
    notes.push(`re-tokened with the calibration: radius class ${classified ?? "unknown"}, elevation ${elevation}, palette ${measured ? "measured" : "none"}`);
  }

  return { bundle: prepared, overrides: { elevation, expected }, measured, notes };
}
