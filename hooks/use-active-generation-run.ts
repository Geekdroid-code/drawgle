"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { fetchActiveGenerationRun } from "@/lib/supabase/queries";
import type { GenerationRunData } from "@/lib/types";

export function useActiveGenerationRun(projectId: string, initialRun: GenerationRunData | null) {
  const [generationRun, setGenerationRun] = useState<GenerationRunData | null>(initialRun);
  const [isLoading, setIsLoading] = useState(!initialRun);

  useEffect(() => {
    setGenerationRun(initialRun);
  }, [initialRun]);

  useEffect(() => {
    if (!projectId) {
      setGenerationRun(null);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const loadGenerationRun = async () => {
      try {
        setIsLoading(true);
        const nextRun = await fetchActiveGenerationRun(supabase, projectId);
        if (!cancelled) {
          setGenerationRun(nextRun);
        }
      } catch (error) {
        console.error("Failed to load active generation run", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadGenerationRun();

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
          void loadGenerationRun();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    generationRun,
    isLoading,
  };
}