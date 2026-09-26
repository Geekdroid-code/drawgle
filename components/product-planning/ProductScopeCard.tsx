"use client";
import { useState } from "react";
import Image from "next/image";
import { usePlanningLease } from "@/hooks/use-planning-lease";
import { INITIAL_PROJECT_SCREEN_LIMIT } from "@/lib/generation/limits";
import { activeFacts, type ProductPlanning } from "@/lib/product-planning/model";
import { scopeQuote, scopeParents } from "@/lib/product-planning/scope-outputs";

export function ProductScopeCard({ state, projectId, disabled, onApprove }: {
  state: ProductPlanning; projectId?: string; disabled?: boolean; onApprove: (revision: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planningBusy = usePlanningLease(state.lease);
  if (state.scope?.status !== "proposed") return null;
  const surfaces = activeFacts(state, "surfaces");
  const selected = state.scope.surfaceIds.map((id) => surfaces.find((surface) => surface.id === id)).filter((surface) => Boolean(surface));
  const later = surfaces.filter((surface) => !state.scope!.surfaceIds.includes(surface.id));
  const manifest = state.scope.manifest;
  const quote = scopeQuote(state);
  return (
    <section className="mx-4 my-3 min-w-0 rounded-[20px] bg-white p-4 text-sm text-slate-800 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.3)] ring-1 ring-slate-950/[0.09]" aria-label="Current design scope" aria-busy={busy}>
      <p className="text-[11px] font-medium tracking-wide text-slate-500">Ready for your approval</p>
      <h3 className="mt-1 text-[15px] font-semibold leading-6 text-slate-950">{manifest ? "Your screen flow" : "Design first"}</h3>
      <p className="mt-1 text-[12px] leading-5 text-slate-600">{state.scope.goal}</p>
      {manifest && <p className="mt-2 text-xs leading-5 text-slate-500">Journeys: {activeFacts(state, "journeys").filter(f => manifest.some(item => item.journeyIds.includes(f.id))).map(f => f.label).join(", ")}</p>}
      {!!state.scope.journeyCoverage?.length && <details className="mt-2 text-xs leading-5 text-slate-500">
        <summary className="cursor-pointer">Product outcomes & scope</summary>
        <p>{state.scope.requestedScope === "whole_product" ? "Complete product flow" : "Selected part of the product"}</p>
        {state.scope.journeyCoverage.map((journey, index) => <p key={`${journey.journeyId}-${index}`} className="mt-1">
          {journey.outcome}{journey.outputKeys.some(key => !state.scope!.outputKeys?.includes(key) && !state.scope!.existingOutputs?.some(output => output.item.stableKey === key)) ? " — includes later work" : ""}
        </p>)}
      </details>}
      <ol className="mt-4 divide-y divide-slate-950/[0.07] border-y border-slate-950/[0.07]">
        {manifest ? scopeParents(state).map((item, index) => <li key={item.stableKey} className="min-w-0 py-2.5">
          <details><summary className="cursor-pointer break-words text-[12px] font-medium text-slate-900 hover:text-slate-600"><span className="mr-2 font-mono text-[11px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>{item.name}</summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
            <p className="text-xs leading-5 text-slate-500">Outcome: {item.outcome}</p>
            {manifest.filter(state => state.parentStableKey === item.stableKey).map(state => <p key={state.stableKey} className="mt-1 text-xs text-slate-600">↳ {state.name}: {state.triggerLabel}</p>)}
          </details></li>) : selected.map((surface, index) => <li key={surface!.id} className="break-words py-2.5 text-[12px] font-medium"><span className="mr-2 font-mono text-[11px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>{surface!.label}</li>)}
      </ol>
      {later.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">Later: {later.map((surface) => surface.label).join(", ")}</p>}
      {!!state.scope.boundaries?.length && <p className="mt-2 text-xs leading-5 text-slate-500">Flow continues outside this scope: {state.scope.boundaries.map(item => item.name).join(", ")}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">{state.scope.rationale}</p>
      {state.experience && <details className="mt-3 text-xs leading-5 text-slate-500"><summary className="cursor-pointer">Design direction & reference</summary>
        {projectId && state.experience.referenceHash && <Image src={`/api/projects/${projectId}/planning-reference?v=${encodeURIComponent(state.experience.referenceHash)}`} alt="Reference used for this design direction" width={600} height={600} unoptimized className="my-2 max-h-64 w-full rounded-lg object-contain" />}
        <p>{state.experience.direction}</p><p>{state.experience.informationHierarchy}</p><p>{state.experience.navigation}</p><p>{state.experience.adaptations}</p></details>}
      {manifest && <details className="mt-3 text-xs leading-5 text-slate-500"><summary className="cursor-pointer">Assumptions to review</summary>{activeFacts(state).filter(f => f.source === "assumption" && ["decisions", "constraints", "journeys"].includes(f.section)).map(f => <p key={f.id}>{f.detail}</p>)}</details>}
      <p className="mt-3 rounded-lg bg-slate-950/[0.035] px-3 py-2 text-[11px] leading-5 text-slate-600">{quote.parents} screens{quote.states ? ` + ${quote.states} states` : ""} · {quote.credits} credits{!manifest && selected.length > INITIAL_PROJECT_SCREEN_LIMIT ? " for the first batch. The rest stay on the roadmap for a later build." : " for this scope."}</p>
      {manifest && <p className="mt-2 text-xs text-slate-500">All approved screens and states will build in sequence. You can keep using this canvas while they appear.</p>}
      <button type="button" disabled={disabled || busy || planningBusy} className="mt-3 w-full rounded-full bg-slate-950 px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 motion-reduce:transition-none" onClick={async () => {
        setBusy(true); setError(null);
        try { await onApprove(state.revision); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start generation."); } finally { setBusy(false); }
      }}>{busy ? "Starting…" : "Approve & generate"}</button>
      <p className="mt-2 text-xs text-slate-500">Want a different scope? Tell Drawgle in chat.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}
