import { describe, expect, it } from "vitest";

import { formatProductAnatomy, normalizeProductAnatomy, productAnatomySchema } from "./product-anatomy";

const anatomy = {
  kind: "A personal document manager for people who keep work and life papers in one place",
  components: [
    { name: "document-row", shows: "One document in any listing", form: "A compact row: type icon, name, size and date in quiet metadata, a trailing more button; hairlines between rows" },
    { name: "folder-tile", shows: "One folder", form: "A small tile with a folder glyph, name and item count, two to a row" },
  ],
  conventions: ["Sort by name, date or size", "Switch between list and grid", "Select several documents to act on together"],
  avoid: ["A greeting and summary figures on the first screen"],
};

describe("normalizeProductAnatomy", () => {
  it("keeps a well-formed anatomy as it is", () => {
    expect(normalizeProductAnatomy(anatomy)).toEqual(anatomy);
    expect(productAnatomySchema.parse(normalizeProductAnatomy(anatomy))).toEqual(anatomy);
  });

  it("names components in kebab case, drops unnamed, formless and repeated ones, and keeps at most eight", () => {
    const read = normalizeProductAnatomy({ ...anatomy, components: [
      { name: "Document Row", shows: "One document", form: "A compact row" },
      { name: "document row", shows: "Again", form: "A card" },
      { name: "", shows: "Nameless", form: "A tile" },
      { name: "empty-form", shows: "Formless", form: "  " },
      ...Array.from({ length: 10 }, (_, index) => ({ name: `part ${index}`, shows: "", form: "A row" })),
    ] })!;
    expect(read.components[0]).toEqual({ name: "document-row", shows: "One document", form: "A compact row" });
    expect(read.components.map(component => component.name)).not.toContain("empty-form");
    expect(read.components).toHaveLength(8);
    // a component without what it shows is described by its name
    expect(read.components[1]).toEqual({ name: "part-0", shows: "part 0", form: "A row" });
  });

  it("clips and de-duplicates the lists, and keeps them optional", () => {
    const read = normalizeProductAnatomy({ ...anatomy, conventions: ["a", "a", "b", "c", "d", "e", "f", "g"], avoid: "nothing" })!;
    expect(read.conventions).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(read.avoid).toEqual([]);
  });

  it("keeps design values out, so that structure never carries an order for how it looks", () => {
    // what a live run wrote into an invoice tracker's anatomy
    const read = normalizeProductAnatomy({ ...anatomy, components: [
      { name: "data-card", shows: "Financial figures", form: "White rounded card with a 12px radius, subtle 4px blur shadow and #1E3A8A accents" },
    ] })!;
    expect(read.components[0].form).not.toMatch(/12px|4px|#1E3A8A/i);
    expect(read.components[0].form).toContain("White rounded card");
  });

  it("gives nothing when there is no kind or no usable component, so the plan keeps the behaviour from before", () => {
    expect(normalizeProductAnatomy(undefined)).toBeUndefined();
    expect(normalizeProductAnatomy("an app")).toBeUndefined();
    expect(normalizeProductAnatomy({ ...anatomy, kind: " " })).toBeUndefined();
    expect(normalizeProductAnatomy({ ...anatomy, components: [{ name: "row", shows: "x", form: "" }] })).toBeUndefined();
  });
});

describe("formatProductAnatomy", () => {
  it("says the anatomy decides the components and their form, and a reference only their look", () => {
    const text = formatProductAnatomy(anatomy)!;
    expect(text).toContain("PRODUCT ANATOMY (how this kind of product is built: it decides which components exist and the form each takes. A style reference only decides how they look.)");
    expect(text).toContain(`Kind: ${anatomy.kind}`);
    expect(text).toContain("- document-row: One document in any listing. Form: A compact row: type icon");
    expect(text).toContain("People expect: Sort by name, date or size; Switch between list and grid");
    expect(text).toContain("Avoid, because it would read as another kind of app: A greeting and summary figures on the first screen");
  });

  it("is nothing for a plan without one", () => {
    expect(formatProductAnatomy(undefined)).toBeNull();
    expect(formatProductAnatomy(null)).toBeNull();
    expect(formatProductAnatomy({ ...anatomy, conventions: [], avoid: [] })).not.toMatch(/People expect|Avoid/);
  });
});
