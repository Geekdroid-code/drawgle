"use client";
import { useRef, useState } from "react";
import { PLANNING_CONTINUE_LABEL } from "@/lib/product-planning/questions";
import type { PlanningFailure } from "@/lib/product-planning/tool-failure";

export function ProductPlanningRecovery({ active, disabled, onSubmit, modeError = false, implementationQuestion = false, failure }: {
  active: boolean; disabled?: boolean; modeError?: boolean; implementationQuestion?: boolean; failure?: PlanningFailure | null;
  onSubmit: (input: { prompt: string; clientTurnId: string; continueProductPlanning: boolean }) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const turnId = useRef<string | null>(null);
  const submitting = useRef(false);
  if (implementationQuestion && !active) return null;
  // The assistant message above already states what stopped; this card only offers the way forward.
  return <section className="mx-4 mb-4 rounded-xl border border-slate-950/10 p-3 text-xs leading-5 text-slate-500">
    <p>{modeError ? "That mode question was shown in error. Your project’s selected mode will be used."
      : implementationQuestion ? "Those questions are not needed for screen design. Continue without answering them."
      : failure?.stage === "update_product"
        ? "A saved product fact needs a specific correction. Continue from the existing roadmap and decisions."
        : failure ? "Continue from where planning stopped. Your saved decisions are kept, and no screens have been generated yet."
        : "Continue from the saved decisions and roadmap. You’ll review the scope before any generation starts."}</p>
    {active && !done && <button type="button" disabled={disabled || busy} className="mt-2 rounded-lg bg-slate-950 px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
      if (submitting.current) return;
      submitting.current = true; setBusy(true); setError(false);
      turnId.current ??= crypto.randomUUID();
      try {
        // Continue is an interface action, not a product request: the server resumes from saved state.
        const ok = await onSubmit({ prompt: PLANNING_CONTINUE_LABEL, continueProductPlanning: true, clientTurnId: turnId.current });
        setDone(ok); setError(!ok);
      } catch { setError(true); }
      finally { setBusy(false); submitting.current = false; }
    }}>{busy ? "Continuing…" : PLANNING_CONTINUE_LABEL}</button>}
    {error && <p role="alert" className="mt-2">Couldn’t continue. Please retry.</p>}
  </section>;
}
