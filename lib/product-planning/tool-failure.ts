import { z } from "zod";

export class ProductToolError extends Error {
  constructor(message: string, public readonly code: string, public readonly repair: Record<string, unknown> = {}) { super(message); }
}

export const planningFailureSchema = z.object({
  stage: z.string().max(100), code: z.string().max(100),
  summary: z.string().max(1000), retryable: z.boolean(),
});
export type PlanningFailure = z.infer<typeof planningFailureSchema>;

export function describeToolFailure(tool: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "Invalid product update.";
  const code = error instanceof ProductToolError ? error.code : typeof record.code === "string" ? record.code : error instanceof z.ZodError ? "INVALID_TOOL_ARGUMENTS" : "PLANNING_VALIDATION";
  // Detailed repair feedback stays in the model turn. Persist/log codes and a
  // controlled summary, not raw DB/provider errors, prompts or credentials.
  const summary = code === "UNRESOLVED_PRODUCT_DECISIONS" ? "Some saved product questions still need answers. Continue planning to confirm them."
    : tool === "update_functional_plan" ? "Some planned screens or states could not be saved."
    : tool === "set_design_scope" ? "The selected scope does not yet match the saved screen flow."
    : tool === "propose_scope" ? "The planned flow still has gaps or inconsistent transitions."
    : "A product planning update could not be completed.";
  return { feedback: { error: message, code, ...(error instanceof ProductToolError ? error.repair : {}) },
    diagnostic: { stage: tool, code: code.slice(0, 100), summary, retryable: true } satisfies PlanningFailure };
}

export function readPlanningFailure(metadata: Record<string, unknown>, content: string): PlanningFailure | null {
  const parsed = planningFailureSchema.safeParse(metadata.productPlanningFailure);
  if (parsed.success) return parsed.data;
  // Recover already-persisted failure messages without rewriting conversation history.
  if (content.includes("couldn’t finish validating the screen flow") && metadata.productTurnComplete) return {
    stage: "propose_scope", code: "LEGACY_REVIEW_INCOMPLETE", summary: "The saved flow needs another review.", retryable: true,
  };
  return null;
}
