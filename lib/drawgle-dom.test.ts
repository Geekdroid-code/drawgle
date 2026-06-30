import { describe, expect, it } from "vitest";

import { applyDeterministicEdits } from "@/lib/drawgle-dom";

describe("drawgle deterministic edit operations", () => {
  it("sets class utilities by replacing conflicting utilities in the same family", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button" class="block flex text-red-500">Save</button></div>`;

    const result = applyDeterministicEdits({
      code,
      drawgleId: "dg-button",
      operations: [{ type: "setClassUtility", family: "display", className: "grid" }],
    });

    expect(result).toContain('class="text-red-500 grid"');
    expect(result).not.toContain("block flex");
  });

  it("replaces raw class lists while preserving Tailwind arbitrary class quotes", () => {
    const code = `<div data-drawgle-id="dg-root"><p data-drawgle-id="dg-copy" class="text-sm">Copy</p></div>`;

    const result = applyDeterministicEdits({
      code,
      drawgleId: "dg-copy",
      operations: [{ type: "replaceClassList", className: "font-['Inter'] text-center text-center" }],
    });

    expect(result).toContain(`class="font-['Inter'] text-center"`);
  });

  it("sets manual style overrides without rewriting existing classes", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button" class="p-4 rounded-xl border border-red-500 bg-gradient-to-r from-red-500 to-blue-500" style="color: #111111; opacity: 0.8">Save</button></div>`;

    const result = applyDeterministicEdits({
      code,
      drawgleId: "dg-button",
      operations: [
        { type: "setStyle", property: "padding-top", value: "24px" },
        { type: "setStyle", property: "border-top-left-radius", value: "4px" },
        { type: "setStyle", property: "border-top-width", value: "4px" },
        { type: "setStyle", property: "background-color", value: "#ff0000" },
        { type: "setStyle", property: "opacity", value: "0.5" },
        { type: "setStyle", property: "box-shadow", value: "none" },
      ],
    });

    expect(result).toContain('class="p-4 rounded-xl border border-red-500 bg-gradient-to-r from-red-500 to-blue-500"');
    expect(result).toContain('color: #111111');
    expect(result).toContain('padding-top: 24px');
    expect(result).toContain('border-top-left-radius: 4px');
    expect(result).toContain('border-top-width: 4px');
    expect(result).toContain('background-color: #ff0000');
    expect(result).toContain('opacity: 0.5');
    expect(result).toContain('box-shadow: none');
  });

  it("updates and clears individual style declarations without dropping unrelated styles", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button" style="color: #111111; opacity: 0.8">Save</button></div>`;

    const updated = applyDeterministicEdits({
      code,
      drawgleId: "dg-button",
      operations: [{ type: "setStyle", property: "opacity", value: "0.5" }],
    });

    expect(updated).toContain('style="color: #111111; opacity: 0.5"');

    const clearedOne = applyDeterministicEdits({
      code: updated,
      drawgleId: "dg-button",
      operations: [{ type: "clearStyle", property: "opacity" }],
    });

    expect(clearedOne).toContain('style="color: #111111"');
    expect(clearedOne).not.toContain('opacity');

    const clearedAll = applyDeterministicEdits({
      code: clearedOne,
      drawgleId: "dg-button",
      operations: [{ type: "clearStyle", property: "color" }],
    });

    expect(clearedAll).not.toContain('style=');
  });

  it("saves token style values as inline variable overrides", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button" class="p-4">Save</button></div>`;

    const result = applyDeterministicEdits({
      code,
      drawgleId: "dg-button",
      operations: [{ type: "setStyle", property: "padding-top", value: "var(--dg-spacing-md)" }],
    });

    expect(result).toContain('class="p-4"');
    expect(result).toContain('style="padding-top: var(--dg-spacing-md)"');
  });

  it("sets and clears safe element attributes", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button" title="Old">Save</button></div>`;

    const result = applyDeterministicEdits({
      code,
      drawgleId: "dg-button",
      operations: [
        { type: "setAttribute", name: "aria-label", value: "Save changes" },
        { type: "setAttribute", name: "title", value: null },
      ],
    });

    expect(result).toContain('aria-label="Save changes"');
    expect(result).not.toContain("title=");
  });

  it("throws when a class operation targets a stale selected element", () => {
    const code = `<div data-drawgle-id="dg-root"><button data-drawgle-id="dg-button">Save</button></div>`;

    expect(() =>
      applyDeterministicEdits({
        code,
        drawgleId: "missing",
        operations: [{ type: "setClassUtility", family: "display", className: "grid" }],
      }),
    ).toThrow("Selected design target is stale");
  });
});
