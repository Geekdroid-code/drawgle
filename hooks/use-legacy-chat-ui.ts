"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const readLegacy = () => {
  try {
    return new URLSearchParams(window.location.search).get("ui") === "legacy";
  } catch {
    return false;
  }
};

/**
 * The chat's escape hatch for one release: `?ui=legacy` shows the previous chat cards (the step list, the progress
 * card with bars, the per-batch lines and the separate flow card), for comparison or if the new timeline misreads a
 * project. Remove after the founder has confirmed the new chat.
 */
export function useLegacyChatUi() {
  return useSyncExternalStore(subscribe, readLegacy, () => false);
}
