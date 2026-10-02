"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_CANVAS_FRAME_MODE, type CanvasFrameMode } from "@/lib/canvas-interactions";

/** The canvas view (phone or full length) is a per-browser choice, kept across projects and reloads. */
export const CANVAS_FRAME_MODE_STORAGE_KEY = "drawgle:canvas-frame-mode";

const listeners = new Set<() => void>();
let chosen: CanvasFrameMode | null = null;

const isFrameMode = (value: unknown): value is CanvasFrameMode => value === "full" || value === "phone";

function readFrameMode(): CanvasFrameMode {
  if (chosen) return chosen;
  try {
    const stored = window.localStorage.getItem(CANVAS_FRAME_MODE_STORAGE_KEY);
    if (isFrameMode(stored)) chosen = stored;
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the default applies.
  }
  return chosen ?? DEFAULT_CANVAS_FRAME_MODE;
}

export function setCanvasFrameMode(mode: CanvasFrameMode) {
  chosen = mode;
  try {
    window.localStorage.setItem(CANVAS_FRAME_MODE_STORAGE_KEY, mode);
  } catch {
    // The choice still holds for this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CANVAS_FRAME_MODE_STORAGE_KEY) return;
    chosen = isFrameMode(event.newValue) ? event.newValue : null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Forgets the remembered choice; for tests. */
export function resetCanvasFrameModeForTests() {
  chosen = null;
}

export function useCanvasFrameMode() {
  const mode = useSyncExternalStore(subscribe, readFrameMode, () => DEFAULT_CANVAS_FRAME_MODE);
  return [mode, setCanvasFrameMode] as const;
}
