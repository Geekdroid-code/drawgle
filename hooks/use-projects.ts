"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/supabase/database.types";
import { mapProjectRow } from "@/lib/supabase/mappers";
import { fetchProjects } from "@/lib/supabase/queries";
import type { ProjectData } from "@/lib/types";

const sortProjects = (projects: ProjectData[]) =>
  [...projects].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

const upsertProject = (projects: ProjectData[], project: ProjectData) => {
  const existingIndex = projects.findIndex((entry) => entry.id === project.id);
  if (existingIndex === -1) {
    return sortProjects([...projects, project]);
  }

  const nextProjects = [...projects];
  nextProjects[existingIndex] = project;
  return sortProjects(nextProjects);
};

export function useProjects(ownerId: string, initialProjects: ProjectData[] = []) {
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(initialProjects.length === 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    if (!ownerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const loadProjects = async () => {
      try {
        setIsLoading(true);
        const nextProjects = await fetchProjects(supabase);
        if (!cancelled) {
          setProjects(nextProjects);
        }
      } catch (error) {
        console.error("Failed to load projects", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    const channel = supabase
      .channel(`projects:${ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `owner_id=eq.${ownerId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setProjects((currentProjects) => currentProjects.filter((project) => project.id !== payload.old.id));
            return;
          }

          setProjects((currentProjects) => upsertProject(currentProjects, mapProjectRow(payload.new as ProjectRow)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [ownerId]);

  return {
    projects,
    isLoading,
  };
}