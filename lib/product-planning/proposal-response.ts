import { Type } from "@google/genai";
import { z } from "zod";
import { designFlowCandidateSchema } from "./proposal-candidate";
import { activeFacts, productSectionSchema, type ProductPlanning } from "./model";
import { requiredFactSections, requiredProductFactSections } from "./required-facts";

const string = { type: Type.STRING } as const;
const strings = { type: Type.ARRAY, items: string } as const;
const factResponse = { type: Type.OBJECT, properties: {
    ref: string, supersedesId: { type: Type.STRING, nullable: true },
    label: string, detail: string, source: { type: Type.STRING, enum: ["user", "assumption"] },
    evidence: string, links: strings, blocking: { type: Type.BOOLEAN },
  }, required: ["ref", "label", "detail", "source", "evidence", "links", "blocking"] };
const responseSchema = { type: Type.OBJECT, properties: {
  removeFactIds: strings,
  outputs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
    ref: string, existingKey: { type: Type.STRING, nullable: true }, name: string, description: string,
    surfaceRefs: strings, journeyRefs: strings, decisionRefs: strings, dependencyRefs: strings,
    actions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      label: string, destinationRef: { type: Type.STRING, nullable: true }, outcome: string,
    }, required: ["label", "destinationRef", "outcome"] } },
    information: string,
    entryCondition: { type: Type.STRING, description: "How this screen is reached: name an incoming action or the actor's independent entry point." },
    outcome: { type: Type.STRING, description: "The visible result of this screen's task, including an inline completion when no result screen is needed." },
    inlineStates: strings,
    sequence: { type: Type.INTEGER },
  }, required: ["ref", "name", "description", "surfaceRefs", "journeyRefs", "actions",
    "information", "entryCondition", "outcome", "inlineStates"] } },
  removeOutputKeys: strings,
  scope: { type: Type.OBJECT, properties: { goal: string, rationale: string,
    outputRefs: strings, surfaceRefs: strings }, required: ["goal", "rationale", "outputRefs", "surfaceRefs"] },
}, required: ["facts", "removeFactIds", "outputs", "removeOutputKeys", "scope"] };

const descriptions: Partial<Record<(typeof productSectionSchema.options)[number], string>> = {
  identity: "What product is being designed. Preserve the user's product intent.",
  actors: "Who uses the screens. Preserve distinct audiences and roles.",
  jobs: "User tasks and desired visible outcomes the screens must support. Not backend jobs or implementation decisions.",
  journeys: "How each actor enters the flow, performs a task, and reaches a visible outcome.",
  surfaces: "The product areas represented by the planned screens.",
};

/** The producer must supply the same fact categories that approval consumes.
 * Existing categories may stay empty: saved facts remain authoritative and do
 * not need another model-generated copy on each answer or targeted repair. */
export function proposalResponseContract(state: ProductPlanning) {
  const required = new Set<string>(requiredFactSections(state.input));
  const fact = designFlowCandidateSchema.shape.facts.element.omit({ section: true });
  const sections = requiredProductFactSections;
  const otherSections = productSectionSchema.options.filter(section => !sections.some(core => core === section));
  const otherFact = designFlowCandidateSchema.shape.facts.element.extend({ section: z.enum(otherSections) });
  const groups = Object.fromEntries(sections.map(section => {
    const min = required.has(section) && !activeFacts(state, section).length ? 1 : 0;
    return [section, z.array(fact).min(min).max(40)];
  }));
  const grouped = designFlowCandidateSchema.extend({ facts: z.object({ ...groups, other: z.array(otherFact).max(40) }) });
  const properties = Object.fromEntries(sections.map(section => [section, {
    type: Type.ARRAY, items: factResponse, maxItems: 40,
    minItems: required.has(section) && !activeFacts(state, section).length ? 1 : 0,
    description: `${descriptions[section] ?? section} Add only new facts or explicit corrections; reuse active facts by ID.`,
  }]));
  return {
    responseSchema: { ...responseSchema, properties: {
      facts: { type: Type.OBJECT, properties: { ...properties,
        other: { type: Type.ARRAY, maxItems: 40, items: { ...factResponse,
          properties: { ...factResponse.properties, section: { type: Type.STRING, enum: otherSections } },
          required: [...factResponse.required, "section"] },
        description: "Other new or explicitly changed facts, including surfaces and visual requirements. Preserve each fact's section." },
      }, required: [...sections, "other"] }, ...responseSchema.properties } },
    parse(value: unknown) {
      const candidate = grouped.parse(value);
      return designFlowCandidateSchema.parse({ ...candidate, facts: [
        ...sections.flatMap(section => candidate.facts[section].map(item => ({ ...item, section }))),
        ...candidate.facts.other,
      ] });
    },
  };
}

