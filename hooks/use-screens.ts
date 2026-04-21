"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ScreenRow } from "@/lib/supabase/database.types";
import { mapScreenRow } from "@/lib/supabase/mappers";
import { fetchScreens } from "@/lib/supabase/queries";
import type { ScreenData } from "@/lib/types";

const sortScreens = (screens: ScreenData[]) =>
  [...screens].sort((left, right) => {
    const leftIndex = left.sortIndex ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.sortIndex ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

const upsertScreen = (screens: ScreenData[], screen: ScreenData) => {
  const existingIndex = screens.findIndex((entry) => entry.id === screen.id);
  if (existingIndex === -1) {
    return sortScreens([...screens, screen]);
  }

  const nextScreens = [...screens];
  nextScreens[existingIndex] = screen;
  return sortScreens(nextScreens);
};

const mergeScreenPatch = (currentScreen: ScreenData, nextScreen: ScreenData): ScreenData => {
  const patch = Object.fromEntries(
    Object.entries(nextScreen).filter(([, value]) => value !== undefined),
  ) as Partial<ScreenData>;

  return {
    ...currentScreen,
    ...patch,
  };
};

export function useScreens(projectId: string, initialScreens: ScreenData[] = []) {
  const [screens, setScreens] = useState<ScreenData[]>(sortScreens(initialScreens));
  const [isLoading, setIsLoading] = useState(initialScreens.length === 0);
  const refreshRequestIdRef = useRef(0);

  const refreshScreens = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    if (!projectId) {
      setScreens([]);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      const supabase = createClient();
      const nextScreens = await fetchScreens(supabase, projectId);

      if (refreshRequestIdRef.current === requestId) {
        setScreens(nextScreens);
      }

      return nextScreens;
    } catch (error) {
      if (refreshRequestIdRef.current === requestId) {
        console.error("Failed to load screens", error);
      }

      return null;
    } finally {
      if (refreshRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreens(sortScreens(initialScreens));
  }, [initialScreens]);

  useEffect(() => {
    if (!projectId) {
      refreshRequestIdRef.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreens([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    void refreshScreens();

    const channel = supabase
      .channel(`screens:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screens",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setScreens((currentScreens) => currentScreens.filter((screen) => screen.id !== payload.old.id));
            return;
          }

          setScreens((currentScreens) => {
            const nextScreen = mapScreenRow(payload.new as ScreenRow);
            const currentScreen = currentScreens.find((screen) => screen.id === nextScreen.id);

            return upsertScreen(currentScreens, currentScreen ? mergeScreenPatch(currentScreen, nextScreen) : nextScreen);
          });
        },
      )
      .subscribe((status) => {
        // Re-fetch once the WebSocket subscription is confirmed live to pick up
        // any INSERT events that happened during the handshake window (the gap
        // between the initial fetch completing with 0 rows and the channel
        // being fully acknowledged by Supabase Realtime).
        if (status === "SUBSCRIBED") {
          void refreshScreens();
        }
      });

    return () => {
      refreshRequestIdRef.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [projectId, refreshScreens]);

  return {
    screens,
    isLoading,
    refreshScreens,
  };
}