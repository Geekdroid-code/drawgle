"use client";
import { useRef, useState } from "react";
import type { GenerationRunData, ScreenData } from "@/lib/types";
import { notifyProjectChanged } from "@/lib/project-refresh";
import { cleanErrorMessage } from "@/lib/errors/user-facing";

export function ProductExecutionCard({ projectId, runs, screens }: { projectId: string; runs: GenerationRunData[]; screens: ScreenData[] }) {
  const root = runs.find(run => {
    const product = run.metadata?.productPlanning as { scope?: { manifest?: unknown[] } } | undefined;
    return product?.scope?.manifest?.length && !run.metadata?.productApprovalId;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  if (!root || root.status === "completed") return null;
  const childIds = new Set(runs.filter(run => run.metadata?.productApprovalId === root.id).map(run => run.id));
  const progress = root.metadata?.productProgress as { delivered?: number; failed?: number; blocked?: number; pending?: number } | undefined;
  const delivered = progress?.delivered ?? screens.filter(screen => childIds.has(screen.generationRunId ?? "") && screen.status === "ready").length;
  const manifest = (root.metadata?.productPlanning as { scope: { manifest: unknown[] } }).scope.manifest;
  const stopped = root.status === "failed" || root.status === "canceled";
  const act = async (action: "resume" | "cancel") => {
    setBusy(true); setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/projects/${projectId}/product-generation`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, approvalId: root.id, requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update generation.");
      requestId.current = null;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update generation."); }
    finally { setBusy(false); notifyProjectChanged(projectId); }
  };
  return <section className="mx-4 my-2 min-w-0 rounded-xl bg-slate-950/[0.035] px-3.5 py-3 text-slate-800" aria-label="Approved flow progress">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold">{stopped ? "Approved flow paused" : "Building your approved flow"}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{delivered} of {manifest.length} screens and states delivered{progress ? ` · ${progress.pending ?? 0} pending · ${progress.blocked ?? 0} blocked · ${progress.failed ?? 0} failed` : ""}</p>
      </div>
      <button type="button" disabled={busy} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-950/[0.06] hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50" onClick={() => void act(stopped ? "resume" : "cancel")}>{busy ? "Updating…" : stopped ? "Resume remaining work" : "Stop after current batch"}</button>
    </div>
    {root.error && <p className="mt-2 break-words text-[11px] leading-5 text-rose-600">{cleanErrorMessage(root.error)}</p>}
    {error && <p className="mt-2 text-[11px] text-rose-600" role="alert">{cleanErrorMessage(error)}</p>}
  </section>;
}
