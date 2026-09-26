"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, Sparkles, Wrench } from "lucide-react";
import type { WorkTrace, WorkTraceStep } from "@/lib/agent/work-trace";

function StepMark({ step }: { step: WorkTraceStep }) {
  if (step.status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-rose-600" />;
  if (step.status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-700 motion-reduce:animate-none" />;
  return <Check className="h-3.5 w-3.5 text-emerald-600" />;
}

export function WorkTraceCard({ trace }: { trace: WorkTrace }) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? trace.status === "active";
  const latest = trace.steps.at(-1);
  if (!latest) return null;
  const title = latest.title;

  return <section className="min-w-0 px-5 py-2 text-slate-800" aria-label="Agent work steps">
    <button type="button" aria-expanded={expanded} aria-controls={`trace-${trace.turnId}`}
      onClick={() => setManualExpanded(value => !(value ?? trace.status === "active"))}
      className="group flex w-full min-w-0 items-center gap-2 rounded-lg py-1 text-left hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-600">
        {trace.status === "active" ? <Sparkles className="h-4 w-4" /> : trace.status === "failed"
          ? <AlertCircle className="h-4 w-4 text-rose-600" /> : <Check className="h-4 w-4 text-emerald-600" />}
      </span>
      <span className="min-w-0 flex-1 break-words text-[12.5px] font-medium leading-5" role={trace.status === "active" ? "status" : undefined}>
        {title}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{trace.status === "failed" ? "Needs review" : trace.status === "completed" ? "Done" : `${trace.steps.length} ${trace.steps.length === 1 ? "step" : "steps"}`}</span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <ol id={`trace-${trace.turnId}`} className="ml-[9px] mt-1 space-y-0.5 border-l border-slate-200 pl-4">
      {trace.steps.map(step => <li key={step.id} className="min-w-0 rounded-md py-1">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            {step.kind === "tool" && step.status === "completed" ? <Wrench className="h-3 w-3 text-slate-500" /> : <StepMark step={step} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-[12px] font-medium leading-5 text-slate-700">{step.title}</div>
            {step.detail && step.detail !== "Completed." && <p className="mt-0.5 break-words text-[11.5px] leading-5 text-slate-500">{step.detail}</p>}
          </div>
        </div>
      </li>)}
    </ol>}
  </section>;
}
