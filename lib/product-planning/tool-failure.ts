import { z } from "zod";

export class ProductToolError extends Error {
  constructor(message: string, public readonly code: string, public readonly repair: Record<string, unknown> = {}) { super(message); }
}

export const planningFailureSchema = z.object({
  stage: z.string().max(100), code: z.string().max(100),
  summary: z.string().max(1000), retryable: z.boolean(),
  issuePaths: z.array(z.string().max(120)).max(8).optional(),
  issues: z.array(z.string().max(300)).max(3).optional(),
  validationFingerprint: z.string().regex(/^[a-f0-9]{12}$/).optional(),
});
export type PlanningFailure = z.infer<typeof planningFailureSchema>;

export function readPlanningFailure(metadata: Record<string, unknown>, content: string): PlanningFailure | null {
  const parsed = planningFailureSchema.safeParse(metadata.productPlanningFailure);
  if (parsed.success) return parsed.data;
  // Recover already-persisted failure messages without rewriting conversation history.
  if (content.includes("couldn’t finish validating the screen flow") && metadata.productTurnComplete) return {
    stage: "propose_scope", code: "LEGACY_REVIEW_INCOMPLETE", summary: "The saved flow needs another review.", retryable: true,
  };
  return null;
}
