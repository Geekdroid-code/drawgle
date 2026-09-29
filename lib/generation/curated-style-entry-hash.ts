import { createHash } from "node:crypto";

import type { CuratedStyleReference } from "@/lib/generation/curated-style-catalog";
import { buildCuratedStyleRetrievalDocument } from "@/lib/generation/curated-style-index-core";

/**
 * Changes when a catalogue entry's text, its image address or its id changes, so an edited entry
 * invalidates the preset that was built from it. Kept apart from the presets file so that anything
 * that only needs the hash does not load the presets.
 */
export const curatedStyleEntryHash = (reference: CuratedStyleReference) =>
  createHash("sha256")
    .update([reference.id, reference.imageUrl, buildCuratedStyleRetrievalDocument(reference)].join("\n"))
    .digest("hex");
