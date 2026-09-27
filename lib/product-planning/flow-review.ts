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

/** Canonical route identities come from saved screens, not a review model's copied key lists. */
export function deriveJourneyGraph(state: ProductPlanning, roadmap: FunctionalItem[]) {
  const selectedKeys = [...new Set([...(state.scope?.outputKeys ?? []),
    ...(state.scope?.existingOutputs ?? []).map(output => output.item.stableKey)])];
  const included = new Set(selectedKeys);
  const byKey = new Map(roadmap.map(item => [item.stableKey, item]));
  const edges: Array<{ from: string; action: string; to: string }> = [];
  for (const from of selectedKeys) {
    const item = byKey.get(from);
    if (!item) continue;
    for (const action of item.actions) if (action.destinationKey && included.has(action.destinationKey)) {
      edges.push({ from: item.stableKey, action: action.label, to: action.destinationKey });
    }
    for (const child of roadmap) if (child.parentStableKey === item.stableKey && child.triggerLabel && included.has(child.stableKey)) {
      edges.push({ from: item.stableKey, action: child.triggerLabel, to: child.stableKey });
    }
  }
  const inbound = new Set(edges.map(edge => edge.to));
  const journeys = state.blueprint.facts.filter(fact => fact.status === "active" && fact.section === "journeys")
    .map(fact => {
      const outputKeys = selectedKeys.filter(key => byKey.get(key)?.journeyIds.includes(fact.id));
      return { journeyId: fact.id, outputKeys,
        deferredOutputKeys: roadmap.filter(item => item.journeyIds.includes(fact.id) && !included.has(item.stableKey))
          .map(item => item.stableKey),
        independentEntryCandidates: outputKeys.filter(key => !inbound.has(key)) };
    });
  return { selectedKeys, edges, journeys };
}

function reachableKeys(entryKey: string, selected: Set<string>, edges: ReturnType<typeof deriveJourneyGraph>["edges"]) {
  const reached = new Set<string>();
  const queue = [entryKey];
  while (queue.length) {
    const key = queue.shift()!;
    if (reached.has(key) || !selected.has(key)) continue;
    reached.add(key);
    queue.push(...edges.filter(edge => edge.from === key).map(edge => edge.to));
  }
  return reached;
}

function isSharedRouteContext(key: string, entryKey: string, completionKeys: string[],
  members: string[], selected: Set<string>, edges: ReturnType<typeof deriveJourneyGraph>["edges"]) {
  if (!selected.has(key) || !members.length) return false;
  const fromEntry = reachableKeys(entryKey, selected, edges);
  if (completionKeys.includes(key)) return members.some(member =>
    fromEntry.has(member) && reachableKeys(member, selected, edges).has(key));
  if (!fromEntry.has(key)) return false;
  const onward = reachableKeys(key, selected, edges);
  return members.some(member => onward.has(member));
}

/** Fill only reviewer bookkeeping gaps; never invent an action, entry, or outcome. */
export function normalizeJourneyCoverage(state: ProductPlanning, roadmap: FunctionalItem[], review: FlowReview): FlowReview {
  const graph = deriveJourneyGraph(state, roadmap);
  const selected = new Set(graph.selectedKeys);
  const byKey = new Map(roadmap.map(item => [item.stableKey, item]));
  const counts = new Map<string, number>();
  for (const journey of review.journeys) counts.set(journey.journeyId, (counts.get(journey.journeyId) ?? 0) + 1);
  return { ...review, journeys: review.journeys.map(journey => {
    const saved = graph.journeys.find(item => item.journeyId === journey.journeyId);
    const reached = reachableKeys(journey.entryKey, selected, graph.edges);
    // Separate declared actor entries may cover independent branches of one broad journey.
    const members = counts.get(journey.journeyId)! > 1
      ? (saved?.outputKeys ?? []).filter(key => reached.has(key)) : saved?.outputKeys ?? [];
    const validEndpoints = [journey.entryKey, ...journey.completionKeys].filter(key =>
      byKey.get(key)?.journeyIds.includes(journey.journeyId)
        || isSharedRouteContext(key, journey.entryKey, journey.completionKeys,
          members, selected, graph.edges));
    return { ...journey, outputKeys: [...new Set([...members, ...journey.outputKeys, ...validEndpoints])] };
  }) };
}

