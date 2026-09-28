import { ProductToolError } from "./tool-failure";

/** Shared by the proposal producer and approval consumer. */
export const requiredProductFactSections = ["identity", "actors", "jobs", "journeys"] as const;

export function requiredFactSections(input: { imagePath: string | null; imageReferenceMode: string }) {
  return input.imagePath && input.imageReferenceMode === "recreate"
    ? ["identity"] as const : requiredProductFactSections;
}

export function assertRequiredFacts(state: { input: Parameters<typeof requiredFactSections>[0];
  blueprint: { facts: Array<{ section: string; status: string }> } }) {
  const missing = requiredFactSections(state.input).filter(section =>
    !state.blueprint.facts.some(fact => fact.status === "active" && fact.section === section));
  if (missing.length) throw new ProductToolError(
    `The proposal must record these missing fact sections: ${missing.join(", ")}. Use the user's brief and saved decisions; do not invent new requirements.`,
    "REQUIRED_FACTS_MISSING", { sections: missing });
}
