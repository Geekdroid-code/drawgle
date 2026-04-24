"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { fetchGenerationRuns } from "@/lib/supabase/queries";
import { isActiveGenerationStatus, type GenerationRunData } from "@/lib/types";

export function useGenerationRuns(projectId: string, initialRuns: GenerationRunData[]) {
  // React-documented pattern: "Storing information from previous renders"
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevInitial, setPrevInitial] = useState(initialRuns);
  const [generationRuns, setGenerationRuns] = useState(initialRuns);
  const [isLoading, setIsLoading] = useState(initialRuns.length === 0);

  if (prevInitial !== initialRuns) {
    setPrevInitial(initialRuns);
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
    if (!projectId) return;

    let cancelled = false;

    // Inline async fetch so all setState calls happen after the await,
    // avoiding synchronous setState in the effect body.
    (async () => {
      try {
        const nextRuns = await fetchGenerationRuns(createClient(), projectId);
        if (!cancelled) {
          setGenerationRuns(nextRuns);
        }
      } catch (error) {
        console.error("Failed to load generation runs", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

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
      cancelled = true;
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