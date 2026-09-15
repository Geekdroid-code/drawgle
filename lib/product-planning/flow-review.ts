import { z } from "zod";
import type { ProductPlanning } from "./model";
import type { FunctionalItem } from "./functional-plan";

export const journeyCoverageSchema = z.object({
  journeyId: z.string().min(1), actorId: z.string().min(1), jobId: z.string().min(1),
  outcome: z.string().min(1).max(1500),
  outputKeys: z.array(z.string().min(1)).min(1).max(500),
  entryKey: z.string().min(1), completionKeys: z.array(z.string().min(1)).min(1).max(100),
});
export const flowReviewSchema = z.object({
  ready: z.boolean(), issues: z.array(z.string().min(1).max(1500)).max(12),
  requestedScope: z.enum(["whole_product", "focused"]),
  scopeEvidence: z.string().min(1).max(1500),
  journeys: z.array(journeyCoverageSchema).max(100),
});
export type FlowReview = z.infer<typeof flowReviewSchema>;

export function validateJourneyCoverage(state: ProductPlanning, roadmap: FunctionalItem[], review: FlowReview, userMessages: string[]) {
  const issues: string[] = [];
  const normalize = (value: string) => value.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();
  if (!userMessages.some(message => normalize(message).includes(normalize(review.scopeEvidence)))) issues.push("Ground the requested scope in an exact user quote, not the agent's scope rationale.");
  const byKey = new Map(roadmap.map(item => [item.stableKey, item]));
  const selected = new Set([...(state.scope?.outputKeys ?? []), ...(state.scope?.existingOutputs ?? []).map(output => output.item.stableKey)]);
  const facts = (section: "journeys" | "actors" | "jobs") => new Set(state.blueprint.facts.filter(fact => fact.status === "active" && fact.section === section).map(fact => fact.id));
  const journeyIds = facts("journeys"), actorIds = facts("actors"), jobIds = facts("jobs");
  if (!review.journeys.length) issues.push("Map actual user journeys from entry to completed outcomes before approval.");
  if (review.requestedScope === "whole_product") {
    for (const jobId of jobIds) if (!review.journeys.some(journey => journey.jobId === jobId)) issues.push(`The user job ${jobId} has no mapped outcome. Map it or correct an incorrectly classified blueprint fact.`);
  }
  for (const journey of review.journeys) {
    if (!journeyIds.has(journey.journeyId) || !actorIds.has(journey.actorId) || !jobIds.has(journey.jobId)) issues.push(`Journey ${journey.journeyId} must reference active actors, jobs and journeys.`);
    const keys = new Set(journey.outputKeys);
    if (!keys.has(journey.entryKey) || journey.completionKeys.some(key => !keys.has(key))) issues.push(`Journey ${journey.journeyId} must include its entry and completion outputs.`);
    for (const key of keys) {
      if (!byKey.has(key)) issues.push(`Journey ${journey.journeyId} references unplanned output ${key}.`);
      if (review.requestedScope === "whole_product" && !selected.has(key)) issues.push(`The user requested the whole product, but ${key} is excluded. Do not silently narrow to a visual sample.`);
    }
    // Navigation edges and parent-to-state transitions, not generation dependencies,
    // determine whether the app lets a user reach the declared outcome.
    const reached = new Set<string>(); const queue = [journey.entryKey];
    while (queue.length) {
      const key = queue.shift()!;
      if (reached.has(key) || !keys.has(key)) continue;
      reached.add(key);
      const item = byKey.get(key);
      queue.push(...(item?.actions.flatMap(action => action.destinationKey ? [action.destinationKey] : []) ?? []));
      for (const candidate of roadmap) if (candidate.parentStableKey === key && candidate.triggerLabel) queue.push(candidate.stableKey);
    }
    for (const key of keys) if (!reached.has(key)) issues.push(`Journey ${journey.journeyId} cannot reach ${key} through its planned actions or state transitions.`);
  }
  return [...new Set(issues)];
}
