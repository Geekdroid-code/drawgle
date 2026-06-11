"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectNavigationRow } from "@/lib/supabase/database.types";
import { mapProjectNavigationRow } from "@/lib/supabase/mappers";
import { fetchProjectNavigation } from "@/lib/supabase/queries";
import type { ProjectNavigationData } from "@/lib/types";

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

    const loadNavigation = async () => {
      try {
        const nextNavigation = await fetchProjectNavigation(supabase, projectId);
        if (!cancelled) {
          setProjectNavigation(nextNavigation);
        }
      } catch (error) {
        console.error("Failed to load project navigation", error);
      }
    };

    void loadNavigation();

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
          if (payload.eventType === "DELETE") {
            setProjectNavigation(null);
            return;
          }

          setProjectNavigation(mapProjectNavigationRow(payload.new as ProjectNavigationRow));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          void loadNavigation();
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { projectNavigation };
}
