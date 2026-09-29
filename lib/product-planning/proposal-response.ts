import { Type } from "@google/genai";
import { productSectionSchema } from "./model";

const string = { type: Type.STRING } as const;
const strings = { type: Type.ARRAY, items: string } as const;

/**
 * The structured-output schema for one screen-flow proposal. It deliberately
 * has no minItems/maxItems/length constraints: every bound is enforced by
 * server normalization instead, which keeps the provider's constrained
 * decoder simple and never turns a slightly different answer into an error.
 */
export const proposalResponseSchema = { type: Type.OBJECT, properties: {
  facts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
    ref: string, supersedesId: { type: Type.STRING, nullable: true },
    section: { type: Type.STRING, enum: productSectionSchema.options },
    label: string, detail: string, source: { type: Type.STRING, enum: ["user", "assumption"] },
    evidence: string, links: strings,
  }, required: ["ref", "section", "label", "detail", "source", "evidence", "links"] } },
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
