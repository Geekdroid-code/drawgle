"use client";

import { formatDistanceToNow } from "date-fns";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProjectMessages } from "@/hooks/use-project-messages";
import type { GenerationRunData, ProjectData, ProjectMessage, PromptImagePayload, ScreenData, ScreenPlan } from "@/lib/types";

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

  const { screenPlan: plan, image, requiresBottomNav } = screenPlan;

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
          {requiresBottomNav && plan.type === "root" ? "Bottom nav aware" : "Single screen build"}
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
}) {
  const { messages, isLoading } = useProjectMessages(project.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [messages, screenPlan, generationRun?.id, generationRun?.status, isQueueing, queueError]);

  return (
    <div
      className={`absolute z-50 flex flex-col overflow-hidden transition-all duration-300
        md:left-4 md:bottom-4 md:h-[calc(100vh-5rem)] md:w-96 md:rounded-2xl md:border md:border-black/[0.06]
        bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t border-black/[0.06]
        surface-container backdrop-blur-glass
      `}
    >
      <div className="h-14 shrink-0 border-b border-black/[0.05] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{project.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Agent history</div>
          </div>
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
