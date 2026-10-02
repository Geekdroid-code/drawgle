"use client";
import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

import { usePlanningLease } from "@/hooks/use-planning-lease";
import { INITIAL_PROJECT_SCREEN_LIMIT } from "@/lib/generation/limits";
import { activeFacts, describeScopeNavigation, type ProductPlanning } from "@/lib/product-planning/model";
import { scopeQuote, scopeParents } from "@/lib/product-planning/scope-outputs";

/**
 * The approval card in the agent timeline: the flow as a short numbered list of screens (each opens to its purpose
 * and its states), the navigation, what comes later, and one Approve button. Everything else the planner decided
 * (journeys, outcomes, rationale, design direction, assumptions) sits under "Details". Same approval as before.
 */
export function FlowApprovalCard({ state, projectId, disabled, onApprove }: {
  state: ProductPlanning; projectId?: string; disabled?: boolean; onApprove: (revision: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planningBusy = usePlanningLease(state.lease);
  if (state.scope?.status !== "proposed") return null;
  const scope = state.scope;
  const surfaces = activeFacts(state, "surfaces");
  const selected = scope.surfaceIds.map((id) => surfaces.find((surface) => surface.id === id)).filter((surface) => Boolean(surface));
  const later = surfaces.filter((surface) => !scope.surfaceIds.includes(surface.id));
  const manifest = scope.manifest;
  const quote = scopeQuote(state);
  const navigation = scope.navigation ? describeScopeNavigation(scope.navigation) : null;
  const journeys = manifest ? activeFacts(state, "journeys").filter((fact) => manifest.some((item) => item.journeyIds.includes(fact.id))) : [];
  const assumptions = manifest ? activeFacts(state).filter((fact) => fact.source === "assumption" && ["decisions", "constraints", "journeys"].includes(fact.section)) : [];
  const blocked = disabled || busy || planningBusy;

  return (
    <section className="mx-4 my-2 min-w-0 overflow-hidden rounded-2xl border border-[var(--dg-border-strong)] bg-[var(--dg-surface)] text-[var(--dg-text)]" aria-label="Current design scope" aria-busy={busy}>
      <div className="px-4 pt-3.5">
        <h3 className="text-[13.5px] font-semibold leading-5">{manifest ? "Review your flow" : "Review the first screens"}</h3>
        <p className="mt-0.5 text-[12px] leading-5 text-[var(--dg-text-muted)]">{scope.goal}</p>
      </div>

      <ol className="mt-3 border-t border-[var(--dg-border)]">
        {manifest ? scopeParents(state).map((item, index) => {
          const states = manifest.filter((entry) => entry.parentStableKey === item.stableKey);
          return (
            <li key={item.stableKey} className="border-b border-[var(--dg-border)] last:border-b-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-[var(--dg-surface-muted)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--dg-accent)] [&::-webkit-details-marker]:hidden">
                  <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-[var(--dg-text-faint)]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 break-words text-[12.5px] font-medium leading-5">{item.name}</span>
                  {states.length ? <span className="shrink-0 text-[11px] text-[var(--dg-text-muted)]">{states.length} {states.length === 1 ? "state" : "states"}</span> : null}
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--dg-text-faint)] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <div className="space-y-1 px-4 pb-3 pl-12 text-[11.5px] leading-5 text-[var(--dg-text-muted)]">
                  <p>{item.description}</p>
                  <p>Outcome: {item.outcome}</p>
                  {states.map((entry) => <p key={entry.stableKey} className="text-[var(--dg-text)]">↳ {entry.name}: {entry.triggerLabel}</p>)}
                </div>
              </details>
            </li>
          );
        }) : selected.map((surface, index) => (
          <li key={surface!.id} className="flex items-center gap-3 border-b border-[var(--dg-border)] px-4 py-2.5 last:border-b-0">
            <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-[var(--dg-text-faint)]">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 break-words text-[12.5px] font-medium leading-5">{surface!.label}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-1.5 border-t border-[var(--dg-border)] px-4 py-3 text-[11.5px] leading-5 text-[var(--dg-text-muted)]">
        {navigation ? (
          <p>{navigation.line}
            {navigation.planned.length > 0 ? <span> ({navigation.planned.join(", ")} come{navigation.planned.length === 1 ? "s" : ""} later)</span> : null}
          </p>
        ) : null}
        {later.length > 0 ? <p>Later: {later.map((surface) => surface.label).join(", ")}</p> : null}
        {scope.boundaries?.length ? <p>Flow continues outside this scope: {scope.boundaries.map((item) => item.name).join(", ")}</p> : null}
        <details className="group/details">
          <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-[var(--dg-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dg-accent)] [&::-webkit-details-marker]:hidden">
            Details
            <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open/details:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="mt-1.5 space-y-2">
            {journeys.length ? <p>Journeys: {journeys.map((fact) => fact.label).join(", ")}</p> : null}
            {scope.journeyCoverage?.length ? (
              <div>
                <p>{scope.requestedScope === "whole_product" ? "Complete product flow" : "Selected part of the product"}</p>
                {scope.journeyCoverage.map((journey, index) => (
                  <p key={`${journey.journeyId}-${index}`}>
                    {journey.outcome}{journey.outputKeys.some((key) => !scope.outputKeys?.includes(key) && !scope.existingOutputs?.some((output) => output.item.stableKey === key)) ? " — includes later work" : ""}
                  </p>
                ))}
              </div>
            ) : null}
            <p>{scope.rationale}</p>
            {state.experience ? (
              <div>
                <p className="font-medium text-[var(--dg-text)]">Design direction & reference</p>
                {projectId && state.experience.referenceHash ? (
                  <Image src={`/api/projects/${projectId}/planning-reference?v=${encodeURIComponent(state.experience.referenceHash)}`} alt="Reference used for this design direction" width={600} height={600} unoptimized className="my-2 max-h-56 w-full rounded-lg object-contain" />
                ) : null}
                <p>{state.experience.direction}</p><p>{state.experience.informationHierarchy}</p><p>{state.experience.navigation}</p><p>{state.experience.adaptations}</p>
              </div>
            ) : null}
            {assumptions.length ? (
              <div>
                <p className="font-medium text-[var(--dg-text)]">Assumptions to review</p>
                {assumptions.map((fact) => <p key={fact.id}>{fact.detail}</p>)}
              </div>
            ) : null}
          </div>
        </details>
      </div>

      <div className="border-t border-[var(--dg-border)] px-4 pb-3.5 pt-3">
        <p className="text-[11.5px] leading-5 text-[var(--dg-text-muted)]">
          {quote.parents} screens{quote.states ? ` + ${quote.states} states` : ""} · {quote.credits} credits{!manifest && selected.length > INITIAL_PROJECT_SCREEN_LIMIT ? " for the first batch. The rest stay on the roadmap for a later build." : ""}
        </p>
        <button
          type="button"
          disabled={blocked}
          onClick={async () => {
            setBusy(true); setError(null);
            try { await onApprove(state.revision); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start generation."); } finally { setBusy(false); }
          }}
          className="mt-2.5 w-full rounded-full bg-[var(--dg-text)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--dg-surface)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-accent)] disabled:opacity-50 motion-reduce:transition-none"
        >
          {busy ? "Starting…" : "Approve & generate"}
        </button>
        <p className="mt-2 text-center text-[11px] text-[var(--dg-text-faint)]">Want a different scope? Tell Drawgle in chat.</p>
        {error ? <p role="alert" className="mt-2 text-[11.5px] text-[var(--dg-danger)]">{error}</p> : null}
      </div>
    </section>
  );
}
