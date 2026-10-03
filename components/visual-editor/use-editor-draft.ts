"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SelectedElementInfo, SelectedElementPreviewPayload } from "@/components/ScreenNode";
import type { DeterministicEditOperation, DrawgleImageTargetMeta } from "@/lib/drawgle-dom";
import type { DrawgleStyleProperty } from "@/lib/element-style-inspection";
import { advanceDraft, buildDraftOperations, draftDirty, draftErrors, initialHistory, travelDraft, type EditorDraft } from "@/lib/visual-editor/draft";
import { selectionKey } from "@/lib/visual-editor/selection";

export type EditCommit = { revision: number; changed: boolean };
export type EditSaveOptions = { expectedRevision: number; requestId: string };
export function useEditorDraft({ info, revision, unavailable = false, save, upload, onWorkingChange }: {
  info: SelectedElementInfo | null; revision: number;
  unavailable?: boolean;
  onWorkingChange?: (working: boolean) => void;
  save: (operations: DeterministicEditOperation[], options: EditSaveOptions) => Promise<EditCommit | false>;
  upload: (target: DrawgleImageTargetMeta, file: File) => Promise<string>;
}) {
  const key = selectionKey(info);
  const [session, setSession] = useState(() => ({ key, revision, history: initialHistory() }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveUnconfirmed, setSaveUnconfirmed] = useState(false);
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const gesture = useRef<{ field: string; at: number } | null>(null);
  const urls = useRef(new Set<string>());
  const uploaded = useRef(new WeakMap<File, string>());
  if (session.key !== key) {
    setSession({ key, revision, history: initialHistory() });
    setSaveUnconfirmed(false);
  }
  const current = session.key === key ? session : { key, revision, history: initialHistory() };
  const draft = current.history.present;
  const dirty = draftDirty(draft);
  const stale = unavailable || (current.revision !== revision && (dirty || current.history.past.length > 0 || current.history.future.length > 0));
  const errors = useMemo(() => draftErrors(draft), [draft]);
  // Source metadata can refresh without resetting a pending draft or its redo stack.
  if (!dirty && !current.history.past.length && !current.history.future.length && current.revision !== revision) {
    setSession({ ...current, revision });
  }
  useEffect(() => { requestId.current = null; gesture.current = null; }, [key]);
  useEffect(() => {
    const held = urls.current;
    return () => { held.forEach(url => URL.revokeObjectURL(url)); held.clear(); };
  }, []);
  useEffect(() => {
    const retained = new Set([...session.history.past, session.history.present, ...session.history.future].flatMap(item => item.image ? [item.image.previewUrl] : []));
    urls.current.forEach(url => { if (!retained.has(url)) { URL.revokeObjectURL(url); urls.current.delete(url); } });
  }, [session.history]);
  const update = (next: EditorDraft, field: string) => {
    if (busy.current) return;
    const now = Date.now();
    const coalesce = gesture.current?.field === field && now - gesture.current.at < 700;
    gesture.current = { field, at: now };
    requestId.current = null;
    setError(null); setSaveUnconfirmed(false);
    setSession(previous => ({ ...previous, history: advanceDraft(previous.history, next, coalesce) }));
  };
  const styles = (values: Partial<Record<DrawgleStyleProperty, string>>, field = Object.keys(values).join(",")) => {
    const next = { ...draft.styles };
    const raw = info?.editableMetadata?.styleInspection;
    for (const [property, value] of Object.entries(values)) {
      const name = property as DrawgleStyleProperty;
      const original = raw?.inlineStyle?.[name] || raw?.stableComputedStyle?.[name] || raw?.computedStyle?.[name] || "";
      if (value === original) delete next[name]; else next[name] = value;
    }
    update({ ...draft, styles: next }, field);
  };
  const text = (id: string, value: string) => {
    const next = { ...draft.text };
    const original = info?.editableMetadata?.textNodes.find(node => node.drawgleId === id)?.text;
    if (value === original) delete next[id]; else next[id] = value;
    update({ ...draft, text: next }, `text:${id}`);
  };
  const image = (target: DrawgleImageTargetMeta, file: File) => {
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    const previewUrl = URL.createObjectURL(file);
    urls.current.add(previewUrl);
    update({ ...draft, image: { target, file, previewUrl } }, "image");
  };
  const discard = () => {
    if (busy.current) return;
    setSession({ key, revision, history: initialHistory() });
    requestId.current = null; gesture.current = null; setError(null); setSaveUnconfirmed(false);
  };
  const travel = (direction: "undo" | "redo") => {
    if (busy.current) return;
    requestId.current = null; gesture.current = null; setError(null); setSaveUnconfirmed(false);
    setSession(previous => ({ ...previous, history: travelDraft(previous.history, direction) }));
  };
  const apply = async () => {
    if (busy.current || stale || Object.keys(errors).length) return false;
    if (!dirty) return true;
    busy.current = true; setSaving(true); onWorkingChange?.(true); setError(null);
    let submitted = false;
    try {
      let next = draft;
      if (draft.image) {
        const src = uploaded.current.get(draft.image.file) ?? await upload(draft.image.target, draft.image.file);
        uploaded.current.set(draft.image.file, src);
        next = { ...draft, image: { ...draft.image, uploadedUrl: src } };
      }
      requestId.current ??= crypto.randomUUID();
      submitted = true;
      const result = await save(buildDraftOperations(next), { expectedRevision: current.revision, requestId: requestId.current });
      if (!result) throw new Error("Your changes were not saved. Retry after checking the connection.");
      setSession({ key, revision: result.revision, history: initialHistory() });
      requestId.current = null; gesture.current = null;
      setSaveUnconfirmed(false);
      return true;
    } catch (failure) { setSaveUnconfirmed(submitted); setError(failure instanceof Error ? failure.message : "Could not save changes."); return false; }
    finally { busy.current = false; setSaving(false); onWorkingChange?.(false); }
  };
  const preview: SelectedElementPreviewPayload | null = info?.drawgleId && dirty && !stale ? {
    drawgleId: info.drawgleId,
    styles: Object.fromEntries(Object.entries(draft.styles).filter(([property]) => !errors[property as DrawgleStyleProperty])),
    text: draft.text,
    image: draft.image ? { target: draft.image.target, src: draft.image.previewUrl } : null,
  } : null;
  return { draft, dirty, stale, errors, saving, error, saveUnconfirmed, styles, text, image, discard, apply, preview,
    canUndo: current.history.past.length > 0, canRedo: current.history.future.length > 0,
    hasLocalHistory: current.history.past.length > 0 || current.history.future.length > 0,
    undo: () => travel("undo"), redo: () => travel("redo"), endGesture: () => { gesture.current = null; },
    baselineRevision: current.revision, reset: discard,
  };
}
export type EditorController = ReturnType<typeof useEditorDraft>;
