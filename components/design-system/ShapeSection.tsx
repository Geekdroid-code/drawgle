"use client";
import type { DesignTokenValues } from "@/lib/types";
import { NumberControl } from "@/components/inspector/NumberControl";
import { InspectorSelect } from "@/components/inspector/InspectorSelect";
import { ColorPicker } from "@/components/inspector/ColorPicker";
import { TokenSection } from "./Section";
import { type TokenUpdate } from "./model";
import { parseCssShadow, serializeCssShadow, SHADOW_PRESETS } from "./shadow-model";

function ShadowControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parts = parseCssShadow(value), selected = value === "none" ? "none" : SHADOW_PRESETS.find(preset => serializeCssShadow(preset.value) === value)?.label || "custom";
  return <TokenSection title={label} collapsible summary={<span className="dt-summary">{selected === "custom" ? "Custom" : selected === "none" ? "None" : selected}</span>}>
    <div className="dt-shadow-preview"><span style={{ boxShadow: value }} /></div>
    <InspectorSelect label={`${label} preset`} value={selected} options={[{ value: "none", label: "None" }, ...SHADOW_PRESETS.map(preset => ({ value: preset.label, label: preset.label })), ...(selected === "custom" ? [{ value: "custom", label: "Custom" }] : [])]}
      onChange={next => { if (next === "none") onChange("none"); else { const preset = SHADOW_PRESETS.find(preset => preset.label === next); if (preset) onChange(serializeCssShadow(preset.value)); } }} />
    {parts.enabled && (parts.supported ? <><div className="grid grid-cols-2 gap-2 mt-2">{([ ["x", "X", -40, 40], ["y", "Y", -40, 40], ["blur", "Blur", 0, 96], ["spread", "Spread", -40, 40] ] as const).map(([key, name, min, max]) =>
      <NumberControl key={key} label={name} value={`${parts[key]}px`} min={min} max={max} onChange={next => { if (/^-?\d*\.?\d+(?:px)?$/.test(next)) onChange(serializeCssShadow({ ...parts, [key]: parseFloat(next), enabled: true })); }} />)}</div>
    <div className="dt-property-row mt-2"><span className="dt-property-label">Shadow color</span><ColorPicker label={`${label} color`} value={`rgba(${parts.rgb.join(", ")}, ${parts.opacity})`}
      onChange={next => { const color = parseCssShadow(`0px 0px 0px ${next}`); onChange(serializeCssShadow({ ...parts, color: color.color, opacity: color.opacity, enabled: true })); }} /></div></> : <p className="dt-section-note mt-3">This custom shadow has multiple layers or inherited values. Choose a preset to replace it.</p>)}
  </TokenSection>;
}
export function ShapeSection({ tokens, update }: { tokens: DesignTokenValues; update: TokenUpdate }) {
  return <>
    <TokenSection title="Corners"><div className="dt-radius-preview"><span style={{ borderRadius: tokens.radii?.app || "18px" }}><span style={{ borderRadius: tokens.radii?.inner || "12px" }} /></span></div>
      {([ ["app", "Outer corners", "18px", 48], ["inner", "Inner corners", "12px", 47], ["pill", "Pill", "9999px", 9999] ] as const).map(([key, label, fallback, max]) =>
        <div className="dt-property-row" key={key}><span className="dt-property-label">{label}</span><NumberControl label={label} value={tokens.radii?.[key] || fallback} min={0} max={max} onChange={value => update(["radii", key], value)} /></div>)}
    </TokenSection>
    <TokenSection title="Borders"><div className="dt-property-row"><span className="dt-property-label">Width</span><NumberControl label="Border width" value={tokens.border_widths?.standard || "1px"} min={0} max={8} onChange={value => update(["border_widths", "standard"], value)} /></div></TokenSection>
    <TokenSection title="Elevation">{([ ["Surface shadow", ["shadows", "surface"], tokens.shadows?.surface], ["Overlay shadow", ["shadows", "overlay"], tokens.shadows?.overlay], ["Navigation shadow", ["navigation", "shadow"], tokens.navigation?.shadow || tokens.shadows?.surface] ] as [string, string[], string | undefined][]).map(([label, path, value]) =>
      <ShadowControl key={label} label={label} value={value || "none"} onChange={next => update(path, next)} />)}
      <p className="dt-section-note">Custom shadows stay unchanged until you edit them.</p>
    </TokenSection>
  </>;
}
