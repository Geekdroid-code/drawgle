import { describe, expect, it } from "vitest";
import { classifySelection, visibleProperties } from "./selection";
import { advanceDraft, emptyDraft, initialHistory, travelDraft, buildDraftOperations } from "./draft";
import { applyDeterministicEdits } from "@/lib/drawgle-dom";
import { validateStyleValue, resolveStyleInspection } from "@/lib/element-style-inspection";

import { selectionFixture } from "./test-fixtures";
import { colorPickerHex } from "@/lib/css-color";
describe("contextual editor contracts", () => {
  it("shows existing RGB, transparent and shorthand colors correctly in the custom picker", () => {
    expect(colorPickerHex("rgb(248, 245, 242)")).toBe("#f8f5f2");
    expect(colorPickerHex("rgba(255, 128, 0, 0.5)")).toBe("#ff8000");
    expect(colorPickerHex("rgb(100% 0% 0%)")).toBe("#ff0000");
    expect(colorPickerHex("#f8a5")).toBe("#ff88aa");
    expect(colorPickerHex("var(--project-color)")).toBeNull();
  });
  it("classifies text, semantic and link buttons, cards, flex groups and grids", () => {
    expect(classifySelection(selectionFixture("span")).kind).toBe("text");
    expect(classifySelection(selectionFixture("button")).kind).toBe("button");
    expect(classifySelection({ ...selectionFixture("a"), outerHTML: '<a role="button"><svg></svg><span>Save</span></a>' }).kind).toBe("button");
    expect(classifySelection(selectionFixture("div", { display: "flex", "background-color": "rgb(255, 255, 255)", "border-radius": "16px" })).kind).toBe("container");
    expect(classifySelection(selectionFixture("div", { display: "flex", "background-color": "transparent" })).kind).toBe("group");
    expect(classifySelection(selectionFixture("div", { display: "grid" })).grid).toBe(true);
    expect(visibleProperties.container.main).not.toContain("transform");
  });
  it("never offers the Search Radius container as an image and rejects destructive replacement", () => {
    const info = selectionFixture("div", { "border-radius": "24px" });
    expect(classifySelection(info).kind).toBe("container");
    expect(classifySelection(info).image).toBeUndefined();
    expect(() => applyDeterministicEdits({ code: '<div data-drawgle-id="card"><label>Search Radius</label><input type="range" /></div>', drawgleId: "card",
      operations: [{ type: "replaceImage", mode: "visual_placeholder", src: "https://example.com/image.png" }] })).toThrow(/explicitly marked empty/);
  });
  it("allows explicitly empty image placeholders and preserves image neighbors", () => {
    const code = '<div data-drawgle-id="root"><div data-drawgle-id="card" data-drawgle-image-placeholder></div><button>Keep</button></div>';
    const next = applyDeterministicEdits({ code, drawgleId: "card", operations: [{ type: "replaceImage", mode: "visual_placeholder", src: "https://example.com/image.png" }] });
    expect(next).toContain("<button"); expect(next).toContain("Keep</button>"); expect(next).toContain("<img");
  });
  it("protects screen roots and shared-navigation roots on the server", () => {
    expect(() => applyDeterministicEdits({ code: '<html><body><main data-drawgle-id="card">Root</main></body></html>', drawgleId: "card", operations: [{ type: "deleteElement" }] })).toThrow(/root-level/);
    expect(() => applyDeterministicEdits({ code: '<main><nav data-drawgle-id="card" data-drawgle-primary-nav>Navigation</nav></main>', drawgleId: "card", operations: [{ type: "deleteElement" }] })).toThrow(/root-level/);
  });
  it("keeps local redo after returning to the baseline and truncates the redo branch after a new edit", () => {
    const first = advanceDraft(initialHistory(), { ...emptyDraft(), styles: { "border-radius": "12px" } });
    const baseline = travelDraft(first, "undo");
    expect(baseline.present.styles).toEqual({}); expect(baseline.future).toHaveLength(1);
    expect(travelDraft(baseline, "redo").present.styles).toEqual({ "border-radius": "12px" });
    expect(advanceDraft(baseline, { ...emptyDraft(), text: { label: "New" } }).future).toEqual([]);
  });
  it("batches explicit changes and keeps icon markup when changing a child label", () => {
    const operations = buildDraftOperations({ ...emptyDraft(), text: { label: "Continue" }, styles: { "border-radius": "12px" } });
    const next = applyDeterministicEdits({ code: '<button data-drawgle-id="card"><svg><path /></svg><span data-drawgle-id="label">Save</span></button>', drawgleId: "card", operations });
    expect(next).toContain("<svg>"); expect(next).toContain("Continue</span>"); expect(operations).toHaveLength(2);
  });
  it("validates named colors and rejects malformed hex values", () => {
    expect(validateStyleValue("color", "red")).toBe("red");
    expect(validateStyleValue("color", "rebeccapurple")).toBe("rebeccapurple");
    expect(() => validateStyleValue("color", "#12345")).toThrow();
    expect(() => validateStyleValue("color", "#1234567")).toThrow();
    expect(() => validateStyleValue("color", "rgba(hello)")).toThrow();
    expect(() => validateStyleValue("color", "rgb(300, 2, 1)")).toThrow();
    expect(validateStyleValue("color", "rgb(20 30 40 / 50%)")).toBe("rgb(20 30 40 / 50%)");
  });
  it("does not describe computed value equality as a token link", () => {
    const resolved = resolveStyleInspection({ tagName: "div", classList: [], inlineStyle: {}, computedStyle: { color: "#123456" } },
      [{ name: "--dg-color-text-primary", label: "Primary", value: "#123456", path: "color.text.primary" }]);
    expect(resolved?.properties.find(property => property.property === "color")?.status).not.toBe("linked");
  });
});
