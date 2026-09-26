"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectData } from "@/lib/types";
import { ProductScopeCard } from "./ProductScopeCard";
import { notifyProjectChanged } from "@/lib/project-refresh";
import { initializePlanningConversation } from "@/lib/product-planning/initialize-conversation";
import { usePlanningLease } from "@/hooks/use-planning-lease";

export function PlanningConversation({ project, disabled }: { project: ProjectData; disabled?: boolean }) {
  const started = useRef<string | null>(null);
  const approvalRequest = useRef<{ revision: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForTurn, setWaitingForTurn] = useState(false);
  const state = project.productPlanning;
  const planningBusy = usePlanningLease(state?.lease);
  const initialize = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const result = await initializePlanningConversation(project.id);
      setWaitingForTurn(result.inProgress);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start the conversation."); } finally { setBusy(false); }
  }, [project.id]);
  useEffect(() => {
    if (!state || state.initialTurnComplete || planningBusy || started.current === project.id) return;
    started.current = project.id;
    void initialize();
  }, [initialize, state, planningBusy, project.id]);
  if (!state) return null;
  return <>
    {waitingForTurn && !busy && !planningBusy && !state.initialTurnComplete && <p className="px-5 py-3 text-sm text-slate-500" role="status">Waiting for the current product turn. <button type="button" className="underline" onClick={() => void initialize()}>Check again</button></p>}
    {error && <div role="alert" className="px-5 py-3 text-sm text-rose-600">{error} <button type="button" className="underline disabled:opacity-50" disabled={busy || planningBusy} onClick={() => void initialize()}>Retry</button></div>}
    <ProductScopeCard state={state} projectId={project.id} disabled={disabled || busy} onApprove={async (revision) => {
      if (approvalRequest.current?.revision !== revision) approvalRequest.current = { revision, id: crypto.randomUUID() };
      const response = await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        projectId: project.id, prompt: "Approve this design scope.", productApproval: { revision }, clientRequestId: approvalRequest.current.id,
      }) });
      const data = await response.json();
      notifyProjectChanged(project.id);
      if (!response.ok) throw new Error(data.error || "Could not start generation.");
    }} />
  </>;
}
