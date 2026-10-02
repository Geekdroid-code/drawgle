"use client";
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, Link2, Unlink2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DrawgleStyleProperty, DrawgleTokenReferenceLike } from "@/lib/element-style-inspection";
import { getTokenReferencesForStyleProperty } from "@/lib/element-style-inspection";
import { colorPickerHex } from "@/lib/css-color";

export const inputClass = "ve-input min-w-0 w-full";
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="ve-section"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">{title}</h3>{action}</div>{children}</section>;
}
export function Field({ label, value, onChange, error, numeric = false, unit = "px" }: {
  label: string; value: string; onChange: (value: string) => void; error?: string; numeric?: boolean; unit?: string;
}) {
  const display = numeric && unit && new RegExp(`^-?\\d*\\.?\\d+${unit}$`).test(value) ? value.slice(0, -unit.length) : value;
  const suffix = numeric && /^-?\d*\.?\d+(?:px)?$/.test(value) ? unit : "";
  return <label className="block min-w-0"><span className="mb-1 block text-[11px] text-[var(--dg-text-muted)]">{label}</span>
    <div className="relative"><input aria-label={label} aria-invalid={!!error} className={`${inputClass} ${numeric ? "pr-8" : ""}`} value={display}
      onChange={event => { const next = event.target.value; onChange(numeric && /^-?\d*\.?\d+$/.test(next) ? `${next}${unit}` : next); }} />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--dg-text-muted)]">{suffix}</span>}</div>
    {error && <span role="alert" className="mt-1 block text-[11px] text-red-600">{error}</span>}
  </label>;
}
export function Segments({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: ReactNode; title?: string }[]; onChange: (value: string) => void }) {
  return <div role="group" aria-label={label} className="ve-segments">{options.map(option => <button key={option.value} type="button" aria-label={option.title ?? String(option.label)}
    title={option.title} aria-pressed={value === option.value} className="ve-segment" onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export function TokenField({ property, tokens, ...props }: Parameters<typeof Field>[0] & { property: DrawgleStyleProperty; tokens: DrawgleTokenReferenceLike[] }) {
  const choices = getTokenReferencesForStyleProperty(property, tokens);
  const corners = property === "border-radius";
  const linked = choices.find(token => props.value === `var(${token.name})`);
  return <div className="flex items-end gap-1.5" title={linked ? `Uses project ${linked.label}` : undefined}><div className="min-w-0 flex-1"><Field {...props} value={linked?.value ?? props.value} /></div>{(choices.length > 0 || corners) && <Popover><PopoverTrigger aria-label={`${props.label} presets`} className="ve-icon !h-[34px] !w-[34px] shrink-0 bg-[var(--dg-surface-muted)]"><ChevronDown size={12} /></PopoverTrigger>
    <PopoverContent align="end" className="w-56 rounded-xl p-2"><p className="mb-2 px-2 text-xs font-semibold">{props.label}</p>
      {choices.map(token => <button type="button" key={token.name} className="block w-full rounded-md px-2 py-2 text-left text-xs hover:bg-[var(--dg-surface-muted)]" onClick={() => props.onChange(`var(${token.name})`)}>{token.label} · {token.value}</button>)}
      {corners && <div className="flex flex-wrap gap-1">{[0, 8, 16, 24, 999].map(radius => <button type="button" key={radius} className="ve-input flex-1" onClick={() => props.onChange(`${radius}px`)}>{radius === 999 ? "Pill" : radius}</button>)}</div>}
    </PopoverContent></Popover>}</div>;
}
export function Choices({ label, value, choices, labels, onChange }: { label: string; value: string; choices: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  const known = choices.includes(value);
  return <select aria-label={label} className={inputClass} value={known ? value : "__custom"} onChange={event => onChange(event.target.value)}>
    {!known && <option value="__custom">{value ? `Custom · ${value}` : "Choose"}</option>}
    {choices.map(choice => <option key={choice} value={choice}>{labels?.[choice] ?? choice.charAt(0).toUpperCase() + choice.slice(1)}</option>)}
  </select>;
}
export function ColorControl({ label, property, value, tokens, onChange, error, gradient = false }: {
  label: string; property: DrawgleStyleProperty; value: string; tokens: DrawgleTokenReferenceLike[]; onChange: (value: string) => void; error?: string; gradient?: boolean;
}) {
  const choices = getTokenReferencesForStyleProperty(property, tokens);
  const resolved = choices.find(token => value === `var(${token.name})`);
  const swatch = useRef<HTMLSpanElement>(null);
  const [pickerFallback, setPickerFallback] = useState("#000000");
  return <div><Popover onOpenChange={open => { if (open && swatch.current) setPickerFallback(colorPickerHex(getComputedStyle(swatch.current).backgroundColor) ?? "#000000"); }}><PopoverTrigger className={`${inputClass} flex items-center gap-2 text-left`} aria-label={`Edit ${label}`}>
    <span ref={swatch} className="h-5 w-5 shrink-0 rounded-md border border-black/10" style={{ background: gradient ? "linear-gradient(135deg,#b8c7fc,#e5d3eb)" : resolved?.value ?? value }} />
    <span className="flex-1 truncate">{gradient ? "Gradient" : resolved?.label ?? value ?? "None"}</span><ChevronDown className="h-3 w-3 opacity-50" />
  </PopoverTrigger><PopoverContent className="w-[260px] space-y-3 rounded-xl p-3" align="end">
    <p className="text-xs font-semibold">{label}</p>
    {choices.length > 0 && <div className="flex flex-wrap gap-2">{choices.map(token => <button key={token.name} type="button" aria-label={`Use ${token.label}`} title={token.label}
      className="h-8 w-8 rounded-lg border border-black/10 max-md:min-h-11 max-md:min-w-11" style={{ background: token.value }} onClick={() => onChange(`var(${token.name})`)} />)}</div>}
    <label className="flex gap-2"><input aria-label={`${label} color picker`} type="color" className="h-9 w-10 shrink-0 rounded max-md:min-h-11 max-md:min-w-11" value={colorPickerHex(resolved?.value ?? value) ?? pickerFallback} onChange={event => onChange(event.target.value)} />
      <input aria-label={`${label} value`} className={inputClass} value={gradient ? "" : value} placeholder="#FAFAFA" onChange={event => onChange(event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </PopoverContent></Popover>{error && <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>}</div>;
}
const paddingProperties = ["padding-top", "padding-right", "padding-bottom", "padding-left"] as const;
export function PaddingControl({ values, errors, onChange }: { values: string[]; errors?: Partial<Record<DrawgleStyleProperty, string>>; onChange: (values: Partial<Record<DrawgleStyleProperty, string>>) => void }) {
  const [mode, setMode] = useState<"linked" | "axes" | "sides">("linked");
  const same = values.every(value => value === values[0]);
  const change = (indices: number[], value: string) => onChange(Object.fromEntries(indices.map(index => [paddingProperties[index], value])));
  return <div><div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Inside spacing</span>
    <button className="ve-icon" aria-label="Expand spacing controls" title="Spacing controls" onClick={() => setMode(mode === "linked" ? "axes" : mode === "axes" ? "sides" : "linked")}>
      {mode === "linked" ? <Link2 size={14} /> : <Unlink2 size={14} />}</button></div>
    {mode === "linked" ? <Field label="Padding" value={same ? values[0] : "Mixed"} numeric error={paddingProperties.map(property => errors?.[property]).find(Boolean)} onChange={value => change([0, 1, 2, 3], value)} /> :
      <div className="grid grid-cols-2 gap-2">{mode === "axes" ? <>
        <Field label="Horizontal" value={values[1] === values[3] ? values[1] : "Mixed"} numeric error={errors?.["padding-right"] ?? errors?.["padding-left"]} onChange={value => change([1, 3], value)} />
        <Field label="Vertical" value={values[0] === values[2] ? values[0] : "Mixed"} numeric error={errors?.["padding-top"] ?? errors?.["padding-bottom"]} onChange={value => change([0, 2], value)} /></> :
        paddingProperties.map((property, index) => <Field key={property} label={property.replace("padding-", "")} value={values[index]} numeric error={errors?.[property]} onChange={value => change([index], value)} />)}</div>}
  </div>;
}
