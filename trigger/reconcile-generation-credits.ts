import { logger, schedules } from "@trigger.dev/sdk";

import { reconcileStaleGenerationCredits } from "@/lib/generation/credit-reservations";
import { createAdminClient } from "@/lib/supabase/admin";

export const reconcileGenerationCreditsTask = schedules.task({
  id: "reconcile-generation-credits",
  cron: "*/10 * * * *",
  maxDuration: 120,
  run: async () => {
    const result = await reconcileStaleGenerationCredits(createAdminClient(), 200);
    logger.info("Reconciled stale generation credit reservations", result);
    return result;
  },
});
