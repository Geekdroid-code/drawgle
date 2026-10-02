"use client";

import { useCallback, useRef, useState } from "react";

import { cleanErrorMessage } from "@/lib/errors/user-facing";
import { notifyProjectChanged } from "@/lib/project-refresh";

export type ProductGenerationAction = "resume" | "cancel";

/**
 * Resume or stop an approved flow, through the same endpoint the flow's progress card has always used. A retried
 * request reuses its request id, so a double click or a lost response never resumes twice.
 */
export function useProductGenerationControl(projectId: string) {
  const [busy, setBusy] = useState<ProductGenerationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);

  const act = useCallback(async (action: ProductGenerationAction, approvalId: string) => {
    const key = `${action}:${approvalId}`;
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/product-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, approvalId, requestId: request.current.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update generation.");
      request.current = null;
      return true;
    } catch (failure) {
      setError(cleanErrorMessage(failure instanceof Error ? failure.message : "Could not update generation."));
      return false;
    } finally {
      setBusy(null);
      notifyProjectChanged(projectId);
    }
  }, [projectId]);

  return { act, busy, error };
}
