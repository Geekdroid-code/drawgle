import { expect, it } from "vitest";
import { productSectionSchema } from "./model";
import { proposalResponseSchema } from "./proposal-response";
import { normalizeDesignFlowCandidate } from "./proposal-candidate";

const constraintKeys = new Set(["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "pattern"]);
function constraints(value: unknown, path = "schema"): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    constraintKeys.has(key) ? [`${path}.${key}`] : constraints(child, `${path}.${key}`));
}

it("keeps the provider schema free of count and length constraints the server already normalizes", () => {
  // Constrained decoding rejects over-complex schemas outright; bounds live in normalization.
  expect(constraints(proposalResponseSchema)).toEqual([]);
});

it("asks for a flat fact list with every product section available", () => {
  const facts = proposalResponseSchema.properties.facts;
  expect(facts.type).toBe("ARRAY");
  expect(facts.items.properties.section.enum).toEqual(productSectionSchema.options);
});

it("asks for the navigation decision with the screens, and for each destination's screen", () => {
  const { navigation } = proposalResponseSchema.properties;
  expect(navigation.properties.persistent.type).toBe("BOOLEAN");
  expect(navigation.required).toEqual(["persistent", "destinations", "rationale"]);
  expect(navigation.properties.destinations.items.required).toEqual(["label", "outputRef"]);
  expect(navigation.properties.destinations.items.properties.outputRef.nullable).toBe(true);
  expect(proposalResponseSchema.required).toContain("navigation");
});

it("still reads the retired grouped fact shape from an older response", () => {
  const candidate = normalizeDesignFlowCandidate({
    facts: { identity: [{ ref: "app", label: "Chore app", detail: "Family chores", source: "assumption", evidence: "", links: [] }],
      actors: [], jobs: [], journeys: [], other: [{ ref: "home", section: "surfaces", label: "Home", detail: "Today view",
        source: "assumption", evidence: "", links: [] }] },
    outputs: [{ ref: "today", name: "Today", description: "Today's chores", surfaceRefs: ["home"], journeyRefs: [],
      actions: [], information: "Chores", entryCondition: "App start", outcome: "Chores are visible", inlineStates: [] }],
    scope: { goal: "Chores", rationale: "Requested", outputRefs: ["today"], surfaceRefs: ["home"] },
  });
  expect(candidate?.facts.map(fact => fact.section)).toEqual(["identity", "surfaces"]);
});
