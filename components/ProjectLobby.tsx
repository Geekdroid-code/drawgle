"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { motion, type Transition } from "motion/react";
import {
  ArrowUp,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Sparkles,
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
  ImageReferenceMode,
  PlannedUiFlow,
  ProjectData,
  PromptImagePayload,
} from "@/lib/types";

type LobbyStage = "brief" | "design" | "plan";
type ApiErrorPayload = { error?: unknown; details?: unknown };
type BriefStyleId = "auto" | "neo-brutalism" | "glassmorphism" | "playful-whimsical";
type TextShimmerWaveProps = {
  children: string;
  className?: string;
  duration?: number;
  baseColor?: string;
  shimmerColor?: string;
  zDistance?: number;
  xDistance?: number;
  yDistance?: number;
  spread?: number;
  scaleDistance?: number;
  rotateYDistance?: number;
  transition?: Transition;
  style?: CSSProperties;
};

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

const briefStyles: Array<{
  id: BriefStyleId;
  label: string;
  previewClassName: string;
  previewContent: ReactNode;
}> = [
  {
    id: "auto",
    label: "Auto",
    previewClassName: "border-neutral-200 bg-[#f4f3ed]",
    previewContent: <Sparkles className="h-5 w-5 text-neutral-400" />,
  },
  {
    id: "neo-brutalism",
    label: "Neo-Brutalism",
    previewClassName: "border-neutral-200 bg-black",
    previewContent: <span className="text-[18px] font-black tracking-normal text-[#ccff00]">Aa</span>,
  },
  {
    id: "glassmorphism",
    label: "Glassmorphism",
    previewClassName: "border-neutral-200 bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-900",
    previewContent: <span className="font-serif text-[18px] font-medium italic tracking-normal text-white/90">Aa</span>,
  },
  {
    id: "playful-whimsical",
    label: "Playful Whimsical",
    previewClassName: "border-neutral-200 bg-[#ffff80]",
    previewContent: (
      <>
        <span className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full bg-pink-400" />
        <span className="absolute bottom-1 right-2 h-2.5 w-2.5 rounded-full bg-cyan-400" />
        <span className="relative z-10 text-[18px] font-bold tracking-normal text-pink-600">Aa</span>
      </>
    ),
  },
];

const readApiError = (payload: ApiErrorPayload | null | undefined, fallback: string) => {
  if (!payload?.error) {
    return fallback;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.details && typeof payload.details === "object") {
    return fallback;
  }

  return fallback;
};

