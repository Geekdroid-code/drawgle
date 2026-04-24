"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { fetchGenerationRuns } from "@/lib/supabase/queries";
import { isActiveGenerationStatus, type GenerationRunData } from "@/lib/types";

export function useGenerationRuns(projectId: string, initialRuns: GenerationRunData[]) {
  const [generationRuns, setGenerationRuns] = useState(initialRuns);
  const [isLoading, setIsLoading] = useState(initialRuns.length === 0);

  // Sync initialRuns prop changes into state without using setState inside an effect.
  // We track the previous reference and update synchronously during render.
  const prevInitialRunsRef = useRef(initialRuns);
  if (prevInitialRunsRef.current !== initialRuns) {
    prevInitialRunsRef.current = initialRuns;
    setGenerationRuns(initialRuns);
  }

  const refreshGenerationRuns = useCallback(async () => {
    if (!projectId) {
      setGenerationRuns([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const nextRuns = await fetchGenerationRuns(createClient(), projectId);
      setGenerationRuns(nextRuns);
    } catch (error) {
      console.error("Failed to load generation runs", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    void refreshGenerationRuns();

    const supabase = createClient();
    const channel = supabase
      .channel(`generation-runs:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_runs",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          void refreshGenerationRuns();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, refreshGenerationRuns]);

  const generationRun = generationRuns.find((run) => isActiveGenerationStatus(run.status)) ?? null;

  return {
    generationRun,
    generationRuns,
    isLoading,
    refreshGenerationRuns,
  };
}