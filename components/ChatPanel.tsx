"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Minimize2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AgentBall, AgentThinkingIndicator } from "@/components/AgentBall";
import { AgentComposer } from "@/components/PromptBar";
import { Button } from "@/components/ui/button";
import { useProjectMessages } from "@/hooks/use-project-messages";
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
  NavigationArchitecture,
  NavigationPlan,
  ProjectData,
  ProjectMessage,
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
  | { id: string; kind: "action"; step: AgentStepMetadata; sourceContent?: string; retryRun?: GenerationRunData; proposal?: ScreenPlanProposalMetadata | null; proposalMessageId?: string | null; timestamp?: string };

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
      /^run:[^:]+:(planning|design)$/.test(activityKey) ||
      /^screen:[^:]+:build$/.test(activityKey)
    ),
  );

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

  for (const message of messages) {
    const ui = readAgentUi(message.metadata);
    const thinkingSummary = readThinkingSummary(message.metadata);
    const screenPlanProposal = readScreenPlanProposal(message.metadata);
    const agentStep = resolveAgentStep(readAgentStep(message.metadata), stepFromLegacyMessage(message, screens));
    const activityKey = getMessageActivityKey(message);
    const generationRunId = getMessageGenerationRunId(message);
    const run = generationRunId ? generationRunById.get(generationRunId) : null;

    if (message.role === "user") {
      items.push({
        id: `user-${message.id}`,
        kind: "user",
        content: message.content,
        timestamp: message.timestamp,
      });
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
      items.push({
        id: `action-${message.id}`,
        kind: "action",
        step: normalizedStep,
        sourceContent: message.content,
        proposal: screenPlanProposal,
        proposalMessageId: screenPlanProposal ? message.id : null,
        timestamp: message.timestamp,
      });
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

  if (pendingTurn && (!hasPersistedPending || (!hasPersistedPendingProgress && !hasPersistedPendingResponse))) {
    if (!hasPersistedPending) {
      items.push({
        id: `pending-user-${pendingTurn.id}`,
        kind: "user",
        content: pendingTurn.prompt || "[image]",
        image: pendingTurn.image,
      });
    }

    if (!hasPersistedPendingProgress && !hasPersistedPendingResponse && Date.now() - pendingTurn.startedAt > 450) {
      items.push({
        id: `pending-thinking-${pendingTurn.id}`,
        kind: "thinking",
        live: true,
        summary: {
          label: "Thinking",
          text: "Reading your message.",
          durationMs: Date.now() - pendingTurn.startedAt,
          expandedByDefault: false,
        },
      });
    }
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
        <div className="flex items-center gap-1.5 text-left text-[12px] font-medium text-black/40">
          <Sparkles className="h-3 w-3 opacity-70" />
          <span>{summary.label}</span>
          {seconds ? <span className="font-normal italic opacity-60">{seconds}</span> : null}
        </div>
        <AgentThinkingIndicator label="Thinking..." className="mt-2 pl-3 text-slate-500" />
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
        <AgentThinkingIndicator label="Thinking..." className="mt-2 pl-3 text-slate-500" />
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
  const [expanded, setExpanded] = useState(false);
  const busy = step.status === "queued" || step.status === "thinking" || step.status === "editing";
  const failed = step.status === "failed";
  const pendingProposal = isProposalPending(proposal);
  const processLines = step.processLines?.length ? step.processLines : step.detail ? [step.detail] : [];

  return (
    <div className="px-3 py-2">
      <div className="rounded-[16px] border border-slate-950/[0.1] bg-[#f4f4f5] p-4 text-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AgentBall className="h-4 w-4" active={busy} />
              <h3 className="truncate text-[13px] font-semibold text-slate-950">{step.title}</h3>
            </div>
            <div className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-600">
              {step.detail || (step.targetLabel ? `Working on ${step.targetLabel}.` : statusCopy(step.status))}
            </div>
          </div>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <AgentMark busy={busy} failed={failed} />
          </div>
        </div>

        <button
          type="button"
          className="mt-3 text-left text-[12px] font-medium underline text-slate-600 hover:text-slate-950"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide process" : "Show process"}
        </button>

        {expanded ? (
          <div className="mt-3 space-y-2 border-l border-slate-950/[0.12] pl-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{statusCopy(step.status)}</div>
            {processLines.map((line, index) => (
              <div key={`${line}-${index}`} className="text-[12px] leading-5 text-slate-600">
                {line}
              </div>
            ))}
          </div>
        ) : null}

        {pendingProposal && proposalMessageId && onApproveScreenPlan ? (
          <Button
            type="button"
            className="mt-4 h-9 rounded-full px-4 text-xs font-semibold"
            onClick={() => onApproveScreenPlan(proposalMessageId)}
            disabled={retryDisabled}
          >
            Build screen
          </Button>
        ) : null}

        {proposal?.status === "approved" ? (
          <div className="mt-4 text-[12px] font-medium text-slate-500">Approved for build</div>
        ) : null}

        {retryRun && onRetryGeneration ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-8 rounded-full bg-white px-3 text-xs"
            disabled={retryDisabled}
            onClick={() => onRetryGeneration(retryRun)}
          >
            Retry
          </Button>
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
      className="absolute left-4 top-16 z-50 flex h-12 w-12 animate-in items-center justify-center rounded-full dg-bot-bubble fade-in-0 zoom-in-95 duration-200 transition hover:scale-[1.03]"
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
  onSubmit?: (options: { prompt: string; image?: PromptImagePayload | null; clientTurnId?: string }) => Promise<boolean>;
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
  const isGenerationActive = isActiveGenerationRun(generationRun);
  const hasAlert = Boolean(queueError || screenPlan?.status === "error");
  const isBusy = isGenerationActive || isQueueing || screenPlan?.status === "planning" || Boolean(pendingTurn);

  const conversationItems = useMemo(
    () => buildConversationItems({
      messages,
      screens,
      generationRun,
      generationRuns,
      queueError,
      screenPlan,
      pendingTurn,
    }),
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

  const handleSubmit = async (options: { prompt: string; image?: PromptImagePayload | null }) => {
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

  useEffect(() => {
    if (isCollapsed) return;

    const timeout = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }, 90);

    return () => window.clearTimeout(timeout);
  }, [conversationItems.length, generationRun?.id, generationRun?.status, isCollapsed, reduceMotion]);

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
      className={`absolute z-50 flex flex-col overflow-hidden transition-all duration-300
        animate-in fade-in-0 slide-in-from-left-2
        left-2 right-2 top-[var(--dg-mobile-top-reserve)] bottom-3 h-auto rounded-[24px]
        md:left-4 md:right-auto md:top-auto md:bottom-4 md:h-[calc(100dvh-5rem)] md:w-[404px]
        dg-chat-shell backdrop-blur-xl
      `}
    >
      <header className="min-h-13 h-13 relative shrink-0 px-5">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-8 pl-5 pr-2.5">
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
      </header>

      <div className="chat-history-scrollbar min-h-0 flex-1 overflow-y-auto bg-white pb-8">
        <AnimatePresence initial={false}>
          {conversationItems.length === 0 ? (
            <EmptyConversation isLoading={isLoading} />
          ) : (
            conversationItems.map((item) => {
              if (item.kind === "user") {
                return (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <UserBubble content={item.content} image={item.image} />
                  </motion.div>
                );
              }

              if (item.kind === "thinking") {
                return (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <ThinkingRow summary={item.summary} id={item.id} live={item.live} />
                  </motion.div>
                );
              }

              if (item.kind === "action") {
                return (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
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
                <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <AssistantMessage content={item.content} isError={item.isError} />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 bg-white px-2 py-2">
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
    </div>
  );
}
