"use client";
import { notifyProjectChanged } from "@/lib/project-refresh";

// Chat may close/reopen or mount twice in Strict Mode while the first turn runs.
// Share only pending requests; completed/failed requests remain retryable.
const pending = new Map<string, Promise<{ inProgress: boolean }>>();

export function initializePlanningConversation(projectId: string): Promise<{ inProgress: boolean }> {
  const existing = pending.get(projectId);
  if (existing) return existing;
  const request = (async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: "", initializePlanning: true }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(data.error || "Could not start the conversation.");
      // A conflict means another turn owns the lease. Refresh state once and wait
      // for realtime completion; never automatically retry the conflicting POST.
      return { inProgress: response.status === 409 };
    } finally {
      pending.delete(projectId);
      notifyProjectChanged(projectId);
    }
  })();
  pending.set(projectId, request);
  return request;
}
