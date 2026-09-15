import { activeFacts, type ProductPlanning } from "./model";

export function compileProductContent(state?: ProductPlanning | null): string | null {
  if (!state) return null;
  if (state.input.imageReferenceMode === "recreate" && state.input.imagePath) return "Exact recreation: retain visible source copy and measurements. Do not rewrite it using inferred product language.";
  const sections = ["identity", "actors", "jobs", "entities", "capabilities", "content", "constraints"] as const;
  return ["PRODUCT CONTENT CONTRACT — applies to visible UI copy, sample data, labels and claims on every screen.",
    "Write for the actual audience doing its jobs. Visual reference styling never establishes the product's domain, vocabulary, audience or capabilities. Use consistent entity and action names across the app, natural reading level and plausible units. Do not invent technical telemetry, security/privacy guarantees, biometric claims or performance statistics. Technical language is appropriate only when the actual product and audience justify it. Assumptions are tentative, not user promises.",
    ...sections.map(section => `${section}: ${JSON.stringify(activeFacts(state, section).map(({ label, detail, source }) => ({ label, detail, source })))}`),
  ].join("\n");
}
