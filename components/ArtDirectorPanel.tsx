"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/client";
import { updateProjectFields } from "@/lib/supabase/queries";
import type { DesignTokens, ProjectData, PromptImagePayload } from "@/lib/types";

interface ArtDirectorPanelProps {
  project: ProjectData;
  draftImage?: PromptImagePayload | null;
  onGenerationStart: (designTokens: DesignTokens) => Promise<void>;
}

const getApprovedProjectTokens = (designTokens: ProjectData["designTokens"]) => (
  hasApprovedDesignTokens(designTokens)
    ? normalizeDesignTokens(designTokens)
    : null
);

export function ArtDirectorPanel({ project, draftImage = null, onGenerationStart }: ArtDirectorPanelProps) {
  const [tokens, setTokens] = useState<DesignTokens | null>(() => getApprovedProjectTokens(project.designTokens));
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [designError, setDesignError] = useState<string | null>(null);
  const isFetchingDesignRef = useRef(false);
  const tokensRef = useRef(tokens);

  useEffect(() => {
    const nextTokens = getApprovedProjectTokens(project.designTokens);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens(nextTokens);
    setDesignError(nextTokens || project.prompt?.trim()
      ? null
      : "Add a project brief before generating a design system.");
  }, [project.designTokens, project.id, project.prompt]);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  const fetchDesign = useCallback(async (signal?: AbortSignal) => {
    if (!project.prompt?.trim()) {
      setDesignError("Add a project brief before generating a design system.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setLoadingText("Analyzing your design brief...");
    setDesignError(null);

    try {
      const response = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: project.prompt, image: draftImage }),
        signal,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to generate design tokens.");
      }

      const nextTokens = normalizeDesignTokens(payload as DesignTokens);

      if (!hasApprovedDesignTokens(nextTokens)) {
        throw new Error("Design generation returned an empty or unusable mobile_universal_core token set.");
      }

      setTokens(nextTokens);
      await updateProjectFields(supabase, project.id, { designTokens: nextTokens });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }

      console.error("Failed to fetch design", error);
      setTokens(null);
      setDesignError(error instanceof Error ? error.message : "Failed to generate design tokens.");
    } finally {
      isFetchingDesignRef.current = false;
      setIsLoading(false);
    }
  }, [draftImage, project.id, project.prompt]);

  useEffect(() => {
    if (tokensRef.current || !project.prompt || isFetchingDesignRef.current) {
      return;
    }

    isFetchingDesignRef.current = true;
    const controller = new AbortController();

    void fetchDesign(controller.signal);

    return () => {
      controller.abort();
      isFetchingDesignRef.current = false;
    };
  }, [draftImage, fetchDesign, project.id, project.prompt]);

  const handleBuild = async () => {
    if (!tokens) {
      return;
    }

    setIsStarting(true);
    setLoadingText("Provisioning agents...");

    try {
      const supabase = createClient();
      await updateProjectFields(supabase, project.id, {
        designTokens: tokens,
        status: "active",
      });

      await onGenerationStart(tokens);
    } catch (error) {
      console.error(error);
      setIsStarting(false);
    }
  };

  if (isLoading || isStarting) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
        <div className="w-full max-w-xs space-y-4 rounded-xl border border-gray-100 bg-white p-6 text-center shadow-lg">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-900" />
          <p className="text-sm font-medium text-gray-700">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="absolute inset-0 z-50 overflow-hidden bg-white md:bg-gray-50/80 md:p-6 md:backdrop-blur-sm">
        <div className="absolute inset-0 overflow-auto md:relative md:mx-auto md:max-w-3xl md:overflow-visible">
          <div className="flex min-h-full items-center justify-center p-6 md:min-h-[720px]">
            <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Design System</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Approved design tokens required</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {designError ?? "Generate a mobile_universal_core design system before building screens."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => {
                  if (isFetchingDesignRef.current) {
                    return;
                  }

                  isFetchingDesignRef.current = true;
                  void fetchDesign();
                }} disabled={isLoading || !project.prompt?.trim()}>
                  {isLoading ? "Generating..." : "Retry design analysis"}
                </Button>
                {!project.prompt?.trim() ? (
                  <span className="self-center text-xs text-slate-500">Add a prompt first, then retry.</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-white md:bg-gray-50/80 md:p-6 md:backdrop-blur-sm">
      <div className="absolute inset-0 overflow-auto md:relative md:mx-auto md:max-w-6xl md:overflow-visible">
        <DesignSystemEditor
          value={tokens}
          onChange={setTokens}
          onSubmit={handleBuild}
          title="Design System"
          description="Review the live token system before generating screens. This editor preserves the AI-selected values instead of snapping them into presets."
          submitLabel="Save & Build"
          isSubmitting={isStarting}
          submitStatus={loadingText}
        />
      </div>
    </div>
  );
}