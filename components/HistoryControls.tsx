"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, RotateCw, History } from "lucide-react";
import { buildStandaloneHtmlExport, resolveScreenNavigationCode } from "@/lib/export-pipeline";
import type { HistoryTarget } from "@/lib/design-history/types";
import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";

type Entry = { id: string; label: string; createdAt: string; isCurrent: boolean };
type Listing = { revision: number; canUndo: boolean; canRedo: boolean; entries: Entry[] };
type Preview = { id: string; label: string; payload: Record<string, unknown> };
const query = (target: HistoryTarget) => new URLSearchParams(target.context === "screen"
  ? { context: "screen", screenId: target.screenId } : { context: target.context }).toString();
const editingFocus = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || Boolean(target.closest("input, textarea, [contenteditable], [role='textbox']")));

export function HistoryControls({ projectId, target, screenName, screens, navigation, tokens, disabledReason, onApplied }: {
  projectId: string; target: HistoryTarget | null; screenName?: string;
  screens: ScreenData[]; navigation: ProjectNavigationData | null; tokens: DesignTokens | null;
  disabledReason?: string | null; onApplied: () => void | Promise<void>;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const targetKey = target ? query(target) : "";
  const refresh = useCallback(async () => {
    if (!target) { setListing(null); return; }
    const response = await fetch(`/api/projects/${projectId}/history?${query(target)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Recent changes are unavailable. Refresh and try again.");
    setListing(await response.json() as Listing);
  }, [projectId, targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    if (targetKey) {
      void fetch(`/api/projects/${projectId}/history?${targetKey}`, { cache: "no-store" })
        .then(async response => {
          if (!response.ok) throw new Error("Recent changes are unavailable. Refresh and try again.");
          return response.json() as Promise<Listing>;
        })
        .then(result => { if (!cancelled) setListing(result); })
        .catch(err => { if (!cancelled) setError(err.message); });
    }
    return () => { cancelled = true; };
  }, [projectId, targetKey]);
  const run = useCallback(async (action: "undo" | "redo" | "restore", entryId?: string) => {
    if (!target || !listing || working) return;
    if (disabledReason) { setError(disabledReason); return; }
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/history`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, action, entryId, expectedRevision: listing.revision, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.status === "busy_target" ? "Wait for the active design job to finish." :
        result.status === "incompatible_navigation" ? "Screens changed since this navigation version. It cannot be restored as a whole." :
        result.status === "stale_revision" ? "The design changed in another tab. Refresh Recent changes." :
        result.error || "This history entry is unavailable. Refresh Recent changes.");
      setPreview(null); setOpen(false);
      await onApplied();
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Recovery failed."); void refresh().catch(() => undefined); }
    finally { setWorking(false); }
  }, [disabledReason, listing, onApplied, projectId, refresh, target, working]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!target || !(event.ctrlKey || event.metaKey) || event.altKey || editingFocus(event.target)) return;
      const key = event.key.toLowerCase();
      const action = key === "z" ? event.shiftKey ? "redo" : "undo" : key === "y" && event.ctrlKey && !event.metaKey ? "redo" : null;
      if (!action) return;
      event.preventDefault();
      void run(action);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [run, target]);
  const targetLabel = target?.context === "screen" ? `change to ${screenName || "screen"}` :
    target?.context === "navigation" ? "shared navigation change" : "design-token change";
  const failedScreen = target?.context === "screen" ? screens.find(s => s.id === target.screenId && s.status === "failed") : null;
  const restoreLastGood = async () => {
    if (!failedScreen || !listing || working || disabledReason) return;
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/restore-last-good`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screenId: failedScreen.id,
          expectedRevision: listing.revision, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Last good design unavailable. Refresh and retry.");
      await onApplied(); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not restore the last good design."); }
    finally { setWorking(false); }
  };
  const visual = useMemo(() => {
    if (!preview || !target) return null;
    const sample = target.context === "screen" ? screens.find(s => s.id === target.screenId) : screens.find(s => s.sourceLoaded);
    if (!sample) return null;
    const code = target.context === "screen" ? preview.payload.code : sample.code;
    if (typeof code !== "string" || !code.trim()) return null;
    const candidateTokens = target.context === "tokens" ? preview.payload.tokens as DesignTokens | null : tokens;
    const navigationCode = target.context === "navigation" ? preview.payload.shellCode as string : resolveScreenNavigationCode(sample, navigation);
    return buildStandaloneHtmlExport({ screen: { ...sample, code }, navigationCode, designTokens: candidateTokens,
      activeNavigationItemId: sample.navigationItemId });
  }, [navigation, preview, screens, target, tokens]);
  if (!target) return null;
  return <div className="relative flex items-center gap-1" data-testid="history-controls">
    <button type="button" aria-label={`Undo ${targetLabel}`} title={`Undo ${targetLabel}`} disabled={!listing?.canUndo || !!disabledReason || working}
      onClick={() => void run("undo")} className="rounded-md p-1 text-slate-700 disabled:opacity-40"><RotateCcw className="h-4 w-4" /></button>
    <button type="button" aria-label={`Redo ${targetLabel}`} title={`Redo ${targetLabel}`} disabled={!listing?.canRedo || !!disabledReason || working}
      onClick={() => void run("redo")} className="rounded-md p-1 text-slate-700 disabled:opacity-40"><RotateCw className="h-4 w-4" /></button>
    <button type="button" aria-label="Recent changes" title="Recent changes" onClick={() => setOpen(value => !value)} className="rounded-md p-1 text-slate-700"><History className="h-4 w-4" /></button>
    {failedScreen && <button type="button" disabled={!!disabledReason || working} onClick={() => void restoreLastGood()}
      className="rounded-md px-2 text-xs text-amber-700 disabled:opacity-40">Restore last good design</button>}
    {open && <div role="dialog" aria-label="Recent changes" className="absolute right-0 top-full z-50 max-h-[70vh] w-80 overflow-y-auto rounded-xl border bg-white p-3 shadow-xl dark:bg-neutral-900">
      <p className="text-sm font-semibold">Recent changes · {target.context === "screen" ? screenName : target.context}</p>
      {disabledReason && <p className="text-xs text-amber-700">{disabledReason}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {!listing?.entries.length && <p className="py-3 text-xs text-slate-500">No retained changes yet.</p>}
      {listing?.entries.map(entry => <button key={entry.id} type="button" className="block w-full border-b py-2 text-left text-xs"
        onClick={() => { void fetch(`/api/projects/${projectId}/history/${entry.id}?${targetKey}`, { cache: "no-store" })
          .then(async response => { if (!response.ok) throw new Error("Preview unavailable."); setPreview(await response.json() as Preview); })
          .catch(err => setError(err.message)); }}>
        {entry.label} · {new Date(entry.createdAt).toLocaleString()}{entry.isCurrent ? " · current" : ""}
      </button>)}
      {preview && <div className="pt-2"><p className="text-xs font-semibold">{preview.label}</p>
        <p className="text-[11px] text-slate-500">Screen previews use the current shared tokens and navigation. Restoring a screen changes only that screen.</p>
        {visual && <iframe title="History preview" sandbox="allow-scripts" srcDoc={visual} className="mt-2 h-56 w-full border" />}
        <button type="button" disabled={!!disabledReason || working} onClick={() => void run("restore", preview.id)} className="mt-2 rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-40">Restore this change</button>
      </div>}
    </div>}
    {!open && error && <span role="alert" className="max-w-48 truncate text-xs text-red-600">{error}</span>}
  </div>;
}
