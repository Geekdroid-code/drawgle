import type { DeterministicEditOperation, DrawgleImageTargetMeta } from "@/lib/drawgle-dom";
import { validateStyleValue, type DrawgleStyleProperty } from "@/lib/element-style-inspection";

export type PendingImage = { target: DrawgleImageTargetMeta; file: File; previewUrl: string; uploadedUrl?: string };
export type EditorDraft = { styles: Partial<Record<DrawgleStyleProperty, string>>; text: Record<string, string>; image: PendingImage | null };
export const emptyDraft = (): EditorDraft => ({ styles: {}, text: {}, image: null });
export const draftDirty = (draft: EditorDraft) => Boolean(Object.keys(draft.styles).length || Object.keys(draft.text).length || draft.image);
export function draftErrors(draft: EditorDraft) {
  const errors: Partial<Record<DrawgleStyleProperty, string>> = {};
  Object.entries(draft.styles).forEach(([property, value]) => {
    try { validateStyleValue(property as DrawgleStyleProperty, value); }
    catch (error) { errors[property as DrawgleStyleProperty] = error instanceof Error ? error.message : "Invalid value"; }
  });
  return errors;
}
export function buildDraftOperations(draft: EditorDraft): DeterministicEditOperation[] {
  if (Object.keys(draftErrors(draft)).length) throw new Error("Correct the highlighted values before applying.");
  const operations: DeterministicEditOperation[] = Object.entries(draft.styles).map(([property, value]) =>
    value ? { type: "setStyle", property: property as DrawgleStyleProperty, value } : { type: "clearStyle", property: property as DrawgleStyleProperty });
  Object.entries(draft.text).forEach(([drawgleId, text]) => operations.push({ type: "replaceText", drawgleId, text }));
  if (draft.image) {
    if (!draft.image.uploadedUrl) throw new Error("The image has not finished uploading.");
    const { target, uploadedUrl } = draft.image;
    operations.push({ type: "replaceImage", drawgleId: target.drawgleId, mode: target.kind === "img" ? "src" : target.kind,
      src: uploadedUrl, alt: target.alt ?? "Project image", targetIndex: target.targetIndex });
  }
  return operations;
}
export type DraftHistory = { past: EditorDraft[]; present: EditorDraft; future: EditorDraft[] };
export const initialHistory = (): DraftHistory => ({ past: [], present: emptyDraft(), future: [] });
export function advanceDraft(history: DraftHistory, next: EditorDraft, coalesce = false): DraftHistory {
  return { past: coalesce ? history.past : [...history.past, history.present].slice(-50), present: next, future: [] };
}
export function travelDraft(history: DraftHistory, direction: "undo" | "redo"): DraftHistory {
  if (direction === "undo" && history.past.length) return {
    past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future],
  };
  if (direction === "redo" && history.future.length) return {
    past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1),
  };
  return history;
}
