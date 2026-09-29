"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectNavigationRow } from "@/lib/supabase/database.types";
import { mapProjectNavigationRow, PROJECT_NAVIGATION_COLUMNS } from "@/lib/supabase/mappers";
import { fetchProjectNavigation } from "@/lib/supabase/queries";
import { isCompleteRecord, mergeRealtimeRecord } from "@/lib/supabase/realtime-patch";
import type { ProjectNavigationData } from "@/lib/types";
import { PROJECT_REFRESH_EVENT, isProjectRefresh } from "@/lib/project-refresh";

export function useProjectNavigation(projectId: string, initialNavigation: ProjectNavigationData | null) {
  const [projectNavigation, setProjectNavigation] = useState<ProjectNavigationData | null>(initialNavigation);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectNavigation(initialNavigation);
  }, [initialNavigation]);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectNavigation(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let requestVersion = 0;
    // The navigation row a completed fetch or complete record has confirmed.
    let heldNavigationId: string | null = null;

    const loadNavigation = async () => {
      const version = ++requestVersion;
      try {
        const nextNavigation = await fetchProjectNavigation(supabase, projectId);
        if (!cancelled && version === requestVersion) {
          heldNavigationId = nextNavigation?.id ?? null;
          setProjectNavigation(nextNavigation);
        }
      } catch (error) {
        console.error("Failed to load project navigation", error);
      }
    };

    void loadNavigation();
    const handleRefresh = (event: Event) => { if (isProjectRefresh(event, projectId)) void loadNavigation(); };
    window.addEventListener(PROJECT_REFRESH_EVENT, handleRefresh);

    const channel = supabase
      .channel(`project-navigation:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_navigation",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          requestVersion += 1;
          if (payload.eventType === "DELETE") {
            heldNavigationId = null;
            setProjectNavigation(null);
            return;
          }

          // UPDATE records omit unchanged large columns (plan, shell, block
          // index): merge over the held navigation, never replace with them.
          const record = payload.new as Partial<ProjectNavigationRow>;
          const complete = isCompleteRecord(record, PROJECT_NAVIGATION_COLUMNS);
          setProjectNavigation((current) => {
            if (current && current.id === record.id) {
              return current.designRevision !== undefined && typeof record.design_revision === "number"
                && current.designRevision > record.design_revision
                ? current
                : mergeRealtimeRecord(current, record, mapProjectNavigationRow, PROJECT_NAVIGATION_COLUMNS);
            }
            return complete ? mapProjectNavigationRow(record as ProjectNavigationRow) : current;
          });
          if (complete) heldNavigationId = record.id ?? null;
          else if (heldNavigationId !== record.id) void loadNavigation();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          void loadNavigation();
        }
      });

    return () => {
      cancelled = true;
      requestVersion += 1;
      window.removeEventListener(PROJECT_REFRESH_EVENT, handleRefresh);
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { projectNavigation };
}
