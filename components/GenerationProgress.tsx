"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isTerminalGenerationStatus, type GenerationRunData, type ProjectData, type ScreenData } from "@/lib/types";

const statusLabels: Record<GenerationRunData["status"], string> = {
  queued: "Queued in Trigger.dev",
  planning: "Planning screens",
  building: "Building screens",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

export function GenerationProgress({
  project,
  generationRun,
  generationRuns,
  screens,
  isQueueing = false,
  queueError,
  onRetry,
  retryDisabled = false,
  embedded = false,
}: {
  project: ProjectData;
  generationRun: GenerationRunData | null;
  generationRuns: GenerationRunData[];
  screens: ScreenData[];
  isQueueing?: boolean;
  queueError?: string | null;
  onRetry?: (run: GenerationRunData) => void;
  retryDisabled?: boolean;
  embedded?: boolean;
}) {
  const terminalRuns = generationRuns.filter((run) => isTerminalGenerationStatus(run.status)).slice(0, 4);

  if (!generationRun && !isQueueing && !queueError && terminalRuns.length === 0) {
    return null;
  }

  const getRunStats = (run: GenerationRunData) => {
    const runScreens = screens.filter((screen) => screen.generationRunId === run.id);

    return {
      totalScreens: run.requestedScreenCount ?? runScreens.length,
      readyScreens: runScreens.filter((screen) => screen.status === "ready").length,
      failedScreens: runScreens.filter((screen) => screen.status === "failed").length,
      buildingScreens: runScreens.filter((screen) => screen.status === "building").length,
    };
  };

  const activeStats = generationRun ? getRunStats(generationRun) : null;

  return (
    <div className={embedded ? "w-full rounded-2xl border border-black/10 bg-white/90 p-4 shadow-sm" : "w-80 p-2 lg:px-4 lg:py-4 rounded-[20px] surface-container backdrop-blur-glass"}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-gray-500" />
            Generation Activity
          </div>
          <p className="text-xs text-gray-500">{project.name}</p>
        </div>
        {isQueueing || generationRun?.status === "queued" || generationRun?.status === "planning" || generationRun?.status === "building" ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        ) : generationRun?.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        )}
      </div>

      <div className="space-y-3 text-sm text-gray-700">
        {queueError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{queueError}</div>
        ) : null}

        {isQueueing || generationRun ? (
          <div className="space-y-2 rounded-xl bg-gray-50 px-3 py-3">
            <div className="font-medium text-gray-900">{isQueueing && !generationRun ? "Queueing generation" : statusLabels[generationRun?.status ?? "queued"]}</div>
            <div className="text-xs text-gray-500">
              {generationRun?.error ? generationRun.error : "Waiting for the next persisted status update from the background run."}
            </div>

            {activeStats ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-primary px-2 py-2">
                    <div className="font-semibold text-gray-900">{activeStats.totalScreens}</div>
                    <div className="text-gray-500">Total</div>
                  </div>
                  <div className="rounded-xl bg-green-50 px-2 py-2">
                    <div className="font-semibold text-green-700">{activeStats.readyScreens}</div>
                    <div className="text-green-600">Ready</div>
                  </div>
                  <div className="rounded-xl bg-red-50 px-2 py-2">
                    <div className="font-semibold text-red-700">{activeStats.failedScreens}</div>
                    <div className="text-red-600">Failed</div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600">
                  {activeStats.buildingScreens > 0 ? `${activeStats.buildingScreens} screen(s) are still being built.` : "Waiting for the next persisted status update."}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {terminalRuns.length > 0 ? (
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Recent Results</div>
            {terminalRuns.map((run) => {
              const stats = getRunStats(run);
              const retryLabel = run.status === "completed" ? "Run again" : "Retry";
              const updatedLabel = formatDistanceToNow(new Date(run.completedAt ?? run.updatedAt), { addSuffix: true });

              return (
                <div key={run.id} className="rounded-xl border border-gray-100 bg-white px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {run.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        ) : run.status === "failed" ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-gray-500" />
                        )}
                        <div className="text-sm font-medium text-gray-900">{statusLabels[run.status]}</div>
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500">{run.prompt}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span>{updatedLabel}</span>
                        <span>{stats.readyScreens}/{stats.totalScreens} ready</span>
                        {stats.failedScreens > 0 ? <span>{stats.failedScreens} failed</span> : null}
                      </div>
                      {run.error ? <div className="mt-2 text-xs text-red-600">{run.error}</div> : null}
                    </div>
                    <Button variant="outline" size="xs" onClick={() => onRetry?.(run)} disabled={retryDisabled}>
                      {retryLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}