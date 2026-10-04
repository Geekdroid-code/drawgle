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
  navigation: { type: Type.OBJECT, description: "Whether this app has one persistent bottom navigation bar, and what it holds. The person approves it with the screens.", properties: {
    persistent: { type: Type.BOOLEAN, description: "True only when the product has peer areas people move between all day, such as Home, Orders and Messages in one product, or Library and Search in another. False for a linear flow, a single task, or a hierarchy of detail screens." },
    destinations: { type: Type.ARRAY, description: "The bar's destinations, in order, when persistent: 2 to 5 short labels. Empty when persistent is false.", items: { type: Type.OBJECT, properties: {
      label: { type: Type.STRING, description: "A short product-specific name shown under the icon, in the product's own words." },
      outputRef: { type: Type.STRING, nullable: true, description: "The ref of the output this destination opens, or a currentRoadmap stableKey. Null when no screen in this plan opens it yet." },
    }, required: ["label", "outputRef"] } },
    rationale: { type: Type.STRING, description: "One sentence: why the product does or does not need persistent navigation." },
  }, required: ["persistent", "destinations", "rationale"] },
  anatomy: { type: Type.OBJECT, description: "How the phone app of this kind is built, used by touch, decided from the product, its people and their tasks alone, never from a visual reference. Structure only: no colour, font, radius, shadow, blur, glass, material, mood or number. No sidebars, side-docked panels, right-click menus, hover states or keyboard shortcuts.", properties: {
    kind: { type: Type.STRING, description: "The specific kind of app in a few words, as a person would describe it, never a broad category." },
    components: { type: Type.ARRAY, description: "The product's own recurring components, 2 to 8. First the item each list or grid holds (every kind of thing people browse, pick or act on), then the main screen's header and other parts that repeat across screens.", items: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING, description: "A short kebab-case name for what it is, never for its sample content." },
      shows: { type: Type.STRING, description: "What it shows." },
      form: { type: Type.STRING, description: "The form the best app of this kind gives it, chosen from how people use that content: a compact row where they scan many items, a tile where they pick a visual one, a card for one rich item, a sheet, a bar. Its parts, whether neighbouring items are divided by a line or a gap, and how dense it is. Never how it looks." },
    }, required: ["name", "shows", "form"] } },
    conventions: { type: Type.ARRAY, description: "At most 6 things people expect from the phone app of this kind and miss when absent: how they sort, filter, select, act on items and move through depth, by touch.", items: string },
    avoid: { type: Type.ARRAY, description: "At most 5 structures (screens, sections or components) that would make it read as another kind of app; never a style.", items: string },
  }, required: ["kind", "components", "conventions", "avoid"] },
}, required: ["facts", "removeFactIds", "outputs", "removeOutputKeys", "scope", "navigation", "anatomy"] };
