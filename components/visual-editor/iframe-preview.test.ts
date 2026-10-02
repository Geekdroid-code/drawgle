import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { applyDeterministicEdits } from "@/lib/drawgle-dom";

// Execute the actual iframe preview functions against a DOM, without a server or generated app scripts.
const screenNode = readFileSync("components/ScreenNode.tsx", "utf8");
const start = screenNode.indexOf("            function classListWithoutSelectionState");
const end = screenNode.indexOf("            /* Tags that should bubble", start);
const preview = () => new Function("document", `var activePreview = null; ${screenNode.slice(start, end)}; return { apply: applyElementPreview, discard: restorePreview };`)(document) as { apply: (payload: unknown) => void; discard: () => void };
afterEach(() => { document.body.innerHTML = ""; });
describe("iframe draft restoration", () => {
  it("previews text, styles, and media together, and discard restores original nodes and attributes", () => {
    const original = '<main data-drawgle-id="card"><button data-drawgle-id="button"><svg></svg><span data-drawgle-id="label">Original</span></button><img data-drawgle-id="image" src="https://example.com/original.png" srcset="https://example.com/original-2x.png 2x"></main>';
    document.body.innerHTML = original;
    const icon = document.querySelector("svg"), label = document.querySelector("span")!.firstChild;
    const controller = preview();
    controller.apply({ drawgleId: "card", styles: { "border-radius": "12px" }, text: { label: "Find nearby" }, image: { target: { kind: "img", drawgleId: "image" }, src: "https://example.com/replacement.png" } });
    expect(document.querySelector("main")!.style.borderRadius).toBe("12px");
    expect(document.querySelector("span")!.textContent).toBe("Find nearby"); expect(document.querySelector("img")!.hasAttribute("srcset")).toBe(false);
    expect(document.querySelector("svg")).toBe(icon);
    const saved = applyDeterministicEdits({ code: original, drawgleId: "card", operations: [
      { type: "setStyle", property: "border-radius", value: "12px" }, { type: "replaceText", drawgleId: "label", text: "Find nearby" },
      { type: "replaceImage", drawgleId: "image", mode: "src", src: "https://example.com/replacement.png" },
    ] });
    expect(saved).toContain("Find nearby</span>"); expect(saved).not.toContain("srcset");
    controller.discard(); expect(document.body.innerHTML).toBe(original);
    expect(document.querySelector("span")!.firstChild).toBe(label); expect(document.querySelector("svg")).toBe(icon);
  });
  it("rejects text changes to compound markup and restores explicit image placeholders", () => {
    document.body.innerHTML = '<main data-drawgle-id="card"><button data-drawgle-id="button"><svg></svg>Save</button><div data-drawgle-id="placeholder" data-drawgle-image-placeholder></div></main>';
    const original = document.body.innerHTML, controller = preview();
    controller.apply({ drawgleId: "card", text: { button: "Destroy icon" }, image: { target: { kind: "visual_placeholder", drawgleId: "placeholder" }, src: "blob:test" } });
    expect(document.querySelector("button")!.textContent).toBe("Save"); expect(document.querySelector("svg")).toBeTruthy();
    expect(document.querySelector("img")!.className).toContain("object-contain");
    controller.discard(); expect(document.body.innerHTML).toBe(original);
  });
});
