"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { AddScreenSidebar } from "@/components/AddScreenSidebar";
import { CanvasArea } from "@/components/CanvasArea";
import { GenerationProgress } from "@/components/GenerationProgress";
import { PromptBar } from "@/components/PromptBar";
import { ScreenEditorPanel } from "@/components/ScreenEditorPanel";
import { Button } from "@/components/ui/button";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProject } from "@/hooks/use-project";
import { useScreens } from "@/hooks/use-screens";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  PlannedUiFlow,
  ProjectData,
  PromptImagePayload,
  ScreenPlan,
  ScreenData,
} from "@/lib/types";

class QueueGenerationError extends Error {
  status: number;
  activeGenerationRunId: string | null;

  constructor(message: string, status: number, activeGenerationRunId?: string | null) {
    super(message);
    this.name = "QueueGenerationError";
    this.status = status;
    this.activeGenerationRunId = activeGenerationRunId ?? null;
  }
}

type AddScreenPlanState =
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

class ScreenPlanningError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ScreenPlanningError";
    this.status = status;
  }
}

async function enqueueGeneration(input: {
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  sourceGenerationRunId?: string;
  plannedScreens?: ScreenPlan[] | null;
  requiresBottomNav?: boolean;
}) {
  const response = await fetch("/api/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new QueueGenerationError(payload.error ?? "Failed to queue generation.", response.status, payload.activeGenerationRunId);
  }

  return payload as { projectId: string; generationRunId: string; triggerRunId: string };
}

async function planSingleScreen(input: {
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
}) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: input.projectId,
      prompt: input.prompt,
      image: input.image ?? null,
      designTokens: input.designTokens ?? null,
      planningMode: "single-screen",
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ScreenPlanningError(payload.error ?? "Failed to plan screen.", response.status);
  }

  return payload as PlannedUiFlow;
}

