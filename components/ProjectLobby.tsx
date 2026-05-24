"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useMemo, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { motion, type Transition } from "motion/react";
import {
  ArrowUp,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Moon,
  Palette,
  Sparkles,
  Sun,
  X,
  Search,
  Trash2,
  Plus,
  LogOut,
  Check,
  Menu,
} from "lucide-react";

import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjects } from "@/hooks/use-projects";
import { useCredits } from "@/hooks/useCredits";
import { PricingDialog } from "@/components/PricingDialog";
import { useAppTheme } from "@/contexts/app-theme-context";
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

const DAY_IN_MS = 86_400_000;
const PROJECT_GROUP_ORDER = ["Today", "Yesterday", "Last 7 days", "Earlier"] as const;
const PROJECT_STATUS_LABEL: Record<ProjectData["status"], string> = {
  draft: "Draft",
  active: "Active",
  queued: "Queued",
  generating: "Building",
  failed: "Needs attention",
  completed: "Ready",
  archived: "Archived",
};

const startOfLocalDay = (value: string) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getGroupLabel = (updatedAt: string) => {
  const diffInDays = Math.floor(
    (startOfLocalDay(new Date().toISOString()) - startOfLocalDay(updatedAt)) / DAY_IN_MS,
  );

  if (diffInDays <= 0) {
    return "Today";
  }

  if (diffInDays === 1) {
    return "Yesterday";
  }

  if (diffInDays < 7) {
    return "Last 7 days";
  }

  return "Earlier";
};

const getProjectContext = (project: ProjectData) => {
  if (project.charter?.appType) {
    return project.charter.appType;
  }

  if (project.charter?.creativeDirection?.conceptName) {
    return project.charter.creativeDirection.conceptName;
  }

  return PROJECT_STATUS_LABEL[project.status] ?? "Design project";
};

