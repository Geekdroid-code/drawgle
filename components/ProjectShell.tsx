"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { CanvasArea } from "@/components/CanvasArea";
import { ChatPanel, type ScreenPlanState } from "@/components/ChatPanel";
import { PromptBar } from "@/components/PromptBar";
import { Button } from "@/components/ui/button";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProject } from "@/hooks/use-project";
import { useScreens } from "@/hooks/use-screens";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, insertProjectMessage } from "@/lib/supabase/queries";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  NavigationArchitecture,
  PlannedUiFlow,
  ProjectData,
  PromptImagePayload,
  ScreenPlan,
  ScreenData,
} from "@/lib/types";

const TERMINAL_GENERATION_STATUSES = new Set<GenerationRunData["status"]>([
  "completed",
  "failed",
  "canceled",
]);

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
  navigationArchitecture?: NavigationArchitecture | null;
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
  const { screens, refreshScreens } = useScreens(initialProject.id, initialScreens);
  const { generationRun, generationRuns, refreshGenerationRuns } = useGenerationRuns(initialProject.id, initialGenerationRuns);
  const [fitRequestVersion, setFitRequestVersion] = useState(0);
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [pendingAddScreenRunId, setPendingAddScreenRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [addScreenPlan, setAddScreenPlan] = useState<ScreenPlanState | null>(null);
  const centeredRunIdRef = useRef<string | null>(null);
  const knownScreenIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedScreenIdsRef = useRef(false);
  const addScreenRefreshAttemptedRunIdRef = useRef<string | null>(null);
  const hasQueuedInitialFitRef = useRef(false);
  const planRequestIdRef = useRef(0);
  const isGenerationBusy = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);
  const isCanvasInteractionLocked = isGenerationBusy;

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
    if (screens.length === 0) {
      knownScreenIdsRef.current = new Set();
      return;
    }

    const currentScreenIds = new Set(screens.map((screen) => screen.id));

    if (!hasHydratedScreenIdsRef.current) {
      hasHydratedScreenIdsRef.current = true;
      knownScreenIdsRef.current = currentScreenIds;
      return;
    }

    const hasNewScreen = screens.some((screen) => !knownScreenIdsRef.current.has(screen.id));
    knownScreenIdsRef.current = currentScreenIds;

    if (!hasNewScreen) {
      return;
    }

    setFitRequestVersion((currentVersion) => currentVersion + 1);
  }, [screens]);

  useEffect(() => {
    if (!pendingQueuedRunId) {
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingQueuedRunId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingQueuedRunId(null);
    }
  }, [screens, pendingQueuedRunId]);

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
    if (!pendingAddScreenRunId) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingAddScreenRunId)) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingAddScreenRunId(null);
    }
  }, [screens, pendingAddScreenRunId]);

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

  useEffect(() => {
    if (!pendingAddScreenRunId) {
      return;
    }

    const trackedRun = generationRuns.find((run) => run.id === pendingAddScreenRunId);
    if (!trackedRun || !TERMINAL_GENERATION_STATUSES.has(trackedRun.status)) {
      return;
    }

    if (screens.some((screen) => screen.generationRunId === pendingAddScreenRunId)) {
      addScreenRefreshAttemptedRunIdRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingAddScreenRunId(null);
      return;
    }

    if (addScreenRefreshAttemptedRunIdRef.current === pendingAddScreenRunId) {
      return;
    }

    addScreenRefreshAttemptedRunIdRef.current = pendingAddScreenRunId;

    let cancelled = false;

    void (async () => {
      await refreshScreens();

      if (!cancelled) {
        addScreenRefreshAttemptedRunIdRef.current = null;
        setPendingAddScreenRunId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [generationRuns, pendingAddScreenRunId, refreshScreens, screens]);

  const queueGenerationRequest = async (input: {
    prompt: string;
    image?: PromptImagePayload | null;
    designTokens?: DesignTokens | null;
    sourceGenerationRunId?: string;
    plannedScreens?: ScreenPlan[] | null;
    requiresBottomNav?: boolean;
    navigationArchitecture?: NavigationArchitecture | null;
  }) => {
    if (!project || isGenerationBusy) {
      return false;
    }

    const isPlannedAddScreenRequest = (input.plannedScreens?.length ?? 0) === 1;

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
        navigationArchitecture: input.navigationArchitecture ?? null,
      });

      setPendingQueuedRunId(queuedRun.generationRunId);
      setPendingAddScreenRunId(isPlannedAddScreenRequest ? queuedRun.generationRunId : null);
      addScreenRefreshAttemptedRunIdRef.current = null;
      await refreshGenerationRuns();
      return true;
    } catch (error) {
      if (isPlannedAddScreenRequest) {
        setPendingAddScreenRunId(null);
        addScreenRefreshAttemptedRunIdRef.current = null;
      }

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
        navigationArchitecture: plan.navigationArchitecture,
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
      navigationArchitecture: project.charter?.navigationArchitecture ?? null,
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
      navigationArchitecture: addScreenPlan.navigationArchitecture,
    });

    if (queued) {
      dismissAddScreenPlan();
    }
  };

  const handleDeleteSelectedScreen = async () => {
    if (!selectedScreen) {
      return;
    }

    try {
      const supabase = createClient();
      await deleteScreen(supabase, selectedScreen.id);
      setSelectedScreen(null);
    } catch (error) {
      console.error("Error deleting screen:", error);
    }
  };

  const handlePromptAction = async (options: {
    prompt: string;
    image?: PromptImagePayload | null;
  }) => {
    if (!project || isCanvasInteractionLocked) {
      return false;
    }

    const prompt = options.prompt.trim();
    if (!prompt && !options.image) {
      return false;
    }

    if (selectedScreen) {
      try {
        const editRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            prompt,
            selectedScreenId: selectedScreen.id,
          }),
        });

        if (!editRes.ok) {
          throw new Error("Failed to edit screen");
        }

        if (!editRes.body) {
          throw new Error("No response body");
        }

        const reader = editRes.body.getReader();

        while (true) {
          const { done } = await reader.read();
          if (done) {
            break;
          }
        }

        return true;
      } catch (error) {
        console.error("Edit flow error:", error);

        try {
          const supabase = createClient();
          await insertProjectMessage(supabase, {
            projectId: project.id,
            ownerId: user.id,
            screenId: selectedScreen.id,
            role: "model",
            content: "Sorry, I encountered an error while processing your request.",
            messageType: "error",
          });
        } catch (messageError) {
          console.error("Failed to persist edit error message", messageError);
          return false;
        }

        return true;
      }
    }

    try {
      const supabase = createClient();

      await insertProjectMessage(supabase, {
        projectId: project.id,
        ownerId: user.id,
        role: "user",
        content: prompt,
        messageType: "chat",
      });
    } catch (error) {
      console.error("Failed to persist create prompt", error);
      return false;
    }

    await handlePromptSubmit({
      prompt,
      image: options.image ?? null,
    });

    return true;
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
          <div className="flex items-center p-2 lg:px-4 lg:py-4 h-8 rounded-[20px] surface-container backdrop-blur-glass">
            <Button variant="ghost" size="sm" onClick={() => router.push("/project/new")} className="h-8 rounded-full text-neutral-700 hover:bg-neutral-200 focus-visible:bg-neutral-200 data-[state=open]:bg-neutral-200">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Workspace
            </Button>
            <div className="hidden h-5 w-px bg-black/10 sm:block" />
            <div className="hidden max-w-[240px] truncate pl-2 text-[11px] font-semibold uppercase text-neutral-500 sm:block">
              {project.name}
            </div>
          </div>
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasArea screens={screens} fitRequestVersion={fitRequestVersion} selectedScreen={selectedScreen} onSelectScreen={setSelectedScreen} />

          <ChatPanel
            project={project}
            screens={screens}
            selectedScreen={selectedScreen}
            generationRun={generationRun}
            generationRuns={generationRuns}
            isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
            queueError={queueError}
            retryDisabled={isCanvasInteractionLocked}
            screenPlan={addScreenPlan}
            isBuilding={isQueueingGeneration}
            onRetryGeneration={handleRetryGeneration}
            onBuildPlannedScreen={() => void handleBuildPlannedScreen()}
            onCancelPlan={dismissAddScreenPlan}
          />

          <div className="absolute bottom-4 left-1/2 z-40 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 md:bottom-8">
            <PromptBar
              project={project}
              selectedScreen={selectedScreen}
              onClearSelectedScreen={() => setSelectedScreen(null)}
              onDeleteSelectedScreen={handleDeleteSelectedScreen}
              onSubmit={handlePromptAction}
              disabled={isCanvasInteractionLocked}
              submitStatusText={selectedScreen ? `Editing ${selectedScreen.name}...` : "Planning screen..."}
            />
          </div>
        </div>
      </main>
    </div>
  );
}