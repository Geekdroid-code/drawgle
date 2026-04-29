"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDotDashed,
  Loader2,
  Minimize2,
  Pencil,
  Plus,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useProjectMessages } from "@/hooks/use-project-messages";
import { describeScreenNavigation } from "@/lib/navigation";
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

type ReadyScreenPlanState = Extract<ScreenPlanState, { status: "ready" }>;

type AgentActivityKind = "user_request" | "working" | "update" | "error" | "proposal";

type AgentActivityItem = {
  id: string;
  kind: AgentActivityKind;
  label: string;
  title: string;
  detail?: string;
  screenName?: string | null;
  timestamp?: string;
  proposal?: ReadyScreenPlanState;
  retryRun?: GenerationRunData;
  dismissPlan?: boolean;
};

type AgentStatus = {
  label: string;
  text: string;
  detail?: string;
  busy: boolean;
  alert: boolean;
};

const generationStatusLabels: Record<GenerationRunData["status"], string> = {
  queued: "Queued",
  planning: "Planning",
  building: "Building",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

const isActiveGenerationRun = (run: GenerationRunData | null) =>
  Boolean(run && (run.status === "queued" || run.status === "planning" || run.status === "building"));

const getMetadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const getMetadataNumber = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "number" ? value : null;
};

const getScreenForMessage = (message: ProjectMessage, screens: ScreenData[]) => {
  const metadataName = getMetadataString(message.metadata, "screenName");

  if (message.screenId) {
    return screens.find((screen) => screen.id === message.screenId) ?? null;
  }

  return metadataName
    ? screens.find((screen) => screen.name === metadataName) ?? null
    : null;
};

const getScreenName = (message: ProjectMessage, screens: ScreenData[]) => {
  const metadataName = getMetadataString(message.metadata, "screenName");
  if (metadataName) {
    return metadataName;
  }

  return getScreenForMessage(message, screens)?.name ?? null;
};

const getRunStats = (run: GenerationRunData, screens: ScreenData[]) => {
  const runScreens = screens.filter((screen) => screen.generationRunId === run.id);

  return {
    totalScreens: run.requestedScreenCount ?? runScreens.length,
    readyScreens: runScreens.filter((screen) => screen.status === "ready").length,
    failedScreens: runScreens.filter((screen) => screen.status === "failed").length,
    buildingScreens: runScreens.filter((screen) => screen.status === "building").length,
    firstBuildingScreen: runScreens.find((screen) => screen.status === "building") ?? null,
  };
};

const screenCountLabel = (count: number) => `${count} screen${count === 1 ? "" : "s"}`;

const titleFromMessage = (message: ProjectMessage, screens: ScreenData[]) => {
  const screenName = getScreenName(message, screens);

  if (message.messageType === "edit_applied") {
    return screenName ? `Applied changes to ${screenName} screen` : "Applied changes";
  }

  if (message.messageType === "generation_completed") {
    const successfulScreens = getMetadataNumber(message.metadata, "successfulScreens");
    if (screenName) {
      return `${screenName} screen ready`;
    }
    if (successfulScreens !== null) {
      return `Created ${screenCountLabel(successfulScreens)}`;
    }
  }

  if (message.messageType === "screen_created" && screenName) {
    return `${screenName} created`;
  }

  return message.content.trim() || "Agent update";
};

const getMessageGenerationRunId = (message: ProjectMessage) =>
  getMetadataString(message.metadata, "generationRunId");

const isPlanningMessage = (message: ProjectMessage) => {
  const normalizedContent = message.content.trim().toLowerCase();
  return normalizedContent.includes("planning screen") || normalizedContent.startsWith("planned ");
};

const isRunSummaryMessage = (message: ProjectMessage, screens: ScreenData[]) => {
  const generationRunId = getMessageGenerationRunId(message);
  if (!generationRunId || getScreenName(message, screens) || message.screenId) {
    return false;
  }

  const normalizedContent = message.content.trim().toLowerCase();
  return (
    getMetadataNumber(message.metadata, "successfulScreens") !== null ||
    normalizedContent.startsWith("created ") ||
    normalizedContent.startsWith("generation finished") ||
    normalizedContent.startsWith("generation failed")
  );
};

