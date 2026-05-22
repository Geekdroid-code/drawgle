"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/supabase/database.types";
import { mapProjectRow } from "@/lib/supabase/mappers";
import type { ProjectData } from "@/lib/types";

const EMPTY_PROJECTS: ProjectData[] = [];
const PAGE_SIZE = 20;

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

export function useProjects(ownerId: string, initialProjects: ProjectData[] = EMPTY_PROJECTS) {
  const [projects, setProjects] = useState<ProjectData[]>(() => sortProjects(initialProjects));
  const [isLoading, setIsLoading] = useState(initialProjects.length === 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialProjects.length >= PAGE_SIZE);

  useEffect(() => {
    if (!ownerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const loadProjects = async () => {
      if (initialProjects.length > 0) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(PAGE_SIZE);

        if (error) throw error;

        const nextProjects = (data ?? []).map(mapProjectRow);
        if (!cancelled) {
          setProjects(nextProjects);
          setHasMore(nextProjects.length >= PAGE_SIZE);
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
  }, [ownerId, initialProjects]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || !ownerId) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const supabase = createClient();
      const oldestProject = projects[projects.length - 1];

      let queryBuilder = supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (oldestProject) {
        queryBuilder = queryBuilder.lt("updated_at", oldestProject.updatedAt);
      }

      const { data, error } = await queryBuilder;
      if (error) {
        throw error;
      }

      const nextBatch = (data ?? []).map(mapProjectRow);
      if (nextBatch.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setProjects((current) => {
        const merged = [...current];
        nextBatch.forEach((proj) => {
          if (!merged.some((p) => p.id === proj.id)) {
            merged.push(proj);
          }
        });
        return sortProjects(merged);
      });
    } catch (error) {
      console.error("Failed to load more projects", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    const supabase = createClient();
    const previousProjects = projects;

    setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId));

    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("owner_id", ownerId);
    if (error) {
      setProjects(previousProjects);
      throw error;
    }
  };

  return {
    projects,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    deleteProject,
  };
}
