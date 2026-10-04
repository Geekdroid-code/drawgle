import { describe, expect, it } from "vitest";

import { repairTokenOpacityClasses } from "./color-opacity-classes";

describe("repairTokenOpacityClasses", () => {
  it("rewrites both spellings the renderer cannot draw into one it can", () => {
    const result = repairTokenOpacityClasses(
      `<div class="border-b border-[var(--dg-color-border-divider)/50]"></div><span class="bg-[var(--dg-color-accent-tints-1)]/20 p-2"></span>`,
    );
    expect(result.repaired).toBe(2);
    expect(result.code).toBe(
      `<div class="border-b border-[color-mix(in_srgb,var(--dg-color-border-divider)_50%,transparent)]"></div>`
      + `<span class="bg-[color-mix(in_srgb,var(--dg-color-accent-tints-1)_20%,transparent)] p-2"></span>`,
    );
  });

  it("keeps variants and the color: hint", () => {
    expect(repairTokenOpacityClasses(`<a class="hover:text-[color:var(--dg-color-action-primary)]/80 dark:ring-[var(--x)/5]"></a>`).code)
      .toBe(`<a class="hover:text-[color-mix(in_srgb,var(--dg-color-action-primary)_80%,transparent)] dark:ring-[color-mix(in_srgb,var(--x)_5%,transparent)]"></a>`);
  });

  it("leaves classes that already render, and text that only looks like a class", () => {
    const code = `<p class="border-[var(--x)] bg-white/40 bg-[#ffffff]/50 text-[var(--y)]">bg-[var(--z)/50] in a sentence</p>`;
    expect(repairTokenOpacityClasses(code)).toEqual({ code, repaired: 0 });
  });

  it("handles single quotes and classes that hold quoted values", () => {
    expect(repairTokenOpacityClasses(`<i class='fill-[var(--x)]/30'></i>`).code)
      .toBe(`<i class='fill-[color-mix(in_srgb,var(--x)_30%,transparent)]'></i>`);
    expect(repairTokenOpacityClasses(`<b class="[font-family:'Inter'] stroke-[var(--x)/60]"></b>`).code)
      .toBe(`<b class="[font-family:'Inter'] stroke-[color-mix(in_srgb,var(--x)_60%,transparent)]"></b>`);
  });

  it("ignores opacities over 100 and data attributes named like class", () => {
    const code = `<div class="bg-[var(--x)]/150" data-class="bg-[var(--x)]/50"></div>`;
    expect(repairTokenOpacityClasses(code)).toEqual({ code, repaired: 0 });
  });
});
