import type { ReferenceMode } from "@/lib/types";

export type FoundationPromptMode = "prompt" | "recreate" | "style" | "preset";
export type PlannerPromptMode = FoundationPromptMode | "project";

export const resolveFoundationPromptMode = ({
  referenceMode,
  hasImage,
  hasDesignStyle,
}: {
  referenceMode?: ReferenceMode | null;
  hasImage: boolean;
  hasDesignStyle: boolean;
}): FoundationPromptMode => {
  if (hasImage) {
    return referenceMode === "user_recreate" ? "recreate" : "style";
  }
  return hasDesignStyle ? "preset" : "prompt";
};

export const resolvePlannerPromptMode = ({
  referenceMode,
  hasImage,
  hasDesignStyle,
  hasExistingProject,
}: {
  referenceMode?: ReferenceMode | null;
  hasImage: boolean;
  hasDesignStyle: boolean;
  hasExistingProject: boolean;
}): PlannerPromptMode => {
  if (hasImage) {
    return referenceMode === "user_recreate" ? "recreate" : "style";
  }
  if (hasDesignStyle) return "preset";
  if (hasExistingProject) return "project";
  return "prompt";
};