export function validateJourneyCoverage(state: ProductPlanning, roadmap: FunctionalItem[], review: FlowReview, userMessages: string[]) {
  review = normalizeJourneyCoverage(state, roadmap, review);
  const graph = deriveJourneyGraph(state, roadmap);
  const selected = new Set(graph.selectedKeys);
  const byKey = new Map(roadmap.map(item => [item.stableKey, item]));
  const issues: string[] = [];
  const normalize = (value: string) => value.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();
  if (!userMessages.some(message => normalize(message).includes(normalize(review.scopeEvidence)))) issues.push("Ground the requested scope in an exact user quote, not the agent's scope rationale.");
  const facts = (section: "journeys" | "actors" | "jobs") => new Set(state.blueprint.facts.filter(fact => fact.status === "active" && fact.section === section).map(fact => fact.id));
  const journeyIds = facts("journeys"), actorIds = facts("actors"), jobIds = facts("jobs");
  const describeJourney = (id: string) => `${state.blueprint.facts.find(fact => fact.id === id)?.label ?? "Journey"} (${id})`;
  const describeOutput = (key: string) => byKey.has(key) ? `${byKey.get(key)!.name} (${key})` : key;
  if (!review.journeys.length) issues.push("Map actual user journeys from entry to completed outcomes before approval.");
  if (review.requestedScope === "whole_product") {
    for (const jobId of jobIds) if (!review.journeys.some(journey => journey.jobId === jobId)) issues.push(`The user job ${jobId} has no mapped outcome. Map it or correct an incorrectly classified blueprint fact.`);
  }
  for (const journey of review.journeys) {
    if (!journeyIds.has(journey.journeyId) || !actorIds.has(journey.actorId) || !jobIds.has(journey.jobId)) issues.push(`Journey ${journey.journeyId} must reference active actors, jobs and journeys.`);
    const keys = new Set(journey.outputKeys);
    const members = graph.journeys.find(item => item.journeyId === journey.journeyId)?.outputKeys ?? [];
    if (!keys.has(journey.entryKey) || journey.completionKeys.some(key => !keys.has(key))) issues.push(
      `Journey ${describeJourney(journey.journeyId)} must include its entry ${describeOutput(journey.entryKey)} and completion outputs ${journey.completionKeys.slice(0, 3).map(describeOutput).join(", ")}${journey.completionKeys.length > 3 ? `, and ${journey.completionKeys.length - 3} more` : ""}.`);
    for (const key of keys) {
      if (!byKey.has(key)) issues.push(`Journey ${journey.journeyId} references unplanned output ${key}.`);
      else if (!byKey.get(key)!.journeyIds.includes(journey.journeyId)
        && !isSharedRouteContext(key, journey.entryKey, journey.completionKeys,
          members, selected, graph.edges)) {
        issues.push(`Journey ${journey.journeyId} names ${key}, but that screen is not assigned to the journey or on its saved route.`);
      }
      if (review.requestedScope === "whole_product" && !selected.has(key)) issues.push(`The user requested the whole product, but ${key} is excluded. Do not silently narrow to a visual sample.`);
    }
    if (review.requestedScope === "whole_product") for (const key of graph.journeys.find(item => item.journeyId === journey.journeyId)?.deferredOutputKeys ?? []) {
      issues.push(`The user requested the whole product, but ${key} is excluded. Do not silently narrow to a visual sample.`);
    }
    // Shared selected screens may bridge two journey screens; the route must still
    // consist of real saved actions or parent-to-state transitions.
    const reached = reachableKeys(journey.entryKey, selected, graph.edges);
    for (const key of keys) if (!reached.has(key)) issues.push(`Journey ${describeJourney(journey.journeyId)} cannot reach ${describeOutput(key)} through its planned actions or state transitions.`);
  }
  return [...new Set(issues)];
}
