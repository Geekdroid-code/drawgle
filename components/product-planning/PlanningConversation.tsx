"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectData } from "@/lib/types";
import { ProductScopeCard } from "./ProductScopeCard";
import { notifyProjectChanged } from "@/lib/project-refresh";

export function PlanningConversation({ project, disabled }: { project: ProjectData; disabled?: boolean }) {
  const started = useRef(false);
  const approvalRequest = useRef<{ revision: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = project.productPlanning;
  const initialize = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, prompt: "", initializePlanning: true }) });
      const data = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(data.error || "Could not start the conversation.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start the conversation."); } finally { setBusy(false); notifyProjectChanged(project.id); }
  }, [project.id]);
  useEffect(() => {
    if (!state || state.initialTurnComplete || started.current) return;
    started.current = true;
    void initialize();
  }, [initialize, state]);
  if (!state) return null;
  return <>
    {busy && <p className="px-5 py-3 text-sm text-slate-500" role="status">Thinking through your product…</p>}
    {error && <div role="alert" className="px-5 py-3 text-sm text-rose-600">{error} <button type="button" className="underline" onClick={() => void initialize()}>Retry</button></div>}
    <ProductScopeCard state={state} disabled={disabled || busy} onApprove={async (revision) => {
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
