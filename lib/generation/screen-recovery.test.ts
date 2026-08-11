import { describe, expect, it } from "vitest";

import {
  extractFirstScreenRoot,
  sanitizeStaticDrawgleHtml,
  validateStaticDrawgleHtml,
} from "@/lib/generation/screen-quality";

const root = (label: string) =>
  `<div class="w-full min-h-screen dg-bg-primary flex flex-col">`
  + `<header class="p-4"><h1>${label}</h1></header>`
  + `<main class="p-4"><p>${label} body copy that makes this long enough to be a real screen fragment.</p></main>`
  + `</div>`;

describe("duplicated screen root recovery", () => {
  it("keeps the first complete root when a screen is emitted twice", () => {
    const duplicated = `${root("Personalized Goals")}\n${root("Personalized Goals")}`;
    expect((duplicated.match(/min-h-screen/g) ?? []).length).toBe(2);

    const sanitized = sanitizeStaticDrawgleHtml(duplicated);
    expect(sanitized.removedCodes).toContain("duplicated_screen_root");
    expect((sanitized.code.match(/min-h-screen/g) ?? []).length).toBe(1);

    // The recovered screen must now pass the gate that previously failed it.
    const validation = validateStaticDrawgleHtml({ code: sanitized.code, requireSingleScreenRoot: true });
    expect(validation.codes).not.toContain("duplicated_screen_fragment");
    expect(validation.unrecoverable).toBe(false);
  });

  it("preserves nested divs when extracting", () => {
    // Realistic size: the extractor requires a recovered fragment to still look
    // like a whole screen rather than a stray wrapper.
    const deeplyNested = `<div class="w-full min-h-screen dg-bg-primary">`
      + `<div class="card p-4"><div class="inner">deep marker</div>`
      + `<p>Body copy long enough that the recovered fragment reads as a complete screen rather than a stray wrapper element.</p>`
      + `</div></div>`;
    const extracted = extractFirstScreenRoot(`${deeplyNested}${root("second screen")}`);

    expect(extracted).toContain("deep marker");
    expect(extracted).not.toContain("second screen");
    // Both nested closing tags must survive so the fragment stays balanced.
    expect((extracted?.match(/<\/div>/g) ?? []).length).toBe(3);
  });

  it("leaves a single-root screen untouched", () => {
    const single = root("Training Dashboard");
    const sanitized = sanitizeStaticDrawgleHtml(single);
    expect(sanitized.removedCodes).not.toContain("duplicated_screen_root");
    expect(sanitized.code).toBe(single);
  });

  it("declines to recover when the roots cannot be separated", () => {
    // Unbalanced: depth never returns to zero, so no safe extraction exists.
    expect(extractFirstScreenRoot(`<div class="min-h-screen"><div>unclosed`)).toBeNull();
  });
});

describe("streamed markup trimming", () => {
  // Mirrors the trim applied in ScreenNode before markup reaches the iframe.
  const trimIncompleteTag = (value: string) => {
    const lastOpen = value.lastIndexOf("<");
    if (lastOpen === -1) return value;
    const lastClose = value.lastIndexOf(">");
    return lastClose > lastOpen ? value : value.slice(0, lastOpen);
  };

  it("drops a trailing half-written tag", () => {
    expect(trimIncompleteTag('<div class="a"><span>hi</span><div class="b'))
      .toBe('<div class="a"><span>hi</span>');
  });

  it("keeps markup that ends on a closed tag", () => {
    const complete = '<div class="a"><span>hi</span></div>';
    expect(trimIncompleteTag(complete)).toBe(complete);
  });

  it("keeps trailing text content", () => {
    expect(trimIncompleteTag("<p>partial sentence")).toBe("<p>partial sentence");
  });
});