const formatCompactTime = (updatedAt: string) => {
  const timestamp = new Date(updatedAt).getTime();
  const diff = Math.max(Date.now() - timestamp, 0);
  const minute = 60_000;
  const hour = 60 * minute;

  if (diff < minute) {
    return "now";
  }

  if (diff < hour) {
    return `${Math.floor(diff / minute)}m`;
  }

  if (diff < DAY_IN_MS) {
    return `${Math.floor(diff / hour)}h`;
  }

  if (diff < DAY_IN_MS * 7) {
    return `${Math.floor(diff / DAY_IN_MS)}d`;
  }

  return new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getStatusDotClass = (status: ProjectData["status"]) => {
  if (status === "failed") {
    return "bg-rose-500";
  }

  if (status === "generating" || status === "queued") {
    return "bg-[#1b7fcccc]";
  }

  if (status === "active" || status === "completed") {
    return "bg-emerald-500";
  }

  return "bg-neutral-300";
};

const getAccountInitial = (user: AuthenticatedUser) => (
  user.fullName?.charAt(0) || user.email?.charAt(0) || "U"
);

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
  const { resolvedTheme, setTheme } = useAppTheme();
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
  
  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Credits & Pricing Dialog state
  const { balance, loading: loadingCredits } = useCredits();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<"upgrade" | "insufficient_credits">("upgrade");

  // Projects data hook and query filtering
  const { projects, deleteProject, hasMore, loadMore, isLoadingMore } = useProjects(user.id, initialProjects);
  const [query, setQuery] = useState("");

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelCallbackRef = (node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !hasMore || isLoadingMore) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        void loadMore();
      }
    }, { rootMargin: "100px" });
    observerRef.current.observe(node);
  };

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) => (
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.prompt.toLowerCase().includes(normalizedQuery)
    ));
  }, [projects, query]);

  const groupedProjects = useMemo(
    () => filteredProjects.reduce<Record<string, ProjectData[]>>((groups, project) => {
      const label = getGroupLabel(project.updatedAt);

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(project);
      return groups;
    }, {}),
    [filteredProjects],
  );

  const visibleGroups = PROJECT_GROUP_ORDER.filter((label) => groupedProjects[label]?.length);
  const isBriefReady = Boolean(prompt.trim() || image);
  const selectedBriefStyleLabel = briefStyles.find((style) => style.id === selectedBriefStyle)?.label ?? "Auto";

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

  const renderSidebarContents = () => {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-[#1c1f26]">
        {/* Sidebar Header */}
        <div className="px-4 pb-4 pt-5 border-b border-slate-100 dark:border-white/[0.06] flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileSidebarOpen(false);
                router.push("/project/new");
              }}
              className="flex min-w-0 items-center gap-3 text-left hover:opacity-85 transition-opacity"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-700 text-[12px] font-bold tracking-wider text-white shadow-sm">
                DG
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                  Workspace
                </span>
                <span className="block truncate text-[15px] font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                  Drawgle
                </span>
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <Avatar className="h-9 w-9 shrink-0 border border-slate-250/[0.08] bg-white">
                <AvatarImage src={user.avatarUrl || ""} />
                <AvatarFallback>{getAccountInitial(user)}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              router.push("/project/new");
            }}
            className="h-10 w-full justify-start rounded-xl px-4 text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </Button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-10 w-full rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-[#252830] pl-10 pr-4 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-neutral-300 dark:focus:border-white/20 focus:ring-1 focus:ring-neutral-200 dark:focus:ring-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
            />
          </div>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleGroups.map((label) => (
            <div key={label} className="mb-4">
              <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                {label}
              </div>
              <div className="space-y-0.5">
                {groupedProjects[label].map((project) => (
                  <ProjectMenuItem
                    key={project.id}
                    project={project}
                    active={false}
                    onDelete={() => deleteProject(project.id)}
                    onNavigate={() => {
                      setIsMobileSidebarOpen(false);
                      router.push(`/project/${project.id}`);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div ref={sentinelCallbackRef} className="py-4 flex justify-center items-center">
              {isLoadingMore ? (
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              ) : (
                <span className="text-[11px] font-semibold text-neutral-400">Loading more...</span>
              )}
            </div>
          )}

          {filteredProjects.length === 0 ? (
            <div className="mx-1 mt-2 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-[#1a1d22] px-4 py-6 text-sm text-center leading-relaxed text-neutral-400">
              {query.trim()
                ? "No projects match that search."
                : "No projects yet. Start the first one from this workspace."}
            </div>
          ) : null}

          <div className="mx-1 mt-4 rounded-xl border border-neutral-100 dark:border-white/[0.06] bg-[#fbfbfc] dark:bg-[#1a1d22] px-4 py-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
            New projects start here. The brief becomes the charter, design system, screen plan, and build kickoff.
          </div>
        </div>

        {/* Credits & Subscription Gating */}
        <div className="px-4 py-3 mx-3 mb-2 bg-gradient-to-br from-[#1b7fcccc]/60 via-[#1b7fcccc]/40 to-[#1b7fcccc]/20 border border-[#1b7fcccc]/10 rounded-2xl shadow-[0_2px_8px_rgba(99,102,241,0.03)] flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black">Credits Balance</span>
            <span className="text-xs font-bold text-neutral-800">{loadingCredits ? "..." : `${balance} credits`}</span>
          </div>
          <button 
            type="button" 
            onClick={() => {
              setPricingReason("upgrade");
              setIsPricingOpen(true);
            }}
            className="w-full text-center py-1.5 px-3 rounded-lg bg-[#1b7fcccc] hover:bg-[#1b7fcccc]/90 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            Upgrade Plan
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-100 dark:border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-250 dark:border-white/[0.06] bg-[#fcfcfd] dark:bg-[#1e2128] p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <Avatar className="h-9 w-9 border border-slate-250/[0.08] bg-white">
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback>{getAccountInitial(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {user.fullName ?? "Drawgle account"}
              </div>
              <div className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                {user.email ?? "Signed in"}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-855 transition-all"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-[#f8f9fb] dark:bg-[#111215] p-4 flex gap-4 overflow-hidden text-neutral-900 dark:text-neutral-100 select-none">
      
      {/* 1. Desktop Floating Sidebar */}
      <aside className="hidden md:flex flex-col w-[300px] shrink-0 bg-white dark:bg-[#1c1f26] border border-neutral-200/80 dark:border-white/[0.08] rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] h-full overflow-hidden">
        {renderSidebarContents()}
      </aside>

      {/* 2. Mobile Drawer Sidebar (with backdrop) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* Floating Drawer Card */}
          <aside className="relative flex flex-col w-[280px] bg-white dark:bg-[#1c1f26] border border-neutral-200/80 dark:border-white/[0.08] rounded-[24px] shadow-2xl h-[calc(100%-2rem)] my-4 ml-4 overflow-hidden z-10 animate-in slide-in-from-left duration-300">
            {renderSidebarContents()}
          </aside>
        </div>
      )}

      {/* 3. Main Dashboard Content Panel */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Floating mobile hamburger menu button */}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="absolute left-4 top-4 z-40 md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200/85 dark:border-white/[0.1] bg-white/90 dark:bg-[#1c1f26]/90 text-neutral-600 dark:text-neutral-300 shadow-sm backdrop-blur-md hover:bg-neutral-50 dark:hover:bg-white/10 active:scale-95 transition-all"
          aria-label="Open sidebar"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

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
                            <div className="flex items-center gap-2.5 bg-white dark:bg-[#1c1f26] border border-[#e2e4e7] dark:border-white/[0.08] rounded-[18px] pl-3 pr-2 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:bg-neutral-50 dark:hover:bg-white/5 group">
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
                            <div className="flex h-8 items-center rounded-[18px] border border-[#e2e4e7] dark:border-white/[0.08] bg-white dark:bg-[#1c1f26] p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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
<div className="bg-white dark:bg-[#1c1f26] border border-[#e2e4e7]/80 dark:border-white/[0.08] rounded-[28px] flex flex-col relative">
                        
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
                            className="h-[100px] sm:h-[120px] [field-sizing:fixed] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden resize-none rounded-none border-0 bg-transparent px-2 py-2 text-[17px] leading-relaxed text-neutral-800 dark:text-neutral-100 shadow-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>

                        {/* Bottom Section: Inline Toolbar Capsule */}
                        <div className="flex items-center justify-between px-3 pb-3">
                          
                          {/* Left tools grouped pill */}
                          <TooltipProvider>
                            <div className="flex items-center bg-[#f7f8f9] dark:bg-[#252830] p-1 rounded-[22px] border border-[#e2e4e7]/60 dark:border-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] relative">
                              
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
                                        "w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm hover:border hover:border-neutral-200/50 dark:hover:border-white/10 transition-all active:scale-95 focus:outline-none ml-1",
                                        isThemePickerOpen && "bg-white dark:bg-white/10 text-neutral-800 dark:text-neutral-100 shadow-sm border border-neutral-200/50 dark:border-white/10",
                                        image && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-neutral-500 hover:shadow-none hover:border-transparent"
                                      )}
                                      disabled={isGeneratingDesign || Boolean(image)}
                                      aria-label="Select design style"
                                    >
                                      <Palette className="h-4.5 w-4.5" />
                                    </button>
                                  }
                                />
                                <TooltipContent>
                                  {image ? "Design styles are not available when using a reference image" : "Select design style"}
                                </TooltipContent>
                              </Tooltip>

                            {/* Style Picker Dropdown Content positioned relative to this tool pill */}
                            {isThemePickerOpen && (
                              <div className="absolute bottom-14 left-0 z-50 w-[240px] rounded-2xl border border-neutral-200/80 dark:border-white/[0.08] bg-white dark:bg-[#1c1f26] p-3 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="mb-2.5 flex items-center justify-between px-1">
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Design style</span>
                                  <button
                                    type="button"
                                    onClick={() => setIsThemePickerOpen(false)}
                                    className="cursor-pointer flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                    aria-label="Close styling options"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  {briefStyles.map((style) => {
                                    const isSelected = selectedBriefStyle === style.id;

                                    return (
                                      <button
                                        type="button"
                                        key={style.id}
                                        onClick={() => {
                                          setSelectedBriefStyle(style.id);
                                          setIsThemePickerOpen(false);
                                        }}
                                        className="cursor-pointer flex min-w-0 flex-col gap-1.5 text-left"
                                      >
                                        <span
                                          className={`relative flex h-[50px] items-center justify-center overflow-hidden rounded-xl border ${style.previewClassName} ${isSelected ? "border-[2.5px] border-neutral-900 shadow-sm" : "hover:border-neutral-300"}`}
                                        >
                                          {style.previewContent}
                                        </span>
                                        <span className={`truncate text-[11px] text-center w-full ${isSelected ? "font-bold text-neutral-800" : "font-semibold text-neutral-500"}`}>
                                          {style.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

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

function ProjectMenuItem({
  project,
  active = false,
  onDelete,
  onNavigate,
}: {
  project: ProjectData;
  active?: boolean;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const context = getProjectContext(project);
  const status = PROJECT_STATUS_LABEL[project.status] ?? "Project";
  const time = formatCompactTime(project.updatedAt);

  return (
    <div className="group/project relative mb-1">
      <button
        type="button"
        onClick={onNavigate}
        className={cn(
          "w-full text-left rounded-xl p-3 transition-all relative flex flex-col gap-1",
          active
            ? "bg-neutral-950 text-white shadow-sm"
            : "hover:bg-neutral-50 dark:hover:bg-white/[0.06] text-neutral-800 dark:text-neutral-200"
        )}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <span className={cn(
            "truncate text-[13px] font-semibold tracking-tight",
            active ? "text-white" : "text-neutral-800 dark:text-neutral-200"
          )}>
            {project.name}
          </span>
          <span className={cn(
            "text-[10px] shrink-0 mt-0.5",
            active ? "text-neutral-400" : "text-neutral-400"
          )}>
            {time}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] font-medium">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getStatusDotClass(project.status))} />
          <span className={cn("truncate max-w-[120px]", active ? "text-neutral-300" : "text-neutral-500")}>
            {context}
          </span>
          <span className="text-neutral-300">/</span>
          <span className={active ? "text-neutral-300" : "text-neutral-500"}>
            {status}
          </span>
        </div>
      </button>

      {/* Delete trigger */}
      {confirming ? (
        <div className="absolute right-2.5 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onDelete();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
            aria-label="Confirm delete"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 hover:bg-neutral-300 transition-colors shadow-sm"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            "absolute right-2.5 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full opacity-0 group-hover/project:opacity-100 transition-all hover:scale-105 shadow-sm border border-neutral-100 focus-visible:opacity-100",
            active 
              ? "bg-white/10 hover:bg-rose-500 hover:text-white border-white/5 text-white/70"
              : "bg-white dark:bg-[#1c1f26] hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-500 text-neutral-400 border-neutral-100 dark:border-white/[0.06]"
          )}
          aria-label="Delete project"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
