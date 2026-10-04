import { describe, expect, it } from "vitest";

import { hasDesignValues } from "@/lib/generation/design-value-scrub";
import { formatReferenceTreatmentMap } from "@/lib/generation/reference-treatment-map";

describe("formatReferenceTreatmentMap", () => {
  it("labels the designer's map as how the reference dresses this product's own components", () => {
    const text = formatReferenceTreatmentMap({
      adaptations: "The item rows take the reference's inset icon wells; the filter row takes its pill chips",
    });
    expect(text).toContain("VISUAL TREATMENT MAP");
    expect(text).toContain("Map: The item rows take the reference's inset icon wells; the filter row takes its pill chips");
    expect(text).toMatch(/Never reproduce the reference's sections/);
  });

  it("never lets the map decide what a screen contains", () => {
    // older projects hold maps in the old direction, from a reference component to a product one
    const text = formatReferenceTreatmentMap({ adaptations: "Insights metric cards → storage figures" })!;
    expect(text).toContain("It never adds a component, section, figure or greeting");
    expect(text).toContain("never decides what a screen contains: the product and the screen's job do");
    expect(text).not.toContain("REFERENCE COMPONENT MAPPING");
    expect(text).not.toContain("name that component in KEY COMPONENTS");
  });

  it("lists the project's component names (its kit, or a preset's) when it has them", () => {
    const text = formatReferenceTreatmentMap({
      adaptations: null,
      presetComponents: ["Calendar strip", " Donut card ", ""],
    });
    expect(text).toContain("PROJECT COMPONENTS (every screen of this product is built from these): Calendar strip, Donut card.");
    expect(text).toContain("use the same component for the same kind of content on every screen");
    expect(text).not.toContain("Map:");
    expect(text).not.toContain("VISUAL TREATMENT MAP");
  });

  it("carries both when the designer read a reference", () => {
    const text = formatReferenceTreatmentMap({ adaptations: "Week selector takes the reference's pill segments", presetComponents: ["Week selector"] });
    expect(text).toContain("Map: Week selector takes the reference's pill segments");
    expect(text).toContain("PROJECT COMPONENTS (every screen of this product is built from these): Week selector.");
  });

  it("removes design values from the map, so the map cannot become an order", () => {
    const text = formatReferenceTreatmentMap({
      adaptations: "The selection card takes the hero card's 32px radius, #FDFBF0 fill and 4% opacity shadow",
    })!;
    expect(hasDesignValues(text)).toBe(false);
    expect(text).toContain("selection card");
  });

  it("returns nothing when there is no map to give", () => {
    expect(formatReferenceTreatmentMap({})).toBeNull();
    expect(formatReferenceTreatmentMap({ adaptations: "   " })).toBeNull();
    expect(formatReferenceTreatmentMap({ adaptations: undefined, presetComponents: [" ", ""] })).toBeNull();
  });
});
