"use client";
import { useId, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

export function SegmentedControl<T extends string>({ label, value, options, onChange, className = "" }: {
  label: string; value: T; options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void; className?: string;
}) {
  const id = useId(); const reduced = useReducedMotion();
  return <LayoutGroup id={id}><div role="group" aria-label={label} className={`ip-segments ${className}`}>
    {options.map((option, index) => <button key={option.value} type="button" className="ip-segment" title={option.title}
      aria-label={option.title ?? (typeof option.label === "string" ? option.label : undefined)} aria-pressed={option.value === value}
      onClick={() => onChange(option.value)} onKeyDown={event => {
        const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + offset + options.length) % options.length;
        onChange(options[next].value);
        (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
      }}>
      {option.value === value && <motion.span aria-hidden layoutId="selected" className="ip-segment-thumb" initial={false}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 38 }} />}
      <span className="ip-segment-label">{option.label}</span>
    </button>)}
  </div></LayoutGroup>;
}
