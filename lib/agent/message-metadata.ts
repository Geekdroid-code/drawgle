import { isMeaningfulStateVariantForContext } from "@/lib/agent/state-variant-guardrails";
import { isGenerationReferencePolicy } from "@/lib/generation/reference-policy";
import type { GenerationReferencePolicy, ImageReferenceMode, NavigationArchitecture, NavigationPlan, ScreenBaseStatePlan, ScreenPlan, ScreenPlanningSeed, ScreenStateVariantPlan } from "@/lib/types";

export type AgentStepStatus = "queued" | "thinking" | "editing" | "completed" | "failed";

export type AgentUiVariant = "chat" | "thinking" | "action_card" | "error";

export type AgentStepMetadata = {
  kind: "edit" | "generation" | "navigation" | "proposal" | "system";
  status: AgentStepStatus;
  title: string;
  detail?: string | null;
  targetLabel?: string | null;
  progress?: number | null;
  processLines?: string[] | null;
  resultPreview?: string | null;
};

export type ThinkingSummaryMetadata = {
  label: string;
  durationMs?: number | null;
  text: string;
  expandedByDefault?: boolean | null;
};

export type AgentMessageUiMetadata = {
  variant: AgentUiVariant;
};

export type ProjectMessageMetadata = Record<string, unknown> & {
  agentStep?: AgentStepMetadata;
  screenPlanProposal?: ScreenPlanProposalMetadata;
  screenStateProposal?: ScreenStateProposalMetadata;
  thinkingSummary?: ThinkingSummaryMetadata;
  ui?: AgentMessageUiMetadata;
};

export type ScreenStateProposalMetadata = {
  version: 1;
  prompt: string;
  parentScreenId: string;
  parentScreenName: string;
  parentRoadmapItemId: string;
  existingRoadmapItemId?: string | null;
  state: {
    stateKey: string;
    stateLabel: string;
    stateRole: string;
    triggerLabel: string;
    description: string;
    editInstruction: string;
  };
  expiresAt: string;
  status?: "pending" | "approved" | "expired" | "dismissed";
  approvedGenerationRunId?: string | null;
};

