"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Minimize2,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AgentBall, AgentThinkingIndicator } from "@/components/AgentBall";
import { DesignMdTab } from "@/components/DesignMdTab";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { AgentComposer } from "@/components/PromptBar";
import { Button } from "@/components/ui/button";
import { PremiumSegmentedTabs, PremiumTabPanel } from "@/components/ui/premium-segmented-tabs";
import { useProjectMessages } from "@/hooks/use-project-messages";
import { hasApprovedDesignTokens } from "@/lib/design-tokens";
import {
  readAgentStep,
  readAgentUi,
  readScreenPlanProposal,
  readThinkingSummary,
  type AgentStepMetadata,
  type ScreenPlanProposalMetadata,
  type ThinkingSummaryMetadata,
} from "@/lib/agent/message-metadata";
import type {
  GenerationRunData,
  GenerationJournalMetadata,
  DesignTokens,
  ImageReferenceMode,
  NavigationArchitecture,
  NavigationPlan,
  ProjectData,
  ProjectMessage,
  ProjectNavigationData,
  PromptImagePayload,
  ScreenData,
  ScreenPlan,
} from "@/lib/types";

export type ScreenPlanState =
  | {
    status: "planning";
    prompt: string;
    image: PromptImagePayload | null;
  }
  | {
    status: "ready";
    prompt: string;
    image: PromptImagePayload | null;
    screenPlan: ScreenPlan;
    requiresBottomNav: boolean;
    navigationArchitecture: NavigationArchitecture;
    navigationPlan: NavigationPlan;
  }
  | {
    status: "error";
    prompt: string;
    image: PromptImagePayload | null;
    error: string;
  };

type PendingTurn = {
  id: string;
  prompt: string;
  image: PromptImagePayload | null;
  startedAt: number;
};

type ConversationItem =
  | { id: string; kind: "user"; content: string; image?: PromptImagePayload | null; timestamp?: string }
  | { id: string; kind: "assistant"; content: string; timestamp?: string; isError?: boolean }
  | { id: string; kind: "thinking"; summary: ThinkingSummaryMetadata; timestamp?: string; live?: boolean }
  | { id: string; kind: "generation_journal"; journal: GenerationJournalMetadata; timestamp?: string }
  | { id: string; kind: "action"; step: AgentStepMetadata; sourceContent?: string; retryRun?: GenerationRunData; proposal?: ScreenPlanProposalMetadata | null; proposalMessageId?: string | null; timestamp?: string };

type ChatWorkspaceTab = "chat" | "design" | "design-md";

const CHAT_WORKSPACE_TABS: Array<{ id: ChatWorkspaceTab; label: string; icon: typeof MessageCircle }> = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "design", label: "Design", icon: Palette },
  { id: "design-md", label: "Design.md", icon: FileText },
];

const isActiveGenerationRun = (run: GenerationRunData | null) =>
  Boolean(run && (run.status === "queued" || run.status === "planning" || run.status === "building"));

const metadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const getMetadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getMetadataNumber = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const getScreenName = (message: ProjectMessage, screens: ScreenData[]) => {
  const metadataName = getMetadataString(message.metadata, "screenName");
  if (metadataName) return metadataName;

  if (!message.screenId) return null;
  return screens.find((screen) => screen.id === message.screenId)?.name ?? null;
};

const getMessageGenerationRunId = (message: ProjectMessage) =>
  getMetadataString(message.metadata, "generationRunId");

const getMessageActivityKey = (message: ProjectMessage) =>
  getMetadataString(message.metadata, "activityKey");

const getMessageClientTurnId = (message: ProjectMessage) =>
  getMetadataString(message.metadata, "clientTurnId");

const compactActionTitle = (content: string) =>
  content.replace(/\s+/g, " ").replace(/\.\.\.$/, "").trim() || "Working";

const isTerminalGenerationRun = (run?: GenerationRunData | null) =>
  Boolean(run && (run.status === "completed" || run.status === "failed" || run.status === "canceled"));

const isInternalGenerationActivity = (activityKey: string | null) =>
  Boolean(
    activityKey &&
    (
      /^run:[^:]+:(planning|design|assets)$/.test(activityKey) ||
      /^screen:[^:]+:build$/.test(activityKey)
    ),
  );

const JOURNAL_PHASE_STATUSES = new Set(["pending", "active", "completed", "failed"]);
const JOURNAL_STATUSES = new Set(["queued", "planning", "building", "completed", "failed"]);
const JOURNAL_SCREEN_STATUSES = new Set(["planned", "queued", "building", "ready", "failed"]);

const readGenerationJournal = (metadata: Record<string, unknown>): GenerationJournalMetadata | null => {
  const journal = metadataRecord(metadata.generationJournal);
  if (journal.version !== 1) return null;
  if (typeof journal.generationRunId !== "string" || !journal.generationRunId) return null;
  if (typeof journal.title !== "string" || !journal.title.trim()) return null;
  if (typeof journal.status !== "string" || !JOURNAL_STATUSES.has(journal.status)) return null;
  if (!Array.isArray(journal.phases)) return null;

  const phases = journal.phases.flatMap((phaseValue) => {
    const phase = metadataRecord(phaseValue);
    const id = typeof phase.id === "string" ? phase.id : null;
    const label = typeof phase.label === "string" ? phase.label : null;
    const status = typeof phase.status === "string" && JOURNAL_PHASE_STATUSES.has(phase.status) ? phase.status : null;
    if (!id || !label || !status) return [];
    return [{
      id,
      label,
      status: status as GenerationJournalMetadata["phases"][number]["status"],
      detail: typeof phase.detail === "string" ? phase.detail : null,
    }];
  });
  if (!phases.length) return null;

  const screens: GenerationJournalMetadata["screens"] = Array.isArray(journal.screens)
    ? journal.screens.flatMap((screenValue) => {
      const screen = metadataRecord(screenValue);
      const name = typeof screen.name === "string" ? screen.name : null;
      if (!name) return [];
      const type: NonNullable<GenerationJournalMetadata["screens"]>[number]["type"] =
        screen.type === "root" || screen.type === "detail" ? screen.type : null;
      const chrome: NonNullable<GenerationJournalMetadata["screens"]>[number]["chrome"] =
        typeof screen.chrome === "string" ? screen.chrome as NonNullable<GenerationJournalMetadata["screens"]>[number]["chrome"] : null;
      const status = typeof screen.status === "string" && JOURNAL_SCREEN_STATUSES.has(screen.status)
        ? screen.status as NonNullable<GenerationJournalMetadata["screens"]>[number]["status"]
        : "planned";
      return [{
        name,
        type,
        description: typeof screen.description === "string" ? screen.description : null,
        chrome,
        navigationItemId: typeof screen.navigationItemId === "string" ? screen.navigationItemId : null,
        assetNeedCount: typeof screen.assetNeedCount === "number" && Number.isFinite(screen.assetNeedCount) ? screen.assetNeedCount : 0,
        status,
      }];
    })
    : [];

  const assetSummaryRecord = metadataRecord(journal.assetSummary);
  const assetSummary = typeof assetSummaryRecord.requested === "number"
    ? {
      requested: assetSummaryRecord.requested,
      resolved: typeof assetSummaryRecord.resolved === "number" ? assetSummaryRecord.resolved : 0,
      placeholders: typeof assetSummaryRecord.placeholders === "number" ? assetSummaryRecord.placeholders : 0,
    }
    : null;

  return {
    version: 1,
    generationRunId: journal.generationRunId,
    status: journal.status as GenerationJournalMetadata["status"],
    title: journal.title,
    detail: typeof journal.detail === "string" ? journal.detail : null,
    activePhase: typeof journal.activePhase === "string" ? journal.activePhase : null,
    phases,
    screens,
    assetSummary,
  };
};

