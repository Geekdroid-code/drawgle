import type { GenerationScopeContract, ProjectCharter, ReferenceMode } from "@/lib/types";
import { activeFacts, type ProductPlanning } from "./model";

export function formatProductTruth(state: ProductPlanning, includeScope = false) {
  return [
    "AUTHORITATIVE PRODUCT BLUEPRINT: product architecture comes before visual interpretation. Preserve active user decisions; assumptions remain assumptions. Superseded decisions are not product truth. References govern design, never invent or remove product capabilities because of a visual style.",
    JSON.stringify(activeFacts(state)),
    includeScope && state.scope ? `APPROVED DESIGN SCOPE (only these surfaces are to be generated now; other product surfaces remain in the roadmap): ${JSON.stringify(state.scope)}` : null,
  ].filter(Boolean).join("\n");
}

export function scopedGenerationPrompt(state: ProductPlanning) {
  if (!state.scope) throw new Error("No design scope exists.");
  const surfaces = state.scope.surfaceIds.map((id) => activeFacts(state, "surfaces").find((fact) => fact.id === id)!);
  const identity = activeFacts(state, "identity").map((fact) => fact.detail).join(" ").slice(0, 500);
  const preferences = activeFacts(state, "preferences").map((fact) => fact.detail).join(" ").slice(0, 500);
  return [identity, state.scope.goal.slice(0, 1000), `Design exactly ${surfaces.length} screens in the following order:`,
    ...surfaces.map((fact, index) => `${index + 1}. ${fact.label}: ${fact.detail.slice(0, 160)}`),
    preferences ? `Design preferences: ${preferences}` : null,
    "The broader product roadmap is context only; do not generate additional screens or states in this pass."].filter(Boolean).join("\n");
}

export function productScopeContract(state: ProductPlanning, referenceMode: ReferenceMode): GenerationScopeContract {
  const ids = state.scope?.surfaceIds ?? [];
  if (!ids.length) throw new Error("No approved design surfaces.");
  return {
    version: 2, referenceMode, promptScreenCount: ids.length, namedScreenCount: ids.length,
    imageScreenCount: null, finalScreenCount: ids.length, countSource: "named_screens", confidence: "high",
    conflictResolution: null, allScreensRequested: false, reason: "User-approved product design scope.",
    diagnostics: [`Product revision ${state.scope?.approvedRevision}`], requiresConfirmation: false, ambiguities: [],
    screens: ids.map((id, index) => ({ index: index + 1, name: activeFacts(state, "surfaces").find((fact) => fact.id === id)!.label, kind: "screen" })),
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
