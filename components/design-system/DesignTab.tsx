"use client";
import { Loader2 } from "lucide-react";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { hasApprovedDesignTokens } from "@/lib/design-tokens";
import type { DesignTokens } from "@/lib/types";

export function DesignTab({ tokenDraft, tokenDirty, tokenSaving, generationActive, onTokenDraftChange, onSaveTokens, onDiscardTokens }: {
  tokenDraft?: DesignTokens | null; tokenDirty?: boolean; tokenSaving?: boolean; generationActive?: boolean;
  onTokenDraftChange?: (tokens: DesignTokens) => void; onSaveTokens?: () => Promise<void>; onDiscardTokens?: () => void;
}) {
  if (!tokenDraft || !hasApprovedDesignTokens(tokenDraft) || !onTokenDraftChange || !onSaveTokens || !onDiscardTokens) {
    return <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-[var(--dg-text-muted)]">Project styles will appear here after your design is ready.</div>;
  }
  const locked = Boolean(tokenSaving || generationActive);
  const status = generationActive ? "Building · editing paused" : tokenSaving ? "Saving changes…" : tokenDirty ? "Unsaved changes" : "All changes saved";
  return <div className="flex min-h-0 flex-1 flex-col bg-[var(--dg-surface)]">
    <DesignSystemEditor value={tokenDraft} onChange={onTokenDraftChange} onSubmit={onSaveTokens} layout="panel" showPreview={false} disabled={locked} />
    <footer className="dt-save-footer flex items-center justify-between gap-2">
      <span role="status" className="dt-save-state min-w-0" data-dirty={tokenDirty || undefined}>{status}</span>
      <div className="dt-footer-actions shrink-0">
        <button type="button" className="dt-discard" disabled={!tokenDirty || locked} onClick={onDiscardTokens}>Discard</button>
        <button type="button" className="dt-save flex items-center gap-1.5" disabled={!tokenDirty || locked} onClick={() => void onSaveTokens()}>
          {tokenSaving && <Loader2 size={13} className="animate-spin" />}Save
        </button>
      </div>
    </footer>
  </div>;
}
