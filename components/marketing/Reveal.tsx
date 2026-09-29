"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { EASE } from "@/components/marketing/motion/hooks";
import { cn } from "@/lib/utils";

/**
 * The site's one scroll entrance: a short rise, a slow settle, and a faint focus-in.
 * Offsets are halved and capped so nothing travels far; reduced motion keeps only the fade.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
  amount,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
}) {
  const reduced = useReducedMotion();
  const rise = reduced ? 0 : Math.min(18, Math.max(0, y) * 0.5);
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: rise, filter: "blur(4px)" }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once: true, margin: "0px 0px -12% 0px", amount }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** The pill label that opens every section. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mk-surface inline-flex select-none items-center gap-2 rounded-full border border-black/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-800",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="size-3.5 text-mk-accent" fill="currentColor" aria-hidden="true">
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" />
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(60 50 50)" />
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(120 50 50)" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Section header in the site's voice: pill kicker, quiet lead, accent emphasis on its own line, calm description. */
export function SectionHeader({
  kicker,
  lead,
  emphasis,
  description,
  as: Heading = "h2",
  className,
}: {
  kicker: string;
  lead: ReactNode;
  emphasis: ReactNode;
  description?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("mx-auto mb-14 max-w-3xl text-center sm:mb-20", className)}>
      <Reveal y={16}>
        <Kicker className="mb-5">{kicker}</Kicker>
      </Reveal>
      <Reveal y={24} delay={0.08}>
        <Heading className="text-balance text-3xl font-medium leading-tight tracking-tight text-mk-body sm:text-4xl md:text-5xl">
          {lead}{" "}
          <br className="hidden sm:block" />
          <span className="font-semibold text-mk-accent">{emphasis}</span>
        </Heading>
      </Reveal>
      {description ? (
        <Reveal y={24} delay={0.16}>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-mk-body sm:text-lg">{description}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
