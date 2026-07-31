"use client";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
  useNodesInitialized,
  useNodesState,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getVisibleWorkspace,
  getWorkspaceInsetsFromObstacles,
  getZoomAroundPointTransform,
  type CanvasObstacle,
  type CanvasViewport,
} from "@/lib/canvas-camera";
import {
  EMPTY_CANVAS_INSETS,
  SCREEN_FRAME_HEIGHT,
  SCREEN_FRAME_WIDTH,
  SCREEN_VISUAL_INSETS,
  type CanvasNavigationMessage,
  type CanvasTool,
  type CanvasViewportInsets,
} from "@/lib/canvas-interactions";
import { createClient } from "@/lib/supabase/client";
import { updateScreenPosition } from "@/lib/supabase/queries";
import type { DesignTokens, GenerationPreviewMetadata, ProjectNavigationData, ScreenData } from "@/lib/types";
import { CanvasToolDock } from "./CanvasToolDock";
import {
  ScreenNode,
  type ElementSelectionLostReason,
  type SelectedElementInfo,
  type SelectedElementPreviewPayload,
} from "./ScreenNode";

const BUTTON_ZOOM_MULTIPLIER = 1.2;
const CAMERA_ANIMATION_MS = 0;
const NODE_TOP_PADDING = SCREEN_VISUAL_INSETS.top - 8;

const isKeyboardInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']",
    ),
  );
};

