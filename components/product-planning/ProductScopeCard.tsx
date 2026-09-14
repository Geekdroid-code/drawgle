"use client";
import { useState } from "react";
import { usePlanningLease } from "@/hooks/use-planning-lease";
import { INITIAL_PROJECT_SCREEN_LIMIT } from "@/lib/generation/limits";
import { activeFacts, type ProductPlanning } from "@/lib/product-planning/model";

export function ProductScopeCard({ state, disabled, onApprove }: {
  state: ProductPlanning; disabled?: boolean; onApprove: (revision: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planningBusy = usePlanningLease(state.lease);
  if (state.scope?.status !== "proposed") return null;
  const surfaces = activeFacts(state, "surfaces");
  const selected = state.scope.surfaceIds.map((id) => surfaces.find((surface) => surface.id === id)).filter((surface) => Boolean(surface));
  const later = surfaces.filter((surface) => !state.scope!.surfaceIds.includes(surface.id));
  return (
    <section className="mx-4 my-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800" aria-label="Current design scope">
      <p className="font-semibold">Design first</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{state.scope.goal}</p>
      <ol className="mt-3 space-y-2">
        {selected.map((surface, index) => <li key={surface!.id}><span className="mr-2 text-slate-400">{index + 1}.</span>{surface!.label}</li>)}
      </ol>
      {later.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">Later: {later.map((surface) => surface.label).join(", ")}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">{state.scope.rationale}</p>
      <p className="mt-2 text-xs text-slate-500">{Math.min(selected.length, INITIAL_PROJECT_SCREEN_LIMIT)} screens · {Math.min(selected.length, INITIAL_PROJECT_SCREEN_LIMIT) * 20} credits{selected.length > INITIAL_PROJECT_SCREEN_LIMIT ? " for the first batch. The rest stay on the roadmap for a later build." : "."}</p>
      <button type="button" disabled={disabled || busy || planningBusy} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-2.5 font-medium text-white disabled:opacity-50" onClick={async () => {
        setBusy(true); setError(null);
        try { await onApprove(state.revision); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start generation."); } finally { setBusy(false); }
      }}>{busy ? "Starting…" : "Approve & generate"}</button>
      <p className="mt-2 text-xs text-slate-500">Want a different scope? Tell Drawgle in chat.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}
