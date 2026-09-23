"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectNavigationRow } from "@/lib/supabase/database.types";
import { mapProjectNavigationRow } from "@/lib/supabase/mappers";
import { fetchProjectNavigation } from "@/lib/supabase/queries";
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

    const loadNavigation = async () => {
      const version = ++requestVersion;
      try {
        const nextNavigation = await fetchProjectNavigation(supabase, projectId);
        if (!cancelled && version === requestVersion) {
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
            setProjectNavigation(null);
            return;
          }

          const next = mapProjectNavigationRow(payload.new as ProjectNavigationRow);
          setProjectNavigation(current => current?.designRevision !== undefined && next.designRevision !== undefined && current.designRevision > next.designRevision ? current : next);
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
