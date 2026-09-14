"use client";
import { useRef, useState } from "react";
import { resumeProductPlanningPrompt } from "@/lib/product-planning/questions";

export function PlanningModeRecovery({ active, disabled, onSubmit }: {
  active: boolean; disabled?: boolean;
  onSubmit: (input: { prompt: string; clientTurnId: string }) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const turnId = useRef<string | null>(null);
  const submitting = useRef(false);
  return <section className="mx-4 mb-4 rounded-xl border border-slate-950/10 p-3 text-xs leading-5 text-slate-500">
    <p>That mode question was shown in error. Your project’s selected mode will be used.</p>
    {active && !done && <button type="button" disabled={disabled || busy} className="mt-2 rounded-lg bg-slate-950 px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
      if (submitting.current) return;
      submitting.current = true; setBusy(true); setError(false);
      turnId.current ??= crypto.randomUUID();
      try {
        const ok = await onSubmit({ prompt: resumeProductPlanningPrompt, clientTurnId: turnId.current });
        setDone(ok); setError(!ok);
      } catch { setError(true); }
      finally { setBusy(false); submitting.current = false; }
    }}>{busy ? "Continuing…" : "Continue planning"}</button>}
    {error && <p role="alert" className="mt-2">Couldn’t continue. Please retry.</p>}
  </section>;
}
