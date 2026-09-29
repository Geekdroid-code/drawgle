import { CURATED_STYLE_REFERENCES } from "@/lib/generation/curated-style-catalog";

const readable = (tags: readonly string[]) => tags.map((tag) => tag.replace(/-/g, " ")).join(", ");

/**
 * What the catalogue's curator recorded about a reference's typeface and density when it was added to the
 * library. A model that reads a picture can take a geometric sans for a serif, or a tidy 16px grid for
 * "generous whitespace" (the analysis of the mindfulness reference did both), and nothing downstream can tell.
 * The curator's notes are the check on that, for a reference that has them. They are text for the model, not
 * a value: the analysis and the tokens are still the model's reading of the image.
 */
export function curatedReferenceNotes(referenceId?: string | null): string | null {
  const reference = referenceId ? CURATED_STYLE_REFERENCES.find((entry) => entry.id === referenceId) : null;
  if (!reference) return null;

  const { typographyCharacter, density } = reference.selectionProfile;
  return [
    "CURATOR'S NOTES for this reference, recorded when it was added to the library:",
    `- Typography character: ${readable(typographyCharacter)}.`,
    `- Density: ${density}.`,
    "Your description of the typeface and of the spacing must agree with these notes unless the image clearly contradicts them.",
  ].join("\n");
}
