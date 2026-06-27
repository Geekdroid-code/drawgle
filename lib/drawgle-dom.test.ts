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
