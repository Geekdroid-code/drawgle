import { describe, expect, it } from "vitest";

import { stabilizeStreamedHtml } from "./streamed-html";

describe("stabilizeStreamedHtml", () => {
  it("drops an unfinished trailing tag and closes the stable tree", () => {
    expect(stabilizeStreamedHtml('<div class="screen"><section><h1>Hello</h1><div cla')).toBe(
      '<div class="screen"><section><h1>Hello</h1></section></div>',
    );
  });

  it("preserves void and self-closing elements", () => {
    expect(stabilizeStreamedHtml('<main><img src="x"><input /><p>Ready</p>')).toBe(
      '<main><img src="x"><input /><p>Ready</p></main>',
    );
  });

  it("returns completed fenced HTML without adding duplicate closing tags", () => {
    expect(stabilizeStreamedHtml('```html\n<div><span>Done</span></div>\n```')).toBe(
      '<div><span>Done</span></div>',
    );
  });
});
