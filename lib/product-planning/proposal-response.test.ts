import { expect, it } from "vitest";
import { createProductPlanning, activeFacts } from "./model";
import { proposalResponseContract } from "./proposal-response";
import { requiredProductFactSections } from "./required-facts";
import { productFixture, proposalResponseFixture } from "./test-fixtures";

const empty = () => createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
const candidate = () => ({
  facts: productFixture().blueprint.facts.map(fact => ({ ...fact, ref: fact.id })),
  outputs: [], scope: { goal: "Shopping", rationale: "Requested shopping flow", outputRefs: ["shop"], surfaceRefs: ["shop"] },
});

it.each(requiredProductFactSections)("requires missing %s facts in the model schema and parser", section => {
  const contract = proposalResponseContract(empty());
  expect(contract.responseSchema.properties.facts.properties[section].minItems).toBe(1);
  const response = proposalResponseFixture(candidate());
  response.facts[section] = [];
  expect(() => contract.parse(response)).toThrow();
  expect(contract.parse(proposalResponseFixture(candidate())).facts.some(fact => fact.section === section)).toBe(true);
});

it("requires only the absent category when resuming the reported saved state", () => {
  const state = productFixture();
  state.blueprint.facts = state.blueprint.facts.filter(fact => fact.section !== "jobs");
  const contract = proposalResponseContract(state);
  for (const section of requiredProductFactSections) {
    expect(contract.responseSchema.properties.facts.properties[section].minItems).toBe(section === "jobs" ? 1 : 0);
  }
  const response = proposalResponseFixture({ ...candidate(), facts: candidate().facts.filter(fact => fact.section === "jobs") });
  expect(contract.parse(response).facts.map(fact => fact.section)).toEqual(["jobs"]);
});

it("does not require repeated facts when saved categories are already complete", () => {
  const state = productFixture();
  const contract = proposalResponseContract(state);
  expect(contract.parse(proposalResponseFixture({ ...candidate(), facts: [] })).facts).toEqual([]);
  for (const section of requiredProductFactSections) {
    expect(activeFacts(state, section).length).toBeGreaterThan(0);
    expect(contract.responseSchema.properties.facts.properties[section].minItems).toBe(0);
  }
});

it("assigns categories from their group and preserves the existing flat persistence contract", () => {
  const response = proposalResponseFixture(candidate());
  const parsed = proposalResponseContract(empty()).parse(response);
  expect(parsed.facts.map(fact => fact.section)).toEqual(candidate().facts.map(fact => fact.section));
  expect(Array.isArray(parsed.facts)).toBe(true);
});
