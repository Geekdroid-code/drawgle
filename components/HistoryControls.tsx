"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, RotateCw, History } from "lucide-react";
import type { EditorController } from "@/components/visual-editor/use-editor-draft";
import type { HistoryTarget } from "@/lib/design-history/types";
import type { DesignTokens, ScreenData } from "@/lib/types";
import { HistoryPanel, type HistoryEntry as Entry, type HistoryPreview as Preview } from "@/components/visual-editor/HistoryPanel";

/**
 * A saved version the canvas shows in place of the current design while it is previewed: one screen's code, the
 * project styles, or the navigation with its screen assignments. Nothing is saved until it is restored.
 */
export type CanvasHistoryPreview = { label: string; side: "before" | "after" } & (
  | { context: "screen"; screenId: string; code: string }
  | { context: "tokens"; tokens: DesignTokens | null }
  | { context: "navigation"; navigation: Record<string, unknown> }
);
export const EXIT_HISTORY_PREVIEW_EVENT = "drawgle-history-exit-preview";
/** Restores the previewed version from outside the panel: the canvas's preview bar on a phone, where the panel is closed. */
export const RESTORE_HISTORY_PREVIEW_EVENT = "drawgle-history-restore-preview";

type Listing = { revision: number; canUndo: boolean; canRedo: boolean; entries: Entry[] };
const query = (target: HistoryTarget) => new URLSearchParams(target.context === "screen"
  ? { context: "screen", screenId: target.screenId } : { context: target.context }).toString();
const editingFocus = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || Boolean(target.closest("input, textarea, [contenteditable], [role='textbox']")));

