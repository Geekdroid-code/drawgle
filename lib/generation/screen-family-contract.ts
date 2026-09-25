import type { ScreenFamilyContract } from "@/lib/types";

export function formatScreenFamilyContract(contract: ScreenFamilyContract) {
  return [
    "Screen family contract:",
    `- Summary: ${contract.summary}`,
    `- Surfaces: ${contract.surfaces}`,
    `- Typography: ${contract.typography}`,
    `- Spacing: ${contract.spacing}`,
    `- Navigation: ${contract.navigation}`,
    `- Imagery: ${contract.imagery}`,
    contract.consistencyRules.length
      ? `- Consistency rules: ${contract.consistencyRules.join(" | ")}`
      : null,
  ].filter(Boolean).join("\n");
}
