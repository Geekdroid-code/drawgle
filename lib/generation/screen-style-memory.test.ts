import { describe, expect, it } from 'vitest';

import { extractScreenStyleMemory, formatCanonicalVisualSystem } from '@/lib/generation/screen-style-memory';

describe('screen style memory', () => {
  const code = `
    <div class="w-full min-h-screen dg-bg-primary dg-text-high flex flex-col gap-[var(--dg-mobile-layout-section-gap)]">
      <section class="dg-surface-card dg-radius-app dg-shadow-surface p-[var(--dg-spacing-md)] border border-[var(--dg-color-border-divider)]">
        <h1 class="dg-type-screen-title text-[var(--dg-color-text-high-emphasis)]">Dashboard</h1>
        <button class="dg-action-primary dg-radius-pill min-h-[var(--dg-sizing-min-touch-target)]">Start</button>
      </section>
    </div>
  `;

  it('extracts compact token and material evidence from saved screen HTML', () => {
    const memory = extractScreenStyleMemory({ name: 'Dashboard', summary: 'Premium task dashboard.', code });

    expect(memory).toContain('Screen: Dashboard');
    expect(memory).toContain('dg-bg-primary');
    expect(memory).toContain('dg-surface-card');
    expect(memory).toContain('var(--dg-spacing-md)');
    expect(memory).toContain('Root/classes:');
  });

  it('surfaces raw fallback colors as evidence to map back to tokens', () => {
    const rawColorCode = `
      <div class="dg-bg-primary" style="background:#1b1f24; color:rgba(255,255,255,.92)">
        <span class="bg-[#f4d35e] text-[#0b132b]">Highlight</span>
      </div>
    `;

    const memory = extractScreenStyleMemory({ name: 'Fallback palette', code: rawColorCode });

    expect(memory).toContain('Raw color evidence to map back to tokens when systemic');
    expect(memory).toContain('#1b1f24');
  });

  it('formats canonical visual system as continuity evidence, not layout copying', () => {
    const formatted = formatCanonicalVisualSystem([
      { id: 'screen-1', name: 'Dashboard', summary: 'Premium task dashboard.', code },
    ]);

    expect(formatted).toContain('CANONICAL VISUAL SYSTEM FROM EXISTING SCREENS');
    expect(formatted).toContain('style continuity evidence only');
    expect(formatted).toContain('Token utilities:');
  });
});