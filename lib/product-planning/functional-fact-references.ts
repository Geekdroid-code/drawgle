import { activeFacts, type ProductFact, type ProductPlanning } from "./model";
import type { FunctionalItem } from "./functional-plan";
import { ProductToolError } from "./tool-failure";

const humanize = (id: string) => id.replace(/^surface[-_:]?|^journey[-_:]?/i, "")
  .replace(/[-_:]+/g, " ").replace(/\b\w/g, char => char.toUpperCase()).trim() || "Main";

/** Normalize model IDs on a copy. A failed roadmap write must not alter the live planning state. */
export function reconcileFunctionalFactReferences(state: ProductPlanning, items: FunctionalItem[]): ProductPlanning {
  const next = structuredClone(state);
  const byId = new Map(next.blueprint.facts.map(fact => [fact.id, fact]));
  const active = (section: ProductFact["section"]) => activeFacts(next, section);
  // Follow supersessions to the fact that holds this ID's place now.
  const current = (id: string) => {
    let fact = byId.get(id);
    const seen = new Set<string>();
    while (fact?.status === "superseded" && fact.supersededBy && !seen.has(fact.id)) {
      seen.add(fact.id);
      fact = byId.get(fact.supersededBy);
    }
    return fact;
  };
  const resolve = (id: string, section: "surfaces" | "journeys") => {
    const fact = current(id);
    if (fact?.status === "active" && fact.section === section) return fact.id;
    if (!byId.has(id)) return null;
    if (fact?.status === "active") throw new ProductToolError(fact.id === id
      ? `${id} is a ${fact.section} fact, not a ${section} fact. Use an active ${section} fact ID.`
      : `The ${section} fact ${id} was replaced by ${fact.id}, which is a ${fact.section} fact. Use an active ${section} fact ID.`,
    "ROADMAP_FACT_REFERENCES", { factId: id, factSection: fact.section, expectedSection: section });
    throw new ProductToolError(`The ${section} fact ${id} was retired. Use an active ${section} fact ID.`,
      "ROADMAP_FACT_REFERENCES", { factId: id, expectedSection: section });
  };
  const addAssumption = (id: string, section: "surfaces" | "journeys", item: FunctionalItem) => {
    const label = humanize(id);
    const detail = section === "surfaces"
      ? `${item.name}: ${item.description}`
      : `${item.entryCondition} → ${item.outcome}`;
    const fact: ProductFact = { id, section, label, detail: detail.slice(0, 2400), source: "assumption",
      evidence: "", provenance: { basis: "inferred", recommendationMessageId: null }, links: [],
      blocking: false, status: "active", supersededBy: null, messageId: null };
    next.blueprint.facts.push(fact);
    byId.set(id, fact);
  };

  for (const item of items) {
    if (!item.surfaceIds.length) item.surfaceIds = [active("surfaces")[0]?.id ?? "surface-main"];
    if (!item.journeyIds.length) item.journeyIds = [active("journeys")[0]?.id ?? "journey-main"];
    for (const section of ["surfaces", "journeys"] as const) {
      const ids = section === "surfaces" ? item.surfaceIds : item.journeyIds;
      for (let index = 0; index < ids.length; index++) {
        const replacement = resolve(ids[index], section);
        if (replacement) ids[index] = replacement;
        else addAssumption(ids[index], section, item);
      }
    }
    // Decision links are optional context, so only active decisions are kept.
    // Unknown or retired IDs and facts filed elsewhere (such as a style
    // preference) are dropped, never invented or allowed to fail the save.
    item.decisionIds = [...new Set(item.decisionIds.flatMap(id => {
      const fact = current(id);
      return fact?.status === "active" && fact.section === "decisions" ? [fact.id] : [];
    }))];
  }
  return next;
}
