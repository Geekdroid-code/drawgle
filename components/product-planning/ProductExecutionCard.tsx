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
  return <section className="mx-4 my-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181a20] p-4 text-sm text-slate-900 dark:text-slate-100 shadow-sm" aria-label="Approved flow progress">
    <p className="font-medium">{stopped ? "Approved flow paused" : "Building your approved flow"}</p>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{delivered} of {manifest.length} screens and states delivered.</p>
    {progress && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{progress.pending ?? 0} pending · {progress.blocked ?? 0} blocked · {progress.failed ?? 0} failed</p>}
    {root.error && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 p-2.5 rounded-lg border border-slate-200/60 dark:border-white/10">{cleanErrorMessage(root.error)}</p>}
    <button disabled={busy} className="mt-3 text-xs underline font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-50" onClick={() => void act(stopped ? "resume" : "cancel")}>{busy ? "Updating…" : stopped ? "Resume remaining work" : "Stop after current batch"}</button>
    {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400" role="alert">{cleanErrorMessage(error)}</p>}
  </section>;
}