const getMeasuredWorkspaceInsets = (
  container: HTMLElement,
  mobileBottomReserve: number,
): CanvasViewportInsets => {
  const containerRect = container.getBoundingClientRect();
  const obstacles: CanvasObstacle[] = [];

  document.querySelectorAll<HTMLElement>("[data-canvas-obstacle]").forEach((element) => {
    const style = window.getComputedStyle(element);
    if (element === container || style.display === "none" || style.visibility === "hidden") {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const role = element.dataset.canvasObstacle as CanvasObstacle["role"] | undefined;
    const isFullWidthOverlay =
      (role === "left" || role === "right") && rect.width > containerRect.width * 0.7;
    if (role && !isFullWidthOverlay) {
      obstacles.push({
        role,
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        right: rect.right - containerRect.left,
        bottom: rect.bottom - containerRect.top,
      });
    }
  });

  const minimumInsets =
    containerRect.width < 768
      ? { left: 16, right: 16, top: 72, bottom: mobileBottomReserve + 64 }
      : { left: 24, right: 24, top: 56, bottom: 80 };

  return getWorkspaceInsetsFromObstacles(
    { width: containerRect.width, height: containerRect.height },
    obstacles,
    minimumInsets,
  );
};

type ScreenCanvasNodeData = {
  screen: ScreenData;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  canvasTool: CanvasTool;
  isTemporaryCanvasPan: boolean;
  isSelected: boolean;
  selectedDrawgleId: string | null;
  selectedElementPreview?: SelectedElementPreviewPayload | null;
  readOnly?: boolean;
  height?: number;
  onContentHeightChange?: (screenId: string, height: number) => void;
  onScreenSourceNeeded?: (screenId: string) => void;
  onElementSelected?: (info: SelectedElementInfo) => void;
  onElementSelectionLost?: (info: {
    screenId: string;
    drawgleId: string;
    reason?: ElementSelectionLostReason;
  }) => void;
  onCanvasNavigation?: (message: CanvasNavigationMessage) => void;
  onExportCode?: (
    cleanScreenCode: string,
    cleanNavigationCode: string,
    screenName: string,
    tokenCss: string,
    googleFontAssetLinks: string,
    activeNavigationItemId: string | null,
  ) => void;
  onDeleteSelectedElement?: (screenId: string, drawgleId: string) => void;
  onDuplicateSelectedElement?: (screenId: string, drawgleId: string) => void;
  onRetryScreen?: (screen: ScreenData) => void;
};

type ScreenCanvasNode = Node<ScreenCanvasNodeData, "screen">;

type PlannedCanvasNodeData = {
  screen: GenerationPreviewMetadata["screens"][number];
  stage: GenerationPreviewMetadata["stage"];
};

type PlannedCanvasNode = Node<PlannedCanvasNodeData, "planned">;
type CanvasNode = ScreenCanvasNode | PlannedCanvasNode;

const plannedStageCopy: Record<GenerationPreviewMetadata["stage"], string> = {
  screen_briefs: "Writing screen brief",
  asset_resolution: "Preparing project assets",
  building: "Waiting for screen builder",
};

const PlannedCanvasNodeView = memo(({ data }: NodeProps<PlannedCanvasNode>) => (
  <div
    className="pointer-events-none select-none"
    style={{
      width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
      height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
      paddingTop: NODE_TOP_PADDING,
      paddingRight: SCREEN_VISUAL_INSETS.right,
      paddingBottom: SCREEN_VISUAL_INSETS.bottom,
      paddingLeft: SCREEN_VISUAL_INSETS.left,
    }}
  >
    <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500">
      <span>{data.screen.name}</span>
      <span className="font-medium text-slate-400">Planned</span>
    </div>
    <div className="flex h-[744px] w-[343px] flex-col overflow-hidden rounded-[32px] border border-dashed border-slate-300 bg-white/75 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-500">{plannedStageCopy[data.stage]}</div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-slate-800">{data.screen.name}</div>
      <div className="mt-1 text-xs capitalize text-slate-400">{data.screen.type} screen</div>
      <div className="mt-8 h-36 animate-pulse rounded-[22px] bg-slate-100" />
      <div className="mt-5 h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-[18px] bg-slate-100" />
        <div className="h-28 animate-pulse rounded-[18px] bg-slate-100" />
      </div>
    </div>
  </div>
));
PlannedCanvasNodeView.displayName = "PlannedCanvasNodeView";

const ScreenCanvasNodeView = memo(({ data, dragging }: NodeProps<ScreenCanvasNode>) => {
  const nodeHeight = data.height ?? SCREEN_FRAME_HEIGHT;
  const screenId = data.screen.id;
  const sourceLoaded = data.screen.sourceLoaded;
  const requestScreenSource = data.onScreenSourceNeeded;
  useEffect(() => {
    if (sourceLoaded === false) {
      requestScreenSource?.(screenId);
    }
  }, [requestScreenSource, screenId, sourceLoaded]);
  return (
    <div
      style={{
        width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
        height: nodeHeight + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
        paddingTop: NODE_TOP_PADDING,
        paddingRight: SCREEN_VISUAL_INSETS.right,
        paddingBottom: SCREEN_VISUAL_INSETS.bottom,
        paddingLeft: SCREEN_VISUAL_INSETS.left,
      }}
    >
      <ScreenNode
        screen={data.screen}
        projectNavigation={data.projectNavigation}
        designTokens={data.designTokens}
        isSelected={data.isSelected}
        isDragging={dragging}
        canvasTool={data.canvasTool}
        isTemporaryCanvasPan={data.isTemporaryCanvasPan}
        selectionMode={data.canvasTool === "element-select"}
        selectedDrawgleId={data.selectedDrawgleId}
        selectedElementPreview={data.selectedElementPreview ?? null}
        readOnly={data.readOnly}
        onElementSelected={data.onElementSelected}
        onElementSelectionLost={data.onElementSelectionLost}
        onCanvasNavigation={data.onCanvasNavigation}
        onExportCode={data.onExportCode}
        onContentHeightChange={data.onContentHeightChange}
        onDeleteSelectedElement={data.onDeleteSelectedElement}
        onDuplicateSelectedElement={data.onDuplicateSelectedElement}
        onRetryScreen={data.onRetryScreen}
      />
    </div>
  );
});
ScreenCanvasNodeView.displayName = "ScreenCanvasNodeView";

const nodeTypes = { screen: ScreenCanvasNodeView, planned: PlannedCanvasNodeView };

const getNodePosition = (screen: Pick<ScreenData, "x" | "y">) => ({
  x: screen.x - SCREEN_VISUAL_INSETS.left,
  y: screen.y - SCREEN_VISUAL_INSETS.top,
});

const getScreenPosition = (node: Pick<ScreenCanvasNode, "position">) => ({
  x: node.position.x + SCREEN_VISUAL_INSETS.left,
  y: node.position.y + SCREEN_VISUAL_INSETS.top,
});

export type CanvasViewportController = {
  zoomIn: () => Promise<boolean>;
  zoomOut: () => Promise<boolean>;
  resetZoom: () => Promise<boolean>;
  fitAll: () => Promise<boolean>;
  focusScreen: (screen: ScreenData | null) => Promise<boolean>;
  panBy: (deltaX: number, deltaY: number) => Promise<boolean>;
  zoomAt: (nextZoom: number, point: { x: number; y: number }) => Promise<boolean>;
};

type CanvasStageProps = {
  screens: ScreenData[];
  generationPreview?: GenerationPreviewMetadata | null;
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  selectedScreen?: ScreenData | null;
  mobileBottomReserve?: number;
  tool: CanvasTool;
  disabled?: boolean;
  readOnly?: boolean;
  onToolChange?: (tool: CanvasTool) => void;
  onSelectScreen?: (screen: ScreenData | null) => void;
  onCanvasClick?: () => void;
  selectedElementScreenId?: string | null;
  selectedElementDrawgleId?: string | null;
  selectedElementPreview?: SelectedElementPreviewPayload | null;
  hasSelectedElement: boolean;
  selectedElementCanEditText: boolean;
  selectedElementCanEditDesign: boolean;
  onElementSelected?: (info: SelectedElementInfo) => void;
  onElementSelectionLost?: (info: {
    screenId: string;
    drawgleId: string;
    reason?: ElementSelectionLostReason;
  }) => void;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  onClearSelectedElement?: () => void;
  onExportCode?: ScreenCanvasNodeData["onExportCode"];
  onDeleteSelectedElement?: (screenId: string, drawgleId: string) => void;
  onDuplicateSelectedElement?: (screenId: string, drawgleId: string) => void;
  onScreenSourceNeeded?: (screenId: string) => void;
  onRetryScreen?: (screen: ScreenData) => void;
};

export function CanvasStage(props: CanvasStageProps) {
  return (
    <ReactFlowProvider>
      <CanvasStageContent {...props} />
    </ReactFlowProvider>
  );
}

function CanvasStageContent({
  screens,
  generationPreview,
  projectNavigation,
  designTokens,
  selectedScreen,
  mobileBottomReserve = 96,
  tool,
  disabled,
  readOnly,
  onToolChange,
  onSelectScreen,
  onCanvasClick,
  selectedElementScreenId,
  selectedElementDrawgleId,
  selectedElementPreview,
  hasSelectedElement,
  selectedElementCanEditText,
  selectedElementCanEditDesign,
  onElementSelected,
  onElementSelectionLost,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
  onExportCode,
  onDeleteSelectedElement,
  onDuplicateSelectedElement,
  onScreenSourceNeeded,
  onRetryScreen,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<CanvasNode> | null>(null);
  const knownScreenIdsRef = useRef<Set<string>>(new Set());
  const hydratedScreenIdsRef = useRef(false);
  const initialFitCompletedRef = useRef(false);
  const pendingFocusScreenIdRef = useRef<string | null>(null);
  const iframePanRef = useRef({ active: false, x: 0, y: 0 });
  const dragTransactionRef = useRef<{
    screenId: string;
    startPosition: { x: number; y: number };
  } | null>(null);
  const persistedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const callbackRefs = useRef({
    onElementSelected,
    onElementSelectionLost,
    onExportCode,
    onDeleteSelectedElement,
    onDuplicateSelectedElement,
    onScreenSourceNeeded,
    onRetryScreen,
  });
  const [viewportSize, setViewportSize] = useState<CanvasViewport | null>(null);
  const [workspaceInsets, setWorkspaceInsets] =
    useState<CanvasViewportInsets>(EMPTY_CANVAS_INSETS);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<CanvasNode> | null>(null);
  const [viewportState, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [screenHeights, setScreenHeights] = useState<Record<string, number>>({});

  const handleContentHeightChange = useCallback((screenId: string, height: number) => {
    setScreenHeights((prev) => {
      const currentHeight = prev[screenId] ?? SCREEN_FRAME_HEIGHT;
      if (Math.abs(currentHeight - height) <= 4) return prev;
      return { ...prev, [screenId]: height };
    });
  }, []);

  const nodesInitialized = useNodesInitialized();
  const visibleWorkspace = useMemo(
    () => (viewportSize ? getVisibleWorkspace(viewportSize, workspaceInsets) : null),
    [viewportSize, workspaceInsets],
  );
  const dockCenterX = viewportSize
    ? Math.min(
        Math.max(visibleWorkspace?.centerX ?? viewportSize.width / 2, 180),
        Math.max(180, viewportSize.width - 180),
      )
    : null;
  const isTemporaryPan = isSpacePressed;
  const activeTool = readOnly && tool === "element-select" ? "pointer" : tool;
  const isPanToolActive = activeTool === "pan" || isTemporaryPan;
  const changeTool = useCallback(
    (nextTool: CanvasTool) => {
      if (readOnly && nextTool === "element-select") return;
      onToolChange?.(nextTool);
    },
    [onToolChange, readOnly],
  );

  useEffect(() => {
    callbackRefs.current = {
      onElementSelected,
      onElementSelectionLost,
      onExportCode,
      onDeleteSelectedElement,
      onDuplicateSelectedElement,
      onScreenSourceNeeded,
      onRetryScreen,
    };
  }, [onElementSelected, onElementSelectionLost, onExportCode, onDeleteSelectedElement, onDuplicateSelectedElement, onScreenSourceNeeded, onRetryScreen]);

  const reportCommand = useCallback(async (name: string, command: () => Promise<boolean>) => {
    const succeeded = await command();
    if (!succeeded && process.env.NODE_ENV !== "production") {
      console.error(`[CanvasViewportController] ${name} failed`);
    }
    return succeeded;
  }, []);

  const setCameraViewport = useCallback(
    (viewport: Viewport, name: string, duration = CAMERA_ANIMATION_MS) => {
      const instance = flowRef.current;
      if (!instance?.viewportInitialized) return Promise.resolve(false);
      return reportCommand(name, () => instance.setViewport(viewport, { duration }));
    },
    [reportCommand],
  );

  const zoomAt = useCallback(
    (nextZoom: number, point: { x: number; y: number }) => {
      const instance = flowRef.current;
      if (!instance?.viewportInitialized) return Promise.resolve(false);
      const current = instance.getViewport();
      const next = getZoomAroundPointTransform(
        { x: current.x, y: current.y, scale: current.zoom },
        nextZoom,
        point,
      );
      return setCameraViewport({ x: next.x, y: next.y, zoom: next.scale }, "focal zoom");
    },
    [setCameraViewport],
  );

  const zoomAroundWorkspaceCenter = useCallback(
    (nextZoom: number) =>
      visibleWorkspace
        ? zoomAt(nextZoom, {
            x: visibleWorkspace.centerX,
            y: visibleWorkspace.centerY,
          })
        : Promise.resolve(false),
    [visibleWorkspace, zoomAt],
  );

  const fitAll = useCallback(() => {
    const instance = flowRef.current;
    if (!instance?.viewportInitialized || !nodesInitialized || instance.getNodes().length === 0) {
      return Promise.resolve(false);
    }
    return reportCommand("fit all", () =>
      instance.fitView({
        nodes: instance.getNodes(),
        padding: 0.12,
        minZoom: 0.1,
        maxZoom: 4,
        duration: CAMERA_ANIMATION_MS,
      }),
    );
  }, [nodesInitialized, reportCommand]);

  const focusScreen = useCallback(
    (screen: ScreenData | null) => {
      const instance = flowRef.current;
      if (!instance?.viewportInitialized || !nodesInitialized || !screen) {
        return Promise.resolve(false);
      }
      const node = instance.getNode(screen.id);
      if (!node) return Promise.resolve(false);
      return reportCommand("focus screen", () =>
        instance.fitView({
          nodes: [node],
          padding: 0.16,
          minZoom: 0.1,
          maxZoom: 4,
          duration: CAMERA_ANIMATION_MS,
        }),
      );
    },
    [nodesInitialized, reportCommand],
  );

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      const instance = flowRef.current;
      if (!instance?.viewportInitialized) return Promise.resolve(false);
      const current = instance.getViewport();
      return setCameraViewport(
        { x: current.x + deltaX, y: current.y + deltaY, zoom: current.zoom },
        "pan",
        0,
      );
    },
    [setCameraViewport],
  );

  const controller = useMemo<CanvasViewportController>(
    () => ({
      zoomIn: () => zoomAroundWorkspaceCenter(viewportState.zoom * BUTTON_ZOOM_MULTIPLIER),
      zoomOut: () => zoomAroundWorkspaceCenter(viewportState.zoom / BUTTON_ZOOM_MULTIPLIER),
      resetZoom: () => zoomAroundWorkspaceCenter(1),
      fitAll,
      focusScreen,
      panBy,
      zoomAt,
    }),
    [fitAll, focusScreen, panBy, viewportState.zoom, zoomAroundWorkspaceCenter, zoomAt],
  );

  const handleCanvasNavigation = useCallback(
    (message: CanvasNavigationMessage) => {
      const container = containerRef.current;
      const instance = flowRef.current;
      if (!container || !instance) return;

      if (message.type === "drawgleCanvasZoom") {
        const rect = container.getBoundingClientRect();
        void controller.zoomAt(instance.getZoom() * Math.exp(-message.deltaY * 0.0025), {
          x: message.clientX - rect.left,
          y: message.clientY - rect.top,
        });
        return;
      }
      if (message.type === "drawgleCanvasPanBy") {
        void controller.panBy(message.deltaX, message.deltaY);
        return;
      }

      const gesture = iframePanRef.current;
      if (message.type === "drawgleCanvasPanStart") {
        gesture.active = true;
        gesture.x = message.clientX;
        gesture.y = message.clientY;
        setIsPanning(true);
      } else if (message.type === "drawgleCanvasPanMove" && gesture.active) {
        void controller.panBy(message.clientX - gesture.x, message.clientY - gesture.y);
        gesture.x = message.clientX;
        gesture.y = message.clientY;
      } else if (message.type === "drawgleCanvasPanEnd") {
        gesture.active = false;
        setIsPanning(false);
      }
    },
    [controller, setIsPanning],
  );

  const handleElementSelected = useCallback((info: SelectedElementInfo) => {
    callbackRefs.current.onElementSelected?.(info);
  }, []);
  const handleElementSelectionLost = useCallback(
    (info: { screenId: string; drawgleId: string; reason?: ElementSelectionLostReason }) => {
      callbackRefs.current.onElementSelectionLost?.(info);
    },
    [],
  );
  const handleExportCode = useCallback<NonNullable<ScreenCanvasNodeData["onExportCode"]>>(
    (...args) => callbackRefs.current.onExportCode?.(...args),
    [],
  );
  const handleDeleteSelectedElement = useCallback<NonNullable<ScreenCanvasNodeData["onDeleteSelectedElement"]>>(
    (screenId, drawgleId) => callbackRefs.current.onDeleteSelectedElement?.(screenId, drawgleId),
    [],
  );
  const handleDuplicateSelectedElement = useCallback<NonNullable<ScreenCanvasNodeData["onDuplicateSelectedElement"]>>(
    (screenId, drawgleId) => callbackRefs.current.onDuplicateSelectedElement?.(screenId, drawgleId),
    [],
  );
  const handleScreenSourceNeeded = useCallback<NonNullable<ScreenCanvasNodeData["onScreenSourceNeeded"]>>(
    (screenId) => callbackRefs.current.onScreenSourceNeeded?.(screenId),
    [],
  );
  const handleRetryScreen = useCallback<NonNullable<ScreenCanvasNodeData["onRetryScreen"]>>(
    (screen) => callbackRefs.current.onRetryScreen?.(screen),
    [],
  );

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      const nextPersistedPositions = new Map<string, { x: number; y: number }>();
      const nextNodes: CanvasNode[] = screens.map((screen) => {
        const current = currentById.get(screen.id);
        const selected = selectedScreen?.id === screen.id;
        const persistedPosition = { x: screen.x, y: screen.y };
        const previousPersistedPosition = persistedPositionsRef.current.get(screen.id);
        nextPersistedPositions.set(screen.id, persistedPosition);

        const screenHeight = screenHeights[screen.id] ?? SCREEN_FRAME_HEIGHT;
        const nodeHeight = screenHeight + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom;

        const nextData: ScreenCanvasNodeData = {
          screen,
          projectNavigation,
          designTokens,
          canvasTool: activeTool,
          isTemporaryCanvasPan: isTemporaryPan,
          isSelected: selected,
          selectedDrawgleId:
            selectedElementScreenId === screen.id ? selectedElementDrawgleId ?? null : null,
          selectedElementPreview:
            selectedElementScreenId === screen.id ? selectedElementPreview ?? null : null,
          readOnly,
          height: screenHeight,
          onContentHeightChange: handleContentHeightChange,
          onElementSelected: readOnly ? undefined : handleElementSelected,
          onElementSelectionLost: readOnly ? undefined : handleElementSelectionLost,
          onCanvasNavigation: handleCanvasNavigation,
          onExportCode: readOnly ? undefined : handleExportCode,
          onDeleteSelectedElement: readOnly ? undefined : handleDeleteSelectedElement,
          onDuplicateSelectedElement: readOnly ? undefined : handleDuplicateSelectedElement,
          onScreenSourceNeeded: handleScreenSourceNeeded,
          onRetryScreen: readOnly ? undefined : handleRetryScreen,
        };

        if (current?.type === "screen") {
          const dragOwnsPosition = dragTransactionRef.current?.screenId === screen.id;
          const persistedPositionChanged =
            !previousPersistedPosition ||
            previousPersistedPosition.x !== persistedPosition.x ||
            previousPersistedPosition.y !== persistedPosition.y;
          return {
            ...current,
            position:
              !dragOwnsPosition && persistedPositionChanged
                ? getNodePosition(screen)
                : current.position,
            draggable: activeTool === "pointer" && !disabled && !readOnly,
            selected,
            data: nextData,
            style: {
              ...current.style,
              width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
              height: nodeHeight,
            },
          };
        }

        return {
          id: screen.id,
          type: "screen",
          position: getNodePosition(screen),
          draggable: activeTool === "pointer" && !disabled && !readOnly,
          selectable: false,
          selected,
          data: nextData,
          style: {
            width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
            height: nodeHeight,
          },
        };
      });
      persistedPositionsRef.current = nextPersistedPositions;
      const previewBaseX = screens.length > 0
        ? Math.max(...screens.map((screen) => screen.x)) + 450
        : 4800;
      const previewBaseY = screens[0]?.y ?? 4600;
      const previewNodes: PlannedCanvasNode[] = (generationPreview?.screens ?? []).map((screen, index) => ({
        id: `generation-preview:${screen.stableKey}`,
        type: "planned",
        position: {
          x: previewBaseX + index * 450 - SCREEN_VISUAL_INSETS.left,
          y: previewBaseY - SCREEN_VISUAL_INSETS.top,
        },
        draggable: false,
        selectable: false,
        data: { screen, stage: generationPreview?.stage ?? "screen_briefs" },
        style: {
          width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
          height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
        },
      }));
      return [...nextNodes, ...previewNodes];
    });
  }, [
    designTokens,
    disabled,
    generationPreview,
    handleCanvasNavigation,
    handleContentHeightChange,
    handleDeleteSelectedElement,
    handleDuplicateSelectedElement,
    handleElementSelected,
    handleElementSelectionLost,
    handleExportCode,
    handleScreenSourceNeeded,
    isTemporaryPan,
    projectNavigation,
    readOnly,
    screenHeights,
    screens,
    selectedElementDrawgleId,
    selectedElementPreview,
    selectedElementScreenId,
    selectedScreen?.id,
    setNodes,
    activeTool,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateMeasurements = () => {
      setViewportSize({ width: container.clientWidth, height: container.clientHeight });
      setWorkspaceInsets(getMeasuredWorkspaceInsets(container, mobileBottomReserve));
    };
    updateMeasurements();
    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(container);
    const observeObstacles = () => {
      document.querySelectorAll<HTMLElement>("[data-canvas-obstacle]").forEach((element) => {
        resizeObserver.observe(element);
      });
      updateMeasurements();
    };
    observeObstacles();
    const mutationObserver = new MutationObserver(observeObstacles);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updateMeasurements);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [mobileBottomReserve]);

  useEffect(() => {
    if (
      !flowInstance ||
      !viewportSize ||
      !nodesInitialized ||
      nodes.length === 0 ||
      initialFitCompletedRef.current
    ) {
      return;
    }
    void controller.fitAll().then((succeeded) => {
      if (succeeded) initialFitCompletedRef.current = true;
    });
  }, [controller, flowInstance, nodes.length, nodesInitialized, viewportSize]);

  useEffect(() => {
    const currentIds = new Set(screens.map((screen) => screen.id));
    if (!hydratedScreenIdsRef.current) {
      hydratedScreenIdsRef.current = true;
      knownScreenIdsRef.current = currentIds;
      return;
    }
    const newlyAdded = screens.filter((screen) => !knownScreenIdsRef.current.has(screen.id));
    knownScreenIdsRef.current = currentIds;
    if (newlyAdded.length > 0) {
      pendingFocusScreenIdRef.current = newlyAdded[newlyAdded.length - 1].id;
    }
  }, [screens]);

  useEffect(() => {
    const pendingId = pendingFocusScreenIdRef.current;
    if (!flowInstance || !nodesInitialized || !pendingId) return;
    const screen = screens.find((candidate) => candidate.id === pendingId) ?? null;
    if (!screen) return;
    void controller.focusScreen(screen).then((succeeded) => {
      if (succeeded) pendingFocusScreenIdRef.current = null;
    });
  }, [controller, flowInstance, nodesInitialized, screens]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyboardInputTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.code === "Space") {
        setIsSpacePressed(true);
        return;
      }
      if (key === "escape" || key === "v") changeTool("pointer");
      else if (key === "h") changeTool("pan");
      else if (key === "p") changeTool(activeTool === "pan" ? "pointer" : "pan");
      else if (key === "0") {
        event.preventDefault();
        void controller.resetZoom();
      } else if (event.shiftKey && key === "1") {
        event.preventDefault();
        void controller.fitAll();
      } else if (event.shiftKey && key === "2" && selectedScreen) {
        event.preventDefault();
        void controller.focusScreen(selectedScreen);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsSpacePressed(false);
    };
    const handleBlur = () => setIsSpacePressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [activeTool, changeTool, controller, selectedScreen]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full dg-dashed-grid-bg select-none"
      style={{ cursor: isPanning ? "grabbing" : isPanToolActive ? "grab" : "default" }}
    >
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onInit={(instance) => {
          flowRef.current = instance;
          setFlowInstance(instance);
          setViewportState(instance.getViewport());
        }}
        onNodeClick={(_, node) => {
          if (node.type !== "screen") return;
          if (activeTool === "pointer" && !isTemporaryPan) {
            const screen = screens.find((candidate) => candidate.id === node.id) ?? null;
            onSelectScreen?.(screen);
          }
        }}
        onNodeDragStart={(_, node) => {
          if (node.type !== "screen") return;
          if (activeTool !== "pointer" || disabled || readOnly || isTemporaryPan) return;
          dragTransactionRef.current = {
            screenId: node.id,
            startPosition: { ...node.position },
          };
        }}
        onNodeDragStop={(_, node) => {
          if (node.type !== "screen") return;
          const transaction = dragTransactionRef.current;
          dragTransactionRef.current = null;
          if (!transaction || transaction.screenId !== node.id || activeTool !== "pointer" || readOnly) return;
          if (
            transaction.startPosition.x === node.position.x &&
            transaction.startPosition.y === node.position.y
          ) {
            return;
          }
          const position = getScreenPosition(node);
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
          updateScreenPosition(createClient(), node.id, position.x, position.y).catch((error) => {
            const persistedScreen = screens.find((screen) => screen.id === node.id);
            if (persistedScreen) {
              setNodes((current) =>
                current.map((entry) =>
                  entry.id === node.id ? { ...entry, position: getNodePosition(persistedScreen) } : entry,
                ),
              );
            }
            console.error("Failed to save screen position", error);
          });
        }}
        onPaneClick={() => {
          if (activeTool !== "pan" && !isTemporaryPan) onCanvasClick?.();
        }}
        onMove={(_, viewport) => setViewportState(viewport)}
        onMoveStart={() => setIsPanning(true)}
        onMoveEnd={() => setIsPanning(false)}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={activeTool === "pointer" && !disabled && !readOnly}
        nodesConnectable={false}
        elementsSelectable={false}
        selectionOnDrag={false}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        deleteKeyCode={null}
        autoPanOnNodeDrag={false}
        autoPanOnNodeFocus={false}
        panOnDrag={isPanToolActive ? [0, 1] : [1]}
        panActivationKeyCode="Space"
        panOnScroll
        zoomOnScroll
        zoomActivationKeyCode={["Meta", "Control"]}
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--dg-border-strong)" />
      </ReactFlow>

      <CanvasToolDock
        tool={activeTool}
        zoomPercent={Math.round(viewportState.zoom * 100)}
        canFocus={Boolean(selectedScreen)}
        disabled={disabled}
        readOnly={readOnly}
        workspaceCenterX={dockCenterX}
        onToolChange={changeTool}
        onZoomOut={() => void controller.zoomOut()}
        onResetZoom={() => void controller.resetZoom()}
        onFitCanvas={() => void controller.fitAll()}
        onFocusSelection={() => void controller.focusScreen(selectedScreen ?? null)}
        onZoomIn={() => void controller.zoomIn()}
      />
    </div>
  );
}
