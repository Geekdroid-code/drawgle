import { describe, expect, it } from 'vitest';

import { detectTokenDrift } from '@/lib/token-drift';

describe('detectTokenDrift', () => {
  it('flags generic palettes, raw colors, and non-token arbitrary geometry on app UI', () => {
    const result = detectTokenDrift(`
      <div class="bg-white text-black rounded-[24px] p-[21px]" style="background:#f3f3f3;color:rgba(10,20,30,.7)">
        Token drift
      </div>
    `);

    expect(result.hasSevereDrift).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain('generic_tailwind_palette');
    expect(result.issues.map((issue) => issue.code)).toContain('raw_style_color');
    expect(result.issues.map((issue) => issue.code)).toContain('raw_radius');
    expect(result.issues.map((issue) => issue.code)).toContain('raw_spacing');
  });

  it('allows Drawgle token utilities, CSS variables, and SVG art-specific colors', () => {
    const result = detectTokenDrift(`
      <div class="dg-bg-primary text-[var(--dg-color-text-high-emphasis)] rounded-[var(--dg-radii-app)] p-[var(--dg-spacing-md)]" style="background:var(--dg-color-surface-card,#ffffff);box-shadow:var(--dg-shadows-surface,0 8px 18px rgba(15,23,42,.14))">
        <svg><path fill="#ff00aa" d="M0 0h10v10H0z"></path></svg>
      </div>
      <style>.ok{color:var(--dg-color-text-high-emphasis,#111827)}</style>
    `);

    expect(result.hasSevereDrift).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it('flags raw system colors in style blocks', () => {
    const result = detectTokenDrift('<style>.bad{background:#f3f3f3;color:rgba(1,2,3,.4)}</style>');

    expect(result.hasSevereDrift).toBe(true);
    expect(result.severeIssues.filter((issue) => issue.code === 'raw_style_color')).toHaveLength(2);
  });

  it('does not flag values that tokenizeStaticDrawgleHtml rewrites to CSS variables', () => {
    // These mirror the post-tokenization form: bg-[var(--dg-color-action-primary)] /
    // rounded-[var(--dg-radii-app)] / p-[var(--dg-spacing-md)] with raw fallback
    // hex/px kept inside the var() definition.
    const result = detectTokenDrift(`
      <div class="bg-[var(--dg-color-action-primary,#2563eb)] rounded-[var(--dg-radii-app,18px)] p-[var(--dg-spacing-md,16px)]" style="color:var(--dg-color-text-high-emphasis,#111827);background:var(--dg-color-surface-card,#ffffff)">
        Tokenized surface
      </div>
    `);

    expect(result.hasSevereDrift).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it('escalates raw radius drift to severe in navigation scope to protect the shell', () => {
    const result = detectTokenDrift(
      `<nav data-drawgle-primary-nav><div class="rounded-[24px] p-[14px]">x</div></nav>`,
      { scope: 'navigation' },
    );

    expect(result.hasSevereDrift).toBe(true);
    expect(result.severeIssues.some((issue) => issue.code === 'raw_radius')).toBe(true);
  });
});