"use client";
import type { DesignTokenValues } from "@/lib/types";
import { ColorPicker } from "@/components/inspector/ColorPicker";
import { Scrubber } from "@/components/inspector/Scrubber";
import { colorGroups, type TokenUpdate } from "./model";
import { TokenSection } from "./Section";

export function ColorSection({ tokens, update, disabled = false }: { tokens: DesignTokenValues; update: TokenUpdate; disabled?: boolean }) {
  const groups = colorGroups(tokens);
  const palette = [...groups.filter(group => group.label === "Actions"), ...groups.filter(group => group.label !== "Actions")]
    .flatMap(group => group.colors).filter((color, index, colors) => colors.findIndex(item => item.value === color.value) === index);
  return <>{groups.filter(group => group.colors.length).map((group, index) => <TokenSection title={group.label} key={group.label} collapsible={index > 2}
    summary={<span className="dt-palette-summary">{group.colors.slice(0, 4).map(color => <span key={color.label} style={{ background: color.value }} />)}</span>}>
    {group.colors.map(color => <div className="dt-property-row" key={color.path.join(".")}>
      <span className="dt-property-label">{color.label}</span><ColorPicker label={color.label} value={color.value} palette={palette} onChange={value => update(color.path, value)} />
    </div>)}
  </TokenSection>)}<TokenSection title="Interaction states" collapsible summary={<span className="dt-summary">Opacity</span>}>
    {([ ["disabled", "Disabled", ".38"], ["pressed", "Pressed", ".12"], ["scrim_overlay", "Scrim overlay", ".50"] ] as const).map(([key, label, fallback]) =>
      <div className="py-1" key={key}><Scrubber label={label} ariaLabel={`${label} opacity`} disabled={disabled}
        value={Math.round(parseFloat(tokens.opacities?.[key] || fallback) * 100)} formatValue={value => `${value}%`}
        onValueChange={next => update(["opacities", key], (next / 100).toFixed(2))} /></div>)}
  </TokenSection></>;
}
