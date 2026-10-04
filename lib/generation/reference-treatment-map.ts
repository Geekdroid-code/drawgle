import { stripDesignValues } from "@/lib/generation/design-value-scrub";

/**
 * How the reference dresses this product's own components, as evidence for the brief planner.
 *
 * The discovery designer reads the reference and records, in productPlanning.experience.adaptations, which of its
 * treatments dresses each of this product's components ("the search results take its inset icon wells"). It used to
 * record the opposite direction ("its metric cards → storage figures"), and the planner was told to name a reference
 * component wherever one fitted: a file manager came out as the reference's analytics dashboard, greeting and figure
 * tiles included. The product and each screen's job decide which components exist; this map only says how they
 * look. Older projects still hold mappings in the old direction, and the label below constrains those too.
 */
export function formatReferenceTreatmentMap({
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
    mapping ? "VISUAL TREATMENT MAP (how the reference dresses this product's own components, from the designer who read it)." : null,
    mapping ? "Use it to say how a screen's own components look. It never adds a component, section, figure or greeting, and never decides what a screen contains: the product and the screen's job do. Never reproduce the reference's sections, their order or its content." : null,
    mapping ? `Map: ${mapping}` : null,
    // The builder is given each of these as markup, so a brief that names one gets exactly that component.
    names.length > 0
      ? `PROJECT COMPONENTS (every screen of this product is built from these): ${names.join(", ")}. In KEY COMPONENTS, name the one each piece of content uses, and use the same component for the same kind of content on every screen.`
      : null,
  ].filter(Boolean).join("\n");
}
