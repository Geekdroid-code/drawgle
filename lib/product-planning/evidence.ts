import { z } from "zod";
import { decisionClassificationSchema, designerRecommendationSchema } from "./discovery-decisions";
import { questionChoicesSchema } from "./questions";

export const evidenceAssessmentSchema = z.object({
  turnId: z.string(),
  mode: z.enum(["product", "recreate", "clarify_mode"]),
  modeChangeEvidence: z.string().max(1000).optional(),
  productReady: z.boolean(),
  experienceReady: z.boolean(),
  gaps: z.array(z.object({
    area: z.enum(["product", "experience", "mode"]),
    question: z.string().min(1).max(600),
    consequence: z.string().min(1).max(1000),
    choices: questionChoicesSchema.optional(),
    ...decisionClassificationSchema.partial().shape,
  })).max(6),
  recommendations: z.array(designerRecommendationSchema).max(12).optional(),
  delegation: z.string().max(1000).default(""),
  rationale: z.string().min(1).max(2000),
});
export type EvidenceAssessment = z.infer<typeof evidenceAssessmentSchema>;

export function evidenceAllowsProposal(assessment?: EvidenceAssessment | null) {
  return Boolean(assessment && assessment.mode !== "clarify_mode" && assessment.productReady
    && assessment.experienceReady && assessment.gaps.length === 0);
}

export const decisionProvenanceSchema = z.object({
  basis: z.enum(["direct", "accepted_recommendation", "delegated", "inferred", "reference_observation"]).default("inferred"),
  recommendationMessageId: z.string().uuid().nullable().default(null),
});