export type ScreenPlanProposalMetadata = {
  prompt: string;
  screenPlan: ScreenPlan;
  planningSeed: ScreenPlanningSeed;
  requiresBottomNav: boolean;
  navigationArchitecture: NavigationArchitecture;
  navigationPlan: NavigationPlan;
  expiresAt: string;
  imagePath?: string | null;
  imageReferenceMode?: ImageReferenceMode | null;
  referencePolicy?: GenerationReferencePolicy | null;
  baseState?: ScreenBaseStatePlan | null;
  stateVariants?: ScreenStateVariantPlan[];
  selectedStateVariantIds?: string[];
  status?: "pending" | "approved" | "expired";
  approvedGenerationRunId?: string | null;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asString = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

const asStatus = (value: unknown): AgentStepStatus | null => {
  if (value === "queued" || value === "thinking" || value === "editing" || value === "completed" || value === "failed") {
    return value;
  }

  return null;
};

const asKind = (value: unknown): AgentStepMetadata["kind"] | null => {
  if (value === "edit" || value === "generation" || value === "navigation" || value === "proposal" || value === "system") {
    return value;
  }

  return null;
};

const asVariant = (value: unknown): AgentUiVariant | null => {
  if (value === "chat" || value === "thinking" || value === "action_card" || value === "error") {
    return value;
  }

  return null;
};

const asNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : null;

const asBoolean = (value: unknown) => typeof value === "boolean" ? value : null;

const asImageReferenceMode = (value: unknown): ImageReferenceMode | null =>
  value === "style" || value === "recreate" ? value : null;
const asGenerationReferencePolicy = (value: unknown): GenerationReferencePolicy | null =>
  isGenerationReferencePolicy(value) ? value : null;
const asBaseState = (value: unknown): ScreenBaseStatePlan | null => {
  const record = asRecord(value);
  const stateKey = asString(record?.stateKey);
  const stateLabel = asString(record?.stateLabel);

  return stateKey && stateLabel ? { stateKey, stateLabel } : null;
};

const asStateVariant = (value: unknown): ScreenStateVariantPlan | null => {
  const record = asRecord(value);
  const id = asString(record?.id);
  const stateKey = asString(record?.stateKey);
  const stateLabel = asString(record?.stateLabel);
  const stateRole = asString(record?.stateRole);
  const triggerLabel = asString(record?.triggerLabel);
  const description = asString(record?.description);
  const editInstruction = asString(record?.editInstruction);

  if (!id || !stateKey || !stateLabel || !stateRole || !triggerLabel || !description || !editInstruction) {
    return null;
  }

  return {
    id,
    stateKey,
    stateLabel,
    stateRole,
    triggerLabel,
    description,
    editInstruction,
    defaultSelected: typeof record?.defaultSelected === "boolean" ? record.defaultSelected : false,
  };
};

const asStateVariants = (
  value: unknown,
  context: { prompt?: string | null; screenPlan?: ScreenPlan | null } = {},
): ScreenStateVariantPlan[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const variants: ScreenStateVariantPlan[] = [];

  for (const item of value) {
    const variant = asStateVariant(item);
    if (!variant || seen.has(variant.id) || !isMeaningfulStateVariantForContext(variant, context)) {
      continue;
    }

    seen.add(variant.id);
    variants.push(variant);
    if (variants.length >= 3) {
      break;
    }
  }

  return variants;
};

const isScreenPlan = (value: unknown): value is ScreenPlan => {
  const record = asRecord(value);
  const type = record?.type;
  return Boolean(
    record &&
    typeof record.name === "string" &&
    record.name.trim() &&
    (type === "root" || type === "detail") &&
    typeof record.description === "string" &&
    record.description.trim(),
  );
};

const asScreenPlanningSeed = (value: unknown, fallbackPlan: ScreenPlan, prompt: string): ScreenPlanningSeed => {
  const record = asRecord(value);
  const name = asString(record?.name) ?? fallbackPlan.name;
  const type = record?.type === "root" || record?.type === "detail" ? record.type : fallbackPlan.type;
  return {
    name,
    type,
    summary: asString(record?.summary) ?? fallbackPlan.description,
    prompt: asString(record?.prompt) ?? prompt,
    roadmapStableKey: asString(record?.roadmapStableKey) ?? fallbackPlan.roadmapStableKey ?? null,
  };
};

const isNavigationArchitecture = (value: unknown): value is NavigationArchitecture => {
  const record = asRecord(value);
  return Boolean(record && typeof record.kind === "string" && typeof record.primaryNavigation === "string");
};

const isNavigationPlan = (value: unknown): value is NavigationPlan => {
  const record = asRecord(value);
  return Boolean(record && typeof record.enabled === "boolean" && Array.isArray(record.items));
};

export function readAgentUi(metadata: Record<string, unknown>): AgentMessageUiMetadata | null {
  const ui = asRecord(metadata.ui);
  const variant = asVariant(ui?.variant);
  return variant ? { variant } : null;
}

export function readThinkingSummary(metadata: Record<string, unknown>): ThinkingSummaryMetadata | null {
  const summary = asRecord(metadata.thinkingSummary);
  const label = asString(summary?.label);
  const text = asString(summary?.text);

  if (!label || !text) {
    return null;
  }

  return {
    label,
    text,
    durationMs: asNumber(summary?.durationMs),
    expandedByDefault: typeof summary?.expandedByDefault === "boolean" ? summary.expandedByDefault : null,
  };
}

export function readAgentStep(metadata: Record<string, unknown>): AgentStepMetadata | null {
  const step = asRecord(metadata.agentStep);
  const kind = asKind(step?.kind);
  const status = asStatus(step?.status);
  const title = asString(step?.title);

  if (!kind || !status || !title) {
    return null;
  }

  return {
    kind,
    status,
    title,
    detail: asString(step?.detail),
    targetLabel: asString(step?.targetLabel),
    progress: asNumber(step?.progress),
    processLines: asStringArray(step?.processLines),
    resultPreview: asString(step?.resultPreview),
  };
}

export function readScreenPlanProposal(metadata: Record<string, unknown>): ScreenPlanProposalMetadata | null {
  const proposal = asRecord(metadata.screenPlanProposal);
  const prompt = asString(proposal?.prompt);
  const requiresBottomNav = asBoolean(proposal?.requiresBottomNav);
  const expiresAt = asString(proposal?.expiresAt);

  if (
    !proposal ||
    !prompt ||
    requiresBottomNav === null ||
    !isScreenPlan(proposal.screenPlan) ||
    !isNavigationArchitecture(proposal.navigationArchitecture) ||
    !isNavigationPlan(proposal.navigationPlan) ||
    !expiresAt
  ) {
    return null;
  }

  const proposalRecord = proposal as Record<string, unknown>;
  const status = proposalRecord.status === "approved" || proposalRecord.status === "expired" || proposalRecord.status === "pending"
    ? proposalRecord.status
    : "pending";

  return {
    prompt,
    screenPlan: proposal.screenPlan,
    planningSeed: asScreenPlanningSeed(proposal.planningSeed, proposal.screenPlan, prompt),
    requiresBottomNav,
    navigationArchitecture: proposal.navigationArchitecture,
    navigationPlan: proposal.navigationPlan,
    expiresAt,
    imagePath: asString(proposal.imagePath),
    imageReferenceMode: asImageReferenceMode(proposal.imageReferenceMode),
    referencePolicy: asGenerationReferencePolicy(proposal.referencePolicy),
    baseState: asBaseState(proposal.baseState),
    stateVariants: asStateVariants(proposal.stateVariants, { prompt, screenPlan: proposal.screenPlan }),
    selectedStateVariantIds: asStringArray(proposal.selectedStateVariantIds) ?? [],
    status,
    approvedGenerationRunId: asString(proposal.approvedGenerationRunId),
  };
}

export function readScreenStateProposal(metadata: Record<string, unknown>): ScreenStateProposalMetadata | null {
  const proposal = asRecord(metadata.screenStateProposal);
  const state = asRecord(proposal?.state);
  const version = proposal?.version;
  const prompt = asString(proposal?.prompt);
  const parentScreenId = asString(proposal?.parentScreenId);
  const parentScreenName = asString(proposal?.parentScreenName);
  const parentRoadmapItemId = asString(proposal?.parentRoadmapItemId);
  const stateKey = asString(state?.stateKey);
  const stateLabel = asString(state?.stateLabel);
  const stateRole = asString(state?.stateRole);
  const triggerLabel = asString(state?.triggerLabel);
  const description = asString(state?.description);
  const editInstruction = asString(state?.editInstruction);
  const expiresAt = asString(proposal?.expiresAt);

  if (
    version !== 1 || !prompt || !parentScreenId || !parentScreenName || !parentRoadmapItemId ||
    !stateKey || !stateLabel || !stateRole || !triggerLabel || !description || !editInstruction || !expiresAt
  ) {
    return null;
  }

  const proposalRecord = proposal as Record<string, unknown>;
  const status =
    proposalRecord.status === "approved" ||
    proposalRecord.status === "expired" ||
    proposalRecord.status === "pending" ||
    proposalRecord.status === "dismissed"
      ? proposalRecord.status
      : "pending";

  return {
    version: 1,
    prompt,
    parentScreenId,
    parentScreenName,
    parentRoadmapItemId,
    existingRoadmapItemId: asString(proposalRecord.existingRoadmapItemId),
    state: { stateKey, stateLabel, stateRole, triggerLabel, description, editInstruction },
    expiresAt,
    status,
    approvedGenerationRunId: asString(proposalRecord.approvedGenerationRunId),
  };
}

export function buildThinkingSummary(input: ThinkingSummaryMetadata): ThinkingSummaryMetadata {
  return {
    label: input.label,
    text: input.text,
    durationMs: input.durationMs ?? null,
    expandedByDefault: input.expandedByDefault ?? false,
  };
}