const getMessageAction = (message: ProjectMessage) =>
  getMetadataString(message.metadata, "action");

const isEditStartMessage = (message: ProjectMessage) => {
  const action = getMessageAction(message);
  const normalizedContent = message.content.trim().toLowerCase();
  return (
    action === "edit_start" ||
    action === "navigation_edit_start" ||
    (message.role === "system" && message.messageType === "chat" && normalizedContent.startsWith("editing ") && normalizedContent.endsWith("..."))
  );
};

const isEditNoopMessage = (message: ProjectMessage) => {
  const action = getMessageAction(message);
  const normalizedContent = message.content.trim().toLowerCase();
  return action === "edit_noop" || normalizedContent.startsWith("no material ");
};

const isEditActivityMessage = (message: ProjectMessage) =>
  isEditStartMessage(message) || isEditNoopMessage(message) || message.messageType === "edit_applied";

const getMessageActivityKey = (message: ProjectMessage, screens: ScreenData[]) => {
  if (message.role === "user") {
    return null;
  }

  const explicitActivityKey = getMetadataString(message.metadata, "activityKey");
  if (explicitActivityKey) {
    return explicitActivityKey;
  }

  const generationRunId = getMessageGenerationRunId(message);
  if (!generationRunId) {
    return null;
  }

  const screenName = getScreenName(message, screens);
  const isStatusMessage =
    message.messageType === "generation_started" ||
    message.messageType === "generation_completed" ||
    message.messageType === "screen_created" ||
    message.messageType === "error";

  if (!isStatusMessage) {
    return null;
  }

  if (screenName || message.screenId) {
    return `legacy-screen:${generationRunId}:${message.screenId ?? screenName}`;
  }

  if (getMetadataNumber(message.metadata, "successfulScreens") !== null) {
    return `legacy-run:${generationRunId}:summary`;
  }

  if (isPlanningMessage(message)) {
    return `legacy-run:${generationRunId}:planning`;
  }

  return null;
};

const collapseActivityMessages = (
  messages: ProjectMessage[],
  screens: ScreenData[],
  generationRuns: GenerationRunData[],
) => {
  const orderedKeys: string[] = [];
  const messagesByKey = new Map<string, ProjectMessage>();
  const terminalRunIds = new Set(
    generationRuns
      .filter((run) => run.status === "completed" || run.status === "failed" || run.status === "canceled")
      .map((run) => run.id),
  );

  for (const message of messages) {
    const generationRunId = getMessageGenerationRunId(message);
    if (generationRunId && isRunSummaryMessage(message, screens)) {
      terminalRunIds.add(generationRunId);
    }
  }

  let latestUserMessageId: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      latestUserMessageId = message.id;
      const activityKey = `message:${message.id}`;
      orderedKeys.push(activityKey);
      messagesByKey.set(activityKey, message);
      continue;
    }

    const generationRunId = getMessageGenerationRunId(message);
    if (generationRunId && terminalRunIds.has(generationRunId) && message.messageType === "generation_started" && isPlanningMessage(message)) {
      continue;
    }

    const explicitActivityKey = getMetadataString(message.metadata, "activityKey");
    const userMessageId = getMetadataString(message.metadata, "userMessageId");
    const activityKey =
      explicitActivityKey ??
      (isEditActivityMessage(message)
        ? `legacy-edit:${userMessageId ?? latestUserMessageId ?? message.screenId ?? getScreenName(message, screens) ?? message.id}`
        : getMessageActivityKey(message, screens) ?? `message:${message.id}`);

    if (!messagesByKey.has(activityKey)) {
      orderedKeys.push(activityKey);
    }

    messagesByKey.set(activityKey, message);
  }

  return orderedKeys
    .map((key) => messagesByKey.get(key))
    .filter((message): message is ProjectMessage => Boolean(message));
};

