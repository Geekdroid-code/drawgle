"use client";

import { useState } from "react";
import { Eye, Lock } from "lucide-react";

import { CanvasStage } from "@/components/CanvasArea";
import { DrawgleLogo } from "@/components/DrawgleLogo";
import type { ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";
import type { CanvasTool } from "@/lib/canvas-interactions";

export function PublicPreviewShell({
  project,
  screens,
  projectNavigation,
}: {
  project: ProjectData;
  screens: ScreenData[];
  projectNavigation: ProjectNavigationData | null;
}) {
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pointer");
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);

  return (
    <div className="h-dvh min-h-0 overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)]">
      <main className="relative z-0 flex h-full w-full overflow-hidden">
        <div
          data-canvas-obstacle="top"
          className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center justify-between gap-3"
        >
          <div className="flex h-9 min-w-0 items-center gap-2 rounded-full dg-panel px-2.5 backdrop-blur-xl sm:px-3">
            <DrawgleLogo className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-none text-[var(--dg-text)]">
                {project.name}
              </div>
            </div>
          </div>
          <div className="flex h-9 shrink-0 items-center gap-2 rounded-full dg-panel px-3 text-xs font-semibold text-[var(--dg-text-muted)] backdrop-blur-xl">
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Read-only preview</span>
            <Eye className="h-3.5 w-3.5 sm:hidden" />
          </div>
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <CanvasStage
            screens={screens}
            projectNavigation={projectNavigation}
            designTokens={project.designTokens ?? null}
            selectedScreen={selectedScreen}
            tool={canvasTool}
            readOnly
            onToolChange={setCanvasTool}
            onSelectScreen={setSelectedScreen}
            onCanvasClick={() => setSelectedScreen(null)}
            selectedElementScreenId={null}
            selectedElementDrawgleId={null}
            selectedElementPreview={null}
            hasSelectedElement={false}
            selectedElementCanEditText={false}
            selectedElementCanEditDesign={false}
          />
        </div>
      </main>
    </div>
  );
}
