import type {
  BuilderProjectContractV1,
  DesignComponentShapePolicy,
  DesignTokens,
  NavigationPlan,
  ProjectCharter,
  ScreenFamilyContract,
  ScreenPlan,
} from "@/lib/types";

const DEFAULT_SHAPE_POLICY: DesignComponentShapePolicy = {
  version: 1,
  field: "app",
  standardButton: "inner",
  primaryCta: "inner",
  segmentedContainer: "app",
  segmentedItem: "inner",
  nestedSurface: "inner",
  iconWell: "pill",
  evidenceSource: "default",
  rationale: "Use the canonical component-role radius hierarchy.",
};

/**
 * One-line purpose for the contract's screen identity block.
 *
 * This contract exists to carry *product continuity*, and the builder already
 * receives the full brief as `Screen Description` in its system instruction.
 * Passing `screenPlan.description` through verbatim sent the entire brief a
 * second time — byte-for-byte identical, roughly 350 tokens per build — and
 * contradicted this module's own rule that it is not a screen template.
 */
const summarizeScreenPurpose = (description: string) => {
  const labelled = /(?:^|\n)\s*Visual Goal:\s*([^\n]+)/i.exec(description)?.[1]
    ?? /(?:^|\n)\s*Reference DNA:\s*([^\n]+)/i.exec(description)?.[1]
    ?? description.split(/\n/).find((line) => line.trim().length > 0)
    ?? "";
  const cleaned = labelled.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trimEnd()}...` : cleaned;
};

export function buildBuilderProjectContract({
  charter,
  screenFamily,
  screenPlan,
  navigationPlan,
  designTokens,
}: {
  charter: ProjectCharter;
  screenFamily?: ScreenFamilyContract | null;
  screenPlan: ScreenPlan;
  navigationPlan?: NavigationPlan | null;
  designTokens?: DesignTokens | null;
}): BuilderProjectContractV1 {
  const shapePolicy = designTokens?.meta?.componentShapePolicy ?? DEFAULT_SHAPE_POLICY;
  return {
    version: 1,
    product: {
      appType: charter.appType,
      targetAudience: charter.targetAudience,
      purpose: `${charter.appType} for ${charter.targetAudience}`,
      keyFeatures: charter.keyFeatures.slice(0, 12),
    },
    screen: {
      name: screenPlan.name,
      type: screenPlan.type,
      purpose: summarizeScreenPurpose(screenPlan.description),
      regions: screenPlan.layoutContract?.regions ?? [],
      chromePolicy: screenPlan.chromePolicy ?? null,
    },
    navigation: {
      enabled: Boolean(navigationPlan?.enabled),
      destinations: (navigationPlan?.items ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        role: item.role,
        linkedScreenName: item.linkedScreenName,
      })),
      currentItemId: screenPlan.navigationItemId ?? null,
    },
    family: screenFamily ?? null,
    componentShapePolicy: shapePolicy,
  };
}

export const formatBuilderProjectContract = (contract: BuilderProjectContractV1) => [
  "BUILDER PRODUCT CONTRACT V1 — PRODUCT CONTINUITY, NOT A SCREEN TEMPLATE",
  JSON.stringify(contract, null, 2),
  "The target screen purpose and named regions own layout. Do not import another screen's topology or source-reference domain content.",
].join("\n");