const isUsefulThinkingSummary = (summary: ThinkingSummaryMetadata) => {
  const text = summary.text.trim();
  return Boolean(text && !/^Reading the canvas context, selected target, recent conversation, and active jobs before deciding the next action\.$/i.test(text));
};

const isProposalPending = (proposal?: ScreenPlanProposalMetadata | null) =>
  Boolean(proposal && proposal.status === "pending" && new Date(proposal.expiresAt).getTime() >= Date.now());

const isTerminalStep = (step?: AgentStepMetadata | null) =>
  step?.status === "completed" || step?.status === "failed";

const resolveAgentStep = (
  explicitStep: AgentStepMetadata | null,
  legacyStep: AgentStepMetadata | null,
) => {
  if (isTerminalStep(legacyStep) && explicitStep && !isTerminalStep(explicitStep)) {
    return legacyStep;
  }

  return explicitStep ?? legacyStep;
};

const reconcileStaleEditStep = ({
  step,
  message,
  screens,
}: {
  step: AgentStepMetadata;
  message: ProjectMessage;
  screens: ScreenData[];
}): AgentStepMetadata => {
  if (step.kind !== "edit" && step.kind !== "navigation") {
    return step;
  }

  if (step.status !== "queued" && step.status !== "editing" && step.status !== "thinking") {
    return step;
  }

  const editJob = metadataRecord(message.metadata.editJob);
  const editScreenId = getMetadataString(editJob, "screenId") ?? message.screenId;
  const screen = editScreenId ? screens.find((candidate) => candidate.id === editScreenId) : null;

  if (!screen?.updatedAt) {
    return step;
  }

  const screenUpdatedAt = new Date(screen.updatedAt).getTime();
  const messageCreatedAt = new Date(message.timestamp).getTime();

  if (!Number.isFinite(screenUpdatedAt) || !Number.isFinite(messageCreatedAt) || screenUpdatedAt <= messageCreatedAt) {
    return step;
  }

  return {
    ...step,
    status: "completed",
    detail: step.detail || `Saved the updated ${screen.name} screen.`,
    processLines: [
      ...(step.processLines ?? []),
      "Detected the saved screen update and marked this edit complete.",
    ],
  };
};

