"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  X,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { describeNavigationArchitecture } from "@/lib/navigation";
import type {
  AuthenticatedUser,
  DesignTokens,
  PlannedUiFlow,
  ProjectData,
  PromptImagePayload,
} from "@/lib/types";

type LobbyStage = "brief" | "design" | "plan";

const workspaceSidebarStyles = {
  "--sidebar-width": "20rem",
  "--sidebar": "#ffffff",
  "--sidebar-foreground": "#171717",
  "--sidebar-primary": "#171717",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-accent": "#f7f7f8",
  "--sidebar-accent-foreground": "#171717",
  "--sidebar-border": "rgba(15,23,42,0.09)",
  "--sidebar-ring": "rgba(0,47,167,0.24)",
} as CSSProperties;

export function ProjectLobby({
  initialPrompt = "",
  user,
  initialProjects,
}: {
  initialPrompt?: string;
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
}) {
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

  const handleSignOut = async () => {
    try {
      await fetch("/auth/signout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (signOutError) {
      console.error("Failed to sign out", signOutError);
    }
  };

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

  const handleRemoveImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
          navigationArchitecture: plan.navigationArchitecture,
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
    <SidebarProvider className="h-svh dg-dashed-grid-bg text-neutral-950" style={workspaceSidebarStyles}>
      <AppSidebar user={user} onSignOut={handleSignOut} initialProjects={initialProjects} />

      <SidebarInset className="flex h-svh flex-col overflow-hidden bg-transparent md:m-0 md:rounded-none md:shadow-none">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-950/[0.08] bg-white/84 px-4 backdrop-blur-xl md:px-6">
          <div className="flex flex-1 items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-full border border-black/10 bg-white text-neutral-700 hover:bg-white md:hidden" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Protected workspace</div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-full min-h-0 w-full flex-col px-4 py-4 sm:px-5 lg:px-6">
            {error ? (
              <div className="mb-5 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {stage === "brief" ? (
              <section className="flex min-h-0 flex-1 items-start overflow-y-auto sm:items-center">
                <div className="mx-auto w-full max-w-4xl pb-10 pt-[min(14vh,5.5rem)] sm:py-12">
                 

                  <h1 className="mx-auto mt-2 flex max-w-4xl justify-center text-center text-[clamp(2.45rem,10.5vw,3.75rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-neutral-950 sm:mt-6 sm:text-6xl">
                    What native mobile app shall we design?
                  </h1>
                

                  <div className="mx-auto mt-7 overflow-hidden rounded-lg dg-gradient-ring shadow-[0_18px_42px_-34px_rgba(15,23,42,0.62)] sm:mt-8">
                    <Textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleGenerateDesign();
                        }
                      }}
                      placeholder="Describe the app, the flow, or the exact UI you want recreated..."
                      className="min-h-[168px] resize-none rounded-none border-0 bg-white px-5 py-5 text-[18px] leading-8 text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 sm:min-h-[196px] sm:px-6 sm:py-6 sm:text-[21px]"
                    />

                    <div className="flex items-center justify-between gap-2 border-t border-slate-950/[0.08] bg-[#f5f6f8] px-3 py-2.5 sm:px-4">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-10 rounded-lg border-slate-950/[0.1] bg-white p-0 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] hover:bg-white hover:text-neutral-950"
                          onClick={() => fileInputRef.current?.click()}
                          title={image ? "Replace reference image" : "Attach reference image"}
                        >
                          <ImageIcon className="h-4.5 w-4.5" />
                        </Button>

                        {image ? (
                          <div className="flex min-w-0 max-w-[min(45vw,240px)] items-center gap-2 rounded-lg border border-slate-950/[0.08] bg-white py-1 pl-1 pr-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-950/[0.08] bg-white">
                              <Image
                                src={`data:${image.mimeType};base64,${image.data}`}
                                alt="Reference upload"
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-neutral-900">Reference attached</div>
                              <div className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 sm:block">
                                Prompt aware
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              aria-label="Remove reference image"
                              className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-950"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="hidden rounded-lg border border-slate-950/[0.07] bg-white/70 px-3 py-2 text-xs font-medium text-neutral-500 sm:block">
                            Reference image optional
                          </div>
                        )}
                      </div>

                      <Button
                        className="h-10 shrink-0 rounded-lg dg-button-primary px-4 text-xs font-semibold shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.35),inset_0_7px_12px_rgba(255,255,255,0.1),inset_0_-2px_5px_rgba(0,0,0,0.6),0_10px_20px_-16px_rgba(0,0,0,0.85)] disabled:opacity-60 sm:px-5 sm:text-sm"
                        onClick={() => void handleGenerateDesign()}
                        disabled={!isBriefReady || isGeneratingDesign}
                      >
                        {isGeneratingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate design system"}
                      </Button>
                    </div>
                  </div>

                  
                </div>
              </section>
            ) : null}

            {stage === "design" && designTokens ? (
              <section className="flex min-h-0 flex-1 flex-col gap-3">
            

                <DesignSystemEditor
                  value={designTokens}
                  onChange={setDesignTokens}
                  onSubmit={handlePlanFlow}
                  submitLabel="Save design system & plan screens"
                  isSubmitting={isPlanning}
                  submitStatus="Planning your initial flow..."
                  description="Review the canonical token JSON here, then move straight into the first screen plan."
                />
              </section>
            ) : null}

            {stage === "plan" && plan ? (
              <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
                <aside className="min-h-0 overflow-y-auto">
                  <div className="flex min-h-full flex-col rounded-[18px] border border-slate-950/[0.1] bg-white">
                    <div className="px-4 py-4">
                    <div className="inline-flex items-center gap-2 rounded-full dg-control-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Step 3 of 3
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">Review, then build.</h1>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">This is the exact plan Trigger.dev will build from.</p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-y border-slate-950/[0.08] bg-[#f7f7f8] p-3">
                      <div className="rounded-[14px] border border-slate-950/[0.08] bg-white p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Project charter</div>
                        <p className="mt-2 text-sm leading-6 text-neutral-700">
                          This is the app memory used to keep new screens, edits, navigation, and visual direction coherent.
                        </p>
                      </div>
                      <MetadataBlock label="Original intent" value={plan.charter.originalPrompt} multiline />
                      {plan.charter.imageReferenceSummary ? (
                        <MetadataBlock label="Reference summary" value={plan.charter.imageReferenceSummary} multiline />
                      ) : null}
                      <MetadataBlock label="App type" value={plan.charter.appType} />
                      <MetadataBlock label="Audience" value={plan.charter.targetAudience} />
                      <MetadataBlock label="User journey" value={plan.charter.navigationModel} multiline />
                      <MetadataBlock label="Product direction" value={plan.charter.designRationale} multiline />

                      {plan.charter.creativeDirection ? (
                        <>
                          <MetadataBlock
                            label="Creative direction"
                            value={`${plan.charter.creativeDirection.conceptName}\n${plan.charter.creativeDirection.styleEssence}`}
                            multiline
                          />
                          <MetadataBlock label="Surface language" value={plan.charter.creativeDirection.surfaceLanguage} multiline />
                          <MetadataBlock label="Signature moments" value={plan.charter.creativeDirection.signatureMoments.join(", ")} multiline />
                          <MetadataBlock label="Avoid" value={plan.charter.creativeDirection.avoid.join(", ")} multiline />
                        </>
                      ) : null}

                      {plan.charter.navigationArchitecture?.consistencyRules.length ? (
                        <MetadataBlock label="Consistency rules" value={plan.charter.navigationArchitecture.consistencyRules.join("\n")} multiline />
                      ) : null}
                    </div>

                    <div className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {plan.charter.keyFeatures.map((feature) => (
                        <span key={feature} className="rounded-full dg-control px-3 py-1.5 text-xs font-medium text-neutral-600">
                          {feature}
                        </span>
                      ))}
                      {designTokens?.meta?.recommendedFonts?.map((font) => (
                        <span key={font} className="rounded-full dg-button-primary px-3 py-1.5 text-xs font-medium text-white">
                          {font}
                        </span>
                      ))}
                    </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 border-t border-slate-950/[0.08] bg-white/95 p-3 backdrop-blur">
                      <Button className="h-11 rounded-full dg-button-primary text-sm font-medium" onClick={() => void handleBuildProject()} disabled={isBuilding}>
                        {isBuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Build all screens"}
                        {!isBuilding ? <ArrowRight className="ml-1.5 h-4 w-4" /> : null}
                      </Button>
                      <Button type="button" variant="outline" className="h-11 rounded-full dg-control" onClick={() => setStage("design")} disabled={isBuilding}>
                        Adjust design system
                      </Button>
                    </div>
                  </div>
                </aside>

                <section className="min-h-0 rounded-[18px] border border-slate-950/[0.1] bg-white">
                  <div className="flex shrink-0 flex-col gap-4 border-b border-slate-950/[0.08] px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Initial screen plan</div>
                      <div className="text-sm text-neutral-500">{plan.screens.length} screens queued for the first generation pass.</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full dg-control-muted px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">
                      <LayoutTemplate className="h-3.5 w-3.5" />
                      {describeNavigationArchitecture(plan.navigationArchitecture)}
                    </div>
                  </div>

                  <div className="grid max-h-[calc(100dvh-15rem)] gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
                    {plan.screens.map((screen, index) => (
                      <article key={`${screen.name}-${index}`} className="flex min-h-[260px] flex-col rounded-[16px] border border-slate-950/[0.08] bg-[#fbfbfc] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{screen.type}</div>
                            <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">{screen.name}</h2>
                          </div>
                          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full dg-button-primary text-xs font-semibold text-white">
                            {index + 1}
                          </div>
                        </div>
                        <p className="mt-4 line-clamp-[10] whitespace-pre-line text-sm leading-6 text-neutral-600">{screen.description}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ) : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MetadataBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className={`mt-1 text-sm ${multiline ? "whitespace-pre-line leading-6 text-neutral-700" : "font-medium text-neutral-900"}`}>
        {value}
      </div>
    </div>
  );
}
