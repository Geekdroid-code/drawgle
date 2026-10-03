"use client";
import { HistoryControls, type CanvasHistoryPreview } from "@/components/HistoryControls";
import { HistoryPreviewBar } from "@/components/HistoryPreviewBar";
import { confirmPermanentScreenDeletion } from "@/lib/confirm-screen-deletion";

import type { ProductAnswers } from "@/lib/product-planning/questions";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRight, ArrowLeft, HelpCircle, Share2, LogOut, FolderSync, CircleDollarSign, User, CreditCard, Download, Mail, MessageCircle } from "lucide-react";

import { AnimatedThemeToggle } from "@/components/AnimatedThemeToggle";
import { CreateStateDialog } from "@/components/CreateStateDialog";
import { CanvasStage } from "@/components/CanvasArea";
import { ExportMenu } from "@/components/ExportMenu";
import { ProjectCanvasLoading } from "@/components/ProjectCanvasLoading";
import { PreviewShareDialog } from "@/components/PreviewShareDialog";
import { ChatPanel } from "@/components/ChatPanel";
import { PlanningEmptyCanvas } from "@/components/product-planning/PlanningEmptyCanvas";
import { notifyProjectChanged } from "@/lib/project-refresh";
import { saveDesignTokens } from "@/lib/design-history/save-tokens";
import { useDraftNavigationGuard } from "@/components/visual-editor/use-draft-navigation-guard";
import { VisualEditor } from "@/components/visual-editor/VisualEditor";
import { useEditorDraft, type EditSaveOptions } from "@/components/visual-editor/use-editor-draft";
import type { ElementSelectionLostReason, SelectedElementInfo } from "@/components/ScreenNode";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCredits } from "@/hooks/useCredits";
import { PricingDialog } from "@/components/PricingDialog";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeterministicEditOperation, DrawgleImageTargetMeta } from "@/lib/drawgle-dom";
import { useGenerationRuns } from "@/hooks/use-generation-runs";
import { useProductFulfillments } from "@/hooks/use-product-fulfillments";
import { isProductApprovalRun, readApprovalFromRun } from "@/lib/agent/flow-build";
import { flowPlaceholders } from "@/lib/canvas/flow-placeholders";
import { parseStoredNavigationPlan } from "@/lib/project-navigation";
import { useProject } from "@/hooks/use-project";
import { useProjectNavigation } from "@/hooks/use-project-navigation";
import { useScreens } from "@/hooks/use-screens";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { filterPendingGenerationPreview, readGenerationPreview } from "@/lib/generation-preview";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, insertProjectMessage } from "@/lib/supabase/queries";
import { getDrawgleTokenReferences, buildDrawgleTokenCss, buildGoogleFontAssetLinks } from "@/lib/token-runtime";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  ImageReferenceMode,
  NavigationArchitecture,
  NavigationPlan,
  ProjectData,
  ProjectNavigationData,
  PromptImagePayload,
  RoadmapBuildRecommendation,
  ScreenPlan,
  ScreenData,
} from "@/lib/types";
import type { CanvasTool } from "@/lib/canvas-interactions";

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

type ManualEditMode = "selected" | "design";

const MAX_REPLACEMENT_UPLOAD_BYTES = 2.8 * 1024 * 1024;
const MAX_REPLACEMENT_IMAGE_EDGE = 2400;

const loadImageForUpload = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image file."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare this image for upload."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const prepareReplacementImageFile = async (file: File) => {
  if (file.size <= MAX_REPLACEMENT_UPLOAD_BYTES) {
    return file;
  }

  if (file.type === "image/gif") {
    throw new Error("GIF replacements must be under 4MB. Use PNG, JPEG, or WebP for larger images.");
  }

  if (!file.type.startsWith("image/")) {
    return file;
  }

  const image = await loadImageForUpload(file);
  const scale = Math.min(1, MAX_REPLACEMENT_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare this image for upload.");
  }
  context.drawImage(image, 0, 0, width, height);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "replacement-image";
  for (const quality of [0.86, 0.76, 0.66, 0.56]) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob.size <= MAX_REPLACEMENT_UPLOAD_BYTES || quality === 0.56) {
      return new File([blob], `${baseName}.webp`, { type: "image/webp" });
    }
  }

  return file;
};

type ElementEditSession = {
  screenId: string | null;
  element: SelectedElementInfo;
  mode: ManualEditMode;
  selectedAt: string;
  selectionVersion: number;
  freshness: "fresh" | "stale";
};

