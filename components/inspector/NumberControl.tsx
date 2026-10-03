"use client";
import { useRef } from "react";
import { clamp } from "./color-model";

export function NumberControl({ label, value, onChange, min = 0, max = 9999, step = 1, unit = "px", error }: {
  label: string; value: string; onChange: (value: string) => void; min?: number; max?: number;
  step?: number; unit?: string; error?: string;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const edited = useRef(false);
  const numeric = /^-?\d*\.?\d+(?:px|%)?$/.test(value);
  const number = numeric ? parseFloat(value) : null;
  const display = numeric && unit && value.endsWith(unit) ? value.slice(0, -unit.length) : value;
  const commit = (next: number) => onChange(`${Number(clamp(next, min, max).toFixed(2))}${unit}`);
  return <div className="ip-number" data-invalid={!!error || undefined}>
    <span className={`ip-scrub ${number !== null ? "ip-scrub-enabled" : ""}`} title={number !== null ? "Drag to adjust · Shift for larger steps" : label}
      role={number !== null ? "slider" : undefined} tabIndex={number !== null ? 0 : undefined} aria-label={`Adjust ${label}`}
      aria-valuenow={number ?? undefined} aria-valuemin={min} aria-valuemax={max}
      onPointerDown={event => { if (number === null || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, value: number }; }}
      onPointerMove={event => { if (drag.current) commit(drag.current.value + Math.round((event.clientX - drag.current.x) / 3) * step * (event.shiftKey ? 10 : 1)); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => { if (number === null || !["ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft"].includes(event.key)) return; event.preventDefault(); commit(number + (event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1) * step * (event.shiftKey ? 10 : 1)); }}>
      {label}
    </span>
    <input aria-label={label} aria-invalid={!!error} inputMode="decimal" value={display}
      onFocus={() => { edited.current = false; }}
      onChange={event => { edited.current = true; const next = event.target.value; onChange(/^-?\d*\.?\d+$/.test(next) ? `${next}${unit}` : next); }}
      onBlur={event => { const next = event.target.value; if (edited.current && /^-?\d*\.?\d+$/.test(next)) { const clamped = clamp(parseFloat(next), min, max); if (clamped !== parseFloat(next)) commit(clamped); } edited.current = false; }} />
    {numeric && <span className="ip-unit">{unit}</span>}
  </div>;
}
