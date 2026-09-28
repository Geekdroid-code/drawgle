"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { EASE } from "@/components/marketing/motion/hooks";
import { cn } from "@/lib/utils";

/** Fade-and-rise on first scroll into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  x = 0,
  amount,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
  amount?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-60px", amount }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Section header in the site's voice: quiet kicker, two-tone headline, calm description. */
export function SectionHeader({
  kicker,
  lead,
  emphasis,
  emphasisTone = "ink",
  breakBeforeEmphasis = false,
  description,
  kickerStyle = "plain",
  as: Heading = "h2",
  align = "center",
  className,
}: {
  kicker: string;
  lead: ReactNode;
  emphasis: ReactNode;
  emphasisTone?: "ink" | "accent";
  breakBeforeEmphasis?: boolean;
  description?: ReactNode;
  kickerStyle?: "plain" | "pill";
  as?: "h1" | "h2";
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <Reveal className={className ?? (centered ? "mb-14 text-center sm:mb-16" : "mb-12 text-left")}>
      {kickerStyle === "pill" ? (
        <div className="mk-surface mb-5 inline-flex select-none items-center gap-2 rounded-full border border-black/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-800">
          <svg viewBox="0 0 100 100" className="size-3.5 text-mk-accent" fill="currentColor" aria-hidden="true">
            <rect x="44.5" y="10" width="11" height="80" rx="5.5" />
            <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(60 50 50)" />
            <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(120 50 50)" />
          </svg>
          <span>{kicker}</span>
        </div>
      ) : (
        <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-neutral-400 sm:text-sm">{kicker}</span>
      )}
      <Heading className="text-balance text-3xl font-medium leading-tight tracking-tight text-mk-body sm:text-4xl md:text-5xl">
        {lead}{" "}
        {breakBeforeEmphasis ? <br className="hidden sm:block" /> : null}
        <span className={emphasisTone === "accent" ? "font-semibold text-mk-accent" : "font-semibold text-mk-ink"}>{emphasis}</span>
      </Heading>
      {description ? (
        <p className={cn("mt-4 max-w-2xl text-pretty text-base leading-relaxed text-mk-body sm:text-lg", centered && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
