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
  /** The project's components (its kit, or an approved preset's), each as "name (when to use it)". */
  presetComponents?: readonly string[];
}): string | null {
  const mapping = adaptations?.trim() ? stripDesignValues(adaptations.trim()) : "";
  const names = presetComponents.map((name) => name.trim()).filter(Boolean);
  if (!mapping && names.length === 0) return null;
  return [
    mapping ? "REFERENCE COMPONENT MAPPING (the reference's components, mapped onto this product by the designer who read it)." : null,
    mapping ? "Where a screen's job fits one, name that component in KEY COMPONENTS. Never reproduce the reference's sections, their order or its content." : null,
    mapping ? `Mapping: ${mapping}` : null,
    // The builder is given each of these as markup, so a brief that names one gets exactly that component.
    names.length > 0
      ? `PROJECT COMPONENTS (every screen of this product is built from these): ${names.join(", ")}. In KEY COMPONENTS, name the one each piece of content uses, and use the same component for the same kind of content on every screen.`
      : null,
  ].filter(Boolean).join("\n");
}