const activityFromMessage = (message: ProjectMessage, screens: ScreenData[]): AgentActivityItem => {
  const screenName = getScreenName(message, screens);
  const screen = getScreenForMessage(message, screens);

  if (message.role === "user") {
    return {
      id: `message-${message.id}`,
      kind: "user_request",
      label: "User request",
      title: message.content.trim() || "Reference image request",
      detail: screenName ? `Editing ${screenName}` : undefined,
      screenName,
      timestamp: message.timestamp,
    };
  }

  if (message.messageType === "error") {
    return {
      id: `message-${message.id}`,
      kind: "error",
      label: "Agent alert",
      title: message.content.trim() || "Something needs review.",
      screenName,
      timestamp: message.timestamp,
    };
  }

  if (isEditStartMessage(message)) {
    return {
      id: `message-${message.id}`,
      kind: "working",
      label: "Agent working",
      title: titleFromMessage(message, screens),
      screenName,
      timestamp: message.timestamp,
    };
  }

  if (isEditNoopMessage(message)) {
    return {
      id: `message-${message.id}`,
      kind: "update",
      label: "Agent update",
      title: message.content.trim() || (screenName ? `No material changes for ${screenName}` : "No material changes applied"),
      screenName,
      timestamp: message.timestamp,
    };
  }

  if (message.messageType === "generation_started") {
    if (screen?.status === "ready") {
      return {
        id: `message-${message.id}`,
        kind: "update",
        label: "Agent update",
        title: `${screen.name} ready`,
        screenName: screen.name,
        timestamp: message.timestamp,
      };
    }

    if (screen?.status === "failed") {
      return {
        id: `message-${message.id}`,
        kind: "error",
        label: "Agent alert",
        title: `${screen.name} failed`,
        detail: screen.error ?? undefined,
        screenName: screen.name,
        timestamp: message.timestamp,
      };
    }

    return {
      id: `message-${message.id}`,
      kind: "working",
      label: "Agent working",
      title: titleFromMessage(message, screens),
      screenName,
      timestamp: message.timestamp,
    };
  }

  if (
    message.messageType === "generation_completed" ||
    message.messageType === "screen_created" ||
    message.messageType === "edit_applied"
  ) {
    return {
      id: `message-${message.id}`,
      kind: "update",
      label: message.messageType === "edit_applied" ? "Edit applied" : "Agent update",
      title: titleFromMessage(message, screens),
      screenName,
      timestamp: message.timestamp,
    };
  }

  return {
    id: `message-${message.id}`,
    kind: message.role === "model" ? "update" : "working",
    label: message.role === "model" ? "Agent reply" : "Agent note",
    title: message.content.trim() || "Agent update",
    screenName,
    timestamp: message.timestamp,
  };
};

