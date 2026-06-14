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
import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";
import { CanvasToolDock } from "./CanvasToolDock";
import {
  ScreenNode,
  type ElementSelectionLostReason,
  type SelectedElementInfo,
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
};

type ScreenCanvasNode = Node<ScreenCanvasNodeData, "screen">;

const ScreenCanvasNodeView = memo(({ data, dragging }: NodeProps<ScreenCanvasNode>) => (
  <div
    style={{
      width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
      height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
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
      onElementSelected={data.onElementSelected}
      onElementSelectionLost={data.onElementSelectionLost}
      onCanvasNavigation={data.onCanvasNavigation}
      onExportCode={data.onExportCode}
    />
  </div>
));
ScreenCanvasNodeView.displayName = "ScreenCanvasNodeView";

const nodeTypes = { screen: ScreenCanvasNodeView };

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
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  selectedScreen?: ScreenData | null;
  mobileBottomReserve?: number;
  tool: CanvasTool;
  disabled?: boolean;
  onToolChange?: (tool: CanvasTool) => void;
  onSelectScreen?: (screen: ScreenData | null) => void;
  onCanvasClick?: () => void;
  selectedElementScreenId?: string | null;
  selectedElementDrawgleId?: string | null;
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
  projectNavigation,
  designTokens,
  selectedScreen,
  mobileBottomReserve = 96,
  tool,
  disabled,
  onToolChange,
  onSelectScreen,
  onCanvasClick,
  selectedElementScreenId,
  selectedElementDrawgleId,
  hasSelectedElement,
  selectedElementCanEditText,
  selectedElementCanEditDesign,
  onElementSelected,
  onElementSelectionLost,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
  onExportCode,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<ScreenCanvasNode> | null>(null);
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
  });
  const [viewportSize, setViewportSize] = useState<CanvasViewport | null>(null);
  const [workspaceInsets, setWorkspaceInsets] =
    useState<CanvasViewportInsets>(EMPTY_CANVAS_INSETS);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<ScreenCanvasNode> | null>(null);
  const [viewportState, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<ScreenCanvasNode>([]);
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
  const isPanToolActive = tool === "pan" || isTemporaryPan;

  useEffect(() => {
    callbackRefs.current = { onElementSelected, onElementSelectionLost, onExportCode };
  }, [onElementSelected, onElementSelectionLost, onExportCode]);

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

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      const nextPersistedPositions = new Map<string, { x: number; y: number }>();
      const nextNodes: ScreenCanvasNode[] = screens.map((screen) => {
        const current = currentById.get(screen.id);
        const selected = selectedScreen?.id === screen.id;
        const persistedPosition = { x: screen.x, y: screen.y };
        const previousPersistedPosition = persistedPositionsRef.current.get(screen.id);
        nextPersistedPositions.set(screen.id, persistedPosition);
        const nextData: ScreenCanvasNodeData = {
          screen,
          projectNavigation,
          designTokens,
          canvasTool: tool,
          isTemporaryCanvasPan: isTemporaryPan,
          isSelected: selected,
          selectedDrawgleId:
            selectedElementScreenId === screen.id ? selectedElementDrawgleId ?? null : null,
          onElementSelected: handleElementSelected,
          onElementSelectionLost: handleElementSelectionLost,
          onCanvasNavigation: handleCanvasNavigation,
          onExportCode: handleExportCode,
        };

        if (current) {
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
            draggable: tool === "pointer" && !disabled,
            selected,
            data: nextData,
          };
        }

        return {
          id: screen.id,
          type: "screen",
          position: getNodePosition(screen),
          draggable: tool === "pointer" && !disabled,
          selectable: false,
          selected,
          data: nextData,
          style: {
            width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
            height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
          },
        };
      });
      persistedPositionsRef.current = nextPersistedPositions;
      return nextNodes;
    });
  }, [
    designTokens,
    disabled,
    handleCanvasNavigation,
    handleElementSelected,
    handleElementSelectionLost,
    handleExportCode,
    isTemporaryPan,
    projectNavigation,
    screens,
    selectedElementDrawgleId,
    selectedElementScreenId,
    selectedScreen?.id,
    setNodes,
    tool,
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
      if (key === "escape" || key === "v") onToolChange?.("pointer");
      else if (key === "h") onToolChange?.("pan");
      else if (key === "p") onToolChange?.(tool === "pan" ? "pointer" : "pan");
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
  }, [controller, onToolChange, selectedScreen, tool]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<ScreenCanvasNode>[]) => {
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
      <ReactFlow<ScreenCanvasNode>
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
          if (tool === "pointer" && !isTemporaryPan) {
            const screen = screens.find((candidate) => candidate.id === node.id) ?? null;
            onSelectScreen?.(screen);
          }
        }}
        onNodeDragStart={(_, node) => {
          if (tool !== "pointer" || disabled || isTemporaryPan) return;
          dragTransactionRef.current = {
            screenId: node.id,
            startPosition: { ...node.position },
          };
        }}
        onNodeDragStop={(_, node) => {
          const transaction = dragTransactionRef.current;
          dragTransactionRef.current = null;
          if (!transaction || transaction.screenId !== node.id || tool !== "pointer") return;
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
          if (tool !== "pan" && !isTemporaryPan) onCanvasClick?.();
        }}
        onMove={(_, viewport) => setViewportState(viewport)}
        onMoveStart={() => setIsPanning(true)}
        onMoveEnd={() => setIsPanning(false)}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={tool === "pointer" && !disabled}
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
        onlyRenderVisibleElements={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--dg-border-strong)" />
      </ReactFlow>

      <CanvasToolDock
        tool={tool}
        zoomPercent={Math.round(viewportState.zoom * 100)}
        canFocus={Boolean(selectedScreen)}
        hasSelectedElement={hasSelectedElement}
        selectedElementCanEditText={selectedElementCanEditText}
        selectedElementCanEditDesign={selectedElementCanEditDesign}
        disabled={disabled}
        workspaceCenterX={dockCenterX}
        onToolChange={onToolChange}
        onZoomOut={() => void controller.zoomOut()}
        onResetZoom={() => void controller.resetZoom()}
        onFitCanvas={() => void controller.fitAll()}
        onFocusSelection={() => void controller.focusScreen(selectedScreen ?? null)}
        onZoomIn={() => void controller.zoomIn()}
        onEditSelectedText={onEditSelectedText}
        onEditSelectedDesign={onEditSelectedDesign}
        onClearSelectedElement={onClearSelectedElement}
      />
    </div>
  );
}
