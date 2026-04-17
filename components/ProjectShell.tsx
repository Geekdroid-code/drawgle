"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Menu } from "lucide-react";

import { ArtDirectorPanel } from "@/components/ArtDirectorPanel";
import { CanvasArea } from "@/components/CanvasArea";
import { GenerationProgress } from "@/components/GenerationProgress";
import { PromptBar } from "@/components/PromptBar";
import { ScreenEditorPanel } from "@/components/ScreenEditorPanel";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProject } from "@/hooks/use-project";
import { useScreens } from "@/hooks/use-screens";
import { createClient } from "@/lib/supabase/client";
import { updateProjectFields } from "@/lib/supabase/queries";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  ProjectData,
  PromptImagePayload,
  ScreenData,
} from "@/lib/types";

type PendingGenerationOptions = {
  prompt: string;
  image?: PromptImagePayload | null;
};

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

async function enqueueGeneration(input: {
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  designTokens?: DesignTokens | null;
  sourceGenerationRunId?: string;
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
  const [centerTarget, setCenterTarget] = useState<{ x: number; y: number; timestamp: number } | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationOptions | null>(null);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const centeredRunIdRef = useRef<string | null>(null);
  const isGenerationLocked = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);

  useEffect(() => {
    if (!project && !isProjectLoading) {
      router.replace("/");
    }
  }, [project, isProjectLoading, router]);

  useEffect(() => {
    if (!selectedScreen) {
      return;
    }

    const updatedScreen = screens.find((screen) => screen.id === selectedScreen.id);
    if (!updatedScreen) {
      setSelectedScreen(null);
      return;
    }

    if (updatedScreen.updatedAt !== selectedScreen.updatedAt || updatedScreen.code !== selectedScreen.code) {
      setSelectedScreen(updatedScreen);
    }
  }, [screens, selectedScreen]);

  useEffect(() => {
    if (!pendingQueuedRunId) {
      return;
    }

    if (generationRuns.some((run) => run.id === pendingQueuedRunId)) {
      setPendingQueuedRunId(null);
    }
  }, [generationRuns, pendingQueuedRunId]);

  useEffect(() => {
    if (generationRun?.id) {
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

    const firstGeneratedScreen = screens.find((screen) => screen.generationRunId === generationRun.id);
    if (!firstGeneratedScreen) {
      return;
    }

    centeredRunIdRef.current = generationRun.id;
    setCenterTarget({
      x: firstGeneratedScreen.x,
      y: firstGeneratedScreen.y,
      timestamp: Date.now(),
    });
  }, [generationRun?.id, screens]);

  const handleSignOut = async () => {
    try {
      await fetch("/auth/signout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  const queueGenerationRequest = async (input: {
    prompt: string;
    image?: PromptImagePayload | null;
    designTokens?: DesignTokens | null;
    sourceGenerationRunId?: string;
  }) => {
    if (!project || isGenerationLocked) {
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
    needsDesign: boolean;
  }) => {
    if (!project || isGenerationLocked) {
      return;
    }

    const supabase = createClient();

    if (options.needsDesign) {
      setPendingGeneration({ prompt: options.prompt, image: options.image ?? null });
      setQueueError(null);
      await updateProjectFields(supabase, project.id, {
        prompt: options.prompt,
        status: "draft",
      });
      return;
    }

    await queueGenerationRequest({
      prompt: options.prompt,
      image: options.image ?? null,
      designTokens: project.designTokens ?? null,
    });
  };

  const handleGenerationStart = async (designTokens: DesignTokens) => {
    if (!project || isGenerationLocked) {
      return;
    }

    const queuedPrompt = pendingGeneration?.prompt ?? project.prompt;
    if (!queuedPrompt.trim()) {
      return;
    }

    const didQueue = await queueGenerationRequest({
      prompt: queuedPrompt,
      image: pendingGeneration?.image ?? null,
      designTokens,
    });

    if (didQueue) {
      setPendingGeneration(null);
    }
  };

  const handleRetryGeneration = async (run: GenerationRunData) => {
    if (!project || isGenerationLocked) {
      return;
    }

    await queueGenerationRequest({
      prompt: run.prompt,
      designTokens: project.designTokens ?? null,
      sourceGenerationRunId: run.id,
    });
  };

  if (isProjectLoading || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f5] font-sans text-gray-900">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar user={user} onSignOut={handleSignOut} currentProjectId={project.id} />
      </div>

      <main className="relative z-0 flex h-full w-full flex-1 overflow-hidden">
        <div className="absolute left-4 top-4 z-50 flex items-center gap-2 md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="border-gray-200 bg-white/90 shadow-sm backdrop-blur-md" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-r-0 p-0">
              <Sidebar user={user} onSignOut={handleSignOut} currentProjectId={project.id} />
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm" onClick={() => router.push("/")} className="border-gray-200 bg-white/90 shadow-sm backdrop-blur-md">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div className="absolute left-4 top-4 z-50 hidden md:block">
          <Button variant="outline" size="sm" onClick={() => router.push("/")} className="border-gray-200 bg-white/90 shadow-sm backdrop-blur-md">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasArea screens={screens} centerTarget={centerTarget} selectedScreen={selectedScreen} onSelectScreen={setSelectedScreen} />

          <div className="absolute right-4 top-16 z-40 md:right-6 md:top-4">
            <GenerationProgress
              project={project}
              generationRun={generationRun}
              generationRuns={generationRuns}
              screens={screens}
              isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
              queueError={queueError}
              onRetry={handleRetryGeneration}
              retryDisabled={isGenerationLocked}
            />
          </div>

          {!selectedScreen && (
            <div
              className={`absolute bottom-4 left-1/2 z-40 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 md:bottom-8 ${
                project.status === "draft" ? "pointer-events-none translate-y-8 opacity-0" : "translate-y-0 opacity-100"
              }`}
            >
              <PromptBar project={project} onSubmit={handlePromptSubmit} disabled={isGenerationLocked} />
            </div>
          )}

          {selectedScreen && <ScreenEditorPanel screen={selectedScreen} ownerId={user.id} onClose={() => setSelectedScreen(null)} />}

          {project.status === "draft" && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pb-20 md:p-6">
              <ArtDirectorPanel project={project} onGenerationStart={handleGenerationStart} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}