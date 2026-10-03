import { describe, expect, it } from "vitest";

import { describeElementEdit } from "./labels";

const code = `<main data-drawgle-id="root">
  <button data-drawgle-id="out" class="dg-type-button-label">Sign&nbsp;Out</button>
  <img data-drawgle-id="avatar" src="a.webp" alt="Portrait of Tavorian">
  <div data-drawgle-id="dot" class="w-2 h-2"></div>
  <section data-drawgle-id="list"><h2 data-drawgle-id="title">Saved for Later</h2><p data-drawgle-id="note">Items you kept for after the drop goes live</p></section>
</main>`;

describe("names for saved element edits", () => {
  it("says what changed and on what, in the person's words", () => {
    expect(describeElementEdit(code, "out", [{ type: "setStyle", property: "background-color", value: "#000" }])).toBe("Restyled “Sign Out”");
    expect(describeElementEdit(code, "out", [{ type: "replaceText", text: "Log out" }])).toBe("Changed text to “Log out”");
    expect(describeElementEdit(code, "list", [{ type: "replaceText", drawgleId: "title", text: "Kept" }, { type: "replaceText", drawgleId: "note", text: "Later" }]))
      .toBe("Changed text in “Saved for Later Items you k…”");
    expect(describeElementEdit(code, "avatar", [{ type: "replaceImage", mode: "src", src: "b.webp" }])).toBe("Replaced image");
    expect(describeElementEdit(code, "avatar", [{ type: "deleteElement" }])).toBe("Deleted “Portrait of Tavorian”");
    expect(describeElementEdit(code, "dot", [{ type: "duplicateElement" }])).toBe("Duplicated element");
    expect(describeElementEdit(code, "out", [{ type: "replaceText", text: "Exit" }, { type: "setStyle", property: "color", value: "red" }])).toBe("Edited “Sign Out”");
    expect(describeElementEdit(code, "title", [{ type: "clearStyle", property: "color" }], "navigation")).toBe("Restyled “Saved for Later” in navigation");
  });

  it("gives the same edit the same name, as a retried save needs", () => {
    const operations = [{ type: "setStyle" as const, property: "color" as const, value: "red" }];
    expect(describeElementEdit(code, "note", operations)).toBe(describeElementEdit(code, "note", operations));
    expect(describeElementEdit(code, "missing", operations)).toBe("Restyled element");
  });
});
