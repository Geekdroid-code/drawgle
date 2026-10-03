"use client";
import type { DesignTokenValues } from "@/lib/types";
import { NumberControl } from "@/components/inspector/NumberControl";
import { TokenSection } from "./Section";
import type { TokenUpdate } from "./model";
const SPACING = ["xxs", "xs", "sm", "md", "lg", "xl", "xxl"] as const;
const LAYOUT = [{ key: "screen_margin", label: "Screen margin" }, { key: "section_gap", label: "Section gap" }, { key: "element_gap", label: "Element gap" }] as const;
const SIZES = [{ key: "standard_button_height", label: "Button height" }, { key: "standard_input_height", label: "Input height" }, { key: "icon_small", label: "Small icon" }, { key: "icon_standard", label: "Standard icon" }, { key: "bottom_nav_height", label: "Bottom navigation" }] as const;

export function SpacingSection({ tokens, update }: { tokens: DesignTokenValues; update: TokenUpdate }) {
  return <>
    <TokenSection title="Spacing scale"><p className="dt-section-note">A consistent rhythm across every screen.</p>
      {SPACING.map(key => <div className="dt-spacing-row" key={key}><span className="dt-spacing-visual" aria-hidden><span style={{ width: Math.max(2, Math.min(parseFloat(tokens.spacing?.[key] || "0"), 80)) }} /></span>
        <NumberControl label={key.toUpperCase()} value={tokens.spacing?.[key] || "0px"} min={0} max={96} onChange={value => update(["spacing", key], value)} /></div>)}
    </TokenSection>
    <TokenSection title="Layout rhythm">{LAYOUT.map(item => <div className="dt-property-row" key={item.key}><span className="dt-property-label">{item.label}</span>
      <NumberControl label={item.label} value={tokens.mobile_layout?.[item.key] || "0px"} min={0} max={120} onChange={value => update(["mobile_layout", item.key], value)} /></div>)}</TokenSection>
    <TokenSection title="Component sizes" collapsible summary={<span className="dt-summary">5 values</span>}>{SIZES.map(item => <div className="dt-property-row" key={item.key}><span className="dt-property-label">{item.label}</span>
      <NumberControl label={item.label} value={tokens.sizing?.[item.key] || "8px"} min={8} max={140} onChange={value => update(["sizing", item.key], value)} /></div>)}</TokenSection>
  </>;
}
