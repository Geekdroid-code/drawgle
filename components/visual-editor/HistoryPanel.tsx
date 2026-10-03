"use client";
import { ArrowLeft, Check, History } from "lucide-react";

/** startingPoint: where the history starts (the design system or navigation generation created); nothing is before it. */
export type HistoryEntry = { id: string; label: string; createdAt: string; isCurrent: boolean; startingPoint?: boolean };
export type HistoryPreview = { id: string; label: string; payload: Record<string, unknown>; beforePayload: Record<string, unknown>; startingPoint?: boolean };

const SHOWN: Record<"screen" | "navigation" | "tokens", (side: "before" | "after") => string> = {
  screen: (side) => `The canvas shows this screen ${side} the change. Restoring makes this version current. Shared styles and navigation stay as they are.`,
  navigation: (side) => `The canvas shows the navigation ${side} the change. Restoring brings back this navigation and which screens show it. Screen contents stay as they are.`,
  tokens: (side) => `The canvas shows the project styles ${side} the change. Restoring brings back these styles. Screen contents and navigation stay as they are.`,
};
const STARTED: Record<"screen" | "navigation" | "tokens", string> = {
  screen: "",
  navigation: "Generation created this navigation, so nothing comes before it. The canvas shows it as it was created; restoring brings it back. Screen contents stay as they are.",
  tokens: "Generation created this design system, so nothing comes before it. The canvas shows it as it was created; restoring brings it back. Screen contents and navigation stay as they are.",
};

/**
 * Saved changes for the selected screen, the navigation or the project styles. A previewed version is shown on the
 * canvas itself, at full size where it lives, while this panel keeps the list, the Before/After switch and Restore.
 */
export function HistoryPanel({ label, entries, preview, onCanvas, error, disabledReason, working, failedScreen,
  side, scope, onSideChange, onBack, onPreview, onClearPreview, onRestore, onRestoreLastGood }: {
  label: string; entries: HistoryEntry[]; preview: HistoryPreview | null;
  /** Whether the canvas is showing the previewed version; it does not while another change is pending. */
  onCanvas: boolean;
  error: string | null; disabledReason?: string | null; working: boolean; failedScreen: boolean;
  onBack: () => void; onPreview: (entry: HistoryEntry) => void; onClearPreview: () => void;
  onRestore: () => void; onRestoreLastGood: () => void;
  side: "before" | "after"; onSideChange: (side: "before" | "after") => void;
  scope: "screen" | "navigation" | "tokens";
}) {
  return <section aria-label="Saved changes" className="ve-history">
    <div className="ve-section">
      <button type="button" onClick={preview ? onClearPreview : onBack} className="ve-history-back">
        <ArrowLeft size={14} />{preview ? "Back to history" : "Back to properties"}
      </button>
      <h3 className="mt-3 text-sm font-semibold">{preview ? "Preview change" : "Saved changes"}</h3>
      <p className="mt-1 truncate text-xs text-[var(--dg-text-muted)]">{label}</p>
    </div>
    <div className="ve-history-scroll">
      {(error || disabledReason) && <p role={error ? "alert" : undefined} className="ve-section text-xs text-[var(--dg-text-muted)]">{error || disabledReason}</p>}
      {failedScreen && <div className="ve-section"><p className="mb-2 text-xs text-[var(--dg-text-muted)]">The last generation failed. Your last saved design is available.</p>
        <button type="button" className="ve-discard w-full" disabled={!!disabledReason || working} onClick={onRestoreLastGood}>Restore last good design</button></div>}
      {preview ? <div className="ve-section">
        <p className="mb-3 text-xs font-medium">{preview.label}</p>
        <div className="ve-segments mb-3" aria-label="Preview state">
          <button type="button" className="ve-segment" aria-pressed={side === "before"} disabled={preview.startingPoint}
            title={preview.startingPoint ? "Nothing comes before this: generation created it." : undefined} onClick={() => onSideChange("before")}>Before change</button>
          <button type="button" className="ve-segment" aria-pressed={side === "after"} onClick={() => onSideChange("after")}>After change</button>
        </div>
        <p className="text-xs leading-relaxed text-[var(--dg-text-muted)]">{!onCanvas ? "Finish or discard the pending change to see this version on the canvas."
          : preview.startingPoint && STARTED[scope] ? STARTED[scope] : SHOWN[scope](side)}</p>
      </div> : entries.length ? <ol className="space-y-1 p-3">{entries.map(entry => <li key={entry.id}>
        <button type="button" onClick={() => onPreview(entry)} className="ve-history-entry">
          <span className="flex items-start justify-between gap-2"><span className="min-w-0 text-[13px] font-medium leading-5">{entry.label}</span>
            {entry.isCurrent && <Check size={14} className="mt-1 shrink-0 text-[#3563ee]" aria-label="Current version" />}</span>
          <span className="mt-1 block text-[11px] text-[var(--dg-text-muted)]">{new Date(entry.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{entry.isCurrent ? " · Current" : ""}</span>
        </button>
      </li>)}</ol> : <div className="ve-history-empty">
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dg-surface-muted)]"><History size={18} /></span>
        <p className="text-sm font-medium text-[var(--dg-text)]">No saved changes yet</p>
        <p className="mt-2 max-w-52 text-xs leading-5">Apply your first edit and it will appear here. You can revisit saved versions whenever you need.</p>
      </div>}
    </div>
    <footer className="ve-footer">
      {preview ? <button type="button" className="ve-apply w-full" disabled={!!disabledReason || working} onClick={onRestore}>{working ? "Restoring…" : "Restore this version"}</button>
        : <p className="text-[11px] leading-5 text-[var(--dg-text-muted)]">Your unsaved adjustments stay intact while you browse history.</p>}
    </footer>
  </section>;
}
