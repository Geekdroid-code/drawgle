import type { DesignTokens } from "@/lib/types";

export async function saveDesignTokens(projectId: string, tokens: DesignTokens, expectedRevision: number, signal?: AbortSignal) {
  const response = await fetch(`/api/projects/${projectId}/design-tokens`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ tokens, expectedRevision, requestId: crypto.randomUUID() }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Could not save design tokens.");
  return result as { status: "success"; revision: number };
}
