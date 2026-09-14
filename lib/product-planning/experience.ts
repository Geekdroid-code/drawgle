import { z } from "zod";

export const experienceSchema = z.object({
  referencePath: z.string().min(1),
  referenceId: z.string().nullable(),
  referenceHash: z.string().min(1),
  observations: z.string().min(1).max(4000),
  direction: z.string().min(1).max(4000),
  informationHierarchy: z.string().min(1).max(2400),
  navigation: z.string().min(1).max(2400),
  adaptations: z.string().min(1).max(4000),
});
export type ProductExperience = z.infer<typeof experienceSchema>;
