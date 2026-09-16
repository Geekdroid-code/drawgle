import { productPatchSchema } from "./model";
import type { EvidenceAssessment } from "./evidence";

export function prepareDesignerPatch(tool: string, argsValue: Record<string, unknown> | undefined, userEvidence: string[],
  history: Array<{ id: string; role: string }>, assessment: EvidenceAssessment) {
  const args = argsValue ?? {};
  const operations = tool === "set_design_scope" ? [{ ...args, op: "set_scope" }] : [
    ...(Array.isArray(args.facts) ? args.facts.map((fact) => ({ op: "put_fact", fact })) : []),
    ...(Array.isArray(args.supersessions) ? args.supersessions.map((entry) => ({ ...entry, op: "supersede_fact" })) : []),
  ];
  const patch = productPatchSchema.parse({ operations });

  const normalizeQuote = (text: string) => text.toLowerCase().replace(/[“”‘’"']/g, "").replace(/\s+/g, " ").trim();
  const assumptions: string[] = [];
  for (const operation of patch.operations) {
    const fact = operation.op === "put_fact" ? operation.fact : operation.op === "supersede_fact" ? operation.replacement : null;
    if (fact?.source === "user" && (!fact.evidence || !userEvidence.some((quote) => normalizeQuote(quote).includes(normalizeQuote(fact.evidence))))) {
      fact.source = "assumption";
      assumptions.push(fact.id);
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
