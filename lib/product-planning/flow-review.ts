import { z } from "zod";

// Saved scopes approved before the proposal planner stopped running a separate
// model review may still carry this coverage summary; the scope card shows it.
export const journeyCoverageSchema = z.object({
  journeyId: z.string().min(1), actorId: z.string().min(1), jobId: z.string().min(1),
  outcome: z.string().min(1).max(1500),
  outputKeys: z.array(z.string().min(1)).min(1).max(500),
  entryKey: z.string().min(1), completionKeys: z.array(z.string().min(1)).min(1).max(100),
});
