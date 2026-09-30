import { describe, expect, it } from "vitest";

import {
  formatStyleComponents,
  MAX_STYLE_COMPONENT_HTML_CHARS,
  MAX_STYLE_COMPONENTS,
  MAX_STYLE_COMPONENTS_BLOCK_CHARS,
  SPECIMEN_MARKING_INSTRUCTION,
  styleComponentsOf,
  styleComponentsSchema,
  usableStyleComponents,
} from "@/lib/generation/style-components";
import type { ProjectReferenceDna } from "@/lib/types";

const stat = {
  name: "stat-tile-pair",
  use: "Two counts side by side, for example meals and meds",
  html: `<div class="grid grid-cols-2 gap-[var(--dg-spacing-sm)]">
    <div class="dg-surface-card dg-radius-app p-[var(--dg-spacing-md)]"><p class="dg-type-caption dg-text-medium">Meals</p><p class="dg-type-metric-value">3</p></div>
  </div>`,
};

const withHtml = (index: number, size: number) => ({
  name: `component-${index}`,
  use: `Use ${index}`,
  html: `<div class="c${index}">${"x".repeat(size)}</div>`,
});

describe("formatStyleComponents", () => {
  it("writes one line per component as name — when to use it — html, under the rules", () => {
    const block = formatStyleComponents([stat])!;
    const lines = block.split("\n");

    expect(lines[0]).toContain("STYLE COMPONENTS");
    expect(lines[0]).toContain("name — when to use it — html");
    expect(block).toContain("Build this screen from these components wherever they fit its job");
    // the same content is drawn with the same component on every screen: that is what makes a project consistent
    expect(block).toContain("the same kind of content uses the same component on every screen");
    expect(block).toContain("must use the same surface ladder, radius roles, type roles and spacing");
    expect(block).toContain("never reproduce a reference's sections or their order");
    const componentLines = lines.filter((line) => line.startsWith("- "));
    expect(componentLines).toHaveLength(1);
    expect(componentLines[0].startsWith("- stat-tile-pair — Two counts side by side, for example meals and meds — <div")).toBe(true);
    // the components come after the rules
    expect(lines.indexOf(componentLines[0])).toBe(lines.length - 1);
  });

  it("puts each component on a single line", () => {
    const block = formatStyleComponents([stat])!;
    expect(block.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(1);
    expect(block).not.toMatch(/\n\s+<div/);
    expect(block).toContain('<div class="grid grid-cols-2 gap-[var(--dg-spacing-sm)]"> <div class="dg-surface-card');
  });

  it("caps the block at ten components", () => {
    const many = Array.from({ length: 14 }, (_, index) => withHtml(index + 1, 20));
    const block = formatStyleComponents(many)!;
    const lines = block.split("\n").filter((line) => line.startsWith("- "));
    expect(lines).toHaveLength(MAX_STYLE_COMPONENTS);
    expect(lines[0]).toContain("component-1 —");
    expect(lines[9]).toContain("component-10 —");
    expect(block).not.toContain("component-11");
  });

  it("asks the specimen build for composed units, not a flood of chips, and for no navigation of its own", () => {
    // the first mindfulness build marked ten atoms and left its card, search field and highlighted row out
    expect(SPECIMEN_MARKING_INSTRUCTION).toContain("Mark composed units, because they carry the design");
    expect(SPECIMEN_MARKING_INSTRUCTION).toContain("at most eight in all, and never the same look twice");
    expect(SPECIMEN_MARKING_INSTRUCTION).toContain("Mark a chip, badge or button on its own only when it appears outside every unit you marked");
    expect(SPECIMEN_MARKING_INSTRUCTION).toContain("under about 900 characters");
    // the limit is above that, so that a build that goes over a little is not lost
    expect(MAX_STYLE_COMPONENT_HTML_CHARS).toBeGreaterThan(900);
    expect(SPECIMEN_MARKING_INSTRUCTION).toContain("do not draw a status bar or the bottom navigation, although the image shows them");
  });

  it("stays inside the size budget by leaving out whole components, never by cutting markup", () => {
    // ten components of 1000 characters would be about 10.5k characters with their names and uses
    const large = Array.from({ length: 10 }, (_, index) => withHtml(index + 1, 1000));
    const block = formatStyleComponents(large)!;
    expect(block.length).toBeLessThanOrEqual(MAX_STYLE_COMPONENTS_BLOCK_CHARS);
    const lines = block.split("\n").filter((line) => line.startsWith("- "));
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.length).toBeLessThan(10);
    // every line that made it is complete
    for (const line of lines) expect(line.endsWith("</div>")).toBe(true);
    // the ones left out are the last ones
    expect(block).toContain(`component-${lines.length} —`);
    expect(block).not.toContain(`component-${lines.length + 1} —`);
  });

  it("leaves out anything malformed or over the per-component limit", () => {
    const block = formatStyleComponents([
      { name: "", use: "No name", html: "<div></div>" },
      { name: "no-use", use: " ", html: "<div></div>" },
      { name: "no-html", use: "Nothing to copy", html: "" },
      { name: "too-long", use: "Over the limit", html: `<div>${"x".repeat(MAX_STYLE_COMPONENT_HTML_CHARS)}</div>` },
      { name: "not-strings", use: 4, html: {} },
      null,
      "text",
      { name: "kept", use: "The one that is valid", html: "<span>ok</span>" },
    ])!;
    const lines = block.split("\n").filter((line) => line.startsWith("- "));
    expect(lines).toEqual(["- kept — The one that is valid — <span>ok</span>"]);
  });

  it("does not let a dash inside a name or a use read as another field", () => {
    const [component] = usableStyleComponents([{ name: "week — strip", use: "Pick a day – any day", html: "<div></div>" }]);
    expect(component.name).toBe("week - strip");
    expect(component.use).toBe("Pick a day - any day");
  });

  it("gives nothing when there is nothing to show", () => {
    expect(formatStyleComponents([])).toBeNull();
    expect(formatStyleComponents(null)).toBeNull();
    expect(formatStyleComponents(undefined)).toBeNull();
    expect(formatStyleComponents("<div></div>")).toBeNull();
    expect(formatStyleComponents([{ name: "x" }])).toBeNull();
  });
});

describe("style component data", () => {
  it("validates what a preset stores: at most ten, each with its markup under the limit", () => {
    expect(styleComponentsSchema.safeParse([stat]).success).toBe(true);
    expect(styleComponentsSchema.safeParse(Array.from({ length: 11 }, (_, index) => withHtml(index, 10))).success).toBe(false);
    expect(styleComponentsSchema.safeParse([{ ...stat, html: "x".repeat(MAX_STYLE_COMPONENT_HTML_CHARS + 1) }]).success).toBe(false);
    expect(styleComponentsSchema.safeParse([{ name: "x", use: "y" }]).success).toBe(false);
  });

  it("reads the components a project's reference DNA carries", () => {
    const dna = { specimen: { source: "preset", components: [stat, { name: "", use: "x", html: "<i></i>" }] } } as unknown as ProjectReferenceDna;
    expect(styleComponentsOf(dna).map((component) => component.name)).toEqual(["stat-tile-pair"]);
    expect(styleComponentsOf({} as ProjectReferenceDna)).toEqual([]);
    expect(styleComponentsOf(null)).toEqual([]);
    expect(styleComponentsOf(undefined)).toEqual([]);
  });
});
