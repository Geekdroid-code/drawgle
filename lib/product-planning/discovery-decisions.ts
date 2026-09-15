import { z } from "zod";
import type { EvidenceAssessment } from "./evidence";

export const decisionTypeSchema = z.enum(["product_behavior", "business_rule", "actor_access", "visual_design", "interaction_detail"]);
export const decisionClassificationSchema = z.object({
  decisionKey: z.string().regex(/^[a-z0-9_-]{1,100}$/),
  decisionType: decisionTypeSchema,
  requiresUserInput: z.boolean(),
  whyUserMustDecide: z.string().max(1000),
});

export const designerRecommendationSchema = z.object({
  decisionKey: z.string().min(1).max(100),
  recommendation: z.string().min(1).max(1500),
  rationale: z.string().min(1).max(1500),
});

/** A visual preference cannot block product discovery, even when returned as a gap. */
export function resolveDiscoveryDecisions(assessment: EvidenceAssessment, resolvedKeys: string[]) {
  const resolved = new Set(resolvedKeys);
  const recommendations = [...(assessment.recommendations ?? [])];
  const gaps = assessment.gaps.filter(gap => {
    const classification = decisionClassificationSchema.parse(gap);
    if (resolved.has(classification.decisionKey)) return false;
    const designerOwned = ["visual_design", "interaction_detail"].includes(classification.decisionType)
      || !classification.requiresUserInput;
    if (designerOwned) {
      const choice = gap.choices?.[0];
      if (choice) recommendations.push({ decisionKey: classification.decisionKey,
        recommendation: `${choice.label}: ${choice.description}`, rationale: gap.consequence });
      return false;
    }
    if (!classification.whyUserMustDecide.trim()) throw new Error("A product question needs a concrete reason this user must decide rather than the designer recommending a reversible default.");
    return true;
  });
  // The assessment judges user-dependent uncertainty. The later architecture
  // review separately checks whether the agent has actually mapped the product.
  return { ...assessment, gaps, recommendations: [...new Map(recommendations.map(item => [item.decisionKey, item])).values()].slice(0, 12), productReady: gaps.length === 0,
    experienceReady: gaps.length === 0 };
}
