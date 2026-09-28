"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";

import { cn } from "@/lib/utils";
import { EASE } from "./hooks";
import { measureAnchor } from "./Stage";

/**
 * A pointer that glides to `[data-anchor=target]` inside the stage.
 * `pressed` plays a press + ripple, like a real click.
 */
export function Cursor({
  stageRef,
  target,
  pressed = false,
  hidden = false,
  from = { x: 360, y: 700 },
  nudge = { x: 6, y: 8 },
  duration = 0.8,
  settleKey,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  target: string | null;
  pressed?: boolean;
  hidden?: boolean;
  from?: { x: number; y: number };
  nudge?: { x: number; y: number };
  duration?: number;
  /** Re-measure the target when this changes (e.g. after layout shifts). */
  settleKey?: unknown;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const { x: fromX, y: fromY } = from;
  const { x: nudgeX, y: nudgeY } = nudge;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !scope.current) return;
    const point = target ? measureAnchor(stage, target) : null;
    const next = point ? { x: point.x + nudgeX, y: point.y + nudgeY } : { x: fromX, y: fromY };
    void animate(scope.current, next, { duration: point ? duration : 0.6, ease: EASE });
  }, [animate, duration, fromX, fromY, nudgeX, nudgeY, scope, settleKey, stageRef, target]);

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-[80]"
      style={{ transform: `translateX(${fromX}px) translateY(${fromY}px)` }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: hidden ? 0 : 1, scale: pressed ? 0.84 : 1 }}
        transition={{ duration: pressed ? 0.12 : 0.3, ease: EASE }}
        className="relative origin-top-left"
      >
        <AnimatePresence>
          {pressed ? (
            <motion.span
              key="ripple"
              initial={{ opacity: 0.55, scale: 0.2 }}
              animate={{ opacity: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="absolute -left-5 -top-5 size-10 rounded-full bg-mk-accent/35"
            />
          ) : null}
        </AnimatePresence>
        <svg width="26" height="26" viewBox="0 0 26 26" className="relative drop-shadow-[0_3px_6px_rgba(15,23,42,0.28)]">
          <path
            d="M3.5 2.5 20.8 13.9a.8.8 0 0 1-.36 1.46l-7.1.86-3.3 6.3a.8.8 0 0 1-1.48-.18L3.5 2.5Z"
            fill="#ffffff"
            stroke="#141414"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}

/** Drawgle's selection frame: hairline outline, corner handles, and a name tag. */
export function PrecisionFrame({
  show,
  label,
  detail,
  inset = -5,
  radius = "inherit",
  tagSide = "top",
}: {
  show: boolean;
  label: string;
  detail?: string;
  inset?: number;
  radius?: string | number;
  tagSide?: "top" | "bottom";
}) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, scale: 1.035 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.32, ease: EASE }}
          aria-hidden="true"
          className="pointer-events-none absolute z-40 border-[1.5px] border-mk-accent"
          style={{ inset, borderRadius: radius }}
        >
          <span className="absolute -left-[5px] -top-[5px] size-2 rounded-[2px] border-[1.5px] border-mk-accent bg-white" />
          <span className="absolute -right-[5px] -top-[5px] size-2 rounded-[2px] border-[1.5px] border-mk-accent bg-white" />
          <span className="absolute -bottom-[5px] -left-[5px] size-2 rounded-[2px] border-[1.5px] border-mk-accent bg-white" />
          <span className="absolute -bottom-[5px] -right-[5px] size-2 rounded-[2px] border-[1.5px] border-mk-accent bg-white" />
          <span
            className={cn(
              "absolute left-0 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-mk-accent px-2.5 py-1 font-mono text-[11px] font-medium leading-none text-white shadow-[0_6px_16px_-6px_rgba(48,93,222,0.6)]",
              tagSide === "top" ? "-top-8" : "-bottom-8",
            )}
          >
            <span className="size-1.5 rounded-full bg-white/80" />
            {label}
            {detail ? <span className="text-white/70">{detail}</span> : null}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Dashed hover outline shown while the pointer is over an editable element. */
export function HoverOutline({ show, inset = -4 }: { show: boolean; inset?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none absolute z-30 rounded-[inherit] border-[1.5px] border-dashed border-mk-accent/60"
      style={{ inset }}
    />
  );
}

/** Small status pill used as captions inside the motion graphics. */
export function StatusChip({
  children,
  tone = "light",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "accent" | "success";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold leading-none",
        tone === "light" && "bg-white text-mk-ink shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.06]",
        tone === "dark" && "bg-mk-ink text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.6)]",
        tone === "accent" && "bg-mk-accent text-white shadow-[0_10px_30px_-12px_rgba(48,93,222,0.7)]",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Monospace design-token readout, e.g. `--radius-card 28px`. */
export function TokenChip({ name, value, swatch, className }: { name: string; value: string; swatch?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 font-mono text-[12px] leading-none text-neutral-500 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.4)] ring-1 ring-black/[0.06]",
        className,
      )}
    >
      {swatch ? <span className="size-3 rounded-full ring-1 ring-black/10 transition-colors duration-500" style={{ backgroundColor: swatch }} /> : null}
      <span>{name}</span>
      <span className="font-semibold text-mk-ink">{value}</span>
    </span>
  );
}

/** Blinking text caret. */
export function Caret({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("mk-caret ml-px inline-block h-[1.05em] w-[1.5px] translate-y-[0.15em] bg-mk-accent", className)} />;
}
