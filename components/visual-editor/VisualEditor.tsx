"use client";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, CornerLeftUp, Ellipsis, X } from "lucide-react";
import type { SelectedElementInfo } from "@/components/ScreenNode";
import type { DrawgleTokenReferenceLike } from "@/lib/element-style-inspection";
import { classifySelection } from "@/lib/visual-editor/selection";
import type { EditorController } from "./use-editor-draft";
import { EditorSections } from "./sections";
import "./visual-editor.css";

export function VisualEditor({ info, editor, tokens, open, disabled, onClose, onDelete, onDiscard, historyControls, historyOpen = false, historyPanelRef }: {
  info: SelectedElementInfo | null; editor: EditorController; tokens: DrawgleTokenReferenceLike[];
  historyControls?: ReactNode;
  historyOpen?: boolean; historyPanelRef?: (element: HTMLDivElement | null) => void;
  open: boolean; disabled: boolean; onClose: () => void; onDelete: () => void;
  onDiscard?: () => void;
}) {
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bottom, setBottom] = useState(88);
  const selection = info ? classifySelection(info) : null;
  const parent = info?.editableMetadata?.ancestors?.[0];
  useLayoutEffect(() => {
    if (!open) return;
    const toolbar = document.querySelector<HTMLElement>('[data-canvas-obstacle="bottom"]');
    const measure = () => setBottom(toolbar ? Math.max(16, window.innerHeight - toolbar.getBoundingClientRect().top + 12) : 88);
    measure();
    const observer = new ResizeObserver(measure);
    if (toolbar) observer.observe(toolbar);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[data-slot="popover-content"]')) { event.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);
  if (!info || !selection) return <aside aria-label="Visual editor" data-canvas-obstacle={open ? "right" : undefined} className={`ve-panel ${open ? "" : "!hidden"}`}>
    <header className="ve-header flex items-center justify-between"><h2 className="text-sm font-semibold">Visual editor</h2>{historyControls}<button type="button" aria-label="Close visual editor" className="ve-icon" onClick={onClose}><X size={16} /></button></header>
    <div ref={historyPanelRef} className={historyOpen ? "ve-history-host" : "hidden"} />
    {!historyOpen && <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center"><p className="text-sm font-medium">Select an element</p><p className="text-xs text-[var(--dg-text-muted)]">Click text, a button, an image, or a card to adjust it.</p></div>}
  </aside>;
  const protectedRoot = info.editableMetadata?.riskFlags?.isRootLike || info.editableMetadata?.riskFlags?.isNavigationRoot;
  return <aside aria-label="Visual editor" data-canvas-obstacle={open ? "right" : undefined} className={`ve-panel ${open ? "" : "!hidden"}`} style={{ "--ve-bottom": `${bottom}px` } as React.CSSProperties}>
    <header className="ve-header"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="hidden text-[11px] text-[var(--dg-text-muted)] md:block">Visual editor</p>
      <h2 className="truncate text-sm font-semibold">{selection.label}</h2></div><div className="flex items-center gap-1">
      {historyControls}
      <button type="button" className="ve-icon" aria-label="Element actions" onClick={() => setMenu(!menu)}><Ellipsis size={16} /></button>
      <button type="button" className="ve-icon" aria-label="Close visual editor" onClick={onClose}><X size={16} /></button></div></div>
      <div className="mt-2 flex min-w-0 items-center gap-1 text-[11px] text-[var(--dg-text-muted)]">
        {parent && <button type="button" className="flex max-w-[120px] shrink-0 items-center gap-1 hover:text-[var(--dg-text)] max-md:min-h-11 max-md:min-w-11" aria-label="Select parent" disabled={editor.saving}
          onClick={() => window.dispatchEvent(new CustomEvent("drawgle-select-child", { detail: { screenId: info.screenId, drawgleId: parent.drawgleId } }))}><CornerLeftUp size={12} /><span className="truncate">{parent.label}</span><ChevronRight size={12} /></button>}
        <span className="truncate">{info.textPreview || selection.label}</span></div>
      {menu && <div className="mt-2 rounded-lg bg-[var(--dg-surface-muted)] p-1"><button type="button" disabled={disabled || editor.saving || !!protectedRoot} className="w-full rounded-md p-2 text-left text-xs text-red-600 disabled:opacity-40"
        onClick={() => { setMenu(false); onDelete(); }}>Delete element</button></div>}
    </header>
    <div ref={historyPanelRef} className={historyOpen ? "ve-history-host" : "hidden"} />
    <div className={historyOpen ? "hidden" : "ve-body"} onBlur={editor.endGesture} onPointerUp={editor.endGesture}>
      <fieldset disabled={disabled || editor.saving || editor.stale} className="min-w-0">
        <EditorSections info={info} editor={editor} tokens={tokens} more={false} />
        <button type="button" className="ve-more" aria-expanded={more} onClick={() => setMore(!more)}><span>More</span><ChevronDown size={14} className={more ? "rotate-180" : ""} /></button>
        {more && <EditorSections info={info} editor={editor} tokens={tokens} more />}
      </fieldset>
    </div>
    <footer className={historyOpen ? "hidden" : "ve-footer"}>
      {(editor.stale || editor.error) && <p role="alert" className="mb-2 text-xs text-red-600">{editor.stale ? "This element changed since you started. Discard this draft to load the saved version." : editor.error}</p>}
      {Object.keys(editor.errors).length > 0 && <p role="alert" className="mb-2 text-xs text-red-600">Check the highlighted values before applying.</p>}
      <div className="flex items-center gap-2"><button type="button" className="ve-discard" disabled={editor.saving || !editor.hasLocalHistory && !editor.dirty} onClick={onDiscard ?? editor.discard}>Discard</button>
        <button type="button" className="ve-apply" disabled={!editor.dirty || disabled || editor.saving || editor.stale || !!Object.keys(editor.errors).length} onClick={() => void editor.apply()}>{editor.saving ? "Saving…" : "Apply changes"}</button></div>
    </footer>
  </aside>;
}
