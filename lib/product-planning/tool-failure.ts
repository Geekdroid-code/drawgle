import { z } from "zod";
import { createHash } from "node:crypto";

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

export function describeToolFailure(tool: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "Invalid product update.";
  const code = error instanceof ProductToolError ? error.code : typeof record.code === "string" ? record.code : error instanceof z.ZodError ? "INVALID_TOOL_ARGUMENTS" : "PLANNING_VALIDATION";
  const issuePaths = error instanceof z.ZodError
    ? [...new Set(error.issues.map(issue => issue.path.map(String).join(".").slice(0, 120)))].slice(0, 8) : [];
  const issues = error instanceof ProductToolError && Array.isArray(error.repair.issues)
    ? error.repair.issues.filter((issue): issue is string => typeof issue === "string")
      .map(issue => issue.replace(/[\r\n\t]+/g, " ").slice(0, 300)).slice(0, 3) : [];
  // Detailed repair feedback stays in the model turn. Persist/log codes and a
  // controlled summary, not raw DB/provider errors, prompts or credentials.
  const summary = code === "UNRESOLVED_PRODUCT_DECISIONS" ? "A screen or flow choice still needs an answer. Continue planning to confirm it."
    : code === "FACT_ID_CONFLICT" ? "A product fact changed meaning under an existing ID. The saved decision is intact; revise it with an explicit supersession."
    : code === "FACT_NOT_ACTIVE" ? "The fact selected for revision is no longer active. Read the current fact IDs before retrying."
    : code === "FACT_LINK_INVALID" ? "A product fact points to a missing or superseded fact. Repair the link before continuing."
    : code === "ROADMAP_FACT_REFERENCES" ? "A planned screen still uses a changed product fact. Update its roadmap references with the decision."
    : code === "INVALID_TOOL_ARGUMENTS" ? "A planning field failed validation. Drawgle can retry the indicated fields without changing saved decisions."
    : tool === "update_functional_plan" ? "Some planned screens or states could not be saved."
    : tool === "set_design_scope" ? "The selected scope does not yet match the saved screen flow."
    : tool === "propose_scope" ? "The planned flow still has gaps or inconsistent transitions."
    : "A product planning update could not be completed.";
  return { feedback: { error: message, code, ...(error instanceof ProductToolError ? error.repair : {}) },
    diagnostic: { stage: tool, code: code.slice(0, 100), summary, retryable: true,
      validationFingerprint: createHash("sha256").update(tool + ":" + code + ":" + message).digest("hex").slice(0, 12),
      ...(issuePaths.length ? { issuePaths } : {}), ...(issues.length ? { issues } : {}) } satisfies PlanningFailure };
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
