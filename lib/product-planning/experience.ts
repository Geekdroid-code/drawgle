import { z } from "zod";

export const experienceSchema = z.object({
  sourceFrames: z.array(z.object({ index: z.number().int().positive(),
    bounds: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }),
    sourceHash: z.string().length(64), path: z.string().min(1), hash: z.string().length(64), transformVersion: z.literal(1),
  })).max(24).optional(),
  referencePath: z.string().min(1).nullable(),
  referenceId: z.string().nullable(),
  referenceHash: z.string().min(1).nullable(),
  catalogHash: z.string().optional(),
  requirementsKey: z.string().optional(),
  compatibility: z.object({ compatible: z.boolean(), conflicts: z.array(z.string()).max(20), transfer: z.string().max(3000), rationale: z.string().max(2000) }).optional(),
  observations: z.string().min(1).max(4000),
  direction: z.string().min(1).max(4000),
  informationHierarchy: z.string().min(1).max(2400),
  navigation: z.string().min(1).max(2400),
  adaptations: z.string().min(1).max(4000),
});
export type ProductExperience = z.infer<typeof experienceSchema>;
