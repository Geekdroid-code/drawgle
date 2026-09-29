import { productPatchSchema } from "./model";
import type { EvidenceAssessment } from "./evidence";

const factId = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const decisionKey = /^[a-z0-9_-]{1,100}$/;
const decisionTypes = new Set(["screen_scope", "screen_flow", "screen_content"]);
const bases = new Set(["direct", "accepted_recommendation", "delegated", "inferred", "reference_observation"]);
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit).trim() : "";
export const normalizeDesignerFactId = (value: unknown) => typeof value === "string"
  ? value.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "").slice(0, 80).replace(/-+$/, "") : "";

// Filler that models add to any restatement; it never carries a user claim.
const fillerWords = new Set(["the", "and", "for", "with", "that", "this", "these", "those", "from", "into", "onto", "their",
  "they", "them", "its", "are", "was", "were", "has", "have", "had", "can", "will", "should", "would", "each", "every", "any",
  "all", "per", "via", "who", "what", "when", "where", "which", "while", "also", "only", "just", "more", "most", "very",
  "app", "apps", "application", "user", "users", "screen", "screens", "view", "views", "feature", "features", "people", "person"]);
const stem = (word: string) => word.length > 4 ? word.replace(/(?:ing|ed|es|s)$/, "") : word;
const contentWords = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/)
  .filter(word => word.length >= 3 && !fillerWords.has(word)).map(stem);
const normalizeQuote = (value: string) => value.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();

/** A user fact may paraphrase, but its claims must come from the user's words.
 * An unsupported modifier (for example "biometric" from "premium habit
 * tracker") must never become a binding user requirement. */
export function groundedInUserWords(value: string, userEvidence: string[]) {
  const words = [...new Set(contentWords(value))];
  if (!words.length) return true;
  const available = new Set(userEvidence.flatMap(contentWords));
  return words.filter(word => available.has(word)).length / words.length >= 0.7;
}

export const quotedByUser = (evidence: string, userEvidence: string[]) =>
  Boolean(evidence.trim()) && userEvidence.some(quote => normalizeQuote(quote).includes(normalizeQuote(evidence)));

/** Deterministic wording for a claimed user fact. A grounded paraphrase keeps
 * the designer's words; otherwise the confirmed fact is stated in the user's
 * own quoted words. The same input always yields the same wording, so a
 * restated fact matches its saved identity instead of duplicating it. */
export function userFactWording<T extends { label: string; detail: string; evidence: string }>(fact: T, userEvidence: string[]): T {
  if (groundedInUserWords(`${fact.label} ${fact.detail}`, userEvidence)) return fact;
  return { ...fact, detail: fact.evidence.slice(0, 2400).trim(),
    label: groundedInUserWords(fact.label, userEvidence) ? fact.label : fact.evidence.slice(0, 120).trim() };
}

function normalizeFact(value: unknown) {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const id = normalizeDesignerFactId(raw.id) || normalizeDesignerFactId(raw.label) || normalizeDesignerFactId(raw.detail);
  const label = text(raw.label, 120) || text(raw.detail, 120);
  const detail = text(raw.detail, 2400) || label;
  const source = raw.source === "user" ? "user" : "assumption";
  const evidence = source === "user" ? text(raw.evidence, 1000) : "";
  const provenance = raw.provenance && typeof raw.provenance === "object" ? raw.provenance as Record<string, unknown> : {};
  const basis = bases.has(provenance.basis as string) ? provenance.basis as string : source === "user" ? "direct" : "inferred";
  const recommendationMessageId = typeof provenance.recommendationMessageId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(provenance.recommendationMessageId)
    ? provenance.recommendationMessageId : null;
  const links = Array.isArray(raw.links) ? [...new Set(raw.links.map(normalizeDesignerFactId).filter(link => factId.test(link)))].slice(0, 30) : [];
  return {
    id, section: raw.section, label, detail, source, evidence, links,
    provenance: { basis, recommendationMessageId },
    blocking: raw.blocking === true,
    ...(typeof raw.decisionKey === "string" && decisionKey.test(raw.decisionKey) ? { decisionKey: raw.decisionKey } : {}),
    ...(decisionTypes.has(raw.designDecisionType as string) ? { designDecisionType: raw.designDecisionType } : {}),
  };
}

export function prepareDesignerPatch(tool: string, argsValue: Record<string, unknown> | undefined, userEvidence: string[],
  history: Array<{ id: string; role: string }>, assessment: EvidenceAssessment) {
  const args = argsValue ?? {};
  const operations = tool === "set_design_scope" ? [{ ...args, op: "set_scope" }] : [
    ...(Array.isArray(args.facts) ? args.facts.map((fact) => ({ op: "put_fact", fact: normalizeFact(fact) })) : []),
    ...(Array.isArray(args.supersessions) ? args.supersessions.map((entry) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      return { op: "supersede_fact", id: normalizeDesignerFactId(item.id), replacement: item.replacement ? normalizeFact(item.replacement) : null };
    }) : []),
  ];
  if (tool === "update_product" && operations.length === 0) return { patch: { operations: [] } as ReturnType<typeof productPatchSchema.parse>, assumptions: [] };
  const patch = productPatchSchema.parse({ operations });

  const assumptions: string[] = [];
  for (const operation of patch.operations) {
    const fact = operation.op === "put_fact" ? operation.fact : operation.op === "supersede_fact" ? operation.replacement : null;
    if (fact?.source === "user" && !quotedByUser(fact.evidence, userEvidence)) {
      fact.source = "assumption";
      assumptions.push(fact.id);
    } else if (fact?.source === "user" && fact.provenance?.basis !== "accepted_recommendation") {
      Object.assign(fact, userFactWording(fact, userEvidence));
    }
    if (fact) {
      fact.provenance ??= { basis: fact.source === "user" ? "direct" : "inferred", recommendationMessageId: null };
      if (fact.provenance.basis === "accepted_recommendation" && (!history.some(message => message.role === "model" && message.id === fact.provenance!.recommendationMessageId) || fact.source !== "user")) {
        fact.provenance.basis = "inferred";
        fact.provenance.recommendationMessageId = null;
        fact.source = "assumption";
      }
      if (fact.provenance.basis === "delegated" && !assessment.delegation) {
        fact.provenance.basis = "inferred";
        fact.source = "assumption";
      }
      if (fact.provenance.basis === "reference_observation") fact.source = "assumption";
      if (fact.source === "assumption" && fact.provenance.basis === "direct") fact.provenance.basis = "inferred";
    }
  }
  return { patch, assumptions };
}
