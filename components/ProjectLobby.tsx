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

const imageReferenceModes: Array<{ id: ImageReferenceMode; label: string; compactLabel: string }> = [
  { id: "recreate", label: "Image to UI", compactLabel: "Image to UI" },
  { id: "style", label: "Style reference", compactLabel: "Style Ref" },
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
  const selectedBriefStyleLabel = briefStyles.find((style) => style.id === selectedBriefStyle)?.label ?? "Auto";

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
      setSelectedBriefStyle("auto");
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f8f9fb] text-neutral-900 select-none dark:bg-[#111215] dark:text-neutral-100">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-full min-h-0 w-full flex-col">
            {stage === "brief" ? (
              <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
                <div className="w-full max-w-3xl py-12 flex flex-col items-center">
                  
                  {/* Title section with styling */}
                  <h1 className="text-center text-[clamp(2.0rem,5.5vw,3.0rem)] font-extrabold leading-[1.05] tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl max-w-xl mb-8 select-text">
                    What Mobile App shall we <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">design today?</span>
                  </h1>

                  {/* Redesigned Prompt Box inside outer gradient border */}
                  <div
                    className={`relative w-full rounded-[38px] bg-[linear-gradient(110deg,#ff9a9e_0%,#fecfef_20%,#e0c3fc_40%,#8ec5fc_60%,#a8edea_80%,#d4fc79_100%)] p-[2px]  transition-all duration-300 ${isGeneratingDesign ? "dg-brief-generating-shell animate-pulse" : ""}`}
                  >
                    <div className="bg-[#f2f3f5] dark:bg-[#1a1d22] rounded-[36px] p-2 flex flex-col relative z-20">
                      
                      {/* Top Section: Attachment Preview Sitting on Gray */}
                      <div className="flex flex-wrap items-center gap-2.5 px-3 pt-2 pb-2.5 min-h-[44px]">
                        {image ? (
                          <>
                            <div className="flex items-center gap-2.5 bg-white dark:bg-[#1b1b1b] border border-[#e2e4e7] dark:border-white/[0.08] rounded-[18px] pl-3 pr-2 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:bg-neutral-50 dark:hover:bg-white/5 group">
                              <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-md border border-neutral-200">
                                <Image
                                  src={`data:${image.mimeType};base64,${image.data}`}
                                  alt="Reference preview"
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              </span>
                              <span className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[120px]">
                                Reference image
                              </span>
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="text-neutral-400 hover:text-neutral-700 transition-colors ml-1 p-0.5 rounded-full hover:bg-neutral-100"
                                aria-label="Remove reference image"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Image Reference Modes toggle pill */}
                            <div className="flex h-8 items-center rounded-[18px] border border-[#e2e4e7] dark:border-white/[0.08] bg-white dark:bg-[#1b1b1b] p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                              {imageReferenceModes.map((mode) => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() => setImageReferenceMode(mode.id)}
                                  className={`cursor-pointer h-7 rounded-[15px] px-3 text-[11px] font-bold transition duration-200 ${imageReferenceMode === mode.id ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"}`}
                                  disabled={isGeneratingDesign}
                                  aria-pressed={imageReferenceMode === mode.id}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-[12px] font-medium text-neutral-400 px-1 w-full text-left">
                            Attach reference image to guide the design
                          </div>
                        )}
                      </div>

                      {/* Inner White Container */}
<div className="bg-white dark:bg-[#1b1b1b] border border-[#e2e4e7]/80 dark:border-white/[0.08] rounded-[28px] flex flex-col relative">
                        
                        {/* Middle Section: Text input */}
                        <div className="px-4 pt-4 pb-2">
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
                            className="rounded-lg h-[100px] sm:h-[120px] [field-sizing:fixed] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden resize-none border-0 bg-transparent px-2 py-2 text-[17px] leading-relaxed text-neutral-800 dark:text-neutral-100 shadow-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>

                        {/* Bottom Section: Inline Toolbar Capsule */}
                        <div className="flex items-center justify-between px-3 pb-3">
                          
                          {/* Left tools grouped pill */}
                          <TooltipProvider>
                            <div className="flex items-center bg-[#f7f8f9] dark:bg-[#2a2a2a] p-1 rounded-[22px] border border-[#e2e4e7]/60 dark:border-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] relative">
                              
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
                                      className={`w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm hover:border hover:border-neutral-200/50 dark:hover:border-white/10 transition-all active:scale-95 focus:outline-none ${image ? "bg-white dark:bg-white/10 text-neutral-800 dark:text-neutral-100 shadow-sm border border-neutral-200/50 dark:border-white/10" : ""}`}
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
                                        "relative w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm hover:border hover:border-neutral-200/50 dark:hover:border-white/10 transition-all active:scale-95 focus:outline-none ml-1",
                                        isThemePickerOpen && "bg-white dark:bg-white/10 text-neutral-800 dark:text-neutral-100 shadow-sm border border-neutral-200/50 dark:border-white/10",
                                        image && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-neutral-500 hover:shadow-none hover:border-transparent"
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
                                  className="absolute bottom-14 left-0 z-50 w-[240px] rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#1b1b1b] p-3 shadow-xl overflow-hidden"
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
                          <div className="hidden sm:flex items-center text-xs font-semibold text-neutral-400 dark:text-neutral-500 mr-auto ml-4">
                            Style: <span className="text-neutral-700 dark:text-neutral-300 ml-1.5 font-bold bg-neutral-100 dark:bg-white/10 px-2.5 py-1 rounded-full">{selectedBriefStyleLabel}</span>
                          </div>

                          {/* Right: Submit Button capsule */}
                          <button
                            type="button"
                            onClick={() => void handleGenerateDesign()}
                            disabled={!isBriefReady || isGeneratingDesign}
                            className={`h-[42px] px-5 rounded-[16px] flex items-center justify-center text-white text-[14px] font-semibold transition-all active:scale-95 focus:outline-none shadow-[0_4px_14px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.1)] ${
                              isBriefReady 
                                ? "bg-gradient-to-b from-[#2a2a2a] to-[#111111] border border-black hover:from-[#333] hover:to-[#1a1a1a]" 
                                : "bg-neutral-200 dark:bg-white/10 border-neutral-300 dark:border-white/10 text-neutral-400 dark:text-neutral-600 cursor-not-allowed shadow-none"
                            }`}
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
                  <div className="rounded-[18px] border border-slate-950/[0.1] bg-white px-4 py-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.72)] backdrop-blur-xl sm:px-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Step 3 of 3
                        </div>
                        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">Review, then build.</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                          Confirm the planned screens and project memory before the generation run starts.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-600">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          {describeNavigationArchitecture(plan.navigationArchitecture)}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-700">
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
                        <span key={feature} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
                          {feature}
                        </span>
                      ))}
                      {designTokens?.meta?.recommendedFonts?.map((font) => (
                        <span key={font} className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white">
                          {font}
                        </span>
                      ))}
                    </div>
                  </div>

                  <section className="rounded-[18px] border border-slate-950/[0.1] bg-white">
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
                            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                              {index + 1}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                              {screen.chromePolicy?.chrome ?? screen.type}
                            </span>
                            {screen.navigationItemId ? (
                              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                                {screen.navigationItemId}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600">{screen.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <details className="rounded-[18px] border border-slate-950/[0.1] bg-white lg:hidden">
                    <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-neutral-950">
                      Project memory
                      <span className="ml-2 text-xs font-medium text-neutral-500">Tap to review full context</span>
                    </summary>
                    <div className="border-t border-slate-950/[0.08] bg-[#f7f7f8] px-4 py-4">
                      <ProjectMemory plan={plan} />
                    </div>
                  </details>

                  <section className="hidden rounded-[18px] border border-slate-950/[0.1] bg-white lg:block">
                    <div className="border-b border-slate-950/[0.08] px-5 py-4">
                      <div className="text-sm font-semibold text-neutral-950">Project memory</div>
                      <div className="mt-1 text-sm text-neutral-500">The context used to keep future screens, edits, navigation, and visual direction coherent.</div>
                    </div>
                    <div className="bg-[#f7f7f8] px-5 py-5">
                      <ProjectMemory plan={plan} columns />
                    </div>
                  </section>

                  <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-slate-950/[0.08] bg-white px-4 py-3 shadow-[0_-18px_44px_-34px_rgba(15,23,42,0.8)] backdrop-blur-xl sm:-mx-5 sm:px-5 lg:mx-0 lg:rounded-[18px] lg:border lg:border-slate-950/[0.1]">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row-reverse sm:items-center">
                      <Button className="h-12 flex-1 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-sm font-medium" onClick={() => void handleBuildProject()} disabled={isBuilding}>
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
