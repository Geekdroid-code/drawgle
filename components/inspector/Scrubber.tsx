"use client";

import { useRef, useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./scrubber.css";

type ScrubberProps = {
  label: string; ariaLabel?: string; value: number; min?: number; max?: number; step?: number;
  decimals?: number; ticks?: number; disabled?: boolean; spectrum?: boolean; className?: string;
  formatValue?: (value: number) => string; onValueChange: (value: number) => void;
};

/** A full-row adjustment target. Reading or hovering never changes its value. */
export function Scrubber({ label, ariaLabel = label, value, min = 0, max = 100, step = 1,
  decimals = 0, ticks = 7, disabled = false, spectrum = false, className = "", formatValue, onValueChange }: ScrubberProps) {
  const reduced = useReducedMotion();
  const pointer = useRef<number | null>(null);
  const lastEmitted = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const range = max - min;
  const percentage = range > 0 ? Math.min(100, Math.max(0, (value - min) / range * 100)) : 0;
  const display = formatValue ? formatValue(value) : value.toFixed(decimals);
  const blocked = (target: HTMLElement) => disabled || range <= 0 || step <= 0 || !!target.closest("fieldset[disabled]");
  const emit = (next: number) => {
    const rounded = Number((min + Math.round((next - min) / step) * step).toFixed(10));
    const bounded = Math.min(max, Math.max(min, rounded));
    if (!Number.isFinite(bounded) || bounded === (lastEmitted.current ?? value)) return;
    lastEmitted.current = bounded;
    onValueChange(bounded);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (blocked(event.currentTarget)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) emit(min + Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * range);
  };
  const end = () => { pointer.current = null; lastEmitted.current = null; setDragging(false); };
  return <div role="slider" aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max}
    aria-valuenow={value} aria-valuetext={display} aria-orientation="horizontal" aria-disabled={disabled || range <= 0}
    tabIndex={disabled || range <= 0 ? -1 : 0} className={`ip-scrubber ${spectrum ? "ip-scrubber-spectrum" : ""} ${className}`}
    data-dragging={dragging || undefined} data-reduced-motion={reduced || undefined}
    onPointerDown={event => {
      if (blocked(event.currentTarget) || event.button !== 0 || pointer.current !== null) return;
      event.preventDefault(); event.currentTarget.focus();
      pointer.current = event.pointerId; lastEmitted.current = value;
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); move(event);
    }}
    onPointerMove={event => { if (pointer.current === event.pointerId) move(event); }}
    onPointerUp={event => { if (pointer.current === event.pointerId) { event.currentTarget.releasePointerCapture(event.pointerId); end(); } }}
    onPointerCancel={end} onLostPointerCapture={end}
    onKeyDown={event => {
      if (blocked(event.currentTarget) || event.ctrlKey || event.metaKey || event.altKey) return;
      const increment = step * (event.shiftKey ? 10 : 1);
      const keys: Record<string, number> = { ArrowRight: value + increment, ArrowUp: value + increment, ArrowLeft: value - increment,
        ArrowDown: value - increment, Home: min, End: max, PageUp: value + step * 10, PageDown: value - step * 10 };
      const next = keys[event.key];
      if (next === undefined) return;
      event.preventDefault(); lastEmitted.current = null; emit(next); lastEmitted.current = null;
    }}>
    <span aria-hidden="true" className="ip-scrubber-fill" style={{ width: `${percentage}%` }} />
    <span aria-hidden="true" className="ip-scrubber-ticks">{Array.from({ length: Math.max(0, ticks) }, (_, index) => <i key={index} />)}</span>
    <span aria-hidden="true" className="ip-scrubber-thumb" style={{ left: `clamp(5px, ${percentage}%, calc(100% - 5px))` }}>
      <motion.i initial={false} animate={{ scaleY: dragging ? 1 : .7 }} transition={{ duration: reduced ? 0 : .15 }} />
    </span>
    <span className="ip-scrubber-label">{label}</span><span className="ip-scrubber-value">{display}</span>
  </div>;
}
