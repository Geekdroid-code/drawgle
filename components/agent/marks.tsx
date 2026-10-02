"use client";

import { useState } from "react";
import { Orbit, Trace } from "loading-dev";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { cn } from "@/lib/utils";

/**
 * The agent's step marks: one rounded-square family. A step still to come is a dotted squircle, the step being worked
 * on is a squircle drawing itself (Trace), a finished step is a solid squircle whose check draws in, and a step that
 * didn't work out is a soft red squircle. The agent itself, while working, is a dot with a ring circling it (Orbit).
 */

// A squircle (continuous-curvature rounded square) inside a 16px box.
const SQUIRCLE = "M8 1.25C12.6 1.25 14.75 3.4 14.75 8S12.6 14.75 8 14.75 1.25 12.6 1.25 8 3.4 1.25 8 1.25Z";
const SQUIRCLE_INNER = "M8 1.9C12.15 1.9 14.1 3.85 14.1 8S12.15 14.1 8 14.1 1.9 12.15 1.9 8 3.85 1.9 8 1.9Z";

export type StepMarkStatus = "queued" | "active" | "done" | "failed" | "skipped";

type MarkProps = { className?: string; size?: number };

const box = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  className: cn("shrink-0", className),
  "aria-hidden": true as const,
  focusable: false as const,
});

export function DoneMark({ className, size = 16, animate = false }: MarkProps & { animate?: boolean }) {
  return (
    <svg {...box(size, cn(animate && "dg-mark-pop", className))} data-mark="done">
      <path d={SQUIRCLE} fill="var(--dg-text)" />
      <path
        d="M5.25 8.3 7.15 10.1 10.8 6.15"
        fill="none"
        stroke="var(--dg-surface)"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={animate ? "dg-mark-draw" : undefined}
      />
    </svg>
  );
}

export function QueuedMark({ className, size = 16 }: MarkProps) {
  return (
    <svg {...box(size, className)} data-mark="queued">
      <path
        d={SQUIRCLE_INNER}
        fill="none"
        stroke="var(--dg-text-faint)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="0 0.0833"
        pathLength={1}
      />
    </svg>
  );
}

export function SkippedMark({ className, size = 16 }: MarkProps) {
  return (
    <svg {...box(size, className)} data-mark="skipped">
      <path d={SQUIRCLE_INNER} fill="none" stroke="var(--dg-text-faint)" strokeWidth={1.1} />
      <path d="M5.9 8h4.2" stroke="var(--dg-text-faint)" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export function FailedMark({ className, size = 16 }: MarkProps) {
  return (
    <svg {...box(size, className)} data-mark="failed">
      <path d={SQUIRCLE} fill="var(--dg-danger)" fillOpacity={0.12} stroke="var(--dg-danger)" strokeOpacity={0.5} strokeWidth={1} />
      <path d="M8 4.85v3.7" stroke="var(--dg-danger)" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx="8" cy="10.95" r="0.95" fill="var(--dg-danger)" />
    </svg>
  );
}

/** A paused or stopped build: the squircle holding still. */
export function PausedMark({ className, size = 16 }: MarkProps) {
  return (
    <svg {...box(size, className)} data-mark="paused">
      <path d={SQUIRCLE_INNER} fill="none" stroke="var(--dg-text-muted)" strokeWidth={1.2} />
      <path d="M6.6 5.9v4.2M9.4 5.9v4.2" stroke="var(--dg-text-muted)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function ActiveMark({ size = 16, className }: MarkProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} data-mark="active">
      <Trace size={size} color="var(--dg-accent)" />
    </span>
  );
}

/**
 * A step's mark. A step that turns done while the person watches settles in with its check drawing; a step that was
 * already done when the chat loaded doesn't animate.
 */
export function StepMark({ status, size = 16, className }: MarkProps & { status: StepMarkStatus }) {
  // The previous status, kept the way React documents for values derived from earlier renders.
  const [previous, setPrevious] = useState(status);
  const [settling, setSettling] = useState(false);
  if (previous !== status) {
    setPrevious(status);
    setSettling(status === "done");
  }
  if (status === "done") return <DoneMark size={size} animate={settling} className={className} />;
  if (status === "active") return <ActiveMark size={size} className={className} />;
  if (status === "failed") return <FailedMark size={size} className={className} />;
  if (status === "skipped") return <SkippedMark size={size} className={className} />;
  return <QueuedMark size={size} className={className} />;
}

export type AgentMarkState = "working" | "idle" | "failed" | "paused";

/** The agent beside its live line: circling while it works, the Drawgle mark at rest. */
export function AgentMark({ state, size = 16, className }: MarkProps & { state: AgentMarkState }) {
  if (state === "working") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} data-agent="working">
        <Orbit size={size} color="var(--dg-accent)" />
      </span>
    );
  }
  if (state === "failed") return <FailedMark size={size} className={className} />;
  if (state === "paused") return <PausedMark size={size} className={className} />;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center text-[var(--dg-text)]", className)} style={{ width: size, height: size }} data-agent="idle">
      <DrawgleLogo className="h-full w-full" />
    </span>
  );
}

/** A live line: the words glint while the work goes on, and read plainly with reduced motion. */
export function LiveText({ children, accent = false, className }: { children: React.ReactNode; accent?: boolean; className?: string }) {
  return <span className={cn("dg-live-text", accent && "dg-live-text-accent", className)}>{children}</span>;
}
