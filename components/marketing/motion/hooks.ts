"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useInView, useReducedMotion } from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const;

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

/** True while the tab is visible. */
export function usePageVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/**
 * Whether a motion graphic should be running: on screen, tab visible,
 * and the viewer has not asked for reduced motion.
 */
export function usePlayback<T extends Element>(ref: RefObject<T | null>, amount = 0.3) {
  const inView = useInView(ref, { amount });
  const visible = usePageVisible();
  const reduced = useReducedMotion() ?? false;
  return { playing: inView && visible && !reduced, reduced, inView };
}

/**
 * Steps through a timeline of durations (ms). Loops by default.
 * Pausing holds the current step; resuming replays that step's full duration.
 */
export function useSequence(durations: readonly number[], playing: boolean, { loop = true } = {}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => {
      setStep((current) => {
        if (current + 1 < durations.length) return current + 1;
        return loop ? 0 : current;
      });
    }, durations[step] ?? 1000);
    return () => window.clearTimeout(timeout);
  }, [durations, loop, playing, step]);

  return [step, setStep] as const;
}

/**
 * Types `text` out while `running`. Reset whenever `resetKey` changes.
 * Returns the visible slice and whether typing finished.
 */
export function useTypedText(text: string, running: boolean, resetKey: unknown, charMs = 38) {
  const [count, setCount] = useState(0);
  const [previousKey, setPreviousKey] = useState(resetKey);

  if (previousKey !== resetKey) {
    setPreviousKey(resetKey);
    setCount(0);
  }

  useEffect(() => {
    if (!running || count >= text.length) return;
    const timeout = window.setTimeout(() => setCount((current) => Math.min(text.length, current + 1)), charMs);
    return () => window.clearTimeout(timeout);
  }, [charMs, count, running, text.length]);

  return { typed: text.slice(0, count), done: count >= text.length };
}
