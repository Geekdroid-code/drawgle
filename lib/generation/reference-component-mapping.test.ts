import { describe, expect, it } from "vitest";

import { hasDesignValues } from "@/lib/generation/design-value-scrub";
import { formatReferenceComponentMapping } from "@/lib/generation/reference-component-mapping";

describe("formatReferenceComponentMapping", () => {
  it("labels the designer's mapping as its own evidence for the brief planner", () => {
    const text = formatReferenceComponentMapping({
      adaptations: "Mood History row → Pet Selection row; Emotional Check-ins chart → Health Progress donut",
    });
    expect(text).toContain("REFERENCE COMPONENT MAPPING");
    expect(text).toContain("name that component in KEY COMPONENTS");
    expect(text).toContain("Mood History row → Pet Selection row");
    expect(text).toContain("Emotional Check-ins chart → Health Progress donut");
    expect(text).toMatch(/Never reproduce the reference's sections/);
  });

  it("lists a curated preset's component names when it has them", () => {
    const text = formatReferenceComponentMapping({
      adaptations: null,
      presetComponents: ["Calendar strip", " Donut card ", ""],
    });
    expect(text).toContain("Reference components available: Calendar strip, Donut card.");
    expect(text).not.toContain("Mapping:");
  });

  it("carries both when the designer mapped a curated reference", () => {
    const text = formatReferenceComponentMapping({ adaptations: "Calendar strip → week selector", presetComponents: ["Calendar strip"] });
    expect(text).toContain("Mapping: Calendar strip → week selector");
    expect(text).toContain("Reference components available: Calendar strip.");
  });

  it("removes design values from the mapping, so the mapping cannot become an order", () => {
    const text = formatReferenceComponentMapping({
      adaptations: "Hero card with a 32px radius and #FDFBF0 fill → Pet Selection card, 4% opacity shadow",
    })!;
    expect(hasDesignValues(text)).toBe(false);
    expect(text).toContain("Pet Selection card");
  });

  it("returns nothing when there is no mapping to give", () => {
    expect(formatReferenceComponentMapping({})).toBeNull();
    expect(formatReferenceComponentMapping({ adaptations: "   " })).toBeNull();
    expect(formatReferenceComponentMapping({ adaptations: undefined, presetComponents: [" ", ""] })).toBeNull();
  });
});
