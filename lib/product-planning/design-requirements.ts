import type { ProductPlanning } from "./model";

// Only evidence-backed active user requirements are binding. Designer
// recommendations retain their freedom without becoming user constraints.
export function explicitDesignRequirements(state: ProductPlanning) {
  return state.blueprint.facts.filter(f => f.status === "active" && f.source === "user" && f.evidence.trim()
    && ["preferences", "constraints"].includes(f.section))
    .map(({ id, label, detail, evidence }) => ({ id, label, detail, evidence }));
}

export function designRequirementsKey(state: ProductPlanning) {
  return JSON.stringify(explicitDesignRequirements(state).sort((a, b) => a.id.localeCompare(b.id)));
}

export function compileDesignRequirements(state?: ProductPlanning | null): string | null {
  if (!state || (state.input.imageReferenceMode === "recreate" && state.input.imagePath)) return null;
  const requirements = explicitDesignRequirements(state);
  if (!requirements.length) return null;
  return ["EXPLICIT USER DESIGN REQUIREMENTS",
    "Preserve these evidenced choices. Existing project design governs unspecified choices; compatible reference craft and designer judgment develop the rest. Do not turn vague adjectives into invented fixed constraints. Product constraints do not imply a visual treatment. Preserve visual richness and the complete brief structure.",
    JSON.stringify(requirements),
    state.experience?.compatibility ? `Reference transfer: ${JSON.stringify(state.experience.compatibility)}` : null,
  ].filter(Boolean).join("\n");
}
