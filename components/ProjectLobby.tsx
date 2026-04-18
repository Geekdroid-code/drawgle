"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DesignTokens, PlannedUiFlow, PromptImagePayload } from "@/lib/types";

const EXAMPLE_PROMPTS = [
  "A wealth-tracking app for couples with shared goals and calm charts",
  "Recreate this uploaded mobile UI as a polished production-ready screen",
  "A restaurant ordering app with loyalty, saved carts, and order tracking",
  "A study planner for competitive exams with streaks, mock tests, and revision boards",
];

type LobbyStage = "brief" | "design" | "plan";

export function ProjectLobby({ initialPrompt = "" }: { initialPrompt?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<LobbyStage>("brief");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const [designTokens, setDesignTokens] = useState<DesignTokens | null>(null);
  const [plan, setPlan] = useState<PlannedUiFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  const isBriefReady = Boolean(prompt.trim() || image);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setImage({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateDesign = async () => {
    if (!isBriefReady || isGeneratingDesign) {
      return;
    }

    setError(null);
    setIsGeneratingDesign(true);

    try {
      const response = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image,
        }),
      });

      const payload = (await response.json().catch(() => null)) as DesignTokens | { error?: string } | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Failed to generate design tokens.");
      }

      setDesignTokens(payload as DesignTokens);
      setStage("design");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Failed to generate design tokens.");
    } finally {
      setIsGeneratingDesign(false);
    }
  };

  const handlePlanFlow = async () => {
    if (!designTokens || isPlanning) {
      return;
    }

    setError(null);
    setIsPlanning(true);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image,
          designTokens,
        }),
      });

      const payload = (await response.json().catch(() => null)) as PlannedUiFlow | { error?: string } | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Failed to plan the UI flow.");
      }

      setPlan(payload as PlannedUiFlow);
      setStage("plan");
    } catch (planningError) {
      setError(planningError instanceof Error ? planningError.message : "Failed to plan the UI flow.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleBuildProject = async () => {
    if (!designTokens || !plan || isBuilding) {
      return;
    }

    setError(null);
    setIsBuilding(true);

    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image,
          designTokens,
          plannedScreens: plan.screens,
          requiresBottomNav: plan.requiresBottomNav,
          projectCharter: plan.charter,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { projectId?: string; error?: string } | null;

      if (!response.ok || !payload?.projectId) {
        throw new Error(payload?.error ?? "Failed to start the build.");
      }

      router.push(`/project/${payload.projectId}`);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Failed to start the build.");
      setIsBuilding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_36%,#eef2ff_100%)] text-slate-950">
      <div className="dot-pattern min-h-screen">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white/90 px-4 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-black/20 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur md:inline-flex">
              Project Lobby
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Setup once, build cleanly
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16">
          {error ? (
            <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          ) : null}

          {stage === "brief" ? (
            <div className="grid min-h-[calc(100vh-140px)] items-center gap-10 py-8 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="mx-auto w-full max-w-3xl lg:mx-0">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Step 1 of 3
                </div>
                <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
                  Start with the product brief, not the canvas.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Upload a reference image, describe the product in plain language, and let Drawgle lock the project memory,
                  design system, and initial screen plan before anything is generated.
                </p>

                <div className="mt-8 rounded-[32px] border border-black/10 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
                  {image ? (
                    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-black/10 bg-slate-50 p-3">
                      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-black/10 bg-white">
                        <Image
                          src={`data:${image.mimeType};base64,${image.data}`}
                          alt="Reference upload"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900">Reference image attached</div>
                        <div className="mt-1 text-sm text-slate-500">This image will shape the design system and first planning pass.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 transition hover:text-slate-950"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleGenerateDesign();
                      }
                    }}
                    placeholder="Describe the app, feature flow, or say 'recreate this uploaded UI screen as shown'..."
                    className="min-h-[220px] resize-none border-0 bg-transparent px-2 py-3 text-lg leading-8 shadow-none focus-visible:ring-0 sm:text-xl"
                  />

                  <div className="mt-2 flex flex-col gap-3 border-t border-black/5 px-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                      <Button type="button" variant="outline" className="rounded-full border-black/10 bg-white text-slate-700" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Upload reference
                      </Button>
                      <div className="inline-flex items-center rounded-full border border-black/10 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                        Mobile app first
                      </div>
                    </div>

                    <Button className="h-11 rounded-full px-5 text-sm font-medium" onClick={() => void handleGenerateDesign()} disabled={!isBriefReady || isGeneratingDesign}>
                      {isGeneratingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate design system"}
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setPrompt(example)}
                      className="rounded-full border border-black/10 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:border-black/20 hover:text-slate-950"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-4">
                {[
                  {
                    title: "Project charter",
                    description: "Persist the app type, target audience, navigation model, and durable product intent before the first screen is built.",
                  },
                  {
                    title: "Design system",
                    description: "Review colors, typography, spacing, corners, and elevation one time instead of bouncing back out of the canvas later.",
                  },
                  {
                    title: "Reviewed plan",
                    description: "See the initial screen briefs before Trigger.dev starts building, so the first run reflects an approved plan.",
                  },
                ].map((item, index) => (
                  <div key={item.title} className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                ))}
              </section>
            </div>
          ) : null}

          {stage === "design" && designTokens ? (
            <div className="space-y-6 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur">
                    <Sparkles className="h-3.5 w-3.5" />
                    Step 2 of 3
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">Refine the design system before planning.</h1>
                </div>

                <Button type="button" variant="outline" className="rounded-full border-black/10 bg-white/80" onClick={() => setStage("brief")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to brief
                </Button>
              </div>

              <DesignSystemEditor
                value={designTokens}
                onChange={setDesignTokens}
                onSubmit={handlePlanFlow}
                submitLabel="Save Design System & Plan Screens"
                isSubmitting={isPlanning}
                submitStatus="Planning your initial flow..."
                description="These tokens become the visual contract for the first build and future generations."
              />
            </div>
          ) : null}

          {stage === "plan" && plan ? (
            <div className="grid gap-6 py-4 lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <div className="rounded-[28px] border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Step 3 of 3
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Review the plan, then build.</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This plan is what Trigger.dev will build from. No hidden re-planning after you approve it.
                  </p>

                  <div className="mt-5 space-y-4 rounded-2xl border border-black/10 bg-slate-50 p-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">App type</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{plan.charter.appType}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Audience</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{plan.charter.targetAudience}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{plan.charter.navigationModel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Design rationale</div>
                      <div className="mt-1 text-sm leading-6 text-slate-700">{plan.charter.designRationale}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {plan.charter.keyFeatures.map((feature) => (
                      <span key={feature} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <Button className="h-11 rounded-full text-sm font-medium" onClick={() => void handleBuildProject()} disabled={isBuilding}>
                      {isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Build all screens"}
                      {!isBuilding ? <ArrowRight className="ml-1.5 h-4 w-4" /> : null}
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-full border-black/10 bg-white" onClick={() => setStage("design")} disabled={isBuilding}>
                      Adjust design system
                    </Button>
                  </div>
                </div>
              </aside>

              <section className="space-y-4">
                <div className="flex items-center justify-between rounded-[28px] border border-black/10 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">Initial screen plan</div>
                    <div className="text-sm text-slate-500">{plan.screens.length} screens queued for the first generation pass.</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    {plan.requiresBottomNav ? "Bottom nav flow" : "Single-flow layout"}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {plan.screens.map((screen, index) => (
                    <article key={`${screen.name}-${index}`} className="rounded-[28px] border border-black/10 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{screen.type}</div>
                          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{screen.name}</h2>
                        </div>
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold text-white">
                          {index + 1}
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">{screen.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}