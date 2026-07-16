import type { ReferenceMode } from "@/lib/types";

export type GenerationPromptMode = "recreate" | "style" | "prompt";

/**
 * Selects the prompt contract from application state. The LLM never decides
 * whether it is recreating pixels, borrowing visual DNA, or working from text.
 */
export const resolveGenerationPromptMode = ({
  referenceMode,
  hasImage,
  hasDesignStyle,
  hasReferenceAnalysis,
  hasProjectVisualMemory = false,
}: {
  referenceMode?: ReferenceMode | null;
  hasImage: boolean;
  hasDesignStyle: boolean;
  hasReferenceAnalysis: boolean;
  hasProjectVisualMemory?: boolean;
}): GenerationPromptMode => {
  if (hasImage && referenceMode === "user_recreate") {
    return "recreate";
  }

  if (hasImage || hasDesignStyle || hasReferenceAnalysis || hasProjectVisualMemory) {
    return "style";
  }

  return "prompt";
};
