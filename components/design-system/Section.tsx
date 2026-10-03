"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
export function TokenSection({ title, children, summary, collapsible = false, defaultOpen = false }: {
  title: string; children: ReactNode; summary?: ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen); const reduced = useReducedMotion();
  return <section className="dt-section">
    {collapsible ? <button type="button" className="dt-section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{title}</span><span className="flex items-center gap-2">{!open && summary}<ChevronDown size={13} className={open ? "rotate-180" : ""} /></span>
    </button> : <h3 className="dt-section-title">{title}</h3>}
    {collapsible ? <AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : .18 }} className="overflow-hidden"><div className="dt-section-content">{children}</div></motion.div>}</AnimatePresence> : <div className="dt-section-content">{children}</div>}
  </section>;
}
