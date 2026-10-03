"use client";
import type { DesignTokenValues } from "@/lib/types";
import { InspectorSelect } from "@/components/inspector/InspectorSelect";
import { NumberControl } from "@/components/inspector/NumberControl";
import { FontPicker } from "./FontPicker";
import { TokenSection } from "./Section";
import { fontName, TYPE_ROLES, WEIGHTS, type TokenUpdate } from "./model";

export function TypeSection({ tokens, recommendations, update }: { tokens: DesignTokenValues; recommendations: string[]; update: TokenUpdate }) {
  const typography = tokens.typography;
  const heading = typography?.heading_font_family || "", body = typography?.body_font_family || "";
  return <>
    <TokenSection title="Font families">
      <div className="dt-property-row"><span className="dt-property-label">Heading</span><FontPicker label="Heading" value={heading} recommendations={recommendations} onChange={value => update(["typography", "heading_font_family"], value)} /></div>
      <div className="dt-property-row"><span className="dt-property-label">Body</span><FontPicker label="Body" value={body} recommendations={recommendations} onChange={value => update(["typography", "body_font_family"], value)} /></div>
      <div className="dt-type-preview"><p className="dt-type-eyebrow">Aa · Your type pairing</p>
        <p style={{ fontFamily: heading, fontWeight: Number(typography?.screen_title?.weight || 600) }} className="text-[24px] leading-tight tracking-tight">Every detail,<br />considered.</p>
        <p style={{ fontFamily: body }} className="mt-2 text-[12px] leading-5 text-[var(--dg-text-muted)]">Clear words. A comfortable rhythm.</p>
        {heading && body && fontName(heading).toLowerCase() === fontName(body).toLowerCase() && <p className="mt-3 text-[10px] leading-4 text-[var(--dg-text-muted)]">One family. Size and weight create the hierarchy.</p>}
      </div>
    </TokenSection>
    <TokenSection title="Type scale">
      {TYPE_ROLES.map(role => {
        const entry = typography?.[role.key];
        const size = entry?.size || `${role.fallback}px`, weight = String(entry?.weight || 400);
        return <TokenSection title={role.label} key={role.key} collapsible summary={<span className="dt-summary">{size} · {weight}</span>}>
          <p className="dt-role-preview" style={{ fontSize: Math.min(parseFloat(size) || role.fallback, 30), fontWeight: Number(weight), fontFamily: role.key.includes("title") ? heading : body }}>{role.sample}</p>
          <div className="grid grid-cols-2 gap-2"><NumberControl label="Size" value={size} min={8} max={72} onChange={value => update(["typography", role.key, "size"], value)} />
            <InspectorSelect label={`${role.label} weight`} value={weight} options={WEIGHTS} onChange={value => update(["typography", role.key, "weight"], value)} /></div>
          <div className="mt-2"><NumberControl label="Line spacing" value={entry?.line_height || `${Math.round(parseFloat(size) * 1.35)}px`} min={10} max={96}
            onChange={value => update(["typography", role.key, "line_height"], value)} /></div>
        </TokenSection>;
      })}
    </TokenSection>
  </>;
}
