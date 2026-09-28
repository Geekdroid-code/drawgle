import { createHash } from "node:crypto";
import { z } from "zod";
import { ProductToolError, type PlanningFailure } from "./tool-failure";

export type ProposalStage = "reference_inspection" | "reference_save" | "scope_validation" | "flow_review" | "scope_save";

const summaries: Record<ProposalStage, string> = {
  reference_inspection: "Drawgle could not inspect the selected visual reference. Your saved screen flow is intact.",
  reference_save: "The visual direction could not be saved. Your saved screen flow is intact.",
  scope_validation: "The saved screen scope has an unresolved planning constraint.",
  flow_review: "The flow review service could not complete its assessment. Your saved screen flow is intact.",
  scope_save: "The reviewed scope could not be saved. Your previous decisions remain intact.",
};

/** Persist enough to distinguish a model, schema, or storage fault, without
 * recording raw provider bodies, prompts, storage paths, or credentials. */
export function describeProposalFailure(stage: ProposalStage, error: unknown): PlanningFailure {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof record.status === "number" && Number.isInteger(record.status) ? record.status : null;
  const databaseCode = typeof record.code === "string" && /^[0-9A-Z]{5}$/.test(record.code) ? record.code : null;
  const kind = error instanceof ProductToolError ? error.code
    : error instanceof z.ZodError ? "RESPONSE_SCHEMA"
    : error instanceof SyntaxError ? "RESPONSE_JSON"
    : status ? `HTTP_${status}` : databaseCode ?? "UNAVAILABLE";
  const issuePaths = error instanceof z.ZodError ? [...new Set(error.issues
    .map(issue => issue.path.map(String).join(".").slice(0, 120)))].slice(0, 8) : [];
  const fingerprint = createHash("sha256").update(JSON.stringify({ stage, kind, issuePaths,
    message: error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "" }))
    .digest("hex").slice(0, 12);
  const summary = kind === "USER_REFERENCE_CONFLICT"
    ? "The supplied reference conflicts with your explicit design requirements. Choose which direction to preserve."
    : kind === "USER_REFERENCE_UNAVAILABLE"
      ? "The supplied reference could not be loaded. Restore or replace that image; your screen flow is saved."
      : summaries[stage];
  return { stage, code: `${stage.toUpperCase()}_${kind}`.slice(0, 100), summary,
    retryable: true, validationFingerprint: fingerprint, ...(issuePaths.length ? { issuePaths } : {}) };
}
