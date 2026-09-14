"use client";

import { useEffect, useState } from "react";
import { isProjectRefresh, PROJECT_REFRESH_EVENT } from "@/lib/project-refresh";

import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/supabase/database.types";
import { mapProjectRow } from "@/lib/supabase/mappers";
import { fetchProject } from "@/lib/supabase/queries";
import type { ProjectData } from "@/lib/types";

export function useProject(projectId: string, initialProject: ProjectData | null) {
  const [project, setProject] = useState<ProjectData | null>(initialProject);
  const [isLoading, setIsLoading] = useState(!initialProject);
  const [prevInitialProject, setPrevInitialProject] = useState(initialProject);
  const [prevProjectId, setPrevProjectId] = useState(projectId);

  if (prevInitialProject !== initialProject) {
    setPrevInitialProject(initialProject);
    setProject(initialProject);
  }

  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    const nextInitial = initialProject?.id === projectId ? initialProject : null;
    setProject(nextInitial);
    setIsLoading(Boolean(projectId && !nextInitial));
  }

  useEffect(() => {
    if (!projectId) return;

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    let requestVersion = 0;

    const loadProject = async () => {
      const version = ++requestVersion;
      try {
        // Refresh in place. Toggling initial loading here unmounts the canvas/chat,
        // which starts planning again and creates a refresh -> 409 -> refresh loop.
        const nextProject = await fetchProject(supabase, projectId);
        if (!cancelled && version === requestVersion) {
          setProject(nextProject);
        }
      } catch (error) {
        console.error("Failed to load project", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProject();
    const onRefresh = (event: Event) => { if (isProjectRefresh(event, projectId)) void loadProject(); };
    window.addEventListener(PROJECT_REFRESH_EVENT, onRefresh);

    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload: any) => {
          if (cancelled) return;
          // A fetch started before this event must not restore an older blueprint.
          requestVersion += 1;
          setIsLoading(false);
          if (payload.eventType === "DELETE") {
            setProject(null);
            return;
          }

          setProject(mapProjectRow(payload.new as ProjectRow));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(PROJECT_REFRESH_EVENT, onRefresh);
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    project,
    isLoading,
  };
}
