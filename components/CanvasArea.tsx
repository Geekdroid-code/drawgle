"use client";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getFitTransform,
  getScreenVisualBounds,
  getScreensVisualBounds,
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

const ScreenCanvasNodeView = ({ data, dragging }: NodeProps<ScreenCanvasNode>) => (
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
);

const nodeTypes = { screen: ScreenCanvasNodeView };

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
  const [viewportSize, setViewportSize] = useState<CanvasViewport | null>(null);
  const [workspaceInsets, setWorkspaceInsets] =
    useState<CanvasViewportInsets>(EMPTY_CANVAS_INSETS);
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<ScreenCanvasNode> | null>(null);
  const [viewportState, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [localScreenPositions, setLocalScreenPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const screenBounds = useMemo(() => getScreensVisualBounds(screens), [screens]);
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
    if (!viewportSize || !screenBounds) return Promise.resolve(false);
    const transform = getFitTransform(screenBounds, viewportSize, workspaceInsets);
    return setCameraViewport(
      { x: transform.x, y: transform.y, zoom: transform.scale },
      "fit all",
    );
  }, [screenBounds, setCameraViewport, viewportSize, workspaceInsets]);

  const focusScreen = useCallback(
    (screen: ScreenData | null) => {
      if (!viewportSize || !screen) return Promise.resolve(false);
      const transform = getFitTransform(getScreenVisualBounds(screen), viewportSize, workspaceInsets);
      return setCameraViewport(
        { x: transform.x, y: transform.y, zoom: transform.scale },
        "focus screen",
      );
    },
    [setCameraViewport, viewportSize, workspaceInsets],
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

  const nodes = useMemo<ScreenCanvasNode[]>(
    () =>
      screens.map((screen) => {
        const position = localScreenPositions[screen.id] ?? { x: screen.x, y: screen.y };
        return {
          id: screen.id,
          type: "screen",
          position: {
            x: position.x - SCREEN_VISUAL_INSETS.left,
            y: position.y - SCREEN_VISUAL_INSETS.top,
          },
          draggable: tool === "pointer" && !disabled,
          selectable: false,
          selected: selectedScreen?.id === screen.id,
          data: {
            screen,
            projectNavigation,
            designTokens,
            canvasTool: tool,
            isTemporaryCanvasPan: isTemporaryPan,
            isSelected: selectedScreen?.id === screen.id,
            selectedDrawgleId:
              selectedElementScreenId === screen.id ? selectedElementDrawgleId ?? null : null,
            onElementSelected,
            onElementSelectionLost,
            // React Flow stores this callback and ScreenNode only invokes it from iframe events.
            // eslint-disable-next-line react-hooks/refs
            onCanvasNavigation: handleCanvasNavigation,
            onExportCode,
          },
          style: {
            width: SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.left + SCREEN_VISUAL_INSETS.right,
            height: SCREEN_FRAME_HEIGHT + SCREEN_VISUAL_INSETS.top + SCREEN_VISUAL_INSETS.bottom,
          },
        };
      }),
    [
      designTokens,
      disabled,
      handleCanvasNavigation,
      isTemporaryPan,
      localScreenPositions,
      onElementSelected,
      onElementSelectionLost,
      onExportCode,
      projectNavigation,
      screens,
      selectedElementDrawgleId,
      selectedElementScreenId,
      selectedScreen?.id,
      tool,
    ],
  );

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
    if (!flowInstance || !viewportSize || initialFitCompletedRef.current) return;
    initialFitCompletedRef.current = true;
    void controller.fitAll();
  }, [controller, flowInstance, viewportSize]);

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
    if (!flowInstance || !pendingId) return;
    const screen = screens.find((candidate) => candidate.id === pendingId) ?? null;
    if (!screen) return;
    void controller.focusScreen(screen).then((succeeded) => {
      if (succeeded) pendingFocusScreenIdRef.current = null;
    });
  }, [controller, flowInstance, screens]);

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
  }, [controller, onToolChange, selectedScreen]);

  const updateLocalScreenPosition = useCallback((node: ScreenCanvasNode) => {
    const x = node.position.x + SCREEN_VISUAL_INSETS.left;
    const y = node.position.y + SCREEN_VISUAL_INSETS.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[CanvasStage] Ignored invalid node drag position", {
          id: node.id,
          position: node.position,
        });
      }
      return null;
    }

    setLocalScreenPositions((current) => {
      const previous = current[node.id];
      if (previous?.x === x && previous.y === y) return current;
      return { ...current, [node.id]: { x, y } };
    });
    return { x, y };
  }, [setLocalScreenPositions]);

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
        onNodeDrag={(_, node) => {
          updateLocalScreenPosition(node);
        }}
        onNodeDragStop={(_, node) => {
          const position = updateLocalScreenPosition(node);
          if (!position) return;
          updateScreenPosition(createClient(), node.id, position.x, position.y).catch((error) => {
            setLocalScreenPositions((current) => {
              const next = { ...current };
              delete next[node.id];
              return next;
            });
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
