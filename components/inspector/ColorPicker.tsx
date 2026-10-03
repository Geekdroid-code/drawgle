"use client";
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { colorPickerHex } from "@/lib/css-color";
import { clamp, colorAlpha, colorRgb, colorValue, hsvToRgb, rgbToHsv, validColor } from "./color-model";
import { Scrubber } from "./Scrubber";
import "./inspector.css";

export type PaletteColor = { label: string; value: string; onSelect?: () => void };
export function ColorPicker({ label, value, onChange, palette = [], display, className = "", trigger }: {
  label: string; value: string; onChange: (value: string) => void; palette?: PaletteColor[];
  display?: string; className?: string; trigger?: ReactNode;
}) {
  const swatch = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [fallback, setFallback] = useState("#000000");
  const [hue, setHue] = useState(0);
  const [text, setText] = useState({ source: value, value });
  const input = text.source === value ? text.value : value;
  const resolved = validColor(value) ? value : fallback;
  const rgb = colorRgb(resolved), hsv = { ...rgbToHsv(rgb), h: hue }, alpha = colorAlpha(resolved);
  const commit = (next: string) => { setText({ source: next, value: next }); onChange(next); };
  const planeChange = (x: number, y: number, width: number, height: number) => {
    if (width && height) commit(colorValue(hsvToRgb({ h: hue, s: clamp(x / width, 0, 1), v: 1 - clamp(y / height, 0, 1) }), alpha));
  };
  return <Popover open={open} onOpenChange={next => {
    if (next) {
      const actual = colorPickerHex(value) ?? (swatch.current ? getComputedStyle(swatch.current).backgroundColor : "#000000");
      setFallback(actual); setHue(rgbToHsv(colorRgb(actual)).h); setText({ source: value, value });
    }
    setOpen(next);
  }}>
    <PopoverTrigger className={className || "ip-color-trigger"} aria-label={`Open ${label}${/color$/i.test(label) ? "" : " color"} picker`}>
      <span ref={swatch} className="ip-swatch" style={{ background: value }} />
      {trigger ?? <><span>{display ?? value}</span><ChevronDown size={12} /></>}
    </PopoverTrigger>
    <PopoverContent positionerClassName="!z-[115]" className="ip-popup ip-color-popup !gap-2 !rounded-[14px] !ring-0" align="end" sideOffset={7} collisionAvoidance={{ side: "shift", align: "shift" }}>
      <div className="flex items-center justify-between"><PopoverTitle className="text-xs font-semibold">{label}</PopoverTitle>
        <button type="button" aria-label="Close color picker" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--dg-surface-muted)] max-md:h-11 max-md:w-11" onClick={() => setOpen(false)}><X size={13} /></button></div>
      <div role="slider" aria-label={`${label} saturation and brightness`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)} aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
        tabIndex={0} className="ip-color-plane" style={{ backgroundColor: colorValue(hsvToRgb({ h: hue, s: 1, v: 1 })),
          backgroundImage: "linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,transparent)" }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); planeChange(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height); }}
        onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = event.currentTarget.getBoundingClientRect(); planeChange(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height); }}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault(); const step = event.shiftKey ? .1 : .01;
          commit(colorValue(hsvToRgb({ ...hsv, s: clamp(hsv.s + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), 0, 1),
            v: clamp(hsv.v + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0), 0, 1) }), alpha));
        }}>
        <span className="ip-color-marker" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }} />
      </div>
      <Scrubber label="Hue" ariaLabel={`${label} hue`} max={359} value={Math.round(hue)} spectrum formatValue={value => `${value}°`}
        onValueChange={next => { setHue(next); commit(colorValue(hsvToRgb({ ...hsv, h: next }), alpha)); }} />
      {palette.length > 0 && <div><p className="ip-field-label">Project palette</p><div className="ip-palette">{palette.map((color, index) =>
        <button key={`${color.label}-${index}`} type="button" title={color.label} aria-label={`Use ${color.label}`}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const target = event.key === "ArrowRight" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
            (target as HTMLButtonElement | null)?.focus();
          }}
          onClick={() => { setHue(rgbToHsv(colorRgb(color.value)).h); if (color.onSelect) color.onSelect(); else commit(color.value); }}><span style={{ background: color.value }} /></button>)}</div></div>}
      <label><span className="sr-only">Color value</span><input aria-label={`${label} value`} aria-invalid={!validColor(input)} className="ip-input"
        value={input} onChange={event => { const next = event.target.value; setText({ source: value, value: next }); if (validColor(next)) { setHue(rgbToHsv(colorRgb(next)).h); onChange(next); } }} /></label>
      {!validColor(input) && <p role="alert" className="text-[11px] text-red-600">Use a hex, RGB, HSL, or named color.</p>}
      <Scrubber label="Opacity" ariaLabel={`${label} opacity`} value={Math.round(alpha * 100)} formatValue={value => `${value}%`}
        onValueChange={next => commit(colorValue(rgb, next / 100))} />
    </PopoverContent>
  </Popover>;
}
