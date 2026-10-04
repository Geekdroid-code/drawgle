import { logger, schedules } from "@trigger.dev/sdk";

import { reconcileStaleGenerationCredits, releaseStaleEditCredits } from "@/lib/generation/credit-reservations";
import { createAdminClient } from "@/lib/supabase/admin";

export const reconcileGenerationCreditsTask = schedules.task({
  id: "reconcile-generation-credits",
  cron: "*/10 * * * *",
  maxDuration: 120,
  run: async () => {
    const admin = createAdminClient();
    const result = await reconcileStaleGenerationCredits(admin, 200);
    const releasedEdits = await releaseStaleEditCredits(admin, 200);
    logger.info("Reconciled stale credit reservations", { ...result, releasedEdits });
    return { ...result, releasedEdits };
  },
});