function buildAgentActivities({
  messages,
  screens,
  generationRun,
  generationRuns,
  isQueueing,
  queueError,
  screenPlan,
}: {
  messages: ProjectMessage[];
  screens: ScreenData[];
  generationRun: GenerationRunData | null;
  generationRuns: GenerationRunData[];
  isQueueing: boolean;
  queueError?: string | null;
  screenPlan?: ScreenPlanState | null;
}) {
  const activities = collapseActivityMessages(messages, screens, generationRuns).map((message) => activityFromMessage(message, screens));

  if (queueError) {
    activities.push({
      id: "live-queue-error",
      kind: "error",
      label: "Agent alert",
      title: queueError,
    });
  }

  if (screenPlan?.status === "planning") {
    activities.push({
      id: "live-screen-planning",
      kind: "working",
      label: "Agent working",
      title: "Planning the next screen...",
      detail: screenPlan.prompt,
    });
  }

  if (screenPlan?.status === "ready") {
    activities.push({
      id: `proposal-${screenPlan.screenPlan.name}`,
      kind: "proposal",
      label: "Proposal ready",
      title: screenPlan.screenPlan.name,
      detail: screenPlan.screenPlan.description,
      proposal: screenPlan,
    });
  }

  if (screenPlan?.status === "error") {
    activities.push({
      id: "live-screen-plan-error",
      kind: "error",
      label: "Planner alert",
      title: screenPlan.error,
      dismissPlan: true,
    });
  }

  if (isQueueing && !generationRun) {
    activities.push({
      id: "live-queueing",
      kind: "working",
      label: "Agent working",
      title: "Queueing generation...",
      detail: "The builder will start as soon as the project slot is free.",
    });
  }

  if (generationRun && isActiveGenerationRun(generationRun)) {
    const stats = getRunStats(generationRun, screens);
    const detail = generationRun.status === "building" && stats.totalScreens > 0
      ? `${stats.readyScreens}/${stats.totalScreens} ready${stats.failedScreens > 0 ? ` - ${stats.failedScreens} failed` : ""}`
      : generationRun.error ?? undefined;

    activities.push({
      id: `live-generation-${generationRun.id}-${generationRun.status}`,
      kind: "working",
      label: "Agent working",
      title: stats.firstBuildingScreen
        ? `Building ${stats.firstBuildingScreen.name}...`
        : `${generationStatusLabels[generationRun.status]} screens...`,
      detail,
    });
  }

  const latestRetryRun = [...generationRuns]
    .filter((run) => run.status === "failed" || run.status === "canceled")
    .sort(
      (left, right) =>
        new Date(right.completedAt ?? right.updatedAt).getTime() -
        new Date(left.completedAt ?? left.updatedAt).getTime(),
    )[0] ?? null;

  if (!generationRun && latestRetryRun) {
    const alreadyHasRunError = messages.some((message) => (
      message.messageType === "error" &&
      getMetadataString(message.metadata, "generationRunId") === latestRetryRun.id
    ));

    if (!alreadyHasRunError) {
      activities.push({
        id: `retry-${latestRetryRun.id}`,
        kind: "error",
        label: "Generation ended",
        title: latestRetryRun.error ?? "Generation finished with an issue.",
        retryRun: latestRetryRun,
      });
    }
  }

  return activities;
}

function getAgentStatus({
  generationRun,
  screens,
  isQueueing,
  queueError,
  screenPlan,
}: {
  generationRun: GenerationRunData | null;
  screens: ScreenData[];
  isQueueing: boolean;
  queueError?: string | null;
  screenPlan?: ScreenPlanState | null;
}): AgentStatus {
  if (queueError) {
    return {
      label: "Drawgle Agent alert",
      text: "Needs review",
      detail: queueError,
      busy: false,
      alert: true,
    };
  }

  if (screenPlan?.status === "error") {
    return {
      label: "Drawgle Planner alert",
      text: "Screen plan needs attention",
      detail: screenPlan.error,
      busy: false,
      alert: true,
    };
  }

  if (screenPlan?.status === "ready") {
    return {
      label: "Drawgle Proposal ready",
      text: "Screen proposal ready",
      detail: screenPlan.screenPlan.name,
      busy: false,
      alert: false,
    };
  }

  if (screenPlan?.status === "planning") {
    return {
      label: "Drawgle Agent working",
      text: "Planning next screen...",
      busy: true,
      alert: false,
    };
  }

  if (isQueueing && !generationRun) {
    return {
      label: "Drawgle Agent working",
      text: "Queueing generation...",
      busy: true,
      alert: false,
    };
  }

  if (generationRun && isActiveGenerationRun(generationRun)) {
    const stats = getRunStats(generationRun, screens);
    if (generationRun.status === "building") {
      return {
        label: "Drawgle Agent working",
        text: stats.firstBuildingScreen ? `Building ${stats.firstBuildingScreen.name}...` : "Building screens...",
        detail: stats.totalScreens > 0 ? `${stats.readyScreens}/${stats.totalScreens} screens ready` : undefined,
        busy: true,
        alert: false,
      };
    }

    return {
      label: "Drawgle Agent working",
      text: `${generationStatusLabels[generationRun.status]} screens...`,
      busy: true,
      alert: false,
    };
  }

  return {
    label: "",
    text: "Drawgle is ready",
    busy: false,
    alert: false,
  };
}