function TextShimmerWave({
  children,
  className = "",
  duration = 1.4,
  baseColor,
  shimmerColor,
  zDistance = 8,
  xDistance = 1.5,
  yDistance = -1.5,
  spread = 1,
  scaleDistance = 1.08,
  rotateYDistance = 8,
  transition,
  style,
}: TextShimmerWaveProps) {
  return (
    <motion.span
      className={`relative inline-block [perspective:500px] ${className}`}
      style={{
        ...style,
        "--base-color": baseColor ?? "color-mix(in oklab, currentColor 55%, transparent)",
        "--base-gradient-color": shimmerColor ?? "currentColor",
      } as CSSProperties}
    >
      {children.split("").map((char, index) => {
        const delay = (index * duration * (1 / spread)) / children.length;

        return (
          <motion.span
            key={`${char}-${index}`}
            className="inline-block whitespace-pre [transform-style:preserve-3d]"
            initial={{
              translateZ: 0,
              scale: 1,
              rotateY: 0,
              color: "var(--base-color)",
            }}
            animate={{
              translateZ: [0, zDistance, 0],
              translateX: [0, xDistance, 0],
              translateY: [0, yDistance, 0],
              scale: [1, scaleDistance, 1],
              rotateY: [0, rotateYDistance, 0],
              color: [
                "var(--base-color)",
                "var(--base-gradient-color)",
                "var(--base-color)",
              ],
            }}
            transition={{
              duration,
              repeat: Infinity,
              repeatDelay: (children.length * 0.05) / spread,
              delay,
              ease: "easeInOut",
              ...transition,
            }}
          >
            {char}
          </motion.span>
        );
      })}
    </motion.span>
  );
}

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
  const [imageReferenceMode, setImageReferenceMode] = useState<ImageReferenceMode>("recreate");
  const [selectedBriefStyle, setSelectedBriefStyle] = useState<BriefStyleId>("auto");
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
    setImageReferenceMode("recreate");
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
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image,
          imageReferenceMode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ({ projectId?: string } & ApiErrorPayload) | null;

      if (!response.ok || !payload?.projectId) {
        throw new Error(readApiError(payload, "Failed to start the build."));
      }

      router.push(`/project/${payload.projectId}`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Failed to start the build.");
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
          imageReferenceMode,
          designTokens,
        }),
      });

      const payload = (await response.json().catch(() => null)) as PlannedUiFlow | ApiErrorPayload | null;

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(readApiError(payload as ApiErrorPayload | null, "Failed to plan the UI flow."));
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
          imageReferenceMode,
          designTokens,
          plannedScreens: plan.screens,
          requiresBottomNav: plan.requiresBottomNav,
          navigationArchitecture: plan.navigationArchitecture,
          navigationPlan: plan.navigationPlan,
          projectCharter: plan.charter,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ({ projectId?: string } & ApiErrorPayload) | null;

      if (!response.ok || !payload?.projectId) {
        throw new Error(readApiError(payload, "Failed to start the build."));
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
                    <span className="dg-brief-title-active">What Mobile App shall we design Today?</span>
                  </h1>
                

                  <div
                    className={`relative mx-auto mt-7 w-full max-w-[640px] rounded-[24px] bg-[linear-gradient(110deg,#ff9a9e_0%,#fecfef_20%,#e0c3fc_40%,#8ec5fc_60%,#a8edea_80%,#d4fc79_100%)] p-0.5 sm:mt-8 ${isGeneratingDesign ? "dg-brief-generating-shell" : ""}`}
                  >
                    <div className="rounded-[22px] bg-white p-2">
                      <div className="flex items-center justify-between px-2 pb-3 pt-2 text-[11px] font-bold uppercase tracking-normal text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-neutral-700" />
                          <span>Drawgle UI V2.0</span>
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-neutral-800 transition-opacity hover:opacity-70"
                          aria-label="Drawgle Pro"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Pro</span>
                        </button>
                      </div>

                      <div className="relative flex flex-col rounded-2xl border border-neutral-100 bg-[#f4f4f6]">
                        <div className="max-h-[300px] overflow-y-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <Textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            readOnly={isGeneratingDesign}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleGenerateDesign();
                              }
                            }}
                            placeholder="Describe the app UI you want to design... e.g., A minimalist dashboard for a fintech app with dark mode."
                            className="min-h-[110px] resize-none rounded-none border-0 bg-transparent px-4 pb-16 pt-4 text-[15px] leading-relaxed text-neutral-800 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 sm:min-h-[132px]"
                          />
                        </div>

                        {image ? (
                          <div className="absolute bottom-[54px] left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="flex max-w-[160px] cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1 pl-1 pr-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                              aria-label="Remove reference image"
                            >
                              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white">
                                <Image
                                  src={`data:${image.mimeType};base64,${image.data}`}
                                  alt="Reference preview"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </span>
                              <span className="truncate">Reference</span>
                              <X className="h-3.5 w-3.5 shrink-0" />
                            </button>
                            <div className="flex h-9 shrink-0 items-center rounded-xl border border-neutral-200 bg-white p-0.5 text-[11px] font-semibold text-neutral-500 shadow-sm">
                              {([
                                ["recreate", "Image to UI"],
                                ["style", "Style Ref"],
                              ] as const).map(([mode, label]) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setImageReferenceMode(mode)}
                                  className={`h-8 cursor-pointer rounded-[10px] px-2.5 transition ${imageReferenceMode === mode ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}
                                  disabled={isGeneratingDesign}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                            <Button
                              type="button"
                              variant="ghost"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white p-0 text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isGeneratingDesign}
                              aria-label={image ? "Replace reference image" : "Attach reference image"}
                            >
                              <ImagePlus className="h-4 w-4" />
                            </Button>

                            <div className="group relative">
                              <button
                                type="button"
                                className="relative z-20 flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                                disabled={isGeneratingDesign}
                              >
                                <Palette className="h-4 w-4 text-neutral-600" strokeWidth={1.5} />
                                <span>Themes</span>
                                <ChevronDown className="h-3 w-3 text-neutral-400 transition-transform duration-200 group-hover:rotate-180" />
                              </button>

                              <div className="invisible absolute bottom-full left-0 z-[100] mb-2 w-[min(280px,calc(100vw-3rem))] translate-y-1 rounded-[16px] border border-neutral-200 bg-white p-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                                <div className="mb-3 flex items-center justify-between px-1">
                                  <span className="text-[12px] font-semibold text-neutral-800">Design style</span>
                                  <X className="h-3.5 w-3.5 text-neutral-400" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  {briefStyles.map((style) => {
                                    const isSelected = selectedBriefStyle === style.id;

                                    return (
                                      <button
                                        type="button"
                                        key={style.id}
                                        onClick={() => setSelectedBriefStyle(style.id)}
                                        className="flex min-w-0 flex-col gap-1.5 text-left"
                                      >
                                        <span
                                          className={`relative flex h-[60px] items-center justify-center overflow-hidden rounded-xl border ${style.previewClassName} ${isSelected ? "border-[1.5px] border-orange-500" : "hover:border-neutral-400"}`}
                                        >
                                          {style.previewContent}
                                        </span>
                                        <span className={`truncate text-[11px] ${isSelected ? "font-semibold text-neutral-700" : "font-medium text-neutral-600"}`}>
                                          {style.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            className={`z-20 h-9 shrink-0 rounded-xl bg-black p-0 text-white transition-transform hover:bg-neutral-800 active:scale-95 disabled:opacity-75 ${isGeneratingDesign ? "w-[116px] px-3" : "w-9"}`}
                            onClick={() => void handleGenerateDesign()}
                            disabled={!isBriefReady || isGeneratingDesign}
                            aria-label="Generate design system"
                          >
                            {isGeneratingDesign ? (
                              <TextShimmerWave
                                className="text-xs font-semibold"
                                baseColor="rgba(255,255,255,0.58)"
                                shimmerColor="#ffffff"
                                duration={1.1}
                                spread={1.2}
                                zDistance={5}
                                scaleDistance={1.04}
                                rotateYDistance={5}
                              >
                                Creating
                              </TextShimmerWave>
                            ) : (
                              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {isGeneratingDesign ? (
                      <div className="pointer-events-none absolute inset-0 z-10 rounded-[24px] dg-brief-prompt-shimmer" />
                    ) : null}
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
              <section className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 pb-3">
                  <div className="rounded-[18px] border border-slate-950/[0.1] bg-white/96 px-4 py-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.72)] backdrop-blur-xl sm:px-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full dg-control-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Step 3 of 3
                        </div>
                        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">Review, then build.</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                          Confirm the planned screens and project memory before the generation run starts.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <span className="inline-flex items-center gap-2 rounded-full dg-control-muted px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          {describeNavigationArchitecture(plan.navigationArchitecture)}
                        </span>
                        <span className="inline-flex items-center rounded-full dg-control px-3 py-2 text-xs font-semibold text-neutral-700">
                          {plan.screens.length} {plan.screens.length === 1 ? "screen" : "screens"} queued
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <DigestTile label="App type" value={plan.charter.appType} />
                      <DigestTile label="Audience" value={plan.charter.targetAudience} />
                      <DigestTile label="Journey" value={plan.charter.navigationModel} />
                      <DigestTile label="Direction" value={plan.charter.creativeDirection?.conceptName ?? plan.charter.designRationale} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
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

                  <section className="rounded-[18px] border border-slate-950/[0.1] bg-white/96">
                    <div className="border-b border-slate-950/[0.08] px-4 py-4 sm:px-5">
                      <div className="text-sm font-semibold text-neutral-950">Initial screen plan</div>
                      <div className="mt-1 text-sm text-neutral-500">This is the exact screen set Trigger.dev will build from.</div>
                    </div>

                    <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3">
                      {plan.screens.map((screen, index) => (
                        <article key={`${screen.name}-${index}`} className="rounded-[16px] border border-slate-950/[0.08] bg-[#fbfbfc] px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{screen.type}</div>
                              <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">{screen.name}</h2>
                            </div>
                            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full dg-button-primary text-xs font-semibold text-white">
                              {index + 1}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full dg-control-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                              {screen.chromePolicy?.chrome ?? screen.type}
                            </span>
                            {screen.navigationItemId ? (
                              <span className="rounded-full dg-control-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                                {screen.navigationItemId}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600">{screen.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <details className="rounded-[18px] border border-slate-950/[0.1] bg-white/96 lg:hidden">
                    <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-neutral-950">
                      Project memory
                      <span className="ml-2 text-xs font-medium text-neutral-500">Tap to review full context</span>
                    </summary>
                    <div className="border-t border-slate-950/[0.08] bg-[#f7f7f8] px-4 py-4">
                      <ProjectMemory plan={plan} />
                    </div>
                  </details>

                  <section className="hidden rounded-[18px] border border-slate-950/[0.1] bg-white/96 lg:block">
                    <div className="border-b border-slate-950/[0.08] px-5 py-4">
                      <div className="text-sm font-semibold text-neutral-950">Project memory</div>
                      <div className="mt-1 text-sm text-neutral-500">The context used to keep future screens, edits, navigation, and visual direction coherent.</div>
                    </div>
                    <div className="bg-[#f7f7f8] px-5 py-5">
                      <ProjectMemory plan={plan} columns />
                    </div>
                  </section>

                  <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-slate-950/[0.08] bg-white/92 px-4 py-3 shadow-[0_-18px_44px_-34px_rgba(15,23,42,0.8)] backdrop-blur-xl sm:-mx-5 sm:px-5 lg:mx-0 lg:rounded-[18px] lg:border lg:border-slate-950/[0.1]">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row-reverse sm:items-center">
                      <Button className="h-12 flex-1 rounded-full dg-button-primary text-sm font-medium" onClick={() => void handleBuildProject()} disabled={isBuilding}>
                        {isBuilding ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting build...
                          </>
                        ) : (
                          <>
                            Build all screens
                            <ArrowRight className="ml-1.5 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="outline" className="h-12 flex-1 rounded-full dg-control sm:max-w-[240px]" onClick={() => setStage("design")} disabled={isBuilding}>
                        Adjust design system
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DigestTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-slate-950/[0.08] bg-[#fbfbfc] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</div>
      <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-neutral-900">{value}</div>
    </div>
  );
}

function ProjectMemory({ plan, columns = false }: { plan: PlannedUiFlow; columns?: boolean }) {
  return (
    <div className={columns ? "grid gap-4 xl:grid-cols-2" : "space-y-4"}>
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
