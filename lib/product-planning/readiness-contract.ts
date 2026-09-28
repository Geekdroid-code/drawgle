import { Type } from "@google/genai";
import { z } from "zod";
import { activeFacts, type ProductPlanning } from "./model";
import { flowReviewSchema, journeyCoverageSchema, normalizeJourneyCoverage } from "./flow-review";
import type { FunctionalItem } from "./functional-plan";
import { ProductToolError } from "./tool-failure";

const text = { type: Type.STRING };
const choice = (values: string[]) => values.length ? { ...text, enum: [...new Set(values)] } : text;
const verdictSchema = z.object({ ready: z.boolean(), issues: z.array(z.string().trim().min(1).max(1500)).max(12) });
const approvalSchema = z.object({
  requestedScope: z.enum(["whole_product", "focused"]),
  scopeMessageIndex: z.number().int().nonnegative(),
  journeys: z.array(journeyCoverageSchema.omit({ outputKeys: true })).min(1).max(100),
});

/** The model judges meaning and selects existing endpoints. The server owns
 * membership lists and quoted evidence, so copying mistakes cannot break a flow. */
export function readinessResponseSchema(state: ProductPlanning, roadmap: FunctionalItem[], messageCount: number) {
  const output = choice(roadmap.map(item => item.stableKey));
  return { type: Type.OBJECT, properties: {
    ready: { type: Type.BOOLEAN },
    issues: { type: Type.ARRAY, maxItems: 12, items: { ...text, description: "One actionable screen/flow correction, at most 1500 characters." } },
    requestedScope: { ...text, enum: ["whole_product", "focused"], nullable: true },
    scopeMessageIndex: { type: Type.INTEGER, minimum: 0, maximum: Math.max(0, messageCount - 1), nullable: true },
    journeys: { type: Type.ARRAY, maxItems: 100, items: { type: Type.OBJECT, properties: {
      journeyId: choice(activeFacts(state, "journeys").map(fact => fact.id)),
      actorId: choice(activeFacts(state, "actors").map(fact => fact.id)),
      jobId: choice(activeFacts(state, "jobs").map(fact => fact.id)),
      outcome: { ...text, description: "The visible outcome of the user's task, at most 1500 characters." }, entryKey: output,
      completionKeys: { type: Type.ARRAY, minItems: 1, maxItems: 100, items: output },
    }, required: ["journeyId", "actorId", "jobId", "outcome", "entryKey", "completionKeys"] } },
  }, required: ["ready", "issues", "requestedScope", "scopeMessageIndex", "journeys"] };
}

export function readReadinessDecision(raw: unknown, state: ProductPlanning, roadmap: FunctionalItem[], userMessages: string[]) {
  const verdict = verdictSchema.parse(raw);
  if (!verdict.ready || verdict.issues.length) {
    if (!verdict.issues.length) throw new ProductToolError("The flow reviewer returned no decision or actionable issue.", "REVIEW_EMPTY_DECISION");
    return { ready: false as const, issues: verdict.issues };
  }
  const approval = approvalSchema.parse(raw);
  const evidence = userMessages[approval.scopeMessageIndex];
  if (!evidence) throw new ProductToolError("The flow reviewer did not select an existing user request.", "REVIEW_EVIDENCE_REFERENCE");
  const coverage = normalizeJourneyCoverage(state, roadmap, flowReviewSchema.parse({
    ...verdict, requestedScope: approval.requestedScope, scopeEvidence: evidence.slice(0, 1500),
    journeys: approval.journeys.map(journey => ({ ...journey,
      outputKeys: [...new Set([journey.entryKey, ...journey.completionKeys])] })),
  }));
  return { ready: true as const, issues: [] as string[], coverage };
}
