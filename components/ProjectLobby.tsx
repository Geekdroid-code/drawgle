"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { motion, type Transition, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Sparkles,
  X,
  Check,
} from "lucide-react";

import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCredits } from "@/hooks/useCredits";
import { PricingDialog } from "@/components/PricingDialog";
import { DESIGN_STYLE_AUTO_ID, DESIGN_STYLE_OPTIONS, type DesignStyleOptionId } from "@/lib/generation/design-styles";
import { describeNavigationArchitecture } from "@/lib/navigation";
import { cn } from "@/lib/utils";
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

const briefStyles: Array<{
  id: DesignStyleOptionId;
  label: string;
  previewClassName: string;
  previewContent: ReactNode;
}> = DESIGN_STYLE_OPTIONS.map((style) => {
  const previews: Record<DesignStyleOptionId, { previewClassName: string; previewContent: ReactNode }> = {
    auto: {
    previewClassName: "border-neutral-200 bg-[#f4f3ed]",
    previewContent: <Sparkles className="h-5 w-5 text-neutral-400" />,
    },
    "modern-light": {
      previewClassName: "border-neutral-200 bg-[#f8fafc]",
      previewContent: <span className="rounded-full bg-[#111827] px-3 py-1 text-[17px] font-black tracking-normal text-white">Aa</span>,
    },
    "modern-dark": {
      previewClassName: "border-neutral-800 bg-[#090b10]",
      previewContent: <span className="text-[18px] font-extrabold tracking-normal text-[#8ab4ff]">Aa</span>,
    },
    "editorial-minimal": {
      previewClassName: "border-[#e5ded4] bg-[#fbfaf7]",
      previewContent: <span className="font-serif text-[19px] font-semibold tracking-normal text-[#151412]">Aa</span>,
    },
    "soft-clay": {
      previewClassName: "border-[#ead8c8] bg-[#fff4e7] shadow-[inset_4px_4px_10px_rgba(121,87,56,0.12)]",
      previewContent: <span className="text-[18px] font-black tracking-normal text-[#f59a5f]">Aa</span>,
    },
    "neo-brutal": {
    previewClassName: "border-neutral-200 bg-black",
    previewContent: <span className="text-[18px] font-black tracking-normal text-[#ccff00]">Aa</span>,
    },
    "luxury-quiet": {
      previewClassName: "border-[#373127] bg-[#10100f]",
      previewContent: <span className="font-serif text-[20px] font-semibold tracking-normal text-[#d6b56d]">Aa</span>,
    },
    "cyberpunk-command": {
      previewClassName: "border-[#16313b] bg-[#030608] shadow-[inset_0_0_18px_rgba(32,247,255,0.18)]",
      previewContent: <span className="text-[18px] font-black tracking-normal text-[#20f7ff]">AA</span>,
    },
    "glass-utility": {
      previewClassName: "border-white/80 bg-gradient-to-br from-[#eef5ff] via-[#dfeaff] to-[#c5d7ff]",
      previewContent: <span className="rounded-full border border-white/80 bg-white/60 px-3 py-1 text-[17px] font-bold tracking-normal text-[#4f46e5] shadow-sm">Aa</span>,
    },
    "playful-whimsical": {
      previewClassName: "border-neutral-200 bg-[#ffff80]",
      previewContent: (
        <>
          <span className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full bg-pink-400" />
          <span className="absolute bottom-1 right-2 h-2.5 w-2.5 rounded-full bg-cyan-400" />
          <span className="relative z-10 text-[18px] font-bold tracking-normal text-pink-600">Aa</span>
        </>
      ),
    },
    "data-command": {
      previewClassName: "border-[#dfe5ee] bg-[#ffffff]",
      previewContent: (
        <>
          <span className="absolute left-2 top-2 h-2 w-8 rounded-full bg-[#155eef]" />
          <span className="absolute bottom-2 left-2 h-5 w-2 rounded-sm bg-[#12b76a]" />
          <span className="absolute bottom-2 left-5 h-8 w-2 rounded-sm bg-[#155eef]" />
          <span className="absolute bottom-2 left-8 h-4 w-2 rounded-sm bg-[#8d98a8]" />
          <span className="relative z-10 ml-auto mr-3 text-[17px] font-black tracking-normal text-[#111827]">Aa</span>
        </>
      ),
    },
  };

  return {
    id: style.id,
    label: style.label,
    ...previews[style.id],
  };
});

