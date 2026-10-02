"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { AgentMark, LiveText, StepMark, type AgentMarkState, type StepMarkStatus } from "./marks";

/**
 * One agent turn in chat: the agent's mark beside one live line, and under it a quiet timeline of what it did. Open
 * while the agent works; once it is done it folds to its line and one sentence, and opens again on a click.
 */
export function AgentBlock({
  state,
  title,
  meta,
  summary,
  footer,
  label,
  defaultOpen = false,
  children,
}: {
  state: AgentMarkState;
  title: string;
  /** A short count on the right of the line, like "3 of 5". */
  meta?: string | null;
  /** One sentence under the line once the work has ended. */
  summary?: ReactNode;
  /** Actions or notes that stay visible even when the timeline is folded. */
  footer?: ReactNode;
  label: string;
  /** Stay open after the work ends, e.g. while the person still has to act under it. */
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const working = state === "working";
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? (working || defaultOpen);
  const listId = useId();
  const hasSteps = Boolean(children);

  return (
    <section className="min-w-0 px-4 py-2 text-[var(--dg-text)]" aria-label={label}>
      <button
        type="button"
        aria-expanded={hasSteps ? open : undefined}
        aria-controls={hasSteps ? listId : undefined}
        disabled={!hasSteps}
        onClick={() => setManualOpen(!open)}
        className="group flex w-full min-w-0 items-center gap-2.5 rounded-lg py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-accent)] disabled:cursor-default"
      >
        <AgentMark state={state} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5" role={working ? "status" : undefined}>
          {working ? <LiveText>{title}…</LiveText> : title}
        </span>
        {meta ? <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--dg-text-muted)]">{meta}</span> : null}
        {hasSteps ? (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--dg-text-faint)] transition-transform duration-200 group-hover:text-[var(--dg-text-muted)] motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        ) : null}
      </button>
      {summary ? <div className="mt-0.5 pl-[26px] text-[12px] leading-5 text-[var(--dg-text-muted)]">{summary}</div> : null}
      {hasSteps && open ? (
        <ol id={listId} className="relative mt-1.5 space-y-0.5">
          {/* the thread that ties the marks together */}
          <span aria-hidden="true" className="absolute bottom-3 left-[7.5px] top-3 w-px bg-[var(--dg-border-strong)]" />
          {children}
        </ol>
      ) : null}
      {footer ? <div className="mt-2 pl-[26px]">{footer}</div> : null}
    </section>
  );
}

/** One step on the timeline: its mark, what happened, and (for the step in progress) what it is doing now. */
export function TimelineStep({
  status,
  title,
  detail,
  indent = false,
  children,
}: {
  status: StepMarkStatus;
  title: ReactNode;
  detail?: ReactNode;
  /** A state, under its screen. */
  indent?: boolean;
  children?: ReactNode;
}) {
  const quiet = status === "queued" || status === "skipped";
  return (
    <li className={cn("relative flex min-w-0 gap-2.5", indent && "pl-[18px]")}>
      <span className="relative z-10 mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-[var(--dg-surface)]">
        <StepMark status={status} size={indent ? 14 : 16} />
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <div className={cn(
          "break-words text-[12.5px] leading-5",
          quiet ? "text-[var(--dg-text-muted)]" : "text-[var(--dg-text)]",
          status === "active" && "font-medium",
          status === "failed" && "text-[var(--dg-danger)]",
        )}>
          {status === "active" ? <LiveText accent>{title}</LiveText> : title}
        </div>
        {detail ? <div className="break-words text-[11.5px] leading-[18px] text-[var(--dg-text-muted)]">{detail}</div> : null}
        {children}
      </div>
    </li>
  );
}
