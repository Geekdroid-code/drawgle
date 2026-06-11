import type { ImageReferenceMode, NavigationArchitecture, NavigationPlan, ScreenPlan } from "@/lib/types";

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
  thinkingSummary?: ThinkingSummaryMetadata;
  ui?: AgentMessageUiMetadata;
};

export type ScreenPlanProposalMetadata = {
  prompt: string;
  screenPlan: ScreenPlan;
  requiresBottomNav: boolean;
  navigationArchitecture: NavigationArchitecture;
  navigationPlan: NavigationPlan;
  expiresAt: string;
  imagePath?: string | null;
  imageReferenceMode?: ImageReferenceMode | null;
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

  const status = proposal.status === "approved" || proposal.status === "expired" || proposal.status === "pending"
    ? proposal.status
    : "pending";

  return {
    prompt,
    screenPlan: proposal.screenPlan,
    requiresBottomNav,
    navigationArchitecture: proposal.navigationArchitecture,
    navigationPlan: proposal.navigationPlan,
    expiresAt,
    imagePath: asString(proposal.imagePath),
    imageReferenceMode: asImageReferenceMode(proposal.imageReferenceMode),
    status,
    approvedGenerationRunId: asString(proposal.approvedGenerationRunId),
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
