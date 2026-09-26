"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Circle, Loader2, Sparkles } from "lucide-react";
import type { GenerationJournalMetadata } from "@/lib/types";

type PhaseStatus = GenerationJournalMetadata["phases"][number]["status"];
type ScreenStatus = NonNullable<GenerationJournalMetadata["screens"]>[number]["status"];

function PhaseIcon({ status }: { status: PhaseStatus }) {
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-rose-600" />;
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-700 motion-reduce:animate-none" />;
  if (status === "completed") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  return <Circle className="h-3 w-3 text-slate-300" />;
}

function screenStatusLabel(status?: ScreenStatus) {
  switch (status) {
    case "briefing": return "Writing brief";
    case "preparing_assets": return "Preparing assets";
    case "ready": return "Ready";
    case "failed": return "Failed";
    case "building": return "Building";
    case "queued": return "Queued";
    default: return "Planned";
  }
}

export function GenerationJournalCard({ journal }: { journal: GenerationJournalMetadata }) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const busy = ["queued", "planning", "building"].includes(journal.status);
  const expanded = manualExpanded ?? busy;
  const failed = journal.status === "failed";
  const activePhase = journal.phases.find(phase => phase.status === "active");
  const detail = activePhase?.detail || journal.detail;

  return <section className="mx-4 my-2 min-w-0 rounded-[18px] bg-white px-4 py-3 text-slate-800 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-950/[0.08]" aria-label="Screen generation progress">
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {failed ? <AlertCircle className="h-4 w-4 text-rose-600" />
          : busy ? <Sparkles className="h-4 w-4 text-slate-700" />
            : <Check className="h-4 w-4 text-emerald-600" />}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-[13px] font-semibold leading-5 text-slate-950" role={busy ? "status" : undefined}>{journal.title}</h3>
        {detail && <p className="mt-0.5 break-words text-[11.5px] leading-5 text-slate-500">{detail}</p>}
      </div>
    </div>

    <div className="mt-3 grid grid-cols-7 gap-1" aria-label="Generation phases">
      {journal.phases.map(phase => <span key={phase.id} title={`${phase.label}: ${phase.status}`} className={`h-1 rounded-full ${phase.status === "failed" ? "bg-rose-500" : phase.status === "completed" ? "bg-slate-950" : phase.status === "active" ? "bg-indigo-500" : "bg-slate-950/[0.09]"}`} />)}
    </div>

    <button type="button" aria-expanded={expanded} onClick={() => setManualExpanded(value => !(value ?? busy))}
      className="mt-2 flex items-center gap-1 rounded text-[11px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
      {expanded ? "Hide steps" : "Show steps"}
      <ChevronDown className={`h-3 w-3 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
    </button>

    {expanded && <div className="mt-3 border-t border-slate-950/[0.07] pt-3">
      <ol className="space-y-2.5">
        {journal.phases.map(phase => <li key={phase.id} className="flex min-w-0 items-start gap-2 text-[11.5px] leading-5">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"><PhaseIcon status={phase.status} /></span>
          <div className="min-w-0 flex-1">
            <span className="font-medium text-slate-800">{phase.label}</span>
            {phase.detail && <p className="break-words text-slate-500">{phase.detail}</p>}
          </div>
        </li>)}
      </ol>

      {Boolean(journal.screens?.length) && <div className="mt-4 border-t border-slate-950/[0.07] pt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-slate-600">Screens</p>
        <ul className="divide-y divide-slate-950/[0.06]">
          {journal.screens?.map((screen, index) => <li key={`${screen.name}-${index}`} className="min-w-0 py-2">
            <details className="group/screen min-w-0">
              <summary className="flex cursor-pointer list-none items-start gap-2 rounded text-[11.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 break-words font-medium text-slate-800">{screen.name}</span>
                <span className={`shrink-0 text-[10.5px] font-medium ${screen.status === "failed" ? "text-rose-600" : screen.status === "ready" ? "text-emerald-700" : "text-slate-500"}`}>{screenStatusLabel(screen.status)}</span>
                <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 group-open/screen:rotate-180" />
              </summary>
              <div className="mt-1.5 break-words pr-5 text-[11px] leading-5 text-slate-500">
                {screen.description && <p>{screen.description}</p>}
                <p>{[screen.type, screen.chrome ? `${screen.chrome} navigation` : null, screen.assetNeedCount ? `${screen.assetNeedCount} asset ${screen.assetNeedCount === 1 ? "need" : "needs"}` : null].filter(Boolean).join(" · ")}</p>
              </div>
            </details>
          </li>)}
        </ul>
      </div>}

      {journal.assetSummary && <p className="mt-3 border-t border-slate-950/[0.07] pt-3 text-[11px] leading-5 text-slate-500">
        Assets: {journal.assetSummary.resolved} resolved, {journal.assetSummary.placeholders} placeholders, {journal.assetSummary.failures ?? 0} failed.
      </p>}
    </div>}
  </section>;
}
