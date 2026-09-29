"use client";

import { useEffect, useState } from "react";
import { isProjectRefresh, PROJECT_REFRESH_EVENT } from "@/lib/project-refresh";

import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/supabase/database.types";
import { mapProjectRow, PROJECT_COLUMNS } from "@/lib/supabase/mappers";
import { fetchProject } from "@/lib/supabase/queries";
import { isCompleteRecord, mergeRealtimeRecord } from "@/lib/supabase/realtime-patch";
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
    // The project a completed fetch or complete record has confirmed.
    let heldProjectId: string | null = null;

    const loadProject = async () => {
      const version = ++requestVersion;
      try {
        // Refresh in place. Toggling initial loading here unmounts the canvas/chat,
        // which starts planning again and creates a refresh -> 409 -> refresh loop.
        const nextProject = await fetchProject(supabase, projectId);
        if (!cancelled && version === requestVersion) {
          heldProjectId = nextProject?.id ?? null;
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
            heldProjectId = null;
            setProject(null);
            return;
          }

          // An UPDATE omits unchanged large columns (tokens, charter, planning):
          // merge it over the project already held, never replace with it.
          const record = payload.new as Partial<ProjectRow>;
          const complete = isCompleteRecord(record, PROJECT_COLUMNS);
          setProject((current) => current && current.id === record.id
            ? mergeRealtimeRecord(current, record, mapProjectRow, PROJECT_COLUMNS)
            : complete ? mapProjectRow(record as ProjectRow) : current);
          if (complete) heldProjectId = record.id ?? null;
          else if (heldProjectId !== record.id) void loadProject();
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
