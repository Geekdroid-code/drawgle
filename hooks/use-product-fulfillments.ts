"use client";

import { useEffect, useState } from "react";

import type { FlowFulfillment } from "@/lib/agent/flow-build";
import { createClient } from "@/lib/supabase/client";

/**
 * Which approved screens are claimed, built or failed, for one approval. The person can read their own approval's
 * claims ("Owners read product fulfillment"); nothing here writes. `refreshKey` changes when the build moves on; while
 * the build is live the claims are read again every few seconds as well, in case a realtime update is missed.
 */
export function useProductFulfillments(approvalId: string | null, refreshKey: string, live: boolean) {
  const [loaded, setLoaded] = useState<{ approvalId: string; fulfillments: FlowFulfillment[] } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!approvalId || !live) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 8000);
    return () => window.clearInterval(interval);
  }, [approvalId, live]);

  useEffect(() => {
    if (!approvalId) return;
    let cancelled = false;
    void createClient()
      .from("product_output_fulfillments")
      .select("output_key, status, screen_id, generation_run_id")
      .eq("approval_id", approvalId)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setLoaded({
          approvalId,
          fulfillments: (data ?? []).map((row) => ({
            outputKey: row.output_key,
            status: row.status,
            screenId: row.screen_id,
            generationRunId: row.generation_run_id,
          })),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [approvalId, refreshKey, tick]);

  return loaded && loaded.approvalId === approvalId ? loaded.fulfillments : null;
}
