"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

import type { WorkTrace, WorkTraceStep } from "@/lib/agent/work-trace";
import { AgentBlock, TimelineStep } from "./AgentBlock";
import type { AgentMarkState, StepMarkStatus } from "./marks";

const stepStatus = (step: WorkTraceStep): StepMarkStatus =>
  step.status === "active" ? "active" : step.status === "failed" ? "failed" : "done";

/** The agent's reasoning, set as quiet text under its step: three lines, then the rest on request. */
function Thought({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-0.5">
      <div className={`text-[11.5px] leading-[18px] text-[var(--dg-text-muted)] ${expanded ? "" : "line-clamp-4"}`}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-1 list-disc space-y-0.5 pl-4">{children}</ul>,
            ol: ({ children }) => <ol className="mb-1 list-decimal space-y-0.5 pl-4">{children}</ol>,
            strong: ({ children }) => <strong className="font-medium text-[var(--dg-text)]">{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-0.5 text-[11px] font-medium text-[var(--dg-text-faint)] hover:text-[var(--dg-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dg-accent)]"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

/**
 * The agent's own steps for a turn (planning the flow, or an edit): its mark and live line, then each step. The
 * flow preview the planner writes becomes this turn's "Thought process", placed after the step it came out of.
 */
export function PlanningTraceBlock({ trace, thought, keepOpen = false }: {
  trace: WorkTrace;
  thought?: { content: string; at: string } | null;
  /** Keep the steps open after the turn ends, while its approval card waits under it. */
  keepOpen?: boolean;
}) {
  const latest = trace.steps.at(-1);
  if (!latest) return null;
  const active = trace.steps.find((step) => step.status === "active");
  const failed = [...trace.steps].reverse().find((step) => step.status === "failed");
  const state: AgentMarkState = trace.status === "active" ? "working" : trace.status === "failed" ? "failed" : "idle";
  const title = (trace.status === "active" ? active ?? latest : trace.status === "failed" ? failed ?? latest : latest).title;
  const thoughtAfter = thought
    ? trace.steps.reduce((index, step, stepIndex) => step.startedAt <= thought.at ? stepIndex : index, -1)
    : -1;

  const thoughtStep = thought ? (
    <TimelineStep key="thought" status="done" title="Thought process">
      <Thought content={thought.content} />
    </TimelineStep>
  ) : null;

  return (
    <AgentBlock defaultOpen={keepOpen} state={state} title={title} label="Agent work steps">
      {thoughtAfter < 0 ? thoughtStep : null}
      {trace.steps.map((step, index) => (
        <StepWithThought key={step.id} step={step} thought={index === thoughtAfter ? thoughtStep : null} />
      ))}
    </AgentBlock>
  );
}

function StepWithThought({ step, thought }: { step: WorkTraceStep; thought: React.ReactNode }) {
  const status = stepStatus(step);
  const detail = (status === "active" || status === "failed") && step.detail && step.detail !== "Completed." ? step.detail : null;
  return (
    <>
      <TimelineStep status={status} title={step.title} detail={detail} />
      {thought}
    </>
  );
}
