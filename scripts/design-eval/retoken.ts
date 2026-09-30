import { calibrateGeneratedTokens, type CalibrationEvidence } from "@/lib/design-tokens";
import { userNamedColorRoles } from "@/lib/generation/user-color-roles";
import type { MeasuredPalette } from "@/lib/generation/reference-palette";
import { compileDesignRequirements } from "@/lib/product-planning/design-requirements";
import { readProductPlanning } from "@/lib/product-planning/model";

import type { ProjectBundle } from "./bundle";

/**
 * A what-if: the project's existing screens under tokens calibrated the way
 * generation now calibrates them. It needs no model call, so a change to the
 * tokens can be judged on real screens before a project is regenerated.
 */
export function retokenBundle(
  bundle: ProjectBundle,
  evidence: Omit<CalibrationEvidence, "userColorRoles"> & { palette?: MeasuredPalette | null },
): ProjectBundle {
  const tokens = bundle.project.designTokens;
  if (!tokens?.tokens) return bundle;

  let requirements: string | null = null;
  try {
    requirements = compileDesignRequirements(readProductPlanning(bundle.project.productPlanning), "curated_style");
  } catch {
    // Planning state that does not parse names no colours.
  }

  return {
    ...bundle,
    project: {
      ...bundle.project,
      designTokens: calibrateGeneratedTokens(tokens, { ...evidence, userColorRoles: userNamedColorRoles(requirements) }),
    },
  };
}
