import { stripDesignValues } from "@/lib/generation/design-value-scrub";

/**
 * The reference's component vocabulary, mapped onto this product, as evidence for
 * the brief planner.
 *
 * The discovery designer reads the reference and records lines such as "Mood
 * History row → Pet Selection row" or "Emotional Check-ins chart → Health Progress
 * donut" in productPlanning.experience.adaptations. That used to reach the planner
 * only as one field of a JSON dump labelled optional guidance, so no brief said
 * "use the calendar strip for the week selector" or "the donut card for vaccination
 * status". Presets (a curated reference's own component names) can be added to it.
 */
export function formatReferenceComponentMapping({
  adaptations,
  presetComponents = [],
}: {
  adaptations?: string | null;
  /** Names of the reference's reusable components, from an approved curated style preset. */
  presetComponents?: readonly string[];
}): string | null {
  const mapping = adaptations?.trim() ? stripDesignValues(adaptations.trim()) : "";
  const names = presetComponents.map((name) => name.trim()).filter(Boolean);
  if (!mapping && names.length === 0) return null;
  return [
    "REFERENCE COMPONENT MAPPING (the reference's components, mapped onto this product by the designer who read it).",
    "Where a screen's job fits one, name that component in KEY COMPONENTS. Never reproduce the reference's sections, their order or its content.",
    mapping ? `Mapping: ${mapping}` : null,
    names.length > 0 ? `Reference components available: ${names.join(", ")}.` : null,
  ].filter(Boolean).join("\n");
}
