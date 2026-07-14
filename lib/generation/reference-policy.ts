import type { GenerationReferencePolicy } from "@/lib/types";

export const isGenerationReferencePolicy = (value: unknown): value is GenerationReferencePolicy =>
  value === "user_upload"
  || value === "project_reference"
  || value === "explicit_style"
  || value === "project_memory"
  || value === "curated_fallback";

export function resolveGenerationReferencePolicy({
  hasCurrentUserImage,
  hasProjectReferenceImage,
  hasExplicitStyle,
  isExistingProject,
  requestedPolicy,
}: {
  hasCurrentUserImage: boolean;
  hasProjectReferenceImage: boolean;
  hasExplicitStyle: boolean;
  isExistingProject: boolean;
  requestedPolicy?: GenerationReferencePolicy | null;
}): GenerationReferencePolicy {
  if (hasCurrentUserImage) return "user_upload";
  if (hasProjectReferenceImage) return "project_reference";
  if (requestedPolicy) return requestedPolicy;
  if (hasExplicitStyle) return "explicit_style";
  if (isExistingProject) return "project_memory";
  return "curated_fallback";
}

export const usesCuratedReferenceImage = (policy: GenerationReferencePolicy) =>
  policy === "curated_fallback";
