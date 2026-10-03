"use client";
import type { DesignTokens } from "@/lib/types";

export function PhonePreview({
  primaryBg,
  secondaryBg,
  primaryText,
  mediumText,
  lowText,
  actionPrimary,
  actionSecondary,
  actionText,
  navigationSurface,
  navigationContent,
  navigationMuted,
  navigationActiveSurface,
  navigationActiveContent,
  navigationBorder,
  navigationShadow,
  cardBg,
  borderDivider,
  radius,
  radiusInner,
  radiusPill,
  shadowSurface,
  borderStandard,
  headingFontFamily,
  bodyFontFamily,
  tokens,
}: {
  primaryBg: string;
  secondaryBg: string;
  primaryText: string;
  mediumText: string;
  lowText: string;
  actionPrimary: string;
  actionSecondary: string;
  actionText: string;
  navigationSurface: string;
  navigationContent: string;
  navigationMuted: string;
  navigationActiveSurface: string;
  navigationActiveContent: string;
  navigationBorder: string;
  navigationShadow: string;
  cardBg: string;
  borderDivider: string;
  radius: string;
  radiusInner: string;
  radiusPill: string;
  shadowSurface: string;
  borderStandard: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  tokens: NonNullable<DesignTokens["tokens"]>;
}) {
  return (
    <div
      className="relative flex aspect-[9/18] h-[min(100%,clamp(360px,68dvh,560px))] max-h-full w-auto max-w-[min(78vw,280px)] flex-col overflow-hidden rounded-[clamp(22px,7vw,30px)] border border-slate-950/[0.12] bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.75)]"
      style={{ backgroundColor: primaryBg, color: primaryText, fontFamily: bodyFontFamily }}
    >
      <div className="flex items-center justify-between px-[7%] pt-[7%]">
        <div className="h-[clamp(20px,6vw,28px)] w-[clamp(20px,6vw,28px)] rounded-full" style={{ backgroundColor: secondaryBg, border: `${borderStandard} solid ${borderDivider}` }} />
        <div className="h-[clamp(20px,6vw,28px)] w-[28%] rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.12, borderRadius: radiusPill }} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-[7%] pb-[7%] pt-[5%]">
        <h3
          className="tracking-tight"
          style={{
            color: primaryText,
            fontSize: `clamp(18px, 5.4vw, ${tokens.typography?.screen_title?.size || "24px"})`,
            fontWeight: Number(tokens.typography?.screen_title?.weight ?? 800),
            lineHeight: "1.12",
            fontFamily: headingFontFamily,
          }}
        >
          Preview
        </h3>
        <p className="mt-1 line-clamp-2" style={{ color: mediumText, fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.supporting?.size || "14px"})`, lineHeight: "1.45" }}>
          Live token response across surfaces, type, spacing, and action states.
        </p>

        <div className="mt-[7%]" style={{ borderBottom: `${borderStandard} solid ${borderDivider}` }} />

        <div
          className="mt-[7%] p-[7%]"
          style={{
            backgroundColor: cardBg,
            borderRadius: radius,
            boxShadow: shadowSurface,
            border: `${borderStandard} solid ${borderDivider}`,
          }}
        >
          <div style={{ fontSize: `clamp(13px, 3.8vw, ${tokens.typography?.body?.size || "16px"})`, lineHeight: "1.35", color: primaryText }}>
            Weekly activity
          </div>
          <div className="mt-1 line-clamp-1" style={{ fontSize: `clamp(10px, 3vw, ${tokens.typography?.caption?.size || "12px"})`, color: lowText }}>
            Token changes land here immediately.
          </div>
          <div className="mt-[7%] grid grid-cols-4 gap-[5%]">
            {[36, 54, 42, 64].map((height, index) => (
              <div key={`${height}-${index}`} className="flex items-end">
                <div
                  className="w-full rounded-full"
                  style={{
                    height: `clamp(24px, ${height / 5}vw, ${height}px)`,
                    background: index % 2 === 0 ? actionPrimary : actionSecondary,
                    opacity: index % 2 === 0 ? 1 : 0.34,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-[6%] flex items-center gap-[5%] p-[6%]"
          style={{
            backgroundColor: cardBg,
            borderRadius: radius,
            boxShadow: shadowSurface,
            border: `${borderStandard} solid ${borderDivider}`,
          }}
        >
          <div className="h-[clamp(30px,9vw,40px)] w-[clamp(30px,9vw,40px)] shrink-0 rounded-full" style={{ backgroundColor: actionPrimary, opacity: 0.14 }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[clamp(12px,3.4vw,14px)] font-semibold" style={{ color: primaryText }}>Reusable row</div>
            <div className="truncate text-[clamp(10px,3vw,12px)]" style={{ color: mediumText }}>Surface plus text rhythm</div>
          </div>
        </div>

        <div
          className="mt-[6%] flex items-center px-[6%]"
          style={{
            backgroundColor: secondaryBg,
            borderRadius: radius,
            border: `${borderStandard} solid ${borderDivider}`,
            height: `clamp(40px, 10vw, ${tokens.sizing?.standard_input_height || "48px"})`,
          }}
        >
          <span className="truncate" style={{ fontSize: `clamp(12px, 3.2vw, ${tokens.typography?.supporting?.size || "14px"})`, color: lowText }}>Search interactions</span>
        </div>

        <div className="flex-1" />

        <div
          className="mt-[6%] grid grid-cols-4 gap-1 p-1.5"
          style={{ backgroundColor: navigationSurface, border: `${borderStandard} solid ${navigationBorder}`, borderRadius: radius, boxShadow: navigationShadow }}
        >
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex h-8 items-center justify-center"
              style={{
                backgroundColor: item === 0 ? navigationActiveSurface : "transparent",
                color: item === 0 ? navigationActiveContent : item === 1 ? navigationContent : navigationMuted,
                borderRadius: radiusInner,
              }}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-[6%] flex h-[clamp(42px,11vw,52px)] w-full items-center justify-center gap-2 transition active:scale-[0.99]"
          style={{
            backgroundColor: actionPrimary,
            color: actionText,
            borderRadius: radius,
            fontSize: `clamp(13px, 3.6vw, ${tokens.typography?.button_label?.size || "16px"})`,
            fontWeight: Number(tokens.typography?.button_label?.weight ?? 600),
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