const imageReferenceModes: Array<{
  id: ImageReferenceMode;
  label: string;
  compactLabel: string;
  description: string;
}> = [
  {
    id: "recreate",
    label: "Image to UI",
    compactLabel: "Image to UI",
    description: "Use the uploaded image as the layout and structure to recreate into a UI.",
  },
  {
    id: "style",
    label: "Style reference",
    compactLabel: "Style Ref",
    description: "Use the uploaded image for mood, color, and visual treatment while designing a new layout.",
  },
];

const readApiError = (payload: ApiErrorPayload | null | undefined, fallback: string) => {
  if (!payload?.error) {
    return fallback;
  }

  if (typeof payload.error === "string") {
    return payload.error;
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
  initialStylePreset = null,
}: {
  initialPrompt?: string;
  initialStylePreset?: { slug: string; version: number; title: string; description: string } | null;
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<LobbyStage>("brief");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const [imageReferenceMode, setImageReferenceMode] = useState<ImageReferenceMode>("recreate");
  const [selectedBriefStyle, setSelectedBriefStyle] = useState<DesignStyleOptionId>(DESIGN_STYLE_AUTO_ID);
  const [selectedStylePreset, setSelectedStylePreset] = useState(initialStylePreset);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [designTokens, setDesignTokens] = useState<DesignTokens | null>(null);
  const [plan, setPlan] = useState<PlannedUiFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  // Credits & Pricing Dialog state
  const { balance, loading: loadingCredits } = useCredits();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<"upgrade" | "insufficient_credits">("upgrade");

  const isBriefReady = Boolean(prompt.trim() || image);
  const selectedBriefStyleLabel = selectedStylePreset?.title ?? briefStyles.find((style) => style.id === selectedBriefStyle)?.label ?? "Auto";
  const selectedDesignStyleId = !image && !selectedStylePreset && selectedBriefStyle !== DESIGN_STYLE_AUTO_ID ? selectedBriefStyle : null;
  const stylePresetSlug = !image ? selectedStylePreset?.slug ?? null : null;
  const activeImageModeDescription =
    imageReferenceModes.find((mode) => mode.id === imageReferenceMode)?.description ?? "";

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
      setSelectedBriefStyle(DESIGN_STYLE_AUTO_ID);
      setSelectedStylePreset(null);
      setIsThemePickerOpen(false);
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

    if (!loadingCredits && balance <= 0) {
      setPricingReason("insufficient_credits");
      setIsPricingOpen(true);
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
          designStyleId: selectedDesignStyleId,
          stylePresetSlug,
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
          designStyleId: selectedDesignStyleId,
          stylePresetSlug,
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
          designStyleId: selectedDesignStyleId,
          stylePresetSlug,
          designTokens,
          plannedScreens: plan.screens,
          requiresBottomNav: plan.requiresBottomNav,
          navigationArchitecture: plan.navigationArchitecture,
          navigationPlan: plan.navigationPlan,
          projectCharter: plan.charter,
          scopeContract: plan.scopeContract,
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)] select-none dg-dashed-grid-bg">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-full min-h-0 w-full flex-col">
            {stage === "brief" ? (
              <section className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 pb-10 pt-24 sm:items-center sm:px-6 sm:py-12">
                <div className="flex w-full max-w-3xl flex-col items-center">
                  
                  {/* Title section with styling */}
                  <h1 className="mb-8 max-w-[21rem] select-text text-center text-[2.05rem] font-bold leading-[1.12] tracking-normal text-neutral-950 dark:text-white min-[390px]:max-w-[24rem] min-[390px]:text-[2.3rem] sm:max-w-2xl sm:text-[3.35rem]">
                    What are we{" "}
                    <span className="inline-block bg-[linear-gradient(100deg,#002fa7_0%,#1b7fcc_42%,#e4002b_100%)] bg-clip-text pb-1 text-transparent dark:bg-[linear-gradient(100deg,#8fd3ff_0%,#ffffff_48%,#ff8aa6_100%)]">
                      bringing to life?
                    </span>
                  </h1>

                  {image ? (
                    <div className="mb-3 flex w-full flex-col items-center">
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-black/10 bg-white/80 p-1 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.7)] dark:border-white/[0.08] dark:bg-white/[0.04]">
                        {imageReferenceModes.map((mode) => (
                          <Tooltip key={mode.id}>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setImageReferenceMode(mode.id)}
                                  className={cn(
                                    "h-8 rounded-md px-3 text-[11px] font-bold transition duration-200",
                                    imageReferenceMode === mode.id
                                      ? "dg-button-primary text-white shadow-sm hover:opacity-100"
                                      : "text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
                                  )}
                                  disabled={isGeneratingDesign}
                                  aria-pressed={imageReferenceMode === mode.id}
                                />
                              }
                            >
                              {mode.label}
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="hidden max-w-[260px] p-2 text-center text-[12px] font-medium leading-relaxed sm:block"
                            >
                              {mode.description}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      <p className="mt-2 max-w-[22rem] px-2 text-center text-[11px] font-medium leading-5 text-neutral-500 dark:text-neutral-400 sm:hidden">
                        {activeImageModeDescription}
                      </p>
                    </div>
                  ) : null}

                  {selectedStylePreset && !image ? (
                    <div className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[#1b7fcc]/20 bg-[#1b7fcc]/[0.045] px-3.5 py-3 text-left">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1b7fcc]">Curated visual style</div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">{selectedStylePreset.title}</div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500 dark:text-neutral-400">{selectedStylePreset.description}</div>
                      </div>
                      <button type="button" onClick={() => setSelectedStylePreset(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/10 text-neutral-500 hover:text-neutral-900 dark:border-white/10 dark:hover:text-white" aria-label="Remove curated style">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {/* Redesigned Prompt Box inside outer gradient border */}
                  <div
                    className={`relative w-full rounded-xl bg-[linear-gradient(110deg,#ff9a9e_0%,#fecfef_20%,#e0c3fc_40%,#8ec5fc_60%,#a8edea_80%,#d4fc79_100%)] p-[1.5px] transition-[filter,opacity] duration-150 sm:rounded-xl sm:p-[2px] ${isGeneratingDesign ? "dg-brief-generating-shell animate-pulse" : ""}`}
                  >
                    <div className="relative z-20 min-h-[212px] rounded-xl bg-white/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[222px] sm:rounded-xl sm:p-5">
                      {image ? (
                        <div className="absolute -left-1 -top-10 z-40 rotate-[-5deg] sm:-left-2 sm:-top-12">
                          <div className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/80 bg-neutral-100 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.9)] transition-all hover:rotate-[2deg] hover:shadow-[0_18px_38px_-24px_rgba(15,23,42,0.95)] dark:border-white/15 dark:bg-neutral-900 sm:h-[72px] sm:w-[72px]">
                            <span className="relative block h-full w-full">
                              <Image
                                src={`data:${image.mimeType};base64,${image.data}`}
                                alt="Reference preview"
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
                              aria-label="Remove reference image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="relative min-h-[180px] sm:min-h-[182px]">
                        <Textarea
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          readOnly={isGeneratingDesign}
                          onClick={(event) => {
                            if (!loadingCredits && balance <= 0) {
                              event.preventDefault();
                              event.currentTarget.blur();
                              setPricingReason("insufficient_credits");
                              setIsPricingOpen(true);
                            }
                          }}
                          onFocus={(event) => {
                            if (!loadingCredits && balance <= 0) {
                              event.preventDefault();
                              event.currentTarget.blur();
                              setPricingReason("insufficient_credits");
                              setIsPricingOpen(true);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void handleGenerateDesign();
                            }
                          }}
                          placeholder="Describe the app UI you want to design... e.g., A minimalist dashboard for a fintech app with dark mode."
                          className="relative z-10 h-[180px] min-h-[180px] resize-none rounded-none border-0 bg-transparent px-0 pb-28 pt-0 text-[17px] leading-relaxed text-neutral-800 shadow-none [field-sizing:fixed] [scroll-padding-bottom:5.5rem] [scrollbar-width:none] placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-neutral-100 dark:placeholder:text-neutral-600 sm:h-[182px] sm:min-h-[182px] sm:pb-24 sm:[scroll-padding-bottom:5rem] [&::-webkit-scrollbar]:hidden"
                        />

                        {/* Bottom controls sit inside the text field surface. */}
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-t from-white/95 via-white/92 to-transparent pt-4 dark:from-[#1f1f1f] dark:via-[#1f1f1f]/92 dark:to-transparent">
                          
                          <TooltipProvider>
                            <div className="pointer-events-auto relative flex items-center gap-1">
                              
                              {/* Hidden input file for images */}
                              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                              
                              {/* Tool 1: Attach reference image */}
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsThemePickerOpen(false);
                                        fileInputRef.current?.click();
                                      }}
                                      className={`flex h-9 w-9 items-center justify-center rounded-[18px] text-neutral-500 transition-all hover:bg-black/5 hover:text-neutral-800 active:scale-95 focus:outline-none dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100 ${image ? "bg-black/5 text-neutral-800 dark:bg-white/10 dark:text-neutral-100" : ""}`}
                                      disabled={isGeneratingDesign}
                                      aria-label="Attach reference image"
                                    >
                                      <ImagePlus className="h-4.5 w-4.5" />
                                    </button>
                                  }
                                />
                                <TooltipContent>Attach reference image</TooltipContent>
                              </Tooltip>

                              {/* Tool 2: Select design style */}
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      onClick={() => setIsThemePickerOpen((prev) => !prev)}
                                      className={cn(
                                        "relative flex h-9 w-9 items-center justify-center rounded-[18px] text-neutral-500 transition-all hover:bg-black/5 hover:text-neutral-800 active:scale-95 focus:outline-none dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100",
                                        isThemePickerOpen && "bg-black/5 text-neutral-800 dark:bg-white/10 dark:text-neutral-100",
                                        image && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-neutral-500"
                                      )}
                                      disabled={isGeneratingDesign || Boolean(image)}
                                      aria-label="Select design style"
                                    >
                                      <Palette className="h-4.5 w-4.5 relative z-10" />
                                      {!isThemePickerOpen && (
                                        <motion.div
                                          layoutId="stylePickerWrapper"
                                          className="absolute inset-0 rounded-[18px] bg-transparent"
                                        />
                                      )}
                                    </button>
                                  }
                                />
                                <TooltipContent>
                                  {image ? "Design styles are not available when using a reference image" : "Select design style"}
                                </TooltipContent>
                              </Tooltip>

                            {/* Style Picker Dropdown Content positioned relative to this tool pill */}
                            <AnimatePresence>
                              {isThemePickerOpen && (
                                <motion.div
                                  layoutId="stylePickerWrapper"
                                  className="absolute bottom-12 left-0 z-50 w-[240px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-xl dark:border-white/[0.08] dark:bg-[#1b1b1b]"
                                  transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.8 }}
                                >
                                  <div className="mb-2.5 flex items-center justify-between px-1">
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Design style</span>
                                    <button
                                      type="button"
                                      onClick={() => setIsThemePickerOpen(false)}
                                      className="cursor-pointer flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
                                      aria-label="Close styling options"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    {briefStyles.map((style, index) => {
                                      const isSelected = selectedBriefStyle === style.id;
                                      const staggerDelay = (index + 2) * 0.035;

                                      return (
                                        <motion.button
                                          type="button"
                                          key={style.id}
                                          initial={{ opacity: 0, y: 15 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{
                                            type: "spring",
                                            bounce: 0.12,
                                            duration: 0.3,
                                            delay: staggerDelay,
                                          }}
                                          onClick={() => {
                                            setSelectedBriefStyle(style.id);
                                            setSelectedStylePreset(null);
                                            setTimeout(() => {
                                              setIsThemePickerOpen(false);
                                            }, 100);
                                          }}
                                          className="cursor-pointer flex min-w-0 flex-col gap-1.5 text-left group"
                                        >
                                          <span
                                            className={`relative flex h-[50px] items-center justify-center overflow-hidden rounded-xl border transition-all duration-150 ${style.previewClassName} ${
                                              isSelected
                                                ? "border-[2.5px] border-neutral-900 dark:border-white shadow-sm scale-98"
                                                : "hover:border-neutral-300 dark:hover:border-neutral-600 hover:scale-102 active:scale-98"
                                            }`}
                                          >
                                            {style.previewContent}
                                          </span>
                                          <span className={`truncate text-[11px] text-center w-full transition-colors duration-150 ${
                                            isSelected
                                              ? "font-bold text-neutral-800 dark:text-neutral-100"
                                              : "font-semibold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200"
                                          }`}>
                                            {style.label}
                                          </span>
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                          </div>
                        </TooltipProvider>

                          {/* Selected Style Text label */}
                          <div className="mr-auto hidden min-w-0 items-center text-xs font-semibold text-neutral-400 dark:text-neutral-500 sm:flex">
                            Style: <span className="ml-1.5 truncate font-bold text-neutral-700 dark:text-neutral-300">{selectedBriefStyleLabel}</span>
                            {selectedStylePreset ? (
                              <button type="button" onClick={() => setSelectedStylePreset(null)} className="ml-1.5 rounded-full p-0.5 hover:bg-black/5" aria-label="Remove curated style">
                                <X className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>

                          {/* Right: Submit Button capsule */}
                          <button
                            type="button"
                            onClick={() => void handleGenerateDesign()}
                            disabled={!isBriefReady || isGeneratingDesign}
                            className="dg-button-primary pointer-events-auto flex h-[42px] items-center justify-center rounded-lg px-5 text-[14px] font-semibold active:scale-95 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 disabled:shadow-none disabled:active:scale-100"
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
                              <div className="flex items-center gap-1.5">
                                <span>Design App</span>
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            )}
                          </button>

                        </div>
                      </div>
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
              <section className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 pb-3">
                  <div className="rounded-[18px] border border-[var(--dg-border)] bg-[var(--dg-surface)] px-4 py-4 text-[var(--dg-text)] shadow-[var(--dg-shadow-soft)] backdrop-blur-xl sm:px-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--dg-surface-muted)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--dg-text-muted)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Step 3 of 3
                        </div>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--dg-text)] sm:text-4xl">Review, then build.</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dg-text-muted)]">
                          Confirm the planned screens and project memory before the generation run starts.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--dg-surface-muted)] px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--dg-text-muted)]">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          {describeNavigationArchitecture(plan.navigationArchitecture)}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[var(--dg-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--dg-text)]">
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
                        <span key={feature} className="rounded-full bg-[var(--dg-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--dg-text-muted)]">
                          {feature}
                        </span>
                      ))}
                      {designTokens?.meta?.recommendedFonts?.map((font) => (
                        <span key={font} className="rounded-full bg-[var(--dg-accent)] px-3 py-1.5 text-xs font-bold text-white">
                          {font}
                        </span>
                      ))}
                    </div>
                  </div>

                  <section className="rounded-[18px] border border-[var(--dg-border)] bg-[var(--dg-surface)] text-[var(--dg-text)]">
                    <div className="border-b border-[var(--dg-border)] px-4 py-4 sm:px-5">
                      <div className="text-sm font-semibold text-[var(--dg-text)]">Initial screen plan</div>
                      <div className="mt-1 text-sm text-[var(--dg-text-muted)]">This is the exact screen set Trigger.dev will build from.</div>
                    </div>

                    <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3">
                      {plan.screens.map((screen, index) => (
                        <article key={`${screen.name}-${index}`} className="rounded-xl border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dg-text-muted)]">{screen.type}</div>
                              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--dg-text)]">{screen.name}</h2>
                            </div>
                            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dg-accent)] text-xs font-bold text-white">
                              {index + 1}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-[var(--dg-surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dg-text-muted)]">
                              {screen.chromePolicy?.chrome ?? screen.type}
                            </span>
                            {screen.navigationItemId ? (
                              <span className="rounded-full bg-[var(--dg-surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dg-text-muted)]">
                                {screen.navigationItemId}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--dg-text-muted)]">{screen.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <details className="rounded-[18px] border border-[var(--dg-border)] bg-[var(--dg-surface)] lg:hidden">
                    <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-[var(--dg-text)]">
                      Project memory
                      <span className="ml-2 text-xs font-medium text-[var(--dg-text-muted)]">Tap to review full context</span>
                    </summary>
                    <div className="border-t border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-4 py-4">
                      <ProjectMemory plan={plan} />
                    </div>
                  </details>

                  <section className="hidden rounded-[18px] border border-[var(--dg-border)] bg-[var(--dg-surface)] lg:block">
                    <div className="border-b border-[var(--dg-border)] px-5 py-4">
                      <div className="text-sm font-semibold text-[var(--dg-text)]">Project memory</div>
                      <div className="mt-1 text-sm text-[var(--dg-text-muted)]">The context used to keep future screens, edits, navigation, and visual direction coherent.</div>
                    </div>
                    <div className="bg-[var(--dg-surface-muted)] px-5 py-5">
                      <ProjectMemory plan={plan} columns />
                    </div>
                  </section>

                  <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-[var(--dg-border)] bg-[var(--dg-surface)] px-4 py-3 shadow-[0_-18px_44px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:-mx-5 sm:px-5 lg:mx-0 lg:rounded-[18px] lg:border">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row-reverse sm:items-center">
                      <Button className="dg-button-primary h-12 flex-1 rounded-full text-sm font-medium" onClick={() => void handleBuildProject()} disabled={isBuilding}>
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
                      <Button type="button" variant="outline" className="h-12 flex-1 rounded-full sm:max-w-[240px]" onClick={() => setStage("design")} disabled={isBuilding}>
                        Adjust design system
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
      <PricingDialog
        open={isPricingOpen}
        onOpenChange={setIsPricingOpen}
        triggerReason={pricingReason}
      />
    </div>
  );
}

function DigestTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dg-text-faint)]">{label}</div>
      <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[var(--dg-text)]">{value}</div>
    </div>
  );
}

function ProjectMemory({ plan, columns = false }: { plan: PlannedUiFlow; columns?: boolean }) {
  return (
    <div className={columns ? "grid gap-4 xl:grid-cols-2" : "space-y-4"}>
      <div className="rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface)] p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dg-text-muted)]">Project charter</div>
        <p className="mt-2 text-sm leading-6 text-[var(--dg-text-muted)]">
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dg-text-muted)]">{label}</div>
      <div className={`mt-1 text-sm ${multiline ? "whitespace-pre-line leading-6 text-[var(--dg-text-muted)]" : "font-medium text-[var(--dg-text)]"}`}>
        {value}
      </div>
    </div>
  );
}
