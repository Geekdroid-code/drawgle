"use client";

import type { DesignTokens } from "@/lib/types";
import { buildGoogleFontHref, getPrimaryGoogleFontFamilies } from "@/lib/token-runtime";

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i;

/** The project's palette as the person would describe it: page, card, the main action, a tint, and the text. */
export function stylePalette(tokens: DesignTokens | null | undefined): string[] {
  const color = tokens?.tokens?.color;
  const candidates = [
    color?.background?.primary,
    color?.surface?.card,
    color?.action?.primary,
    color?.accent_tints?.["1"] ?? color?.action?.secondary,
    color?.text?.high_emphasis,
  ];
  const seen = new Set<string>();
  return candidates.flatMap((value) => {
    const swatch = typeof value === "string" ? value.trim() : "";
    if (!COLOR.test(swatch) || seen.has(swatch.toLowerCase())) return [];
    seen.add(swatch.toLowerCase());
    return [swatch];
  });
}

const familyName = (value: unknown) =>
  typeof value === "string" ? value.split(",")[0].replace(/["']/g, "").trim() || null : null;

/** "Style defined": the project's colours and its two typefaces, set in those typefaces. */
export function StyleDefinedCard({ tokens }: { tokens: DesignTokens | null | undefined }) {
  const swatches = stylePalette(tokens);
  const loadable = getPrimaryGoogleFontFamilies(tokens);
  const heading = familyName(tokens?.tokens?.typography?.heading_font_family) ?? loadable.heading;
  const body = familyName(tokens?.tokens?.typography?.body_font_family) ?? loadable.body;
  const fontHref = buildGoogleFontHref(tokens);
  if (!swatches.length && !heading && !body) return null;
  const typefaces: Array<[role: "Headings" | "Body", family: string | null]> = [["Headings", heading], ["Body", body]];

  return (
    <div className="mt-1.5 rounded-xl border border-[var(--dg-border)] bg-[var(--dg-surface-muted)]/60 px-3 py-2.5" data-style-card>
      {fontHref ? <link rel="stylesheet" href={fontHref} precedence="default" /> : null}
      {swatches.length ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--dg-text-muted)]">Colors</span>
          <span className="ml-auto flex items-center gap-1.5">
            {swatches.map((swatch) => (
              <span
                key={swatch}
                title={swatch}
                className="h-4 w-4 rounded-full border border-[var(--dg-border-strong)]"
                style={{ background: swatch }}
              />
            ))}
          </span>
        </div>
      ) : null}
      {heading || body ? (
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--dg-border)] pt-2">
          {typefaces.map(([role, family]) => family ? (
            <div key={role} className="min-w-0">
              <div className="truncate text-[15px] leading-5 text-[var(--dg-text)]" style={{ fontFamily: `"${family}", system-ui, sans-serif`, fontWeight: role === "Headings" ? 600 : 400 }}>Aa</div>
              <div className="truncate text-[11px] text-[var(--dg-text-muted)]">{family} · {role.toLowerCase()}</div>
            </div>
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}
