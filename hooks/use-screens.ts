"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectMessageRow, ScreenRow } from "@/lib/supabase/database.types";
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreens(sortScreens(initialScreens));
  }, [initialScreens]);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreens([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let refreshTimer: number | null = null;

    const loadScreens = async () => {
      try {
        setIsLoading(true);
        const nextScreens = await fetchScreens(supabase, projectId);
        if (!cancelled) {
          setScreens(nextScreens);
        }
      } catch (error) {
        console.error("Failed to load screens", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const queueRefreshScreens = () => {
      if (cancelled || refreshTimer) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadScreens();
      }, 120);
    };

    void loadScreens();

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
        if (status === "SUBSCRIBED" && !cancelled) {
          void loadScreens();
        }
      });

    const invalidationChannel = supabase
      .channel(`screens-invalidation:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            return;
          }

          const message = payload.new as ProjectMessageRow;
          const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
            ? message.metadata as Record<string, unknown>
            : {};
          const action = typeof metadata.action === "string" ? metadata.action : "";
          const isScreenMutation =
            message.message_type === "edit_applied" ||
            action.includes("source_region_replace") ||
            action.includes("screen_repair") ||
            action.includes("full_screen_reconstruction") ||
            action === "edit_applied" ||
            action === "edit_applied_with_source_health_failure";

          if (isScreenMutation) {
            queueRefreshScreens();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
      void supabase.removeChannel(invalidationChannel);
    };
  }, [projectId]);

  const refreshScreens = useCallback(async () => {
    if (!projectId) return;
    try {
      const supabase = createClient();
      const nextScreens = await fetchScreens(supabase, projectId);
      setScreens(nextScreens);
    } catch (error) {
      console.error("Failed to refresh screens", error);
    }
  }, [projectId]);

  return {
    screens,
    isLoading,
    refreshScreens,
  };
}
