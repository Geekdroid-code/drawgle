import { z } from "zod";
import type { EvidenceAssessment } from "./evidence";

export const screenDecisionTypeSchema = z.enum(["screen_scope", "screen_flow", "screen_content"]);
export const decisionTypeSchema = z.enum([
  ...screenDecisionTypeSchema.options, "product_behavior", "business_rule", "actor_access", "visual_design", "interaction_detail",
]);
export const isScreenDecisionType = (value: unknown) => screenDecisionTypeSchema.safeParse(value).success;
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

const screenQuestion = /\b(screen|view|page|flow|journey|navigation|navigate|visible|display|shown|show|see|appear|gallery|content|actions?|buttons?|tap|entry|state)\b/i;
export const isScreenFramedQuestion = (question: string) => screenQuestion.test(question);
const implementationChoice = /\b(cloud[ -]?sync(?:ed|ing)?|cloud[ -]?backup|backup|database|backend|api|storage|file format|codec|mp4|gif|processing algorithm|video lengths?)\b/i;
export const isScreenDesignCardQuestion = (item: Pick<EvidenceAssessment["gaps"][number], "question" | "consequence" | "choices">) =>
  isScreenFramedQuestion(item.question)
  && !implementationChoice.test([item.question, item.consequence, ...(item.choices ?? []).flatMap(choice => [choice.label, choice.description])].join(" "));

/** Only user-specific screen decisions can hold up design; implementation choices cannot. */
export function resolveDiscoveryDecisions(assessment: EvidenceAssessment, resolvedKeys: string[]) {
  const resolved = new Set(resolvedKeys);
  const recommendations = (assessment.recommendations ?? []).filter(item =>
    !implementationChoice.test(`${item.recommendation} ${item.rationale}`));
  const gaps = assessment.gaps.filter(gap => {
    const classification = decisionClassificationSchema.parse(gap);
    if (resolved.has(classification.decisionKey)) return false;
    if (!isScreenDecisionType(classification.decisionType)) {
      if (!["visual_design", "interaction_detail"].includes(classification.decisionType)) return false;
      const choice = gap.choices?.[0];
      if (choice && !implementationChoice.test(`${choice.label} ${choice.description}`)) recommendations.push({ decisionKey: classification.decisionKey,
        recommendation: `${choice.label}: ${choice.description}`, rationale: gap.consequence });
      return false;
    }
    // A mislabeled implementation question must not reach the interactive cards.
    if (!isScreenDesignCardQuestion(gap)) return false;
    if (!classification.requiresUserInput) {
      const choice = gap.choices?.[0];
      if (choice) recommendations.push({ decisionKey: classification.decisionKey,
        recommendation: `${choice.label}: ${choice.description}`, rationale: gap.consequence });
      return false;
    }
    if (!classification.whyUserMustDecide.trim()) throw new Error("A screen question needs a concrete reason this user must decide rather than the designer recommending a reversible default.");
    return true;
  });
  // The assessment judges user-dependent uncertainty. The later architecture
  // review separately checks whether the agent has actually mapped the product.
  return { ...assessment, gaps, recommendations: [...new Map(recommendations.map(item => [item.decisionKey, item])).values()].slice(0, 12), productReady: gaps.length === 0,
    experienceReady: gaps.length === 0 };
}
