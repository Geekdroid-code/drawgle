import type { GenerationScopeContract, ProjectCharter, ReferenceMode } from "@/lib/types";
import { activeFacts, type ProductPlanning } from "./model";
import { scopeParents, outputPrompt } from "./scope-outputs";

export function formatProductTruth(state: ProductPlanning, includeScope = false) {
  return [
    "AUTHORITATIVE PRODUCT BLUEPRINT: product architecture comes before visual interpretation. Preserve active user decisions; assumptions remain assumptions. Superseded decisions are not product truth. References govern design, never invent or remove product capabilities because of a visual style.",
    JSON.stringify(activeFacts(state)),
    state.experience ? `APPROVED EXPERIENCE DIRECTION: ${JSON.stringify(state.experience)}` : null,
    includeScope && state.scope ? `APPROVED DESIGN SCOPE (generate the selected output manifest; existingOutputs are already built context and other product surfaces remain in the roadmap): ${JSON.stringify(state.scope)}` : null,
  ].filter(Boolean).join("\n");
}

export function scopedGenerationPrompt(state: ProductPlanning, executionKeys?: string[]) {
  if (!state.scope) throw new Error("No design scope exists.");
  if (state.scope.manifest?.length) return [
    activeFacts(state, "identity").map(f => f.detail).join(" "), state.scope.goal,
    `Design exactly these ${scopeParents(state, executionKeys).length} parent screens in this execution batch, with the separately approved parent-linked states:`,
    outputPrompt(scopeParents(state, executionKeys)).slice(0, 7000), state.experience?.direction?.slice(0, 1000),
    "Keep the approved screen identities and functional requirements. Do not add or merge outputs.",
  ].filter(Boolean).join("\n\n");
  const surfaces = state.scope.surfaceIds.map((id) => activeFacts(state, "surfaces").find((fact) => fact.id === id)!);
  const identity = activeFacts(state, "identity").map((fact) => fact.detail).join(" ").slice(0, 500);
  const preferences = activeFacts(state, "preferences").map((fact) => fact.detail).join(" ").slice(0, 500);
  return [identity, state.scope.goal.slice(0, 1000), `Design exactly ${surfaces.length} screens in the following order:`,
    ...surfaces.map((fact, index) => `${index + 1}. ${fact.label}: ${fact.detail.slice(0, 160)}`),
    preferences ? `Design preferences: ${preferences}` : null,
    "The broader product roadmap is context only; do not generate additional screens or states in this pass."].filter(Boolean).join("\n");
}

export function productScopeContract(state: ProductPlanning, referenceMode: ReferenceMode, executionKeys?: string[]): GenerationScopeContract {
  const ids = state.scope?.surfaceIds ?? [];
  if (!ids.length) throw new Error("No approved design surfaces.");
  const names = state.scope?.manifest?.length ? scopeParents(state, executionKeys).map(item => item.name) : ids.map(id => activeFacts(state, "surfaces").find(fact => fact.id === id)!.label);
  return {
    version: 2, referenceMode, promptScreenCount: names.length, namedScreenCount: names.length,
    imageScreenCount: null, finalScreenCount: names.length, countSource: "named_screens", confidence: "high",
    conflictResolution: null, allScreensRequested: false, reason: "User-approved product design scope.",
    diagnostics: [`Product revision ${state.scope?.approvedRevision}`], requiresConfirmation: false, ambiguities: [],
    screens: names.map((name, index) => ({ index: index + 1, name, kind: "screen" })),
  };
}

export function groundCharterInProduct(charter: ProjectCharter, state?: ProductPlanning | null): ProjectCharter {
  if (!state) return charter;
  return { ...charter,
    appType: activeFacts(state, "identity").map((fact) => fact.detail).join(" ") || charter.appType,
    targetAudience: activeFacts(state, "actors").map((fact) => fact.detail).join(" ") || charter.targetAudience,
    keyFeatures: activeFacts(state, "capabilities").map((fact) => `${fact.label}: ${fact.detail}`),
  };
}
