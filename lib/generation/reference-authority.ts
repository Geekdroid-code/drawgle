export type ReferenceScope = "project" | "screen";

/** Server-owned authority; the presence of an image never grants project authority. */
export function resolveReferenceScope(input: {
  referenceScope?: ReferenceScope | null;
  isNewProject?: boolean;
  productPhase?: "discovery" | "canvas";
  hasProjectDesign?: boolean;
}): ReferenceScope {
  if (input.referenceScope) return input.referenceScope;
  // All batches in the initial approval keep its source authority, including retries.
  if (input.productPhase === "discovery" || input.isNewProject) return "project";
  return input.hasProjectDesign || input.productPhase === "canvas" ? "screen" : "project";
}

export const SCREEN_REFERENCE_INSTRUCTION = "ATTACHMENT AUTHORITY: Any attached image is guidance for this request only. Use relevant layout, hierarchy and content to fulfil the user's request, adapted to the existing project tokens, typography, navigation and product decisions. Do not import its palette, change the project visual system, infer new product requirements from it, or add extra screens/states visible in the image. The approved output count remains authoritative.";

export function isScreenScopedRun(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.referenceScope === "screen"
    || metadata?.requestedFrom === "agent-screen-plan-approval"
    || metadata?.requestedFrom === "agent-screen-state-approval";
}
