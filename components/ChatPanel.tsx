"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Pencil,
  Plus,
  ArrowRight,
  Minimize2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProjectMessages } from "@/hooks/use-project-messages";
import { describeScreenNavigation } from "@/lib/navigation";
import type { GenerationRunData, NavigationArchitecture, ProjectData, ProjectMessage, PromptImagePayload, ScreenData, ScreenPlan } from "@/lib/types";

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
    }
  | {
      status: "error";
      prompt: string;
      image: PromptImagePayload | null;
      error: string;
    };

const generationStatusLabels: Record<GenerationRunData["status"], string> = {
  queued: "Queued",
  planning: "Planning",
  building: "Building",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

function MessageTypeIcon({ messageType }: { messageType: ProjectMessage["messageType"] }) {
  switch (messageType) {
    case "edit_applied":
      return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    case "generation_started":
      return <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0 animate-pulse" />;
    case "generation_completed":
      return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    case "screen_created":
      return <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
}

function ActivityNote({
  label,
  icon,
  title,
  detail,
  tone = "neutral",
  action,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: "neutral" | "active" | "success" | "error";
  action?: React.ReactNode;
}) {
  return (
    <div className="self-start w-full rounded-2xl border border-black/[0.04] bg-white/40 px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{title}</p>
      {detail ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function SystemMessageRow({ message }: { message: ProjectMessage }) {
  const tone = message.messageType === "error"
    ? "error"
    : message.messageType === "generation_completed" || message.messageType === "edit_applied"
      ? "success"
      : message.messageType === "generation_started"
        ? "active"
        : "neutral";

  const label = message.messageType === "error"
    ? "Agent alert"
    : message.messageType === "generation_started"
      ? "Agent working"
      : message.messageType === "generation_completed"
        ? "Agent update"
        : message.messageType === "edit_applied"
          ? "Edit applied"
          : "Agent note";

  return (
    <ActivityNote
      label={label}
      icon={<MessageTypeIcon messageType={message.messageType} />}
      title={message.content}
      tone={tone}
    />
  );
}

function MessageBubble({
  message,
  screens,
}: {
  message: ProjectMessage;
  screens: ScreenData[];
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const linkedScreen = message.screenId
    ? screens.find((screen) => screen.id === message.screenId)
    : null;

  if (isSystem) {
    return <SystemMessageRow message={message} />;
  }

  const isEditApplied =
    message.messageType === "edit_applied" ||
    (message.role === "model" && message.content.includes("<edit>"));

  return (
    <div className={`flex flex-col max-w-[90%] ${isUser ? "self-end" : "self-start"}`}>
      {linkedScreen && !isUser ? (
        <div className="mb-1 ml-1 flex items-center gap-1">
          <Pencil className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium tracking-[0.08em] text-slate-400 uppercase">{linkedScreen.name}</span>
        </div>
      ) : null}

      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "rounded-tr-md bg-slate-900 text-white border border-transparent"
            : "rounded-tl-md border border-black/[0.04] bg-white/40 text-slate-800"
        }`}
      >
        {isEditApplied ? (
          <div className="flex items-center gap-2 font-medium text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            Applied changes{linkedScreen ? ` to ${linkedScreen.name}` : ""}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>

      {linkedScreen && isUser ? (
        <div className="mt-1 mr-1 flex items-center gap-1 self-end">
          <span className="text-[10px] font-medium tracking-[0.08em] text-blue-200 uppercase">{linkedScreen.name}</span>
        </div>
      ) : null}
    </div>
  );
}

function getRunStats(run: GenerationRunData, screens: ScreenData[]) {
  const runScreens = screens.filter((screen) => screen.generationRunId === run.id);

  return {
    totalScreens: run.requestedScreenCount ?? runScreens.length,
    readyScreens: runScreens.filter((screen) => screen.status === "ready").length,
    failedScreens: runScreens.filter((screen) => screen.status === "failed").length,
    buildingScreens: runScreens.filter((screen) => screen.status === "building").length,
  };
}

function LiveCanvasActivity({
  generationRun,
  generationRuns,
  screens,
  isQueueing,
  queueError,
  retryDisabled,
  screenPlan,
  onRetryGeneration,
}: {
  generationRun: GenerationRunData | null;
  generationRuns: GenerationRunData[];
  screens: ScreenData[];
  isQueueing: boolean;
  queueError?: string | null;
  retryDisabled?: boolean;
  screenPlan?: ScreenPlanState | null;
  onRetryGeneration?: (run: GenerationRunData) => void;
}) {
  const latestTerminalRun = [...generationRuns]
    .filter((run) => run.status === "completed" || run.status === "failed" || run.status === "canceled")
    .sort(
      (left, right) =>
        new Date(right.completedAt ?? right.updatedAt).getTime() -
        new Date(left.completedAt ?? left.updatedAt).getTime(),
    )[0] ?? null;

  if (queueError) {
    return (
      <ActivityNote
        label="Agent alert"
        icon={<AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
        title={queueError}
        tone="error"
      />
    );
  }

  if (screenPlan?.status === "planning") {
    return (
      <ActivityNote
        label="Analyzing request"
        icon={<Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
        title="Drafting one coherent screen brief from project memory and design tokens."
        detail="This stays in chat so the user can see the agent working without switching surfaces."
        tone="active"
      />
    );
  }

  if (isQueueing && !generationRun) {
    return (
      <ActivityNote
        label="Queued"
        icon={<Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
        title="Your generation request is being queued."
        detail="The builder will start as soon as the current project slot is free."
        tone="active"
      />
    );
  }

  if (generationRun && (generationRun.status === "queued" || generationRun.status === "planning" || generationRun.status === "building")) {
    const stats = getRunStats(generationRun, screens);
    const detail = generationRun.status === "building"
      ? `${stats.readyScreens}/${stats.totalScreens} ready${stats.failedScreens > 0 ? ` · ${stats.failedScreens} failed` : ""}${stats.buildingScreens > 0 ? ` · ${stats.buildingScreens} building` : ""}`
      : generationRun.error ?? "Waiting for the next persisted update from the background run.";

    return (
      <ActivityNote
        label="Agent working"
        icon={<Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
        title={generationRun.status === "building" ? "Building screens on the canvas." : `${generationStatusLabels[generationRun.status]} screens.`}
        detail={detail}
        tone="active"
      />
    );
  }

  return null;
}

function PlanCard({
  screenPlan,
  isBuilding,
  onBuildPlannedScreen,
  onCancelPlan,
}: {
  screenPlan: ScreenPlanState;
  isBuilding: boolean;
  onBuildPlannedScreen: () => void;
  onCancelPlan: () => void;
}) {
  if (screenPlan.status === "planning") {
    return null;
  }

  if (screenPlan.status === "error") {
    return (
      <ActivityNote
        label="Planner error"
        icon={<AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
        title={screenPlan.error}
        tone="error"
        action={
          <Button type="button" variant="outline" className="rounded-full border-black/10 bg-white text-slate-700 hover:bg-slate-50" onClick={onCancelPlan}>
            Dismiss
          </Button>
        }
      />
    );
  }

  const { screenPlan: plan, image, navigationArchitecture } = screenPlan;

  return (
    <section className="self-start w-full rounded-2xl border border-black/[0.04] bg-white/40 px-4 py-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
        Proposed screen
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="rounded-full border border-black/10 bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
          {plan.type}
        </div>
        <div className="rounded-full border border-black/10 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {describeScreenNavigation(plan, navigationArchitecture)}
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold tracking-[-0.02em] text-slate-950">{plan.name}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{plan.description}</p>

      {image ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/10 bg-slate-50 p-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-black/10 bg-white">
            <Image
              src={`data:${image.mimeType};base64,${image.data}`}
              alt="Screen planning reference"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="text-sm text-slate-600">Reference image will be used when this screen is built.</div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" variant="outline" className="rounded-full border-black/10 bg-white" onClick={onCancelPlan} disabled={isBuilding}>
          Cancel
        </Button>
        <Button type="button" className="rounded-full px-5" onClick={onBuildPlannedScreen} disabled={isBuilding}>
          {isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Build Screen
        </Button>
      </div>
    </section>
  );
}

export function CollapsedChatTrigger({
  eyebrow,
  title,
  isBusy,
  hasAlert,
  onExpand,
  variant = "floating",
}: {
  eyebrow: string;
  title: string;
  isBusy: boolean;
  hasAlert: boolean;
  onExpand: () => void;
  variant?: "floating" | "attached";
}) {
  const statusToneClass = hasAlert
    ? "bg-rose-500"
    : isBusy
      ? "bg-amber-400"
      : "bg-emerald-400";

  const accessibilityLabel = `${eyebrow}: ${title}`;
  const mobileStatusText = hasAlert
    ? "Needs review"
    : isBusy
      ? "Working"
      : "Open chat";

  if (variant === "attached") {
    return (
      <button
        type="button"
        onClick={onExpand}
        aria-label={accessibilityLabel}
        title={accessibilityLabel}
        className="relative flex items-center gap-2 overflow-hidden rounded-[18px] rounded-bl-[10px] border border-black/[0.06] bg-[#f5f2ea]/95 px-2.5 py-2 text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.1)] backdrop-blur-xl transition-all duration-200 hover:bg-[#faf7f0]"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          {hasAlert ? (
            <AlertCircle className="h-4 w-4" />
          ) : isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </span>

        <span className="min-w-0 pr-3 text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">History</span>
          <span className="block max-w-[78px] truncate text-[11px] font-medium leading-4 text-slate-700">{mobileStatusText}</span>
        </span>

        <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-white ${statusToneClass} ${isBusy && !hasAlert ? "animate-pulse" : ""}`} />
        <span className="sr-only">{accessibilityLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={accessibilityLabel}
      title={accessibilityLabel}
      className="absolute bottom-4 left-4 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300"
    >
      <span className="pointer-events-none absolute inset-1 translate-y-2 rounded-full bg-slate-950/16 blur-xl" />

      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/90 text-slate-800 shadow-[0_14px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-all duration-200 hover:bg-white md:h-auto md:min-w-[156px] md:justify-start md:gap-3 md:px-3 md:py-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          {hasAlert ? (
            <AlertCircle className="h-4 w-4" />
          ) : isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </span>

        <span className="hidden min-w-0 md:flex md:flex-1 md:flex-col md:items-start md:text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</span>
          <span className="block max-w-[112px] truncate pt-0.5 text-sm font-medium text-slate-800">{title}</span>
        </span>

        <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white ${statusToneClass} ${isBusy && !hasAlert ? "animate-pulse" : ""}`} />
      </span>

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
  const isGenerationActive = Boolean(
    generationRun &&
    (generationRun.status === "queued" || generationRun.status === "planning" || generationRun.status === "building"),
  );
  const hasAlert = Boolean(queueError || screenPlan?.status === "error");
  const isBusy = isGenerationActive || isQueueing || screenPlan?.status === "planning";

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
  }, [isCollapsed, messages, screenPlan, generationRun?.id, generationRun?.status, isQueueing, queueError]);

  if (isCollapsed) {
    return (
      <div className="hidden md:block">
        <CollapsedChatTrigger
          eyebrow={collapsedEyebrow}
          title={collapsedTitle}
          isBusy={isBusy}
          hasAlert={hasAlert}
          onExpand={() => onCollapseChange(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`absolute z-50 flex flex-col overflow-hidden transition-all duration-300
        animate-in fade-in-0 slide-in-from-left-2 duration-300
        md:left-4 md:bottom-4 md:h-[calc(100vh-5rem)] md:w-96 md:rounded-2xl md:border md:border-black/[0.06]
        bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t border-black/[0.06]
        surface-container backdrop-blur-glass
      `}
    >
      <div className="h-14 shrink-0 border-b border-black/[0.05] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{project.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Agent history</div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Minimize agent history"
            className="h-9 w-9 rounded-full border border-black/[0.06] bg-white/55 text-slate-500 hover:bg-white/85 hover:text-slate-800"
            onClick={() => onCollapseChange(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedScreen ? (
        <div className="flex items-center gap-2 border-b border-black/[0.05] bg-white/50 px-4 py-2">
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          <span className="max-w-[220px] truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Focused on {selectedScreen.name}
          </span>
        </div>
      ) : null}

      <div className="chat-history-scrollbar flex-1 overflow-y-auto bg-[#f7f5ef]/70 px-4 py-4">
        <div className="flex flex-col gap-3">
          {!isLoading && messages.length === 0 && !screenPlan ? (
            <div className="mt-10 text-center text-sm leading-6 text-slate-500">
              Start from the main prompt box. This panel will narrate what the agent is doing.
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} screens={screens} />
          ))}

          <LiveCanvasActivity
            generationRun={generationRun}
            generationRuns={generationRuns}
            screens={screens}
            isQueueing={isQueueing}
            queueError={queueError}
            retryDisabled={retryDisabled}
            screenPlan={screenPlan}
            onRetryGeneration={onRetryGeneration}
          />

          {screenPlan && onBuildPlannedScreen && onCancelPlan ? (
            <PlanCard
              screenPlan={screenPlan}
              isBuilding={isBuilding}
              onBuildPlannedScreen={onBuildPlannedScreen}
              onCancelPlan={onCancelPlan}
            />
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
