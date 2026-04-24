"use client";

import { useEffect, useState } from "react";

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
    if (!projectId) {
      setProject(null);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    const loadProject = async () => {
      try {
        setIsLoading(true);
        const nextProject = await fetchProject(supabase, projectId);
        if (!cancelled) {
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
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    project,
    isLoading,
  };
}