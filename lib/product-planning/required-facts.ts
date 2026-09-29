import { ProductToolError } from "./tool-failure";

/**
 * Product-mode plans have no mandatory fact categories: the proposal runner
 * derives any missing identity, surface or journey from the request and the
 * plan itself, and no downstream consumer needs a particular category to
 * exist. Exact recreation keeps its minimal observed identity.
 */
export function requiredFactSections(input: { imagePath: string | null; imageReferenceMode: string }): readonly string[] {
  return input.imagePath && input.imageReferenceMode === "recreate" ? ["identity"] : [];
}

export function assertRequiredFacts(state: { input: Parameters<typeof requiredFactSections>[0];
  blueprint: { facts: Array<{ section: string; status: string }> } }) {
  const missing = requiredFactSections(state.input).filter(section =>
    !state.blueprint.facts.some(fact => fact.status === "active" && fact.section === section));
  if (missing.length) throw new ProductToolError(
    `The proposal must record these missing fact sections: ${missing.join(", ")}. Use the user's brief and saved decisions; do not invent new requirements.`,
    "REQUIRED_FACTS_MISSING", { sections: missing });
}
