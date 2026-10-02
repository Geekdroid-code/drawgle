"use client";
import { useEffect, useRef } from "react";

type TraversalEvent = Event & {
  navigationType: string;
  destination: { key: string; url: string; sameDocument: boolean };
};
type Navigation = EventTarget & { traverseTo(key: string): { finished: Promise<unknown> } };
type NavigationWindow = Window & { navigation?: Navigation };

// Cancel eligible traversals before Next's popstate listener can unmount the draft.
// No history entries are inserted, and the application's history state is untouched.
export function useDraftNavigationGuard(dirty: boolean, onAttempt: (proceed: () => void) => void) {
  const attempt = useRef(onAttempt);
  useEffect(() => { attempt.current = onAttempt; }, [onAttempt]);
  useEffect(() => {
    if (!dirty) return;
    const navigation = (window as NavigationWindow).navigation;
    if (!navigation) return; // Native unload guard still covers document navigation.
    let allowedKey: string | null = null;
    const capture = (event: Event) => {
      const traversal = event as TraversalEvent;
      if (traversal.navigationType !== "traverse") return;
      if (traversal.destination.key === allowedKey) { allowedKey = null; return; }
      // Browsers deliberately allow non-cancelable traversals to escape a page.
      if (!event.cancelable || !traversal.destination.sameDocument ||
          new URL(traversal.destination.url).pathname === location.pathname) return;
      event.preventDefault();
      const key = traversal.destination.key;
      attempt.current(() => {
        allowedKey = key;
        void navigation.traverseTo(key).finished.catch(() => { allowedKey = null; });
      });
    };
    navigation.addEventListener("navigate", capture);
    return () => navigation.removeEventListener("navigate", capture);
  }, [dirty]);
}
