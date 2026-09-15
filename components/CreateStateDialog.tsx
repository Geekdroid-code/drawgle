"use client";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import type { ScreenData } from "@/lib/types";

export function CreateStateDialog({ screen, projectId, busy, onClose, onQueued }: {
  screen: ScreenData; projectId: string; busy: boolean; onClose: () => void;
  onQueued: (runId: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ id: string; prompt: string } | null>(null);
  const inFlight = useRef(false);
  const submit = async () => {
    if (inFlight.current || (busy && !request.current) || prompt.trim().length < 3) return;
    inFlight.current = true; setSubmitting(true); setError(null);
    if (!request.current || request.current.prompt !== prompt.trim()) request.current = { id: crypto.randomUUID(), prompt: prompt.trim() };
    try {
      const response = await fetch("/api/agent/screen-state/create", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, parentScreenId: screen.id, requestId: request.current.id, prompt: request.current.prompt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create this state.");
      await onQueued(result.generationRunId); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Please retry."); }
    finally { inFlight.current = false; setSubmitting(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Create state</DialogTitle><DialogDescription>A new state of {screen.name}. Your original screen stays intact.</DialogDescription></DialogHeader>
      <label htmlFor="state-description" className="text-sm font-medium">Describe the state you want</label>
      <textarea id="state-description" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={3000} disabled={submitting}
        className="min-h-32 w-full rounded-xl border bg-transparent p-3 text-sm" placeholder="What changes on this screen, and what caused it?" />
      <p className="text-sm text-muted-foreground">{STATE_GENERATION_CREDIT_COST} credits · One additional canvas frame</p>
      {busy && <p role="status" className="text-sm">Another generation is running. Your description will stay here while it finishes.</p>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={submit} disabled={(busy && !error) || submitting || prompt.trim().length < 3}>{submitting ? "Creating…" : "Create state"}</Button></div>
    </DialogContent>
  </Dialog>;
}