async function enqueueGeneration(input: {
  clientRequestId?: string;
  projectId: string;
  prompt: string;
  image?: PromptImagePayload | null;
  imageReferenceMode?: ImageReferenceMode;
  designTokens?: DesignTokens | null;
  sourceGenerationRunId?: string;
  targetScreenNames?: string[];
  targetScreenIds?: string[];
  plannedScreens?: ScreenPlan[] | null;
  requiresBottomNav?: boolean;
  navigationArchitecture?: NavigationArchitecture | null;
  navigationPlan?: NavigationPlan | null;
  roadmapBuild?: {
    kind: RoadmapBuildRecommendation["kind"];
    roadmapItemIds: string[];
    parentScreenId?: string | null;
  };
}) {
  const response = await fetch("/api/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientRequestId: input.clientRequestId ?? crypto.randomUUID(),
      ...input,
      targetScreenNames: input.targetScreenNames?.length ? input.targetScreenNames : undefined,
      targetScreenIds: input.targetScreenIds?.length ? input.targetScreenIds : undefined,
    }),
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
  initialProjectNavigation,
}: {
  user: AuthenticatedUser;
  initialProject: ProjectData;
  initialScreens: ScreenData[];
  initialGenerationRuns: GenerationRunData[];
  initialProjectNavigation: ProjectNavigationData | null;
}) {
  const router = useRouter();
  const { project, isLoading: isProjectLoading } = useProject(initialProject.id, initialProject);
  const { screens, refreshScreens, loadScreenSource } = useScreens(initialProject.id, initialScreens);
  const { projectNavigation } = useProjectNavigation(initialProject.id, initialProjectNavigation);
  const { generationRun, generationRuns, refreshGenerationRuns } = useGenerationRuns(initialProject.id, initialGenerationRuns);
  const generationPreview = useMemo(() => filterPendingGenerationPreview(
    readGenerationPreview(generationRun?.metadata?.generationPreview),
    screens,
    generationRun?.id ?? null,
  ), [generationRun?.id, generationRun?.metadata, screens]);

  // The latest approved flow: its per-screen claims feed the chat's build block and the canvas's phones to come.
  const latestApprovalRun = useMemo(
    () => generationRuns.filter((run) => isProductApprovalRun(run))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null,
    [generationRuns],
  );
  const latestApproval = useMemo(() => latestApprovalRun ? readApprovalFromRun(latestApprovalRun) : null, [latestApprovalRun]);
  const approvalBuilding = Boolean(latestApprovalRun && ["queued", "planning", "building", "canceled"].includes(latestApprovalRun.status));
  const approvalRefreshKey = useMemo(() => {
    if (!latestApprovalRun) return "";
    const batches = generationRuns.filter((run) => run.metadata?.productApprovalId === latestApprovalRun.id);
    const batchIds = new Set(batches.map((run) => run.id));
    return [
      latestApprovalRun.status, latestApprovalRun.updatedAt,
      batches.map((run) => `${run.id}:${run.status}`).join(","),
      screens.filter((screen) => batchIds.has(screen.generationRunId ?? "")).map((screen) => `${screen.id}:${screen.status}`).join(","),
    ].join("|");
  }, [generationRuns, latestApprovalRun, screens]);
  const approvalFulfillments = useProductFulfillments(
    latestApprovalRun && latestApprovalRun.status !== "completed" ? latestApprovalRun.id : null,
    approvalRefreshKey,
    approvalBuilding,
  );
  const flowPlaceholderPhones = useMemo(() => flowPlaceholders({
    approval: latestApproval,
    run: latestApprovalRun,
    fulfillments: approvalFulfillments,
    screens,
    preview: generationPreview,
    nextSlot: { x: project?.nextScreenX, y: project?.screenOriginY },
  }), [approvalFulfillments, generationPreview, latestApproval, latestApprovalRun, project?.nextScreenX, project?.screenOriginY, screens]);

  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pointer");
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"chat" | "design">("chat");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [elementSaving, setElementSaving] = useState(false);
  const [inspectorSaving, setInspectorSaving] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySelection, setHistorySelection] = useState("");
  const [historyPanelTarget, setHistoryPanelTarget] = useState<HTMLDivElement | null>(null);
  const [historyCanvasPreview, setHistoryCanvasPreview] = useState<CanvasHistoryPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const mobileChatWasCollapsed = useRef<boolean | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [isQueueingGeneration, setIsQueueingGeneration] = useState(false);
  const [pendingQueuedRunId, setPendingQueuedRunId] = useState<string | null>(null);
  const [pendingAddScreenRunId, setPendingAddScreenRunId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);

  // Credits & Pricing Dialog state
  const { balance, loading: loadingCredits } = useCredits();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<"upgrade" | "insufficient_credits">("upgrade");
  const [editSession, setEditSession] = useState<ElementEditSession | null>(null);
  const [tokenDraft, setTokenDraft] = useState<DesignTokens | null>(() =>
    hasApprovedDesignTokens(initialProject.designTokens)
      ? normalizeDesignTokens(initialProject.designTokens)
      : null,
  );
  const [tokenDirty, setTokenDirty] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const tokenDirtyRef = useRef(tokenDirty);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportInitialScreenId, setExportInitialScreenId] = useState<string | null>(null);

  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    screenId: string;
    drawgleId: string;
  } | null>(null);

  const [alertModalState, setAlertModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  } | null>(null);

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

  const effectiveDesignTokens = tokenDraft && hasApprovedDesignTokens(tokenDraft)
    ? tokenDraft
    : project?.designTokens ?? null;
  // A saved version being previewed in Recent changes is drawn on the canvas in place of the current one. Only what the
  // canvas draws changes; the saved design, exports and edits keep using the current one.
  const canvasScreens = useMemo(() => {
    if (historyCanvasPreview?.context === "screen") {
      return screens.map(screen => screen.id === historyCanvasPreview.screenId ? { ...screen, code: historyCanvasPreview.code, sourceLoaded: true } : screen);
    }
    if (historyCanvasPreview?.context === "navigation" && Array.isArray(historyCanvasPreview.navigation.assignments)) {
      const assignments = new Map((historyCanvasPreview.navigation.assignments as Array<{ screenId: string; chromePolicy: ScreenData["chromePolicy"]; navigationItemId: string | null }>)
        .map(assignment => [assignment.screenId, assignment]));
      return screens.map(screen => {
        const assignment = assignments.get(screen.id);
        return assignment ? { ...screen, chromePolicy: assignment.chromePolicy, navigationItemId: assignment.navigationItemId } : screen;
      });
    }
    return screens;
  }, [historyCanvasPreview, screens]);
  const canvasNavigation = useMemo(() => historyCanvasPreview?.context === "navigation" && projectNavigation
    ? { ...projectNavigation, plan: parseStoredNavigationPlan(historyCanvasPreview.navigation.plan), shellCode: String(historyCanvasPreview.navigation.shellCode ?? "") }
    : projectNavigation, [historyCanvasPreview, projectNavigation]);
  const canvasDesignTokens = historyCanvasPreview?.context === "tokens" ? historyCanvasPreview.tokens : effectiveDesignTokens;
  const showHistoryOnCanvas = useCallback((preview: CanvasHistoryPreview | null) => {
    setHistoryCanvasPreview(preview);
    // On a phone the editor drawer covers the canvas, so it steps aside to show the version; the chat stays collapsed,
    // and the preview bar restores or exits. The drawer's toggle brings back Before/After.
    if (preview && isMobile) setInspectorOpen(false);
  }, [isMobile]);

  const exportTokenCss = useMemo(() => buildDrawgleTokenCss(effectiveDesignTokens), [effectiveDesignTokens]);
  const exportGoogleFontLinks = useMemo(() => buildGoogleFontAssetLinks(effectiveDesignTokens), [effectiveDesignTokens]);
  const addScreenRefreshAttemptedRunIdRef = useRef<string | null>(null);
  const selectionMode = canvasTool === "element-select";
  const isGenerationBusy = Boolean(generationRun) || isQueueingGeneration || Boolean(pendingQueuedRunId);
  const isCanvasInteractionLocked = isGenerationBusy || elementSaving || inspectorSaving || tokenSaving || recoveryBusy;
  const isGenerationActive = Boolean(
    generationRun &&
    (generationRun.status === "queued" || generationRun.status === "planning" || generationRun.status === "building"),
  );
  const selectedElementInfo = editSession?.element ?? null;
  const nextHistorySelection = `${editSession?.screenId}:${editSession?.element.drawgleId}:${workspaceTab}`;
  if (historySelection !== nextHistorySelection) { setHistorySelection(nextHistorySelection); setHistoryOpen(false); }
  const selectedElementScreen = editSession?.screenId
    ? screens.find((screen) => screen.id === editSession.screenId) ?? null
    : null;
  const selectedElementTargetLabel = selectedElementInfo
    ? selectedElementInfo.targetType === "navigation"
      ? "Navigation"
      : selectedElementScreen?.name ?? selectedScreen?.name ?? "Screen"
    : null;
  const selectedElementCanEditText = Boolean(
    selectedElementInfo?.drawgleId &&
    (selectedElementInfo.editableMetadata?.textNodes?.length ?? 0) > 0,
  );
  const selectedElementCanEditDesign = Boolean(selectedElementInfo?.drawgleId);
  const mobilePromptReserve = 96;
  const shellLayoutVars = {
    "--dg-mobile-prompt-reserve": `${mobilePromptReserve}px`,
    "--dg-mobile-prompt-bottom": "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
    "--dg-mobile-top-reserve": "calc(env(safe-area-inset-top, 0px) + 5rem)",
  } as CSSProperties;
  useEffect(() => {
    if (!project && !isProjectLoading) {
      router.replace("/project/new");
    }
  }, [project, isProjectLoading, router]);

  useEffect(() => {
    tokenDirtyRef.current = tokenDirty;
  }, [tokenDirty]);

  useEffect(() => {
    if (tokenDirtyRef.current) {
      return;
    }

    setTokenDraft(hasApprovedDesignTokens(project?.designTokens)
      ? normalizeDesignTokens(project?.designTokens)
      : null);
  }, [project?.designTokens]);

  useEffect(() => {
    if (!selectedScreen) {
      return;
    }

    const updatedScreen = screens.find((screen) => screen.id === selectedScreen.id);
    if (!updatedScreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedScreen(null);
      if (editSession?.screenId === selectedScreen.id) {
          setEditSession(null);
      }
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
  }, [editSession?.screenId, screens, selectedScreen]);

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
    imageReferenceMode?: ImageReferenceMode;
    designTokens?: DesignTokens | null;
    sourceGenerationRunId?: string;
    targetScreenNames?: string[];
    targetScreenIds?: string[];
    plannedScreens?: ScreenPlan[] | null;
    requiresBottomNav?: boolean;
    navigationArchitecture?: NavigationArchitecture | null;
    navigationPlan?: NavigationPlan | null;
    roadmapBuild?: {
      kind: RoadmapBuildRecommendation["kind"];
      roadmapItemIds: string[];
      parentScreenId?: string | null;
    };
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
        imageReferenceMode: input.imageReferenceMode ?? "recreate",
        designTokens: input.designTokens ?? null,
        sourceGenerationRunId: input.sourceGenerationRunId,
        targetScreenNames: input.targetScreenNames,
        targetScreenIds: input.targetScreenIds,
        plannedScreens: input.plannedScreens ?? null,
        requiresBottomNav: input.requiresBottomNav,
        navigationArchitecture: input.navigationArchitecture ?? null,
        navigationPlan: input.navigationPlan ?? null,
        roadmapBuild: input.roadmapBuild,
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
        setQueueError(error.activeGenerationRunId
          ? "A generation is already queued or building for this project."
          : error.message);
        if (error.activeGenerationRunId) setPendingQueuedRunId(error.activeGenerationRunId);
      } else {
        setQueueError(error instanceof Error ? error.message : "Failed to queue generation.");
      }

      return false;
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handleRetryGeneration = async (
    run: GenerationRunData,
    options?: {
      targetScreenNames?: string[];
      targetScreenIds?: string[];
    },
  ) => {
    if (!project || isCanvasInteractionLocked) {
      return;
    }

    const targetCount = options?.targetScreenIds?.length ?? options?.targetScreenNames?.length ?? 0;
    await queueGenerationRequest({
      prompt: targetCount > 0 ? "Retry failed screens" : run.prompt,
      sourceGenerationRunId: run.id,
      targetScreenNames: options?.targetScreenNames,
      targetScreenIds: options?.targetScreenIds,
    });
  };

  const handleRetryScreen = async (screen: ScreenData) => {
    if (!project || isCanvasInteractionLocked) return;
    if (screen.status !== "failed" || !screen.generationRunId) {
      setQueueError("Only failed screens can be retried.");
      return;
    }

    const sourceRun =
      generationRuns.find((run) => run.id === screen.generationRunId) ??
      ({
        id: screen.generationRunId,
        prompt: screen.prompt || "Retry failed screen",
      } as GenerationRunData);

    await handleRetryGeneration(sourceRun, {
      targetScreenIds: [screen.id],
      targetScreenNames: [screen.name],
    });
  };

  const handleBuildRoadmapRecommendation = async (
    recommendation: RoadmapBuildRecommendation,
    selectedItemIds: string[],
  ) => {
    if (!project || isCanvasInteractionLocked) return;
    const selectedItems = recommendation.items.filter((item) => selectedItemIds.includes(item.roadmapItemId));
    if (selectedItems.length === 0) return;
    if (!loadingCredits && balance < selectedItems.length * 20) {
      setPricingReason("insufficient_credits");
      setIsPricingOpen(true);
      return;
    }

    await queueGenerationRequest({
      prompt: `Build ${selectedItems.map((item) => item.name).join(", ")} as the next contextual ${selectedItems.length === 1 ? "screen" : "screens"}.`,
      requiresBottomNav: projectNavigation?.plan?.enabled ?? undefined,
      navigationPlan: projectNavigation?.plan ?? null,
      roadmapBuild: {
        kind: recommendation.kind,
        roadmapItemIds: selectedItems.map((item) => item.roadmapItemId),
      },
    });
  };

  const handleDeleteSelectedScreen = async () => {
    if (!selectedScreen) {
      return;
    }
    if (!confirmPermanentScreenDeletion(selectedScreen.name)) return;

    try {
      const supabase = createClient();
      await deleteScreen(supabase, selectedScreen.id);
      setSelectedScreen(null);
      setEditSession(null);
    } catch (error) {
      console.error("Error deleting screen:", error);
    }
  };

  const handlePromptAction = async (options: {
    prompt: string;
    image?: PromptImagePayload | null;
    imageReferenceMode?: ImageReferenceMode;
    clientTurnId?: string; continueProductPlanning?: boolean; productAnswers?: ProductAnswers;
  }) => {
    if (!project || isCanvasInteractionLocked) {
      return false;
    }

    const prompt = options.prompt.trim();
    if (!prompt && !options.image) {
      return false;
    }

    const activeEditScreenId = editSession?.element.targetType === "navigation"
      ? null
      : editSession?.screenId ?? selectedScreen?.id ?? null;
    const activeEditElement = editSession?.element ?? null;
    const activeSelectionTargetLabel = activeEditElement
      ? activeEditElement.targetType === "navigation"
        ? "Navigation"
        : selectedElementScreen?.name ?? selectedScreen?.name ?? "Screen"
      : null;
    setQueueError(null);
    if (!activeEditElement) {
      setSelectionNotice(null);
    }

    if (activeEditElement && !activeEditElement.drawgleId) {
      setSelectionNotice("I lost the selected element identity. Please reselect the exact element and try again.");
      setEditSession(null);
      return false;
    }

    try {
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          prompt,
          image: options.image ?? null,
          imageReferenceMode: options.imageReferenceMode ?? "recreate",
          selectedScreenId: activeEditScreenId,
          focusedScreenId: selectedScreen?.id ?? null,
          selectedElementHtml: activeEditElement?.outerHTML ?? null,
          selectedElementDrawgleId: activeEditElement?.drawgleId ?? null,
          selectedElementTarget: activeEditElement?.targetType ?? null,
          selectedElementPreview: activeEditElement?.textPreview ?? null,
          selectedElementImageTargets: activeEditElement?.editableMetadata?.imageTargets ?? [],
          selectedElementSelectionVersion: editSession?.selectionVersion ?? null,
          activeSelection: activeEditElement
            ? {
              present: true,
              screenId: activeEditScreenId,
              drawgleId: activeEditElement.drawgleId,
              targetType: activeEditElement.targetType,
              targetLabel: activeSelectionTargetLabel,
              textPreview: activeEditElement.textPreview,
              outerHTML: activeEditElement.outerHTML,
              selectionVersion: editSession?.selectionVersion ?? null,
              freshness: editSession?.freshness ?? "fresh",
            }
            : {
              present: false,
              screenId: null,
              drawgleId: null,
              targetType: null,
              targetLabel: null,
              textPreview: null,
              outerHTML: null,
              selectionVersion: null,
              freshness: null,
            },
          clientTurnId: options.clientTurnId ?? null,
          productAnswers: options.productAnswers,
          continueProductPlanning: options.continueProductPlanning,
        }),
      });
      const payload = await agentRes.json().catch(() => ({}));
      if (project.productPlanning) notifyProjectChanged(project.id);

      if (!agentRes.ok) {
        throw new Error(payload.error ?? "Drawgle agent could not process the request.");
      }

      if (payload.intent === "create_new_screen" && payload.generationRunId) {
        setPendingQueuedRunId(payload.generationRunId);
        setPendingAddScreenRunId(payload.generationRunId);
        addScreenRefreshAttemptedRunIdRef.current = null;
        await refreshGenerationRuns();
      } else if (payload.intent === "modify_screen") {
        if (payload.deterministic) {
          await refreshScreens();
        }
        setEditSession((currentSession) =>
          currentSession ? { ...currentSession, mode: "selected" } : currentSession,
        );
      }

      return true;
    } catch (error) {
      console.error("Agent flow error:", error);

      try {
        const supabase = createClient();
        await insertProjectMessage(supabase, {
          projectId: project.id,
          ownerId: user.id,
          screenId: activeEditScreenId,
          role: "model",
          content: error instanceof Error ? error.message : "Sorry, I encountered an error while processing your request.",
          messageType: "error",
        });
      } catch (messageError) {
        console.error("Failed to persist agent error message", messageError);
        return false;
      }

      return false;
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handleApproveScreenPlan = async (proposalMessageId: string, selectedStateVariantIds: string[] = []) => {
    if (!project || isCanvasInteractionLocked) {
      return;
    }

    setQueueError(null);
    setIsQueueingGeneration(true);

    try {
      const response = await fetch("/api/agent/screen-plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          proposalMessageId,
          selectedStateVariantIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409 && payload.activeGenerationRunId) {
          setPendingQueuedRunId(payload.activeGenerationRunId);
          setQueueError(payload.error ?? "A generation is already queued or building for this project.");
          await refreshGenerationRuns();
          return;
        }

        throw new Error(payload.error ?? "Drawgle could not approve that screen plan.");
      }

      if (payload.generationRunId) {
        setPendingQueuedRunId(payload.generationRunId);
        setPendingAddScreenRunId(payload.generationRunId);
        addScreenRefreshAttemptedRunIdRef.current = null;
      }

      await refreshGenerationRuns();
    } catch (error) {
      console.error("Screen plan approval error:", error);
      setQueueError(error instanceof Error ? error.message : "Failed to approve screen plan.");
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const [stateParent, setStateParent] = useState<ScreenData | null>(null);
  const handleApproveScreenState = async (proposalMessageId: string) => {
    if (!project || isCanvasInteractionLocked) return;

    setQueueError(null);
    setIsQueueingGeneration(true);
    try {
      const response = await fetch("/api/agent/screen-state/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, proposalMessageId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && payload.activeGenerationRunId) {
          setPendingQueuedRunId(payload.activeGenerationRunId);
          setQueueError(payload.error ?? "A generation is already queued or building for this project.");
          await refreshGenerationRuns();
          return;
        }
        throw new Error(payload.error ?? "Drawgle could not approve that screen state.");
      }
      if (payload.generationRunId) {
        setPendingQueuedRunId(payload.generationRunId);
        setPendingAddScreenRunId(payload.generationRunId);
        addScreenRefreshAttemptedRunIdRef.current = null;
      }
      await refreshGenerationRuns();
    } catch (error) {
      console.error("Screen state approval error:", error);
      setQueueError(error instanceof Error ? error.message : "Failed to approve screen state.");
    } finally {
      setIsQueueingGeneration(false);
    }
  };

  const handleDeterministicElementEdit = async (
    operations: DeterministicEditOperation[],
    overrideScreenId?: string,
    overrideDrawgleId?: string,
    saveOptions?: EditSaveOptions,
  ) => {
    if (!project || operations.length === 0) {
      return false;
    }

    const screenId = overrideScreenId ?? editSession?.screenId;
    const drawgleId = overrideDrawgleId ?? editSession?.element.drawgleId;
    const targetType = editSession?.element.targetType ?? "screen";

    if (!screenId || !drawgleId) {
      return false;
    }

    setElementSaving(true);
    try {
      const editRes = await fetch("/api/element-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          screenId,
          targetType,
          drawgleId,
          operations,
          expectedRevision: saveOptions?.expectedRevision ?? (targetType === "navigation" ? projectNavigation?.designRevision : screens.find(screen => screen.id === screenId)?.designRevision),
          requestId: saveOptions?.requestId ?? crypto.randomUUID(),
        }),
      });

      if (!editRes.ok) {
        const payload = await editRes.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to edit selected element.");
      }

      const committed = await editRes.json() as { revision: number; changed: boolean };
      await refreshScreens();
      if (targetType === "screen") await loadScreenSource(screenId);
      notifyProjectChanged(project.id);
      setHistoryRefresh(value => value + 1);
      return committed;
    } catch (error: unknown) {
      if (saveOptions) throw error;
      setAlertModalState({ isOpen: true, title: "Could not save change", description: error instanceof Error ? error.message : "The change could not be saved." });
      return false;
    } finally { setElementSaving(false); }
  };

  const handleReplaceSelectedImage = async (target: DrawgleImageTargetMeta, file: File) => {
    if (!project || !editSession?.element.drawgleId) {
      throw new Error("Select an image before replacing it.");
    }

    const formData = new FormData();
    formData.set("projectId", project.id);
    if (editSession.screenId) {
      formData.set("screenId", editSession.screenId);
    }
    formData.set("targetKind", target.kind);
    formData.set("targetDrawgleId", target.drawgleId);
    const uploadFile = await prepareReplacementImageFile(file);
    formData.set("file", uploadFile);

    const response = await fetch("/api/user-image-assets", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to upload replacement image.");
    }

    return payload.url as string;
  };

  const handleDeleteSelectedElement = async (overrideScreenId?: string, overrideDrawgleId?: string) => {
    const screenId = overrideScreenId ?? editSession?.screenId;
    const drawgleId = overrideDrawgleId ?? editSession?.element.drawgleId;

    if (!project || !screenId || !drawgleId) {
      return;
    }

    setDeleteConfirmState({
      isOpen: true,
      screenId,
      drawgleId,
    });
  };

  const executeDeleteSelectedElement = async () => {
    if (!deleteConfirmState) return;
    const { screenId, drawgleId } = deleteConfirmState;

    try {
      const deleted = await handleDeterministicElementEdit(
        [{ type: "deleteElement", drawgleId }],
        screenId,
        drawgleId,
      );

      if (deleted) {
        clearEditSession();
      }
    } finally {
      setDeleteConfirmState(null);
    }
  };

  const handleDuplicateSelectedElement = async (screenId: string, drawgleId: string) => {
    if (!project || !screenId || !drawgleId) {
      return;
    }

    const duplicated = await handleDeterministicElementEdit(
      [{ type: "duplicateElement", drawgleId }],
      screenId,
      drawgleId,
    );

    if (duplicated) {
      clearEditSession();
    }
  };

  const handleTokenDraftChange = (nextTokens: DesignTokens) => {
    setTokenDraft(normalizeDesignTokens(nextTokens));
    setTokenDirty(true);
  };

  const handleDiscardTokenDraft = () => {
    setTokenDraft(hasApprovedDesignTokens(project?.designTokens)
      ? normalizeDesignTokens(project?.designTokens)
      : null);
    setTokenDirty(false);
  };

  const handleSaveTokenDraft = async () => {
    if (!project || !tokenDraft || !hasApprovedDesignTokens(tokenDraft) || isCanvasInteractionLocked) {
      return;
    }

    setTokenSaving(true);
    try {
      const normalized = normalizeDesignTokens(tokenDraft);
      await saveDesignTokens(project.id, normalized, project.tokenRevision ?? 0);
      setTokenDraft(normalized);
      setTokenDirty(false);
      notifyProjectChanged(project.id);
      setHistoryRefresh(value => value + 1);
      return true;
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Could not save design tokens.");
      return false;
    } finally {
      setTokenSaving(false);
    }
  };

  const clearEditSession = () => {
    editor.discard();
    setEditSession(null);
    setSelectionNotice(null);
  };

  const handleToggleSelectionMode = () => {
    if (editor.saving || recoveryBusy) return;
    if (selectionMode) { closeInspector(); setCanvasTool("pointer"); }
    else setCanvasTool("element-select");
  };

  const commitElementSelection = (info: SelectedElementInfo) => {
    const ownerScreen = screens.find((screen) => screen.id === info.screenId) ?? null;
    const nextSelectionVersion = selectionVersion + 1;

    setSelectionNotice(null);
    setSelectionVersion(nextSelectionVersion);
    setSelectedScreen(ownerScreen);
    setEditSession({
      screenId: info.screenId,
      element: info,
      mode: "selected",
      selectedAt: new Date().toISOString(),
      selectionVersion: nextSelectionVersion,
      freshness: "fresh",
    });
  };

  const handleElementSelected = (info: SelectedElementInfo) => {
    if (info.selectionReason === "rehydrated") {
      if (
        !editSession ||
        editSession.screenId !== info.screenId ||
        editSession.element.drawgleId !== info.drawgleId
      ) {
        return;
      }

      const nextSelectionVersion = editSession.selectionVersion + 1;
      setSelectionVersion((currentVersion) => Math.max(currentVersion, nextSelectionVersion));
      setEditSession((currentSession) => {
        if (
          !currentSession ||
          currentSession.screenId !== info.screenId ||
          currentSession.element.drawgleId !== info.drawgleId
        ) {
          return currentSession;
        }

        return {
          ...currentSession,
          element: info,
          selectionVersion: nextSelectionVersion,
          freshness: "fresh",
        };
      });
      setSelectionNotice(null);
      return;
    }

    if (
      editSession &&
      inspectorDirty &&
      (editSession.screenId !== info.screenId || editSession.element.drawgleId !== info.drawgleId)
    ) {
      setPendingAction(() => () => commitElementSelection(info));
      return;
    }

    commitElementSelection(info);
  };

  const handleElementSelectionLost = (info: { screenId: string; drawgleId: string; reason?: ElementSelectionLostReason }) => {
    if (
      editSession &&
      editSession.screenId === info.screenId &&
      editSession.element.drawgleId === info.drawgleId
    ) {
      if (info.reason === "rehydrate_failed") {
        if (!inspectorDirty) {
          setEditSession(null);
          setSelectionNotice("The selected element is no longer in the saved design.");
          return;
        }
        setSelectionNotice("The selected element is being verified from the saved screen before the next edit.");
        setEditSession((currentSession) =>
          currentSession &&
            currentSession.screenId === info.screenId &&
            currentSession.element.drawgleId === info.drawgleId
            ? { ...currentSession, freshness: "stale" }
            : currentSession,
        );
        return;
      }

      if (inspectorDirty) {
        if (info.reason === "click_miss") { setPendingAction(() => clearEditSession); return; }
        setSelectionNotice("The selected element changed. Your draft is retained; discard it before reselecting.");
        setEditSession(current => current ? { ...current, freshness: "stale" } : current);
        return;
      }
      setSelectionNotice("The selected element changed after the canvas refreshed. Please reselect it before asking for another selected edit.");
      setEditSession(null);
    }
  };

  const handleCanvasSelectScreen = (screen: ScreenData | null) => {
    if (!screen && editSession) {
      return;
    }

    if (inspectorDirty && screen && editSession?.screenId !== screen.id) { setPendingAction(() => () => { clearEditSession(); setSelectedScreen(screen); }); return; }
    setSelectedScreen(screen);

    if (!screen) {
      return;
    }

    if (editSession?.screenId && editSession.screenId !== screen.id) {
      if (inspectorDirty) { setPendingAction(() => () => { clearEditSession(); setSelectedScreen(screen); }); return; }
      setEditSession(null);
    }
  };

  const handleOpenVisualEditor = () => {
    if (!editSession) return;
    setCanvasTool("element-select");
    if (isMobile && mobileChatWasCollapsed.current === null) {
      mobileChatWasCollapsed.current = isChatCollapsed;
      setIsChatCollapsed(true);
    }
    setInspectorOpen(true);
  };

  const editor = useEditorDraft({ info: selectedElementInfo,
    onWorkingChange: setInspectorSaving,
    unavailable: editSession?.freshness === "stale",
    revision: selectedElementInfo?.targetType === "navigation" ? projectNavigation?.designRevision ?? 0 : selectedElementScreen?.designRevision ?? 0,
    save: (operations, options) => handleDeterministicElementEdit(operations, undefined, undefined, options),
    upload: handleReplaceSelectedImage,
  });
  const inspectorDirty = editor.dirty;
  useDraftNavigationGuard(inspectorDirty || tokenDirty, action => setPendingAction(() => action));
  const selectedElementPreview = editor.preview;
  const guardAction = (action: () => void) => {
    if (editor.saving || recoveryBusy) return;
    if (editor.dirty || tokenDirty) setPendingAction(() => action);
    else { editor.discard(); action(); }
  };
  const closeInspector = () => {
    setInspectorOpen(false);
    if (!isMobile) setCanvasTool("pointer");
    if (mobileChatWasCollapsed.current !== null) {
      setIsChatCollapsed(mobileChatWasCollapsed.current);
      mobileChatWasCollapsed.current = null;
    }
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (inspectorDirty || tokenDirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inspectorDirty, tokenDirty]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !(inspectorDirty || tokenDirty) || event.ctrlKey || event.metaKey || anchor.target === "_blank" || anchor.href === location.href) return;
      event.preventDefault(); event.stopPropagation();
      setPendingAction(() => () => router.push(anchor.href));
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [inspectorDirty, tokenDirty, router]);

  if (isProjectLoading || !project) {
    return <ProjectCanvasLoading />;
  }

  const historyControls = (<HistoryControls
              key={editSession?.element.targetType === "navigation" ? "navigation" : editSession?.screenId ??
                (workspaceTab === "design" ? "tokens" : selectedScreen?.id ?? "none")}
              projectId={project.id}
              refreshVersion={historyRefresh}
              viewOpen={historyOpen} onViewOpenChange={setHistoryOpen} panelTarget={historyPanelTarget}
              local={editor}
              onWorkingChange={setRecoveryBusy}
              target={editSession?.element.targetType === "navigation" ? { context: "navigation" } :
                editSession?.screenId ? { context: "screen", screenId: editSession.screenId } :
                workspaceTab === "design" ? { context: "tokens" } :
                selectedScreen ? { context: "screen", screenId: selectedScreen.id } : null}
              screenName={screens.find(screen => screen.id === (editSession?.screenId ?? selectedScreen?.id))?.name}
              screens={screens} onCanvasPreviewChange={showHistoryOnCanvas}
              disabledReason={tokenDirty && !editor.hasLocalHistory ? "Save or discard the current draft before using saved history." :
                isCanvasInteractionLocked ? "Wait for the active design job to finish." : null}
              onApplied={async () => { editor.discard(); setExportMenuOpen(false); notifyProjectChanged(project.id); await refreshScreens(); const recoveredScreenId = editSession?.screenId ?? selectedScreen?.id; if (recoveredScreenId) await loadScreenSource(recoveredScreenId); }}
/>);

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)]" style={shellLayoutVars}>
      <main className="relative z-0 flex h-full w-full overflow-hidden">
        <div
          data-canvas-obstacle="top"
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center gap-2"
        >
          <div className="flex h-8 items-center rounded-full dg-panel px-2 backdrop-blur-xl lg:px-3 max-sm:px-0 max-sm:h-11 max-sm:w-11">
            <Button variant="ghost" size="sm" onClick={() => guardAction(() => router.push("/project/new"))} className="h-8 rounded-full max-sm:h-11 max-sm:w-11 text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] focus-visible:bg-[var(--dg-surface-muted)] data-[state=open]:bg-[var(--dg-surface-muted)] px-2 sm:px-3 flex items-center justify-center">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Workspace</span>
            </Button>
            <div className="hidden h-5 w-px bg-[var(--dg-border-strong)] sm:block" />
            <div className="hidden max-w-[240px] truncate pl-2 text-[11px] font-semibold uppercase text-[var(--dg-text-muted)] sm:block">
              {project.name}
            </div>
          </div>
        </div>

        <HistoryPreviewBar preview={historyCanvasPreview} />

        <div
          data-canvas-obstacle="top"
          className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex items-center gap-0.5 sm:gap-3"
        >
          {/* Group 1 (Utilities): Sun/Moon theme toggle + Help contact dropdown */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5 max-sm:px-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <AnimatedThemeToggle
                      size="icon"
                      variant="circle"
                      className="h-6 w-6 rounded-full text-neutral-600 hover:bg-[#f7f7f8] focus-visible:bg-[#f7f7f8] dark:text-neutral-300 dark:hover:bg-white/10 dark:focus-visible:bg-white/10 [&_svg]:size-3.5"
                    />
                  </span>
                }
              />
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            <PremiumDropdown
              align="start"
              width={200}
              trigger={
                <button
                  type="button"
                  className="hidden h-6 w-6 items-center justify-center rounded-full text-neutral-600 sm:flex dark:text-neutral-300 hover:bg-[#f7f7f8] dark:hover:bg-white/10 focus:outline-none transition-colors cursor-pointer"
                  aria-label="Help"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              }
              header={
                <div className="text-left font-sans">
                  <div className="text-[12px] font-bold text-slate-700 dark:text-slate-300">Get in touch</div>
                </div>
              }
              items={[
                {
                  id: "x",
                  label: "Send message on X",
                  icon: MessageCircle,
                  onClick: () => window.open("https://x.com/9to5_Dad", "_blank"),
                },
                {
                  id: "email",
                  label: "Send us an email",
                  icon: Mail,
                  onClick: () => {
                    window.location.href = "mailto:support@drawgle.com";
                  },
                },
              ]}
            />
          </div>

          {/* Group 2 (Actions): Preview, Share, Export */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5 max-sm:px-1 shadow-sm">
            <PreviewShareDialog
              projectId={project.id}
              projectName={project.name}
              initialEnabled={project.publicPreviewEnabled}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Share project"
                  className="h-6 gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 hover:bg-[#f7f7f8] dark:hover:bg-white/10 flex items-center justify-center"
                >
                  <Share2 className="h-3 w-3 text-neutral-700 dark:text-neutral-300" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              }
            />
            <ExportMenu
              open={exportMenuOpen}
              onOpenChange={open => open ? guardAction(() => setExportMenuOpen(true)) : setExportMenuOpen(false)}
              project={project}
              screens={screens}
              initialScreenId={exportInitialScreenId}
              projectNavigation={projectNavigation}
              designTokens={effectiveDesignTokens}
              tokenCss={exportTokenCss}
              googleFontAssetLinks={exportGoogleFontLinks}
              tokenDirty={tokenDirty || inspectorDirty}
              generationActive={isGenerationActive}
              trigger={
                <Button
                  size="sm"
                  className="h-6 rounded-full dg-button-primary hover:dg-button-primary px-2 sm:px-3 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-all flex items-center justify-center gap-1"
                  onClick={() => setExportInitialScreenId(selectedScreen?.id || screens[0]?.id || null)}
                >
                  <Download className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              }
            />
          </div>

          {/* Credits & Upgrade pill */}
          <div className="flex h-8 shrink-0 items-center rounded-full dg-panel px-1.5 backdrop-blur-xl gap-0.5 max-sm:px-1 border border-[#1b7fcccc]/50 pl-2 shadow-[0_1px_2px_rgba(99,102,241,0.03)]">
            <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#1b7fcccc] tracking-tight select-none mr-1">
              {loadingCredits ? "..." : (
                <>
                  <CircleDollarSign className="hidden h-4 w-4 stroke-[2.5] sm:block" />
                  {balance}
                </>
              )}
            </span>
            <Button
              onClick={() => {
                setPricingReason("upgrade");
                setIsPricingOpen(true);
              }}
              size="sm"
              className="h-6 rounded-full dg-button-primary hover:dg-button-primary px-2 sm:px-3 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <CreditCard className="h-3 w-3 sm:hidden" />
              <span className="hidden sm:inline">Upgrade</span>
            </Button>
          </div>

          {/* Group 3 (User Profile): Gradient Avatar Circle with Radix Dropdown */}
          <PremiumDropdown
            align="end"
            width={220}
            trigger={
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 via-[#1b7fcc] to-blue-600 shadow-md ring-2 ring-white dark:ring-slate-800 hover:ring-blue-200 dark:hover:ring-[#1b7fcc]/60 transition-all focus:outline-none"
              >
                <span className="text-[10px] font-bold text-white uppercase select-none">
                  {user.email ? user.email.slice(0, 2) : "US"}
                </span>
              </button>
            }
            header={
              <div className="text-left">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mb-0.5">Account</div>
                <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{user.email || "user@drawgle.com"}</div>

              </div>
            }
            items={[
              {
                id: "switch",
                label: "Switch Projects",
                icon: FolderSync,
                onClick: () => guardAction(() => router.push("/project/new")),
              },
              {
                id: "account",
                label: "Account Settings",
                icon: User,
                onClick: () => guardAction(() => router.push("/account")),
              },
              {
                id: "billing",
                label: "Billing & Subscription",
                icon: CreditCard,
                onClick: () => guardAction(() => router.push("/billing")),
              },
              ...(isMobile ? [
                { id: "support-x", label: "Send message on X", icon: MessageCircle, onClick: () => window.open("https://x.com/9to5_Dad", "_blank") },
                { id: "support-email", label: "Send us an email", icon: Mail, onClick: () => { window.location.href = "mailto:support@drawgle.com"; } },
              ] : []),
              {
                id: "logout",
                label: "Log Out",
                icon: LogOut,
                variant: "destructive" as const,
                onClick: () => guardAction(() => { void handleSignOut(); }),
              },
            ]}
          />
          {isMobile && <button type="button" aria-label="Toggle visual editor sidebar" aria-expanded={inspectorOpen} disabled={!selectedElementInfo || isCanvasInteractionLocked}
            onClick={() => inspectorOpen ? closeInspector() : handleOpenVisualEditor()}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full dg-panel text-[var(--dg-text-muted)] disabled:opacity-40">
              <PanelRight size={16} />{inspectorDirty && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />}
          </button>}

        </div>

        <div className="relative h-full min-w-0 flex-1">
          {stateParent && project && <CreateStateDialog key={stateParent.id} screen={stateParent} projectId={project.id}
            busy={isCanvasInteractionLocked} onClose={() => setStateParent(null)} onQueued={async runId => {
              setPendingQueuedRunId(runId); setPendingAddScreenRunId(runId);
              addScreenRefreshAttemptedRunIdRef.current = null;
              await refreshGenerationRuns();
            }} />}
          <CanvasStage
            hasEditorDraft={inspectorDirty}
            screens={canvasScreens}
            projectNavigation={canvasNavigation}
            designTokens={canvasDesignTokens}
            generationPreview={generationPreview}
            flowPlaceholders={flowPlaceholderPhones}
            selectedScreen={selectedScreen}
            mobileBottomReserve={mobilePromptReserve}
            tool={canvasTool}
            disabled={isCanvasInteractionLocked}
            onToolChange={tool => { if (editor.saving || recoveryBusy) return; if (tool !== "element-select") closeInspector(); setCanvasTool(tool); }}
            onSelectScreen={handleCanvasSelectScreen}
            onCanvasClick={() => guardAction(() => {
              setSelectedScreen(null);
              clearEditSession();
            })}
            selectedElementScreenId={editSession?.screenId ?? null}
            selectedElementDrawgleId={editSession?.element.drawgleId ?? null}
            selectedElementPreview={selectedElementPreview}
            hasSelectedElement={Boolean(selectedElementInfo)}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            onElementSelected={handleElementSelected}
            onElementSelectionLost={handleElementSelectionLost}
            onEditSelectedText={handleOpenVisualEditor}
            onEditSelectedDesign={handleOpenVisualEditor}
            onClearSelectedElement={() => guardAction(clearEditSession)}
            onDeleteSelectedElement={(screenId, drawgleId) => guardAction(() => { void handleDeleteSelectedElement(screenId, drawgleId); })}
            onDuplicateSelectedElement={(screenId, drawgleId) => guardAction(() => { void handleDuplicateSelectedElement(screenId, drawgleId); })}
            onScreenSourceNeeded={loadScreenSource}
            onRetryScreen={screen => guardAction(() => { void handleRetryScreen(screen); })}
            onCreateState={screen => guardAction(() => setStateParent(screen))}
            onExportCode={(...exportArgs) => guardAction(() => {
              const screenName = exportArgs[2];
              const matchedScreen = screens.find((s) => s.name === screenName);
              if (matchedScreen) {
                setSelectedScreen(matchedScreen);
                setExportInitialScreenId(matchedScreen.id);
              }
              setExportMenuOpen(true);
            })}
          />


          <ConfirmationDialog
            isOpen={Boolean(deleteConfirmState?.isOpen)}
            onClose={() => setDeleteConfirmState(null)}
            onConfirm={executeDeleteSelectedElement}
            title="Delete Element"
            description="Delete this element? You can restore it using Undo after the change is saved."
            confirmText="Delete"
            cancelText="Cancel"
            variant="destructive"
          />

          <Dialog
            open={Boolean(alertModalState?.isOpen)}
            onOpenChange={(open) => !open && setAlertModalState(null)}
          >
            <DialogContent className="w-[min(420px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[24px] border border-slate-950/[0.08] bg-white p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]">
              <DialogHeader className="gap-2 px-5 pb-3 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-slate-950">
                  {alertModalState?.title || "Action Not Supported"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-600">
                  {alertModalState?.description || ""}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t border-slate-950/[0.08] bg-slate-50/80 px-5 py-4">
                <Button
                  className="h-10 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                  onClick={() => setAlertModalState(null)}
                >
                  Okay
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className={isMobile && inspectorOpen && selectionMode ? "hidden" : "contents"}>
          <ChatPanel
            onWorkspaceTabChange={tab => guardAction(() => setWorkspaceTab(tab))}
            project={project}
            screens={screens}
            selectedScreen={selectedScreen}
            generationRun={generationRun}
            generationRuns={generationRuns}
            flowFulfillments={latestApprovalRun ? { approvalId: latestApprovalRun.id, fulfillments: approvalFulfillments } : null}
            projectNavigation={projectNavigation}
            tokenDraft={tokenDraft}
            tokenDirty={tokenDirty}
            tokenSaving={tokenSaving}
            generationActive={isGenerationActive}
            onTokenDraftChange={handleTokenDraftChange}
            onSaveTokens={async () => { await handleSaveTokenDraft(); }}
            onDiscardTokens={handleDiscardTokenDraft}
            isQueueing={isQueueingGeneration || Boolean(pendingQueuedRunId)}
            queueError={queueError ?? selectionNotice}
            retryDisabled={isCanvasInteractionLocked}
            isBuilding={isQueueingGeneration}
            onRetryGeneration={(run, options) => guardAction(() => { void handleRetryGeneration(run, options); })}
            onApproveScreenPlan={(messageId, states) => guardAction(() => { void handleApproveScreenPlan(messageId, states); })}
            onApproveScreenState={messageId => guardAction(() => { void handleApproveScreenState(messageId); })}
            onBuildRoadmapRecommendation={(recommendation, ids) => guardAction(() => { void handleBuildRoadmapRecommendation(recommendation, ids); })}
            contextualSuggestionsEnabled={
              project?.charter?.projectOrigin
                ? project.charter.projectOrigin !== "image_to_ui"
                : project?.charter?.referenceDna?.referenceMode !== "user_recreate"
            }
            isCollapsed={isChatCollapsed}
            onCollapseChange={setIsChatCollapsed}
            onSubmit={async options => { if (inspectorDirty || tokenDirty) { guardAction(() => { void handlePromptAction(options); }); return false; } return handlePromptAction(options); }}
            disabled={isCanvasInteractionLocked}
            selectionMode={selectionMode}
            onToggleSelectionMode={handleToggleSelectionMode}
            onClearSelectedScreen={() => guardAction(() => {
              setSelectedScreen(null);
              setEditSession(null);
              setSelectionNotice(null);
            })}
            onDeleteSelectedScreen={() => guardAction(() => { void handleDeleteSelectedScreen(); })}
            selectedElementPreview={selectedElementInfo?.editableMetadata?.tagName ?? null}
            selectedElementTargetLabel={selectedElementTargetLabel}
            selectedElementCanEditText={selectedElementCanEditText}
            selectedElementCanEditDesign={selectedElementCanEditDesign}
            onEditSelectedText={handleOpenVisualEditor}
            onEditSelectedDesign={handleOpenVisualEditor}
            onClearSelectedElement={() => guardAction(clearEditSession)}
            onDeleteSelectedElement={() => guardAction(() => { void handleDeleteSelectedElement(); })}
          />

          </div>

          {project.productPlanning?.phase === "discovery" && screens.length === 0 && !isGenerationActive ? <PlanningEmptyCanvas /> : null}

          <VisualEditor key={`${editSession?.screenId}:${editSession?.element.drawgleId}`} historyControls={historyControls} historyOpen={historyOpen} historyPanelRef={setHistoryPanelTarget} info={selectedElementInfo} editor={editor} open={isMobile ? inspectorOpen && selectionMode : selectionMode} disabled={isCanvasInteractionLocked}
            tokens={getDrawgleTokenReferences(effectiveDesignTokens)} onClose={closeInspector}
            onDiscard={() => { if (editSession?.freshness === "stale") clearEditSession(); else editor.discard(); }}
            onDelete={() => guardAction(() => void handleDeleteSelectedElement())} />
          <Dialog open={!!pendingAction} onOpenChange={open => { if (!open && !editor.saving) setPendingAction(null); }}>
            <DialogContent><DialogHeader><DialogTitle>Keep your changes?</DialogTitle><DialogDescription>Apply or discard your pending changes before continuing.</DialogDescription></DialogHeader>
              <DialogFooter>
                <Button variant="ghost" disabled={editor.saving || tokenSaving} onClick={() => setPendingAction(null)}>Cancel</Button>
                <Button variant="outline" disabled={editor.saving || tokenSaving} onClick={() => { const action = pendingAction; editor.discard(); handleDiscardTokenDraft(); setPendingAction(null); action?.(); }}>Discard</Button>
                <Button disabled={editor.saving || tokenSaving || editor.stale} onClick={async () => { if (!await editor.apply()) return; if (tokenDirty && !await handleSaveTokenDraft()) return; const action = pendingAction; setPendingAction(null); action?.(); }}>Apply changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