const stepFromLegacyMessage = (message: ProjectMessage, screens: ScreenData[]): AgentStepMetadata | null => {
  const action = getMetadataString(message.metadata, "action");
  const editJob = metadataRecord(message.metadata.editJob);
  const editStatus = getMetadataString(editJob, "status");
  const screenName = getScreenName(message, screens);
  const targetLabel = getMetadataString(message.metadata, "screenName") ?? screenName;

  if (editStatus || action?.includes("edit") || message.messageType === "edit_applied") {
    const failed = message.messageType === "error" || editStatus === "failed";
    const completed = message.messageType === "edit_applied" || editStatus === "completed";
    const queued = editStatus === "queued" || action?.endsWith("_queued");
    const editing = editStatus === "editing" || action?.endsWith("_start");

    return {
      kind: targetLabel === "Navigation" ? "navigation" : "edit",
      status: failed ? "failed" : completed ? "completed" : queued ? "queued" : editing ? "editing" : "editing",
      title: compactActionTitle(message.content),
      detail: completed || failed ? message.content : targetLabel ? `Targeting ${targetLabel}.` : null,
      targetLabel,
      processLines: [
        queued ? "Placed the edit in the workspace queue." : null,
        editing ? "Applying the requested UI change." : null,
        completed ? "Saved the updated canvas state." : null,
        failed ? "Stopped before saving an unsafe result." : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  if (message.messageType === "generation_started" || message.messageType === "generation_completed" || message.messageType === "screen_created") {
    const successfulScreens = getMetadataNumber(message.metadata, "successfulScreens");
    return {
      kind: "generation",
      status: message.messageType === "generation_completed" || message.messageType === "screen_created" ? "completed" : "editing",
      title: compactActionTitle(message.content),
      detail: successfulScreens !== null ? `Delivered ${successfulScreens} screen${successfulScreens === 1 ? "" : "s"}.` : null,
      targetLabel: screenName,
      processLines: [message.content],
    };
  }

  if (message.messageType === "error") {
    return {
      kind: "system",
      status: "failed",
      title: "Needs review",
      detail: message.content,
      targetLabel,
      processLines: [message.content],
    };
  }

  return null;
};

const getRunStats = (run: GenerationRunData, screens: ScreenData[]) => {
  const runScreens = screens.filter((screen) => screen.generationRunId === run.id);
  return {
    totalScreens: run.requestedScreenCount ?? runScreens.length,
    readyScreens: runScreens.filter((screen) => screen.status === "ready").length,
    failedScreens: runScreens.filter((screen) => screen.status === "failed").length,
    firstBuildingScreen: runScreens.find((screen) => screen.status === "building") ?? null,
  };
};

const liveGenerationStep = (generationRun: GenerationRunData, screens: ScreenData[]): AgentStepMetadata => {
  const stats = getRunStats(generationRun, screens);
  const target = stats.firstBuildingScreen?.name ?? null;
  const status = generationRun.status === "queued" ? "queued" : "editing";

  return {
    kind: "generation",
    status,
    title: target ? `Building ${target}` : generationRun.status === "planning" ? "Planning screens" : "Building screens",
    detail: stats.totalScreens > 0 ? `${stats.readyScreens}/${stats.totalScreens} ready${stats.failedScreens > 0 ? `, ${stats.failedScreens} failed` : ""}` : generationRun.error ?? null,
    targetLabel: target,
    processLines: [
      generationRun.status === "queued" ? "Queued the screen generation." : null,
      generationRun.status === "planning" ? "Translating your prompt into screen structure." : null,
      generationRun.status === "building" ? "Rendering the mobile UI on the canvas." : null,
    ].filter((line): line is string => Boolean(line)),
  };
};

function buildConversationItems({
  messages,
  screens,
  generationRun,
  generationRuns,
  queueError,
  screenPlan,
  pendingTurn,
}: {
  messages: ProjectMessage[];
  screens: ScreenData[];
  generationRun: GenerationRunData | null;
  generationRuns: GenerationRunData[];
  queueError?: string | null;
  screenPlan?: ScreenPlanState | null;
  pendingTurn: PendingTurn | null;
}): ConversationItem[] {
  const items: ConversationItem[] = [];
  const generationRunById = new Map(generationRuns.map((run) => [run.id, run]));
  if (generationRun) {
    generationRunById.set(generationRun.id, generationRun);
  }
  const summarizedRunIds = new Set(
    messages
      .filter((message) => {
        const activityKey = getMessageActivityKey(message);
        return Boolean(
          activityKey?.match(/^run:[^:]+:summary$/) ||
          getMetadataNumber(message.metadata, "successfulScreens") !== null ||
          getMetadataNumber(message.metadata, "failedScreens") !== null,
        );
      })
      .map(getMessageGenerationRunId)
      .filter((runId): runId is string => Boolean(runId)),
  );
  const journalRunIds = new Set(
    messages
      .map((message) => readGenerationJournal(message.metadata)?.generationRunId)
      .filter((runId): runId is string => Boolean(runId)),
  );
  const pendingTurnMessages = pendingTurn
    ? messages.filter((message) => getMessageClientTurnId(message) === pendingTurn.id)
    : [];
  const persistedPendingUser = pendingTurnMessages.find((message) => message.role === "user") ?? null;
  const hasPersistedPending = Boolean(persistedPendingUser);
  const hasPersistedPendingProgress = pendingTurnMessages.some((message) =>
    getMetadataString(message.metadata, "action") === "agent_turn_progress",
  );
  const hasPersistedPendingResponse = pendingTurnMessages.some((message) =>
    message.role !== "user" && getMetadataString(message.metadata, "action") !== "agent_turn_progress",
  );
  const terminalEditActivityKeys = new Set<string>();
  const terminalEditMessageIds = new Set<string>();

  for (const message of messages) {
    const action = getMetadataString(message.metadata, "action");
    if (action === "agent_turn_progress") {
      continue;
    }

    const activityKey = getMessageActivityKey(message);
    if (!activityKey?.startsWith("edit:")) {
      continue;
    }

    const agentStep = resolveAgentStep(readAgentStep(message.metadata), stepFromLegacyMessage(message, screens));
    if (!isTerminalStep(agentStep)) {
      continue;
    }

    terminalEditActivityKeys.add(activityKey);
    terminalEditMessageIds.add(message.id);
  }

  const actionByTurnId = new Map<string, typeof items[number] & { kind: "action" }>();
  let latestUserMessageId = "";

  for (const message of messages) {
    const action = getMetadataString(message.metadata, "action");
    const cleanContent = message.content.trim().toLowerCase();
    if (
      action === "pre_action_response" ||
      cleanContent.includes("applying a precise edit") ||
      cleanContent.includes("shaping that into a screen plan") ||
      cleanContent.includes("shaping this into a screen plan")
    ) {
      continue;
    }

    const ui = readAgentUi(message.metadata);
    const thinkingSummary = readThinkingSummary(message.metadata);
    const screenPlanProposal = readScreenPlanProposal(message.metadata);
    const agentStep = resolveAgentStep(readAgentStep(message.metadata), stepFromLegacyMessage(message, screens));
    const generationJournal = readGenerationJournal(message.metadata);
    const uiVariant = getMetadataString(metadataRecord(message.metadata.ui), "variant");
    const activityKey = getMessageActivityKey(message);
    const generationRunId = getMessageGenerationRunId(message);
    const run = generationRunId ? generationRunById.get(generationRunId) : null;

    if (message.role === "user") {
      latestUserMessageId = message.id;
      const persistedImage = message.metadata.image as PromptImagePayload | null;
      items.push({
        id: `user-${message.id}`,
        kind: "user",
        content: message.content,
        timestamp: message.timestamp,
        image: persistedImage ?? null,
      });
      continue;
    }

    if (generationJournal || uiVariant === "generation_journal") {
      if (generationJournal) {
        items.push({
          id: `generation-journal-${message.id}`,
          kind: "generation_journal",
          journal: generationJournal,
          timestamp: message.timestamp,
        });
      }
      continue;
    }

    if (thinkingSummary || ui?.variant === "thinking") {
      const summary = thinkingSummary ?? {
        label: "Analyzed your request",
        text: message.content,
        durationMs: null,
        expandedByDefault: false,
      };

      if (!isUsefulThinkingSummary(summary)) {
        continue;
      }

      items.push({
        id: `thinking-${message.id}`,
        kind: "thinking",
        summary,
        timestamp: message.timestamp,
      });
      continue;
    }

    if (agentStep || ui?.variant === "action_card") {
      if (isInternalGenerationActivity(activityKey)) {
        continue;
      }

      if (
        generationRunId &&
        journalRunIds.has(generationRunId) &&
        activityKey === `run:${generationRunId}:summary`
      ) {
        continue;
      }

      if (getMetadataString(message.metadata, "action") === "agent_turn_progress") {
        const queuedMessageId = getMetadataString(message.metadata, "queuedMessageId");
        if (
          (activityKey && terminalEditActivityKeys.has(activityKey)) ||
          (queuedMessageId && terminalEditMessageIds.has(queuedMessageId))
        ) {
          continue;
        }
      }

      if (
        message.metadata.action === "generation_queued" &&
        generationRunId &&
        summarizedRunIds.has(generationRunId) &&
        isTerminalGenerationRun(run)
      ) {
        continue;
      }

      const step = agentStep ?? {
        kind: "system" as const,
        status: message.messageType === "error" ? "failed" as const : "editing" as const,
        title: compactActionTitle(message.content),
        detail: message.content,
      };
      const generationNormalizedStep = step.kind === "generation" &&
        generationRunId &&
        isTerminalGenerationRun(run) &&
        (step.status === "queued" || step.status === "editing" || step.status === "thinking")
        ? {
          ...step,
          status: run?.status === "failed" || run?.status === "canceled" ? "failed" as const : "completed" as const,
          detail: run?.error ?? step.detail,
        }
        : step;
      const normalizedStep = reconcileStaleEditStep({
        step: generationNormalizedStep,
        message,
        screens,
      });
      if (
        getMetadataString(message.metadata, "action") === "agent_turn_progress" &&
        normalizedStep.status === "completed"
      ) {
        continue;
      }

      const turnId = getMetadataString(message.metadata, "userMessageId") || getMetadataString(message.metadata, "clientTurnId") || latestUserMessageId;
      if (turnId) {
        const existing = actionByTurnId.get(turnId);
        if (existing) {
          const currentStep = existing.step;
          const nextStep = normalizedStep;

          const statusPrecedence = { queued: 1, thinking: 2, editing: 3, completed: 4, failed: 4 };
          const currentPrec = statusPrecedence[currentStep.status] || 0;
          const nextPrec = statusPrecedence[nextStep.status] || 0;

          const isNextGeneric = nextStep.title.toLowerCase().startsWith("done - ") || nextStep.title.toLowerCase().includes("what do you think");
          const isCurrentGeneric = currentStep.title.toLowerCase().startsWith("done - ") || currentStep.title.toLowerCase().includes("what do you think");

          let mergedStatus = currentStep.status;
          let mergedTitle = currentStep.title;
          let mergedDetail = currentStep.detail || nextStep.detail;

          if (nextPrec >= currentPrec) {
            mergedStatus = nextStep.status;
            if (!isNextGeneric || isCurrentGeneric) {
              mergedTitle = nextStep.title;
              mergedDetail = nextStep.detail || mergedDetail;
            }
          }

          const mergedStyleDiff = (nextStep as any).styleDiff || (currentStep as any).styleDiff || null;

          const mergedProcessLines = Array.from(new Set([
            ...(currentStep.processLines || []),
            ...(nextStep.processLines || [])
          ]));

          existing.step = {
            ...currentStep,
            status: mergedStatus,
            title: mergedTitle,
            detail: mergedDetail,
            processLines: mergedProcessLines,
            targetLabel: nextStep.targetLabel || currentStep.targetLabel || null,
            styleDiff: mergedStyleDiff,
          } as any;

          if (screenPlanProposal) {
            existing.proposal = screenPlanProposal;
            existing.proposalMessageId = message.id;
          }
          continue;
        }
      }

      const latestRetryRun = [...generationRuns]
        .filter((run) => run.status === "failed" || run.status === "canceled")
        .sort((left, right) => new Date(right.completedAt ?? right.updatedAt).getTime() - new Date(left.completedAt ?? left.updatedAt).getTime())[0] ?? null;

      const newActionItem: typeof items[number] & { kind: "action" } = {
        id: `action-${message.id}`,
        kind: "action",
        step: normalizedStep,
        sourceContent: message.content,
        retryRun: latestRetryRun ?? undefined,
        proposal: screenPlanProposal,
        proposalMessageId: screenPlanProposal ? message.id : null,
        timestamp: message.timestamp,
      };

      if (turnId) {
        actionByTurnId.set(turnId, newActionItem);
      }
      items.push(newActionItem);
      continue;
    }

    if (message.content.trim()) {
      items.push({
        id: `assistant-${message.id}`,
        kind: "assistant",
        content: message.content,
        timestamp: message.timestamp,
        isError: message.messageType === "error" || ui?.variant === "error",
      });
    }
  }

  if (pendingTurn && !hasPersistedPending) {
    items.push({
      id: `pending-user-${pendingTurn.id}`,
      kind: "user",
      content: pendingTurn.prompt || "[image]",
      image: pendingTurn.image,
    });
  }

  if (queueError) {
    items.push({
      id: "live-queue-error",
      kind: "action",
      step: {
        kind: "system",
        status: "failed",
        title: "Needs review",
        detail: queueError,
        processLines: [queueError],
      },
    });
  }

  if (screenPlan?.status === "planning") {
    items.push({
      id: "live-screen-planning",
      kind: "action",
      step: {
        kind: "generation",
        status: "editing",
        title: "Planning the next screen",
        detail: screenPlan.prompt,
        processLines: ["Creating a focused screen plan from your request."],
      },
    });
  } else if (screenPlan?.status === "ready") {
    items.push({
      id: `proposal-${screenPlan.screenPlan.name}`,
      kind: "action",
      step: {
        kind: "proposal",
        status: "completed",
        title: screenPlan.screenPlan.name,
        detail: screenPlan.screenPlan.description,
        targetLabel: screenPlan.screenPlan.type,
        processLines: ["Prepared a buildable screen proposal."],
      },
    });
  } else if (screenPlan?.status === "error") {
    items.push({
      id: "live-screen-plan-error",
      kind: "action",
      step: {
        kind: "system",
        status: "failed",
        title: "Screen plan needs attention",
        detail: screenPlan.error,
        processLines: [screenPlan.error],
      },
    });
  }

  if (generationRun && isActiveGenerationRun(generationRun)) {
    items.push({
      id: `live-generation-${generationRun.id}-${generationRun.status}`,
      kind: "action",
      step: liveGenerationStep(generationRun, screens),
    });
  }

  const latestRetryRun = [...generationRuns]
    .filter((run) => run.status === "failed" || run.status === "canceled")
    .sort((left, right) => new Date(right.completedAt ?? right.updatedAt).getTime() - new Date(left.completedAt ?? left.updatedAt).getTime())[0] ?? null;

  if (!generationRun && latestRetryRun) {
    const alreadyShown = items.some((item) =>
      item.kind === "action" && item.step.detail === latestRetryRun.error
    );
    if (!alreadyShown && latestRetryRun.error) {
      items.push({
        id: `retry-${latestRetryRun.id}`,
        kind: "action",
        retryRun: latestRetryRun,
        step: {
          kind: "generation",
          status: "failed",
          title: "Generation ended",
          detail: latestRetryRun.error,
          processLines: [latestRetryRun.error],
        },
      });
    }
  }

  return items;
}

function statusCopy(status: AgentStepMetadata["status"]) {
  if (status === "queued") return "Queued";
  if (status === "thinking") return "Thinking";
  if (status === "editing") return "In progress";
  if (status === "completed") return "Done";
  return "Needs review";
}

function AgentMark({ busy, failed }: { busy?: boolean; failed?: boolean }) {
  if (failed) {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-600" />;
  }

  if (busy) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-700" />;
  }

  return <Check className="h-3.5 w-3.5 text-slate-700" />;
}

function ThinkingRow({ summary, id, live = false }: { summary: ThinkingSummaryMetadata; id: string; live?: boolean }) {
  const [expanded, setExpanded] = useState(Boolean(summary.expandedByDefault));
  const isLive = summary.label.toLowerCase().includes("analyzing");
  const seconds = summary.durationMs && summary.durationMs > 0
    ? `${Math.max(1, Math.round(summary.durationMs / 1000))}s`
    : null;

  if (live) {
    return (
      <div className="px-5 py-2">
        <div className="flex items-center gap-2">
          <AgentThinkingIndicator
            label={`${summary.label}...`}
            className="text-black/40"
            hideBall={true}
          />
          {seconds ? (
            <span className="text-[11px] font-normal italic text-black/30">{seconds}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-2">
      <button
        type="button"
        className="group flex items-center gap-1.5 text-left text-[12px] font-medium text-black/40 transition hover:text-black/60"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`${id}-thinking`}
      >
        <Sparkles className="h-3 w-3 opacity-70" />
        <span>{summary.label}</span>
        {seconds ? <span className="font-normal italic opacity-60">{seconds}</span> : null}
        <ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div
        id={`${id}-thinking`}
        className={`${expanded ? "mt-2 max-h-[112px] overflow-y-auto" : "mt-1 line-clamp-2"} border-l border-black/10 pl-3 text-[12px] italic leading-5 text-black/50`}
      >
        {summary.text}
      </div>
      {isLive ? (
        <AgentThinkingIndicator label="Thinking..." className="mt-2 pl-3 text-slate-500" hideBall={true} />
      ) : null}
    </div>
  );
}

function AssistantMessage({ content, isError }: { content: string; isError?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(content).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="group px-5 py-2 text-start">
      <div className={`text-[13px] leading-6 ${isError ? "text-rose-700" : "text-slate-700"}`}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="flex justify-start pt-3 opacity-0 transition group-hover:opacity-100">
        <div className="flex items-center gap-3 text-slate-400">
          <button type="button" title="Copy message" onClick={handleCopy} className="hover:text-slate-700">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

        </div>
      </div>
    </div>
  );
}

function UserBubble({ content, image }: { content: string; image?: PromptImagePayload | null }) {
  return (
    <div className="flex justify-end px-3 py-3">
      <div className="max-w-[78%] rounded-[18px] bg-[#f0f0f1] px-4 py-3 text-[15px] leading-6 text-slate-950">
        {image ? (
          <div className="relative mb-2 h-10 w-10 overflow-hidden rounded-[8px] border border-black/10 bg-white">
            <Image
              src={`data:${image.mimeType};base64,${image.data}`}
              alt="Prompt reference"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </div>
  );
}

function ActionCard({
  step,
  retryRun,
  retryDisabled,
  proposal,
  proposalMessageId,
  onRetryGeneration,
  onApproveScreenPlan,
}: {
  step: AgentStepMetadata;
  retryRun?: GenerationRunData;
  retryDisabled?: boolean;
  proposal?: ScreenPlanProposalMetadata | null;
  proposalMessageId?: string | null;
  onRetryGeneration?: (run: GenerationRunData) => void;
  onApproveScreenPlan?: (proposalMessageId: string) => void;
}) {
  const busy = step.status === "queued" || step.status === "thinking" || step.status === "editing";
  const failed = step.status === "failed";
  const pendingProposal = isProposalPending(proposal);
  const styleDiff = (step as any).styleDiff as string | undefined;

  const rawProcessLines = step.processLines?.length ? step.processLines : step.detail ? [step.detail] : [];
  const processLines = rawProcessLines.filter((line) => {
    const cleanLine = line.trim().toLowerCase();
    return (
      cleanLine !== step.title.trim().toLowerCase() &&
      cleanLine !== statusCopy(step.status).toLowerCase()
    );
  });

  const hasDistinctDetail = Boolean(
    step.detail &&
    step.detail.trim().toLowerCase() !== step.title.trim().toLowerCase() &&
    step.detail.trim().toLowerCase() !== statusCopy(step.status).toLowerCase()
  );

  const fallbackDetail = !hasDistinctDetail && busy
    ? (step.targetLabel ? `Working on ${step.targetLabel}.` : statusCopy(step.status))
    : null;

  return (
    <div className="px-5 py-3 w-full min-w-0 overflow-hidden">
      <div className="flex flex-col font-ui leading-normal min-w-0 w-full">
        {/* Header timeline node */}
        <div className="flex flex-row items-center transition-colors rounded-lg duration-150 min-w-0 w-full">
          <div className="w-[20px] flex justify-center shrink-0">
            <div className="pt-0.5">
              {failed ? (
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              ) : busy ? (
                <AgentBall className="h-4 w-4 shrink-0" active />
              ) : (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 pl-2.5">
            <div className="flex items-center gap-2 py-0.5 text-sm text-left text-slate-800 font-semibold w-full min-w-0">
              <span className="min-w-0 flex-1 break-words whitespace-normal leading-tight">{step.title}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded shrink-0">
                {statusCopy(step.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed timeline path */}
        <div className="flex flex-row min-w-0 w-full">
          <div className="w-[20px] flex justify-center shrink-0">
            <div className={`w-[1px] h-full duration-150 bg-slate-200 ${(busy && processLines.length > 0) || styleDiff || hasDistinctDetail || fallbackDetail ? "min-h-[20px]" : "min-h-[8px]"}`} />
          </div>
          <div className="flex-1 min-w-0 pl-2.5">
            {hasDistinctDetail ? (
              <div className="text-[12px] text-slate-500 leading-relaxed pt-1 pr-4 break-words whitespace-normal font-medium">
                {step.detail}
              </div>
            ) : fallbackDetail ? (
              <div className="text-[12px] text-slate-500 leading-relaxed pt-1 pr-4 break-words whitespace-normal">
                {fallbackDetail}
              </div>
            ) : null}

            {/* Style Diff Block */}
            {styleDiff ? (
              <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-900 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-slate-300 shadow-sm overflow-hidden select-text">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-2">Style Adjustments</div>
                <div className="space-y-1">
                  {styleDiff.split('\n').map((line, idx) => {
                    if (line.startsWith('+')) {
                      return (
                        <div key={idx} className="text-emerald-400 font-medium flex items-start gap-1">
                          <span className="shrink-0 select-none text-emerald-600 font-bold">+</span>
                          <span>{line.substring(1).trim()}</span>
                        </div>
                      );
                    } else if (line.startsWith('-')) {
                      return (
                        <div key={idx} className="text-rose-400 line-through flex items-start gap-1">
                          <span className="shrink-0 select-none text-rose-600 font-bold">-</span>
                          <span>{line.substring(1).trim()}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="text-slate-400 flex items-start gap-1">
                        <span>{line}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Execution / Technical Logs */}
            {busy && processLines.length > 0 ? (
              <div className="mt-3 space-y-2.5 pl-1.5 min-w-0 w-full animate-pulse">
                {processLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600 min-w-0 w-full">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 animate-ping" />
                    <span className="min-w-0 flex-1 break-words whitespace-normal">{line}</span>
                  </div>
                ))}
              </div>
            ) : !busy && processLines.length > 0 ? (
              <details className="mt-3 group/details">
                <summary className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer select-none outline-none">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open/details:rotate-180 text-slate-400 group-hover/details:text-slate-600" />
                  <span>Show execution steps</span>
                </summary>
                <div className="mt-2 space-y-2 pl-1.5 min-w-0 w-full">
                  {processLines.map((line, index) => (
                    <div key={`${line}-${index}`} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 min-w-0 w-full">
                      <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      <span className="min-w-0 flex-1 break-words whitespace-normal">{line}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {pendingProposal && proposalMessageId && onApproveScreenPlan ? (
              <Button
                type="button"
                className="mt-3 h-8 rounded-full px-3 text-[11px] font-semibold"
                onClick={() => onApproveScreenPlan(proposalMessageId)}
                disabled={retryDisabled}
              >
                Build screen
              </Button>
            ) : null}

            {proposal?.status === "approved" ? (
              <div className="mt-3 text-[11px] font-semibold text-emerald-600">Approved for build</div>
            ) : null}

            {retryRun && onRetryGeneration ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-7 rounded-full bg-white px-2.5 text-[10px]"
                disabled={retryDisabled}
                onClick={() => onRetryGeneration(retryRun)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const journalScreenStatusCopy = (status?: NonNullable<GenerationJournalMetadata["screens"]>[number]["status"]) => {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "building") return "Building";
  if (status === "queued") return "Queued";
  return "Planned";
};

const compactJournalDescription = (description?: string | null) => {
  const clean = description?.replace(/\s+/g, " ").trim() ?? "";
  if (!clean) return "Builder-ready screen brief prepared.";
  return clean.length > 150 ? `${clean.slice(0, 147).trim()}...` : clean;
};

function JournalPhaseMark({ status }: { status: GenerationJournalMetadata["phases"][number]["status"] }) {
  if (status === "failed") {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-600" />;
  }

  if (status === "active") {
    return (
      <div className="flex h-3.5 w-3.5 items-center justify-center">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
      </div>
    );
  }

  if (status === "completed") {
    return <Check className="h-3.5 w-3.5 text-slate-700" />;
  }

  return <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />;
}

function GenerationJournalCard({ journal }: { journal: GenerationJournalMetadata }) {
  const [expanded, setExpanded] = useState(journal.status !== "completed");
  const [expandedScreens, setExpandedScreens] = useState<Record<number, boolean>>({});
  const busy = journal.status === "queued" || journal.status === "planning" || journal.status === "building";
  const failed = journal.status === "failed";
  const activePhase = journal.phases.find((phase) => phase.status === "active") ?? null;
  const detail = activePhase?.detail ?? journal.detail ?? (busy ? "Working through the plan and build steps." : null);

  return (
    <div className="px-3 py-2">
      <div className="overflow-hidden rounded-[18px] border border-slate-950/[0.1] bg-[#f6f6f7] text-slate-800">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AgentBall className="h-4 w-4" active={busy} />
                <h3 className="truncate text-[13px] font-semibold text-slate-950">{journal.title}</h3>
              </div>
              {detail ? (
                <div className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-600">{detail}</div>
              ) : null}
            </div>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <AgentMark busy={busy} failed={failed} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {journal.phases.map((phase) => (
              <div
                key={phase.id}
                title={`${phase.label}${phase.detail ? ` - ${phase.detail}` : ""}`}
                className={`h-1.5 rounded-full ${phase.status === "failed"
                  ? "bg-rose-500"
                  : phase.status === "completed"
                    ? "bg-slate-950"
                    : phase.status === "active"
                      ? "bg-slate-500"
                      : "bg-slate-950/[0.1]"
                  }`}
              />
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-left text-[12px] font-medium underline text-slate-600 hover:text-slate-950"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide plan" : "Show plan"}
          </button>
        </div>

        {expanded ? (
          <div className="border-t border-slate-950/[0.08] bg-white/60 px-4 py-3">
            <div className="space-y-2">
              {journal.phases.map((phase) => (
                <div key={phase.id} className="flex items-start gap-2 text-[12px] leading-5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    <JournalPhaseMark status={phase.status} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">{phase.label}</div>
                    {phase.detail ? <div className="text-slate-500">{phase.detail}</div> : null}
                  </div>
                </div>
              ))}
            </div>

            {journal.screens?.length ? (
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Screen Briefs</div>
                {journal.screens.map((screen, index) => {
                  const isScreenExpanded = Boolean(expandedScreens[index]);
                  return (
                    <div
                      key={`${screen.name}-${index}`}
                      onClick={() => setExpandedScreens(prev => ({ ...prev, [index]: !prev[index] }))}
                      className="rounded-[12px] border border-slate-950/[0.08] bg-white px-3 py-2 cursor-pointer transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-slate-950">{screen.name}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {[screen.type, screen.chrome ? `${screen.chrome} chrome` : null, screen.assetNeedCount ? `${screen.assetNeedCount} asset need${screen.assetNeedCount === 1 ? "" : "s"}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${screen.status === "failed"
                          ? "bg-rose-50 text-rose-700"
                          : screen.status === "ready"
                            ? "bg-emerald-50 text-emerald-700"
                            : screen.status === "building"
                              ? "bg-slate-950 text-white"
                              : "bg-slate-950/[0.06] text-slate-600"
                          }`}>
                          {journalScreenStatusCopy(screen.status)}
                        </span>
                      </div>
                      <div className={`mt-2 text-[11px] leading-5 text-slate-600 transition-all ${isScreenExpanded ? "" : "line-clamp-2"}`}>
                        {screen.description || "Builder-ready screen brief prepared."}
                      </div>
                      <div className="mt-1 flex justify-end text-[9px] font-semibold text-slate-400 hover:text-slate-600 select-none">
                        {isScreenExpanded ? "Click to collapse" : "Click to see full plan"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {journal.assetSummary ? (
              <div className="mt-4 rounded-[12px] bg-slate-950/[0.04] px-3 py-2 text-[11px] leading-5 text-slate-600">
                Assets: {journal.assetSummary.requested} requested, {journal.assetSummary.resolved} resolved, {journal.assetSummary.placeholders} placeholder{journal.assetSummary.placeholders === 1 ? "" : "s"}.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyConversation({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 text-[13px] leading-6 text-slate-500">
      I&apos;m ready. Tell me what to create or edit, and I&apos;ll talk through the work as it happens.
    </div>
  );
}

function DesignTab({
  tokenDraft,
  tokenDirty,
  tokenSaving,
  generationActive,
  onTokenDraftChange,
  onSaveTokens,
  onDiscardTokens,
}: {
  tokenDraft?: DesignTokens | null;
  tokenDirty?: boolean;
  tokenSaving?: boolean;
  generationActive?: boolean;
  onTokenDraftChange?: (tokens: DesignTokens) => void;
  onSaveTokens?: () => Promise<void>;
  onDiscardTokens?: () => void;
}) {
  const hasTokens = Boolean(tokenDraft && hasApprovedDesignTokens(tokenDraft));

  if (!hasTokens || !tokenDraft || !onTokenDraftChange || !onSaveTokens || !onDiscardTokens) {
    return (
      <div className="dg-token-editor-muted flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm leading-6 text-slate-500">
        Design tokens will appear here as soon as the generation job finishes design analysis.
      </div>
    );
  }

  const status = generationActive
    ? "Locked while building"
    : tokenSaving
      ? "Saving tokens"
      : tokenDirty
        ? "Unsaved token changes"
        : "Tokens saved";

  return (
    <div className="dg-token-editor-muted flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable]">
        <DesignSystemEditor
          value={tokenDraft}
          onChange={onTokenDraftChange}
          onSubmit={onSaveTokens}
          title="Design System"
          description="Exact project tokens used by screens and navigation."
          submitLabel={tokenDirty ? "Save Tokens" : "Tokens Saved"}
          isSubmitting={tokenSaving}
          submitStatus="Saving live token system..."
          layout="panel"
          showPreview={false}
        />
      </div>
      <div className="dg-token-editor-surface shrink-0 border-t border-slate-950/[0.08] px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-slate-700">{status}</div>
            <div className="truncate text-[11px] text-slate-400">Preview updates live on canvas</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[10px] text-slate-500 hover:bg-slate-950/[0.05] hover:text-slate-950"
              disabled={!tokenDirty || tokenSaving}
              title="Discard token changes"
              onClick={onDiscardTokens}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-[10px] bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
              disabled={!tokenDirty || tokenSaving || generationActive}
              onClick={() => void onSaveTokens()}
            >
              {tokenSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollapsedChatTrigger({
  eyebrow,
  title,
  isBusy,
  hasAlert,
  onExpand,
}: {
  eyebrow: string;
  title: string;
  isBusy: boolean;
  hasAlert: boolean;
  onExpand: () => void;
}) {
  const statusToneClass = hasAlert
    ? "bg-rose-500"
    : isBusy
      ? "bg-amber-400"
      : "bg-emerald-400";
  const accessibilityLabel = `${eyebrow}: ${title}`;

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={accessibilityLabel}
      title={accessibilityLabel}
      className="absolute left-4 top-16 z-50 flex h-12 w-12 cursor-pointer animate-in items-center justify-center rounded-full dg-bot-bubble fade-in-0 zoom-in-95 duration-200 transition hover:scale-[1.03]"
    >
      {hasAlert ? (
        <AlertCircle className="h-5 w-5" />
      ) : isBusy ? (
        <AgentBall className="h-5 w-5" active />
      ) : (
        <AgentBall className="h-5 w-5" />
      )}
      <span className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-white/80 ${statusToneClass} ${isBusy && !hasAlert ? "animate-pulse" : ""}`} />
      <span className="sr-only">{accessibilityLabel}</span>
    </button>
  );
}

export function ChatPanel({
  project,
  screens,
  selectedScreen,
  generationRun,
  generationRuns,
  projectNavigation,
  tokenDraft,
  tokenDirty = false,
  tokenSaving = false,
  generationActive = false,
  onTokenDraftChange,
  onSaveTokens,
  onDiscardTokens,
  isQueueing,
  queueError,
  retryDisabled,
  screenPlan,
  onRetryGeneration,
  onApproveScreenPlan,
  isCollapsed,
  onCollapseChange,
  onSubmit,
  disabled = false,
  selectionMode = false,
  onToggleSelectionMode,
  onClearSelectedScreen,
  onDeleteSelectedScreen,
  selectedElementPreview,
  selectedElementTargetLabel,
  selectedElementCanEditText = false,
  selectedElementCanEditDesign = false,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
}: {
  project: ProjectData;
  screens: ScreenData[];
  selectedScreen: ScreenData | null;
  generationRun: GenerationRunData | null;
  generationRuns: GenerationRunData[];
  projectNavigation?: ProjectNavigationData | null;
  tokenDraft?: DesignTokens | null;
  tokenDirty?: boolean;
  tokenSaving?: boolean;
  generationActive?: boolean;
  onTokenDraftChange?: (tokens: DesignTokens) => void;
  onSaveTokens?: () => Promise<void>;
  onDiscardTokens?: () => void;
  isQueueing: boolean;
  queueError?: string | null;
  retryDisabled?: boolean;
  screenPlan?: ScreenPlanState | null;
  isBuilding?: boolean;
  onRetryGeneration?: (run: GenerationRunData) => void;
  onApproveScreenPlan?: (proposalMessageId: string) => void;
  onBuildPlannedScreen?: () => void;
  onCancelPlan?: () => void;
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onSubmit?: (options: { prompt: string; image?: PromptImagePayload | null; imageReferenceMode?: ImageReferenceMode; clientTurnId?: string }) => Promise<boolean>;
  disabled?: boolean;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  onClearSelectedScreen?: () => void;
  onDeleteSelectedScreen?: () => void | Promise<void>;
  selectedElementPreview?: string | null;
  selectedElementTargetLabel?: string | null;
  selectedElementCanEditText?: boolean;
  selectedElementCanEditDesign?: boolean;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  onClearSelectedElement?: () => void;
}) {
  const { messages, isLoading } = useProjectMessages(project.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [pendingTick, setPendingTick] = useState(0);
  const [activeTab, setActiveTab] = useState<ChatWorkspaceTab>("chat");
  const isGenerationActive = isActiveGenerationRun(generationRun);
  const hasAlert = Boolean(queueError || screenPlan?.status === "error");
  const isBusy = isGenerationActive || isQueueing || screenPlan?.status === "planning" || Boolean(pendingTurn);

  const conversationItems = useMemo(
    () => {
      void pendingTick;
      return buildConversationItems({
        messages,
        screens,
        generationRun,
        generationRuns,
        queueError,
        screenPlan,
        pendingTurn,
      });
    },
    [generationRun, generationRuns, messages, pendingTick, pendingTurn, queueError, screenPlan, screens],
  );

  let collapsedEyebrow = "Drawgle";
  let collapsedTitle = project.name;
  if (hasAlert) {
    collapsedEyebrow = "Needs review";
    collapsedTitle = "Open agent chat";
  } else if (isBusy) {
    collapsedEyebrow = "Working";
    collapsedTitle = "Drawgle is active";
  } else if (selectedScreen) {
    collapsedEyebrow = "Editing";
    collapsedTitle = selectedScreen.name;
  }

  const handleSubmit = async (options: { prompt: string; image?: PromptImagePayload | null; imageReferenceMode?: ImageReferenceMode }) => {
    const turn: PendingTurn = {
      id: crypto.randomUUID(),
      prompt: options.prompt,
      image: options.image ?? null,
      startedAt: Date.now(),
    };
    setPendingTurn(turn);
    setPendingTick(0);

    try {
      return await onSubmit?.({ ...options, clientTurnId: turn.id }) ?? false;
    } finally {
      window.setTimeout(() => {
        setPendingTurn((current) => current?.id === turn.id ? null : current);
      }, 350);
    }
  };

  useEffect(() => {
    if (!pendingTurn) return;

    const interval = window.setInterval(() => {
      setPendingTick((value) => value + 1);
    }, 900);

    return () => window.clearInterval(interval);
  }, [pendingTurn]);

  const lastItemStateKey = conversationItems.length > 0
    ? JSON.stringify({
      id: conversationItems[conversationItems.length - 1].id,
      kind: conversationItems[conversationItems.length - 1].kind,
      status: conversationItems[conversationItems.length - 1].kind === "action"
        ? (conversationItems[conversationItems.length - 1] as any).step?.status
        : conversationItems[conversationItems.length - 1].kind === "generation_journal"
          ? (conversationItems[conversationItems.length - 1] as any).journal?.status
          : null,
      processCount: conversationItems[conversationItems.length - 1].kind === "action"
        ? ((conversationItems[conversationItems.length - 1] as any).step?.processLines?.length ?? 0)
        : conversationItems[conversationItems.length - 1].kind === "generation_journal"
          ? ((conversationItems[conversationItems.length - 1] as any).journal?.phases?.length ?? 0)
          : null,
      detail: conversationItems[conversationItems.length - 1].kind === "action"
        ? ((conversationItems[conversationItems.length - 1] as any).step?.detail ?? "")
        : null,
    })
    : "";

  useEffect(() => {
    if (isCollapsed) return;

    const timeout = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }, 90);

    return () => window.clearTimeout(timeout);
  }, [
    conversationItems.length,
    generationRun?.id,
    generationRun?.status,
    isCollapsed,
    reduceMotion,
    isBusy,
    lastItemStateKey,
  ]);

  if (isCollapsed) {
    return (
      <CollapsedChatTrigger
        eyebrow={collapsedEyebrow}
        title={collapsedTitle}
        isBusy={isBusy}
        hasAlert={hasAlert}
        onExpand={() => onCollapseChange(false)}
      />
    );
  }

  return (
    <div
      data-canvas-obstacle="left"
      className={`absolute z-50 flex flex-col overflow-hidden transition-all duration-300
        animate-in fade-in-0 slide-in-from-left-2
        left-2 right-2 top-[var(--dg-mobile-top-reserve)] bottom-3 h-auto rounded-[24px]
        md:left-4 md:right-auto md:top-auto md:bottom-4 md:h-[calc(100dvh-5rem)] md:w-[404px]
        dg-chat-shell dg-clickable-scope backdrop-blur-xl
      `}
    >
      <header className="relative shrink-0 px-3 pb-2 pt-2 dg-chat-body">
        <div className="flex h-10 items-center justify-between gap-3 px-2">
          <h1 className="min-w-0 max-w-[260px] truncate text-[15px] font-semibold text-slate-950">
            {project.name}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Minimize chat"
            className="pointer-events-auto h-8 w-8 rounded-full text-slate-700 hover:bg-slate-950/[0.05]"
            onClick={() => onCollapseChange(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        <PremiumSegmentedTabs
          items={CHAT_WORKSPACE_TABS}
          value={activeTab}
          onValueChange={setActiveTab}
          size="sm"
          layoutId="chat-workspace-tab"
        />
      </header>

      <PremiumTabPanel panelKey={activeTab} className="min-h-0 flex-1 flex flex-col">
        {activeTab === "chat" ? (
          <>
            <div className="chat-history-scrollbar dg-chat-body min-h-0 flex-1 overflow-y-auto pb-8">
              <AnimatePresence initial={false}>
                {conversationItems.length === 0 ? (
                  <EmptyConversation isLoading={isLoading} />
                ) : (
                  conversationItems.map((item) => {
                    if (item.kind === "user") {
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                          <UserBubble content={item.content} image={item.image} />
                        </motion.div>
                      );
                    }

                    if (item.kind === "thinking") {
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                          <ThinkingRow summary={item.summary} id={item.id} live={item.live} />
                        </motion.div>
                      );
                    }

                    if (item.kind === "generation_journal") {
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                          <GenerationJournalCard journal={item.journal} />
                        </motion.div>
                      );
                    }

                    if (item.kind === "action") {
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                          <ActionCard
                            step={item.step}
                            retryRun={item.retryRun}
                            retryDisabled={retryDisabled}
                            proposal={item.proposal}
                            proposalMessageId={item.proposalMessageId}
                            onRetryGeneration={onRetryGeneration}
                            onApproveScreenPlan={onApproveScreenPlan}
                          />
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                        <AssistantMessage content={item.content} isError={item.isError} />
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
              {isBusy && (
                <div className="mx-1 px-4 transition-all animate-pulse">
                  <div className="flex items-center gap-3">
                    <AgentBall className="h-5 w-5 shrink-0" active />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        Drawgle is active
                      </div>
                      <div className="mt-1">
                        <AgentThinkingIndicator
                          label={
                            pendingTurn
                              ? "Reading your prompt and selected context..."
                              : screenPlan?.status === "planning"
                                ? "Drafting focused screen structures..."
                                : isGenerationActive && generationRun
                                  ? `Building: ${generationRun.status === "planning"
                                    ? "Planning screens"
                                    : "Rendering mobile UI on canvas"
                                  }...`
                                  : isQueueing
                                    ? "Queueing generation job to Trigger.dev..."
                                    : "Polishing style rules and visual details..."
                          }
                          className="text-slate-600 font-semibold"
                          hideBall={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="dg-chat-footer shrink-0 px-2 py-2">
              <AgentComposer
                variant="panel"
                project={project}
                selectedScreen={selectedScreen}
                onClearSelectedScreen={onClearSelectedScreen}
                onDeleteSelectedScreen={onDeleteSelectedScreen}
                onSubmit={handleSubmit}
                disabled={disabled}
                submitStatusText="Thinking..."
                selectionMode={selectionMode}
                onToggleSelectionMode={onToggleSelectionMode}
                selectedElementPreview={selectedElementPreview}
                selectedElementTargetLabel={selectedElementTargetLabel}
                selectedElementCanEditText={selectedElementCanEditText}
                selectedElementCanEditDesign={selectedElementCanEditDesign}
                onEditSelectedText={onEditSelectedText}
                onEditSelectedDesign={onEditSelectedDesign}
                onClearSelectedElement={onClearSelectedElement}
              />
            </div>
          </>
        ) : null}

        {activeTab === "design" ? (
          <DesignTab
            tokenDraft={tokenDraft}
            tokenDirty={tokenDirty}
            tokenSaving={tokenSaving}
            generationActive={generationActive}
            onTokenDraftChange={onTokenDraftChange}
            onSaveTokens={onSaveTokens}
            onDiscardTokens={onDiscardTokens}
          />
        ) : null}

        {activeTab === "design-md" ? (
          <DesignMdTab
            project={project}
            projectNavigation={projectNavigation}
            tokenDraft={tokenDraft}
            tokenDirty={tokenDirty}
          />
        ) : null}
      </PremiumTabPanel>
    </div>
  );
}