function ActivityIcon({
  item,
  reduceMotion,
}: {
  item: AgentActivityItem;
  reduceMotion: boolean;
}) {
  const iconClass = "h-4 w-4";

  if (item.kind === "working") {
    return (
      <motion.span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-[#2563eb]/70 bg-white text-[#2563eb]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      >
        <CircleDotDashed className={iconClass} />
      </motion.span>
    );
  }

  if (item.kind === "error") {
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600">
        <AlertCircle className={iconClass} />
      </span>
    );
  }

  if (item.kind === "proposal") {
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
        <Plus className={iconClass} />
      </span>
    );
  }

  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
      <CheckCircle2 className={iconClass} />
    </span>
  );
}

function ProposalBody({
  item,
  isBuilding,
  onBuildPlannedScreen,
  onCancelPlan,
}: {
  item: AgentActivityItem;
  isBuilding: boolean;
  onBuildPlannedScreen?: () => void;
  onCancelPlan?: () => void;
}) {
  const proposal = item.proposal;
  if (!proposal) {
    return null;
  }

  const plan = proposal.screenPlan;

  return (
    <div className="mt-3 rounded-[12px] border border-slate-950/[0.08] bg-white/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[7px] border border-slate-950/[0.12] bg-[#f7f7f8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          {plan.type}
        </span>
        <span className="rounded-[7px] border border-slate-950/[0.08] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {describeScreenNavigation(plan, proposal.navigationArchitecture)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{plan.description}</p>

      {proposal.image ? (
        <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-slate-950/[0.08] bg-[#f7f7f8] p-2.5">
          <div className="relative h-11 w-11 overflow-hidden rounded-[8px] border border-slate-950/[0.1] bg-white">
            <Image
              src={`data:${proposal.image.mimeType};base64,${proposal.image.data}`}
              alt="Screen planning reference"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="text-xs leading-5 text-slate-600">Reference image will be used when this screen is built.</div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {onCancelPlan ? (
          <Button type="button" variant="outline" className="h-8 rounded-[9px] dg-metal-plate px-3 text-xs" onClick={onCancelPlan} disabled={isBuilding}>
            Cancel
          </Button>
        ) : null}
        {onBuildPlannedScreen ? (
          <Button type="button" className="h-8 rounded-[9px] dg-button-primary px-3 text-xs" onClick={onBuildPlannedScreen} disabled={isBuilding}>
            {isBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            Build Screen
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AgentActivityRow({
  item,
  reduceMotion,
  isBuilding,
  retryDisabled,
  onRetryGeneration,
  onBuildPlannedScreen,
  onCancelPlan,
}: {
  item: AgentActivityItem;
  reduceMotion: boolean;
  isBuilding: boolean;
  retryDisabled?: boolean;
  onRetryGeneration?: (run: GenerationRunData) => void;
  onBuildPlannedScreen?: () => void;
  onCancelPlan?: () => void;
}) {
  const rowVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -4 },
  };

  if (item.kind === "user_request") {
    return (
      <motion.li
        layout
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={rowVariants}
        transition={{ duration: 0.18 }}
        className="ml-10 flex justify-end py-1"
      >
        <div className="max-w-[88%] rounded-[12px] border border-slate-950/[0.07] bg-[#f7f7f8] px-3 py-2 text-right text-sm leading-6 text-slate-700">
          <div className="whitespace-pre-wrap break-words">{item.title}</div>
          {item.detail ? <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{item.detail}</div> : null}
        </div>
      </motion.li>
    );
  }

  const mutedTitle = item.kind === "update" ? "text-slate-700" : "text-slate-900";

  return (
    <motion.li
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={rowVariants}
      transition={{ duration: 0.2 }}
      className="group relative pl-10"
    >
      <div className="absolute left-0 top-2.5 z-10">
        <ActivityIcon item={item} reduceMotion={reduceMotion} />
      </div>

      <div className="rounded-[10px] px-2.5 py-2.5 transition-colors duration-200 group-hover:bg-slate-950/[0.016]">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667894]">
          <span>{item.label}</span>
          {item.screenName ? <span className="h-1 w-1 rounded-full bg-slate-300" /> : null}
          {item.screenName ? <span className="min-w-0 max-w-[132px] truncate">{item.screenName}</span> : null}
        </div>
        <div className={`mt-0.5 text-[13px] leading-5 ${mutedTitle}`}>{item.title}</div>
        {item.detail && item.kind !== "proposal" ? (
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</div>
        ) : null}

        {item.kind === "proposal" ? (
          <ProposalBody
            item={item}
            isBuilding={isBuilding}
            onBuildPlannedScreen={onBuildPlannedScreen}
            onCancelPlan={onCancelPlan}
          />
        ) : null}

        {item.dismissPlan && onCancelPlan ? (
          <Button type="button" variant="outline" className="mt-3 h-8 rounded-[9px] dg-metal-plate px-3 text-xs" onClick={onCancelPlan}>
            Dismiss
          </Button>
        ) : null}

        {item.retryRun && onRetryGeneration ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-8 rounded-[9px] dg-metal-plate px-3 text-xs"
            disabled={retryDisabled}
            onClick={() => onRetryGeneration(item.retryRun as GenerationRunData)}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </motion.li>
  );
}

function AgentActivityTimeline({
  activities,
  isLoading,
  reduceMotion,
  isBuilding,
  retryDisabled,
  onRetryGeneration,
  onBuildPlannedScreen,
  onCancelPlan,
}: {
  activities: AgentActivityItem[];
  isLoading: boolean;
  reduceMotion: boolean;
  isBuilding: boolean;
  retryDisabled?: boolean;
  onRetryGeneration?: (run: GenerationRunData) => void;
  onBuildPlannedScreen?: () => void;
  onCancelPlan?: () => void;
}) {
  if (!isLoading && activities.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-5 text-center">
        <div>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full dg-bot-bubble">
            <Bot className="h-4 w-4" />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Start from the main prompt box. Agent activity will appear here as a live timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="relative pl-1">
        <div className="pointer-events-none absolute bottom-4 left-[17px] top-4 border-l border-dashed border-slate-300" />
        <motion.ul layout className="space-y-0">
          <AnimatePresence initial={false}>
            {activities.map((item) => (
              <AgentActivityRow
                key={item.id}
                item={item}
                reduceMotion={reduceMotion}
                isBuilding={isBuilding}
                retryDisabled={retryDisabled}
                onRetryGeneration={onRetryGeneration}
                onBuildPlannedScreen={onBuildPlannedScreen}
                onCancelPlan={onCancelPlan}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </LayoutGroup>
  );
}

function AgentStatusDock({
  status,
  reduceMotion,
}: {
  status: AgentStatus;
  reduceMotion: boolean;
}) {
  const iconNode = status.alert ? (
    <AlertCircle className="h-4 w-4 text-rose-600" />
  ) : status.busy ? (
    <CircleDotDashed className="h-4 w-4 text-[#2563eb]" />
  ) : (
    <Bot className="h-4 w-4 text-slate-700" />
  );

  return (
    <div className="shrink-0 border-t border-slate-950/[0.07] bg-white/96 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 rounded-[10px] border border-slate-950/[0.07] bg-white px-2.5 py-2">
        <motion.div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-[#f7f7f8] text-slate-800"
          animate={status.busy && !reduceMotion ? { rotate: 360 } : undefined}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        >
          {iconNode}
        </motion.div>
        <div className="min-w-0 flex-1">
          {status.label ? <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">{status.label}</div> : null}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${status.text}-${status.detail ?? ""}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
              transition={{ duration: 0.18 }}
              className="truncate text-sm font-medium leading-5 text-slate-800"
            >
              {status.text}
            </motion.div>
          </AnimatePresence>
          {status.detail ? <div className="truncate text-xs text-slate-500">{status.detail}</div> : null}
        </div>
        {status.busy ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#2563eb] opacity-35 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
          </span>
        ) : (
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.alert ? "bg-rose-500" : "bg-emerald-400"}`} />
        )}
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
      className="absolute left-4 top-16 z-50 flex h-12 w-12 animate-in items-center justify-center rounded-full dg-bot-bubble fade-in-0 zoom-in-95 duration-200 transition hover:scale-[1.03]"
    >
      {hasAlert ? (
        <AlertCircle className="h-5 w-5" />
      ) : isBusy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Bot className="h-5 w-5" />
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
  isBuilding = false,
  onRetryGeneration,
  onBuildPlannedScreen,
  onCancelPlan,
  isCollapsed,
  onCollapseChange,
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
  onBuildPlannedScreen?: () => void;
  onCancelPlan?: () => void;
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
}) {
  const { messages, isLoading } = useProjectMessages(project.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const isGenerationActive = isActiveGenerationRun(generationRun);
  const hasAlert = Boolean(queueError || screenPlan?.status === "error");
  const isBusy = isGenerationActive || isQueueing || screenPlan?.status === "planning";

  const activities = useMemo(
    () => buildAgentActivities({
      messages,
      screens,
      generationRun,
      generationRuns,
      isQueueing,
      queueError,
      screenPlan,
    }),
    [generationRun, generationRuns, isQueueing, messages, queueError, screenPlan, screens],
  );

  const agentStatus = useMemo(
    () => getAgentStatus({
      generationRun,
      screens,
      isQueueing,
      queueError,
      screenPlan,
    }),
    [generationRun, isQueueing, queueError, screenPlan, screens],
  );

  let collapsedEyebrow = "Agent history";
  let collapsedTitle = project.name;

  if (queueError) {
    collapsedEyebrow = "Agent alert";
    collapsedTitle = "Review the latest issue";
  } else if (screenPlan?.status === "error") {
    collapsedEyebrow = "Planner alert";
    collapsedTitle = "Screen plan needs attention";
  } else if (screenPlan?.status === "ready") {
    collapsedEyebrow = "Proposal ready";
    collapsedTitle = screenPlan.screenPlan.name;
  } else if (screenPlan?.status === "planning") {
    collapsedEyebrow = "Planning";
    collapsedTitle = "Shaping the next screen";
  } else if (isGenerationActive) {
    collapsedEyebrow = "Agent live";
    collapsedTitle = "Building screens";
  } else if (isQueueing) {
    collapsedEyebrow = "Queued";
    collapsedTitle = "Waiting to start";
  } else if (selectedScreen) {
    collapsedEyebrow = "Editing";
    collapsedTitle = selectedScreen.name;
  }

  useEffect(() => {
    if (isCollapsed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [activities.length, generationRun?.id, generationRun?.status, isCollapsed, isQueueing, queueError, screenPlan]);

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
        animate-in fade-in-0 slide-in-from-left-2 duration-300
        left-2 right-2 top-[var(--dg-mobile-top-reserve)] bottom-[calc(var(--dg-mobile-prompt-reserve)+var(--dg-mobile-prompt-bottom)+0.35rem)] h-auto rounded-[14px]
        md:left-4 md:right-auto md:top-auto md:bottom-4 md:h-[calc(100dvh-5rem)] md:w-96 md:rounded-[14px]
        dg-chat-shell backdrop-blur-xl
      `}
    >
      <div className="h-[52px] shrink-0 border-b border-slate-950/[0.08] bg-white/70 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-950/[0.08] bg-[#f7f7f8] text-slate-600">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-950">{project.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667894]">Agent history</div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Minimize agent history"
            className="h-8 w-8 rounded-[9px] border border-slate-950/[0.08] bg-white text-slate-600 hover:bg-[#f7f7f8] hover:text-slate-950"
            onClick={() => onCollapseChange(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedScreen ? (
        <div className="flex items-center gap-2 border-b border-slate-950/[0.07] bg-[#f7f7f8]/80 px-3.5 py-2">
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span className="max-w-[220px] truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Focused on {selectedScreen.name}
          </span>
        </div>
      ) : null}

      <div className="chat-history-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-3.5 py-4">
        <AgentActivityTimeline
          activities={activities}
          isLoading={isLoading}
          reduceMotion={reduceMotion}
          isBuilding={isBuilding}
          retryDisabled={retryDisabled}
          onRetryGeneration={onRetryGeneration}
          onBuildPlannedScreen={onBuildPlannedScreen}
          onCancelPlan={onCancelPlan}
        />
        <div ref={messagesEndRef} />
      </div>

      <AgentStatusDock status={agentStatus} reduceMotion={reduceMotion} />
    </div>
  );
}
