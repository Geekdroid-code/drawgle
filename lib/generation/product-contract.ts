import { z } from "zod";

import type { ScreenPlan, ScreenProductContractV1 } from "@/lib/types";

const ProductRequirementSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  kind: z.enum(["context", "content", "input", "action", "status", "outcome"]),
  purpose: z.string().trim().min(8).max(500),
});

/** Snake-case schema used only at the product-blueprint LLM boundary. */
export const ScreenProductContractPlannerSchema = z.object({
  version: z.preprocess((value) => value == null ? 1 : Number(value), z.literal(1)),
  user_job: z.string().trim().min(16).max(700),
  default_lifecycle: z.enum(["entry", "ready", "in-progress", "result"]),
  entry_condition: z.string().trim().min(8).max(500),
  requirements: z.array(ProductRequirementSchema).min(3).max(10),
  primary_action_id: z.string().trim().min(1).max(80),
  action_outcome: z.string().trim().min(8).max(500),
  next_step: z.string().trim().min(8).max(500),
}).superRefine((contract, ctx) => {
  const ids = contract.requirements.map((requirement) => requirement.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["requirements"], message: "Requirement ids must be unique." });
  }
  const primary = contract.requirements.find((requirement) => requirement.id === contract.primary_action_id);
  if (!primary || primary.kind !== "action") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primary_action_id"],
      message: "primary_action_id must reference an action requirement.",
    });
  }
});

const EXPLICIT_ACTIVE_OR_RESULT_STATE = /\b(?:show|display|open|design|build|create|start(?:ing)?|active|live|running|recording|listening|in[- ]progress|completed|finished|success|result|receipt|confirmation)\b[^.!?\n]{0,100}\b(?:state|session|call|recording|progress|result|receipt|confirmation|success|completion|completed|finished|active|live|running|listening)\b|\b(?:active|live|running|recording|listening|in[- ]progress|completed|finished|success|result)\s+(?:screen|state|view|session)\b/i;

export const normalizeScreenProductContract = (
  value: unknown,
  userPrompt = "",
): ScreenProductContractV1 | null => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!source) return null;

  const parsed = ScreenProductContractPlannerSchema.safeParse({
    version: source.version,
    user_job: source.user_job ?? source.userJob,
    default_lifecycle: source.default_lifecycle ?? source.defaultLifecycle,
    entry_condition: source.entry_condition ?? source.entryCondition,
    requirements: source.requirements,
    primary_action_id: source.primary_action_id ?? source.primaryActionId,
    action_outcome: source.action_outcome ?? source.actionOutcome,
    next_step: source.next_step ?? source.nextStep,
  });
  if (!parsed.success) return null;

  const plannedLifecycle = parsed.data.default_lifecycle;
  const defaultLifecycle = (plannedLifecycle === "in-progress" || plannedLifecycle === "result")
    && Boolean(userPrompt.trim())
    && !EXPLICIT_ACTIVE_OR_RESULT_STATE.test(userPrompt)
    ? "ready"
    : plannedLifecycle;

  return {
    version: 1,
    userJob: parsed.data.user_job,
    defaultLifecycle,
    entryCondition: parsed.data.entry_condition,
    requirements: parsed.data.requirements,
    primaryActionId: parsed.data.primary_action_id,
    actionOutcome: parsed.data.action_outcome,
    nextStep: parsed.data.next_step,
  };
};

export const toPlannerProductContract = (contract: ScreenProductContractV1) => ({
  version: 1,
  user_job: contract.userJob,
  default_lifecycle: contract.defaultLifecycle,
  entry_condition: contract.entryCondition,
  requirements: contract.requirements,
  primary_action_id: contract.primaryActionId,
  action_outcome: contract.actionOutcome,
  next_step: contract.nextStep,
});

export const validateProductRequirementCoverage = (
  screen: Pick<ScreenPlan, "productContract" | "layoutContract">,
): string[] => {
  const contract = screen.productContract;
  if (!contract) return ["Missing immutable product contract."];
  const regions = screen.layoutContract?.regions ?? [];
  if (regions.length === 0) return ["Missing target-owned layout regions."];

  const requirementIds = new Set(contract.requirements.map((requirement) => requirement.id));
  const covered = new Set<string>();
  const issues: string[] = [];
  for (const region of regions) {
    for (const id of region.productRequirementIds ?? []) {
      if (!requirementIds.has(id)) issues.push(`Region ${region.id} maps unknown product requirement ${id}.`);
      else covered.add(id);
    }
  }
  for (const id of requirementIds) {
    if (!covered.has(id)) issues.push(`Product requirement ${id} is not assigned to a layout region.`);
  }
  return issues;
};

export const formatScreenProductContract = (contract: ScreenProductContractV1): string => [
  `User job: ${contract.userJob}`,
  `Default lifecycle: ${contract.defaultLifecycle}`,
  `Entry condition: ${contract.entryCondition}`,
  `Requirements:\n${contract.requirements.map((requirement) => `- ${requirement.id} [${requirement.kind}]: ${requirement.purpose}`).join("\n")}`,
  `Primary action: ${contract.primaryActionId}`,
  `Action outcome: ${contract.actionOutcome}`,
  `Next step: ${contract.nextStep}`,
].join("\n");