export function ProjectShell({
  user,
  initialProject,
  initialScreens,
  initialGenerationRuns,
}: {
  user: AuthenticatedUser;
  initialProject: ProjectData;
  initialScreens: ScreenData[];
  initialGenerationRuns: GenerationRunData[];
}) {
  const router = useRouter();
  const { project, isLoading: isProjectLoading } = useProject(initialProject.id, initialProject);
  const { screens } = useScreens(initialProject.id, initialScreens);
  const { generationRun, generationRuns, refreshGenerationRuns } = useGenerationRuns(initialProject.id, initialGenerationRuns);
  const [fitRequestVersion, setFitRequestVersion] = useState(0);
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [addScreenPlan, setAddScreenPlan] = useState<AddScreenPlanState | null>(null);
  const centeredRunIdRef = useRef<string | null>(null);
  const hasQueuedInitialFitRef = useRef(false);
  const planRequestIdRef = useRef(0);
  const isGenerationBusy = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);
  const isCanvasInteractionLocked = isGenerationBusy || Boolean(addScreenPlan);

  useEffect(() => {
    if (!project && !isProjectLoading) {
      router.replace("/project/new");
    }
  }, [project, isProjectLoading, router]);

  useEffect(() => {
    if (!selectedScreen) {
      return;
    }

    const updatedScreen = screens.find((screen) => screen.id === selectedScreen.id);
    if (!updatedScreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedScreen(null);
      return;
    }

    if (
      updatedScreen.updatedAt !== selectedScreen.updatedAt ||
      updatedScreen.code !== selectedScreen.code ||
      updatedScreen.x !== selectedScreen.x ||
      updatedScreen.y !== selectedScreen.y
    ) {
      setSelectedScreen(updatedScreen);
    }
  }, [screens, selectedScreen]);

  useEffect(() => {
    if (screens.length === 0 || hasQueuedInitialFitRef.current) {
      return;
    }

    hasQueuedInitialFitRef.current = true;
    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [screens.length]);

  useEffect(() => {
    if (!pendingQueuedRunId) {
      return;
    }

    if (generationRuns.some((run) => run.id === pendingQueuedRunId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingQueuedRunId(null);
    }
  }, [generationRuns, pendingQueuedRunId]);

  useEffect(() => {
    if (generationRun?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueueError(null);
    }
  }, [generationRun?.id]);

  useEffect(() => {
    if (!generationRun?.id) {
      centeredRunIdRef.current = null;
      return;
    }

    if (centeredRunIdRef.current === generationRun.id) {
      return;
    }

    const hasGeneratedScreens = screens.some((screen) => screen.generationRunId === generationRun.id);
    if (!hasGeneratedScreens) {
      return;
    }

    centeredRunIdRef.current = generationRun.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [generationRun?.id, screens]);

  const queueGenerationRequest = async (input: {
    prompt: string;
    image?: PromptImagePayload | null;
    designTokens?: DesignTokens | null;
    sourceGenerationRunId?: string;
    plannedScreens?: ScreenPlan[] | null;
    requiresBottomNav?: boolean;
  }) => {
    if (!project || isGenerationBusy) {
      return false;
    }

    setQueueError(null);
    setIsQueueingGeneration(true);

    try {
      const queuedRun = await enqueueGeneration({
        projectId: project.id,
        prompt: input.prompt,
        image: input.image ?? null,
        designTokens: input.designTokens ?? null,
        sourceGenerationRunId: input.sourceGenerationRunId,
        plannedScreens: input.plannedScreens ?? null,
        requiresBottomNav: input.requiresBottomNav,
      });

      setPendingQueuedRunId(queuedRun.generationRunId);
      await refreshGenerationRuns();
      return true;
    } catch (error) {
      await refreshGenerationRuns();

      if (error instanceof QueueGenerationError && error.status === 409) {
        setQueueError("A generation is already queued or building for this project.");
        if (error.activeGenerationRunId) {
          setPendingQueuedRunId(error.activeGenerationRunId);
        }
      } else {
        setQueueError(error instanceof Error ? error.message : "Failed to queue generation.");
      }

      return false;
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handlePromptSubmit = async (options: {
    prompt: string;
    image?: PromptImagePayload | null;
  }) => {
    if (!project || isCanvasInteractionLocked) {
      return false;
    }

    setQueueError(null);

    const requestId = ++planRequestIdRef.current;
    setAddScreenPlan({
      status: "planning",
      prompt: options.prompt,
      image: options.image ?? null,
    });

    try {
      const plan = await planSingleScreen({
        projectId: project.id,
        prompt: options.prompt,
        image: options.image ?? null,
        designTokens: project.designTokens ?? null,
      });

      if (requestId !== planRequestIdRef.current) {
        return false;
      }

      const screenPlan = plan.screens[0];
      if (!screenPlan) {
        throw new Error("The planner did not return a screen brief.");
      }

      setAddScreenPlan({
        status: "ready",
        prompt: options.prompt,
        image: options.image ?? null,
        screenPlan,
        requiresBottomNav: plan.requiresBottomNav,
      });

      return true;
    } catch (error) {
      if (requestId !== planRequestIdRef.current) {
        return false;
      }

      setAddScreenPlan({
        status: "error",
        prompt: options.prompt,
        image: options.image ?? null,
        error: error instanceof Error ? error.message : "Failed to plan the next screen.",
      });

      return false;
    }
  };

  const handleRetryGeneration = async (run: GenerationRunData) => {
    if (!project || isCanvasInteractionLocked) {
      return;
    }

    await queueGenerationRequest({
      prompt: run.prompt,
      designTokens: project.designTokens ?? null,
      sourceGenerationRunId: run.id,
    });
  };

  const dismissAddScreenPlan = () => {
    planRequestIdRef.current += 1;
    setAddScreenPlan(null);
  };

  const handleBuildPlannedScreen = async () => {
    if (!project || !addScreenPlan || addScreenPlan.status !== "ready") {
      return;
    }

    const queued = await queueGenerationRequest({
      prompt: addScreenPlan.prompt,
      image: addScreenPlan.image,
      designTokens: project.designTokens ?? null,
      plannedScreens: [addScreenPlan.screenPlan],
      requiresBottomNav: addScreenPlan.requiresBottomNav,
    });

    if (queued) {
      dismissAddScreenPlan();
    }
  };

  if (isProjectLoading || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f4f1ea] text-gray-900">
      <main className="relative z-0 flex h-full w-full overflow-hidden">
        <div className="absolute left-4 right-4 top-4 z-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2 py-2 backdrop-blur-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push("/project/new")} className="h-8 rounded-full px-3 text-neutral-700 hover:text-neutral-950">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Workspace
            </Button>
            <div className="hidden h-5 w-px bg-black/10 sm:block" />
            <div className="hidden max-w-[240px] truncate pr-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 sm:block">
              {project.name}
            </div>
          </div>
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasArea screens={screens} fitRequestVersion={fitRequestVersion} selectedScreen={selectedScreen} onSelectScreen={setSelectedScreen} />

          <div className="absolute right-4 hidden md:block z-40 md:right-6 md:bottom-4">
            <GenerationProgress
              project={project}
              generationRun={generationRun}
              generationRuns={generationRuns}
              screens={screens}
              isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
              queueError={queueError}
              onRetry={handleRetryGeneration}
              retryDisabled={isCanvasInteractionLocked}
            />
          </div>

          {!selectedScreen && (
            <div className="absolute bottom-4 left-1/2 z-40 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 md:bottom-8">
              <PromptBar
                project={project}
                onSubmit={handlePromptSubmit}
                disabled={isCanvasInteractionLocked}
                submitStatusText="Planning screen..."
              />
            </div>
          )}

          <AddScreenSidebar
            open={Boolean(addScreenPlan)}
            projectName={project.name}
            prompt={addScreenPlan?.prompt ?? ""}
            image={addScreenPlan?.image ?? null}
            screenPlan={addScreenPlan?.status === "ready" ? addScreenPlan.screenPlan : null}
            requiresBottomNav={addScreenPlan?.status === "ready" ? addScreenPlan.requiresBottomNav : false}
            isPlanning={addScreenPlan?.status === "planning"}
            isBuilding={isQueueingGeneration}
            error={addScreenPlan?.status === "error" ? addScreenPlan.error : null}
            onCancel={dismissAddScreenPlan}
            onBuild={() => void handleBuildPlannedScreen()}
          />

          {selectedScreen && <ScreenEditorPanel screen={selectedScreen} ownerId={user.id} onClose={() => setSelectedScreen(null)} />}
        </div>
      </main>
    </div>
  );
}