export function HistoryControls({ projectId, target, screenName, screens, disabledReason, onApplied, local, refreshVersion = 0, onWorkingChange, onAvailabilityChange, viewOpen, onViewOpenChange, panelTarget, onCanvasPreviewChange }: {
  projectId: string; target: HistoryTarget | null; screenName?: string;
  screens: ScreenData[];
  local?: Pick<EditorController, "hasLocalHistory" | "canUndo" | "canRedo" | "undo" | "redo" | "saving" | "stale">;
  refreshVersion?: number; onWorkingChange?: (working: boolean) => void;
  onAvailabilityChange?: (available: { undo: boolean; redo: boolean }) => void;
  disabledReason?: string | null; onApplied: () => void | Promise<void>;
  viewOpen?: boolean; onViewOpenChange?: Dispatch<SetStateAction<boolean>>; panelTarget?: HTMLElement | null;
  /** Shows the previewed version on the canvas, or the current design again with null. */
  onCanvasPreviewChange?: (preview: CanvasHistoryPreview | null) => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const open = viewOpen ?? localOpen;
  const setOpen = onViewOpenChange ?? setLocalOpen;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewSide, setPreviewSide] = useState<"before" | "after">("before");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const recoveryRequest = useRef<{ key: string; revision: number; requestId: string } | null>(null);
  const targetKey = target ? query(target) : "";
  const refresh = useCallback(async () => {
    if (!target) { setListing(null); return; }
    const response = await fetch(`/api/projects/${projectId}/history?${query(target)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Recent changes are unavailable. Refresh and try again.");
    setListing(await response.json() as Listing);
  }, [projectId, targetKey, refreshVersion]); // eslint-disable-line react-hooks/exhaustive-deps
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
  }, [projectId, targetKey, refreshVersion]);
  const run = useCallback(async (action: "undo" | "redo" | "restore", entryId?: string, side?: "before" | "after") => {
    if (working || local?.saving || local?.stale) return;
    if (action === "restore" && local?.hasLocalHistory) { setError("Apply or discard your adjustments before restoring a saved change."); return; }
    if (local?.hasLocalHistory && action !== "restore") {
      if (disabledReason) { setError(disabledReason); return; }
      if (action === "undo") local.undo(); else local.redo();
      return;
    }
    if (!target || !listing) return;
    if (disabledReason) { setError(disabledReason); return; }
    setWorking(true); onWorkingChange?.(true); setError(null);
    try {
      const requestKey = `${projectId}:${targetKey}:${action}:${entryId ?? ""}:${side ?? ""}`;
      if (recoveryRequest.current?.key !== requestKey) recoveryRequest.current = { key: requestKey, revision: listing.revision, requestId: crypto.randomUUID() };
      const response = await fetch(`/api/projects/${projectId}/history`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, action, entryId, side, expectedRevision: recoveryRequest.current.revision, requestId: recoveryRequest.current.requestId }) });
      const result = await response.json();
      if (response.ok || response.status < 500) recoveryRequest.current = null;
      if (!response.ok) throw new Error(result.status === "busy_target" ? "Wait for the active design job to finish." :
        result.status === "incompatible_navigation" ? "Screens changed since this navigation version. It cannot be restored as a whole." :
        result.status === "stale_revision" ? "The design changed in another tab. Refresh Recent changes." :
        result.error || "This history entry is unavailable. Refresh Recent changes.");
      if (result.unchanged) { setError("The canvas already matches this version. Choose the other preview state to restore a different appearance."); await refresh(); return; }
      setPreview(null); setOpen(false);
      await onApplied();
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Recovery failed."); setOpen(true); void refresh().catch(() => undefined); }
    finally { setWorking(false); onWorkingChange?.(false); }
  }, [disabledReason, listing, onApplied, projectId, refresh, target, targetKey, working, local, onWorkingChange, setOpen]);
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
  useEffect(() => {
    const handle = (event: Event) => { const action = (event as CustomEvent<"undo" | "redo">).detail; if (action === "undo" || action === "redo") void run(action); };
    window.addEventListener("drawgle-history-action", handle);
    return () => window.removeEventListener("drawgle-history-action", handle);
  }, [run]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); setOpen(false); setPreview(null); historyButton.current?.focus();
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [open, setOpen]);
  const canUndo = !working && !disabledReason && !local?.saving && !local?.stale && (local?.hasLocalHistory ? local.canUndo : !!listing?.canUndo);
  const canRedo = !working && !disabledReason && !local?.saving && !local?.stale && (local?.hasLocalHistory ? local.canRedo : !!listing?.canRedo);
  useEffect(() => { onAvailabilityChange?.({ undo: canUndo, redo: canRedo }); }, [canUndo, canRedo, onAvailabilityChange]);
  const targetLabel = target?.context === "screen" ? `change to ${screenName || "screen"}` :
    target?.context === "navigation" ? "shared navigation change" : "design-token change";
  const failedScreen = target?.context === "screen" ? screens.find(s => s.id === target.screenId && s.status === "failed") : null;
  const restoreLastGood = async () => {
    if (!failedScreen || !listing || working || disabledReason) return;
    setWorking(true); onWorkingChange?.(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/restore-last-good`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screenId: failedScreen.id,
          expectedRevision: listing.revision, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Last good design unavailable. Refresh and retry.");
      await onApplied(); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not restore the last good design."); }
    finally { setWorking(false); onWorkingChange?.(false); }
  };
  // The canvas shows a previewed version only while nothing else is pending: an unsaved adjustment, a token draft or a
  // design job would otherwise be drawn over, or draw over it.
  const previewBlocked = Boolean(local?.hasLocalHistory || disabledReason);
  // The shell passes a new target object on every render; the preview follows its context and screen only.
  const targetContext = target?.context ?? null;
  const targetScreenId = target?.context === "screen" ? target.screenId : null;
  const canvasPreview = useMemo<CanvasHistoryPreview | null>(() => {
    if (!open || !preview || !targetContext || previewBlocked) return null;
    const payload = previewSide === "before" ? preview.beforePayload : preview.payload;
    const shown = { label: preview.label, side: previewSide };
    if (targetContext === "screen") {
      return targetScreenId && typeof payload.code === "string" && payload.code.trim() ? { ...shown, context: "screen", screenId: targetScreenId, code: payload.code } : null;
    }
    if (targetContext === "tokens") return { ...shown, context: "tokens", tokens: (payload.tokens ?? null) as DesignTokens | null };
    return { ...shown, context: "navigation", navigation: payload };
  }, [open, preview, previewBlocked, previewSide, targetContext, targetScreenId]);
  const reportPreview = useRef(onCanvasPreviewChange);
  useEffect(() => { reportPreview.current = onCanvasPreviewChange; }, [onCanvasPreviewChange]);
  useEffect(() => { reportPreview.current?.(canvasPreview); }, [canvasPreview]);
  useEffect(() => () => reportPreview.current?.(null), []);
  useEffect(() => {
    const exit = () => setPreview(null);
    window.addEventListener(EXIT_HISTORY_PREVIEW_EVENT, exit);
    return () => window.removeEventListener(EXIT_HISTORY_PREVIEW_EVENT, exit);
  }, []);
  useEffect(() => {
    if (!canvasPreview || !preview) return;
    const restore = () => { void run("restore", preview.id, previewSide); };
    window.addEventListener(RESTORE_HISTORY_PREVIEW_EVENT, restore);
    return () => window.removeEventListener(RESTORE_HISTORY_PREVIEW_EVENT, restore);
  }, [canvasPreview, preview, previewSide, run]);
  if (!target) return null;
  const historyView = open ? <HistoryPanel label={target.context === "screen" ? screenName || "Selected screen" : target.context === "navigation" ? "Shared navigation" : "Project styles"}
    entries={listing?.entries ?? []} preview={preview} onCanvas={Boolean(canvasPreview)} error={error} disabledReason={local?.hasLocalHistory ? "Apply or discard your adjustments before restoring a saved change." : disabledReason} working={working}
    failedScreen={!!failedScreen} onBack={() => { setOpen(false); setPreview(null); historyButton.current?.focus(); }}
    side={previewSide} scope={target.context} onSideChange={side => { setPreviewSide(side); setError(null); }}
    onClearPreview={() => setPreview(null)} onRestore={() => { if (preview) void run("restore", preview.id, previewSide); }}
    onRestoreLastGood={() => void restoreLastGood()} onPreview={entry => {
      void fetch(`/api/projects/${projectId}/history/${entry.id}?${targetKey}`, { cache: "no-store" })
        .then(async response => { if (!response.ok) { const failure = await response.json().catch(() => null); throw new Error(failure?.error || "Preview unavailable."); } const result = await response.json() as Preview;
          // Only a server without the before-snapshot migration answers without it.
          if (!result.beforePayload) throw new Error("This change can’t be previewed right now. Refresh Recent changes and try again.");
          setPreviewSide("before"); setPreview(result); setError(null); })
        .catch(err => setError(err.message));
    }} /> : null;
  return <div ref={root} className="relative flex items-center gap-1" data-testid="history-controls">
    <button type="button" aria-label={local?.hasLocalHistory ? "Undo adjustment" : `Undo ${targetLabel}`} title={local?.hasLocalHistory ? "Undo adjustment" : `Undo ${targetLabel}`} disabled={!canUndo}
      onClick={() => void run("undo")} className="ve-icon text-[var(--dg-text-muted)] disabled:opacity-40"><RotateCcw className="h-4 w-4" /></button>
    <button type="button" aria-label={local?.hasLocalHistory ? "Redo adjustment" : `Redo ${targetLabel}`} title={local?.hasLocalHistory ? "Redo adjustment" : `Redo ${targetLabel}`} disabled={!canRedo}
      onClick={() => void run("redo")} className="ve-icon text-[var(--dg-text-muted)] disabled:opacity-40"><RotateCw className="h-4 w-4" /></button>
    <button ref={historyButton} type="button" aria-label="Recent changes" title={error || "Recent changes"} aria-expanded={open} aria-pressed={open} onClick={() => { setOpen(value => !value); setPreview(null); }} className={`ve-icon ${open ? "bg-[var(--dg-surface-muted)] text-[#3563ee]" : "text-[var(--dg-text-muted)]"}`}><History className="h-4 w-4" /></button>
    {panelTarget ? createPortal(historyView, panelTarget) : historyView}
  </div>;
}
