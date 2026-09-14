import { Type, type FunctionDeclaration } from "@google/genai";
const text = { type: Type.STRING };
const strings = { type: Type.ARRAY, items: text };
export const functionalTools: FunctionDeclaration[] = [
  { name: "read_functional_plan", description: "Read the existing canonical roadmap screens and states before planning additions or edits.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "update_functional_plan", description: "Incrementally map concrete screens and meaningful separately generated states. One product surface can have many screens. No screen-count target. Only send changed items. Preserve stable keys. Links and dependency graph are validated atomically. Inline-only states belong on the parent and are not charged outputs.", parameters: {
    type: Type.OBJECT, properties: { removeKeys: strings, items: { type: Type.ARRAY, items: {
      type: Type.OBJECT, properties: {
        stableKey: { ...text, description: "Stable screen:slug or state:parent:slug key. Reuse for updates." },
        kind: { type: Type.STRING, enum: ["screen", "state"] }, name: text, description: text,
        parentStableKey: { ...text, nullable: true, description: "For a state, exact stableKey of its parent screen. Null only for a screen. Include new parents and linked new outputs in this same delta." },
        surfaceIds: { ...strings, description: "IDs of existing blueprint facts in section surfaces, NOT screen: roadmap keys. Read the IDs returned by update_product." },
        journeyIds: { ...strings, description: "IDs of existing blueprint facts in section journeys." },
        decisionIds: { ...strings, description: "Active product fact IDs that establish this screen/state's behavior. Superseded decisions invalidate the functional item until updated." },
        dependencyKeys: { ...strings, description: "Generation prerequisites only, not navigation links. No cycles." },
        actions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: text, destinationKey: { ...text, nullable: true }, outcome: text }, required: ["label", "destinationKey", "outcome"] } },
        information: text, entryCondition: text, outcome: text, inlineStates: strings,
        stateKey: { ...text, nullable: true, description: "For a state: unique lowercase letters/digits/hyphens/underscores identifier within its parent. Required and non-null for states." },
        triggerLabel: { ...text, description: "For a state: nonempty user action or condition that activates it." },
        editInstruction: { ...text, description: "For a state: concrete nonempty changes to the parent's design/content, preserving its visual identity." },
        sequence: { type: Type.INTEGER },
        referenceScreenIndex: { type: Type.INTEGER, nullable: true, description: "One-based visible source frame index for exact recreation, matching the existing image-to-UI contract (first frame = 1). Set null for product adaptations. Supplied state frames to recreate are their own screen outputs, not invented state variations." },
      }, required: ["stableKey", "kind", "name", "description", "parentStableKey", "surfaceIds", "journeyIds", "dependencyKeys", "actions", "information", "entryCondition", "outcome", "inlineStates", "stateKey", "triggerLabel", "editInstruction", "sequence"],
    } } }, required: ["items", "removeKeys"],
  } },
];
