import { experienceSchema } from "./experience";
import { explicitDesignRequirements, designRequirementsKey } from "./design-requirements";
import type { ProductPlanning } from "./model";

/** Prompt-only design already has its source of truth. Do not ask a model to
 * paraphrase it as a prerequisite for the models that actually design the UI. */
export function promptExperience(state: ProductPlanning, reason: "explicit" | "optional_reference_unavailable") {
  const requirements = explicitDesignRequirements(state).map(item => `${item.label}: ${item.detail}`).join("\n");
  return experienceSchema.parse({
    provenance: "prompt_synthesis", referencePath: null, referenceId: null, referenceHash: null,
    requirementsKey: designRequirementsKey(state),
    observations: "No external visual evidence is used. The original user brief and saved explicit design requirements are the design sources.",
    direction: ["Develop the visual system from the complete original brief and explicit user design requirements. Preserve those requirements; use design judgment for unspecified choices.", requirements].filter(Boolean).join("\n").slice(0, 4000),
    informationHierarchy: "Use each approved screen's task, visible information and primary action to determine its hierarchy. Shared styling does not imply identical screen layouts.",
    navigation: "Use the approved screen actions, destinations and independent actor entries. Do not invent destinations from an unrelated reference.",
    adaptations: "The token generator and screen designer receive the complete brief and approved scope. Keep user requirements authoritative; no external palette, imagery or product behavior is implied.",
    compatibility: { compatible: true, conflicts: [],
      transfer: "Use the user's brief and explicit requirements directly; there is no external reference to reconcile.",
      rationale: reason === "explicit" ? "The user chose prompt-only design."
        : "Optional curated evidence was unavailable or incompatible. The original design requirements remain unchanged." },
  });
}
