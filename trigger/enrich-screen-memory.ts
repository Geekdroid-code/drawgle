import { logger, task } from "@trigger.dev/sdk";

import { refreshScreenRetrievalMemory } from "@/lib/generation/screen-memory";
import { createAdminClient } from "@/lib/supabase/admin";

export const enrichScreenMemoryTask = task({
  id: "enrich-screen-memory",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15000,
  },
  maxDuration: 120,
  run: async ({ screenId }: { screenId: string }) => {
    const result = await refreshScreenRetrievalMemory(createAdminClient(), screenId);
    logger.info("Refreshed screen retrieval memory", result);
    return result;
  },
});
