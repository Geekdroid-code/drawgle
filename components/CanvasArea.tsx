"use client";

import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clampCanvasScale,
  getCenteredTransform,
  getFitTransform,
  getScreenVisualBounds,
  getScreensVisualBounds,
  getVisibleWorkspace,
  getWorkspaceInsetsFromObstacles,
  getZoomAroundPointTransform,
  type CanvasBounds,
  type CanvasObstacle,
  type CanvasViewport,
} from "@/lib/canvas-camera";
import {
  EMPTY_CANVAS_INSETS,
  type CanvasNavigationMessage,
  type CanvasTool,
  type CanvasTransformState,
  type CanvasViewportInsets,
} from "@/lib/canvas-interactions";
import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";
import { CanvasToolDock } from "./CanvasToolDock";
import { ScreenNode } from "./ScreenNode";
import type { ElementSelectionLostReason, SelectedElementInfo } from "./ScreenNode";

const CANVAS_SIZE = 10000;
const DEFAULT_EMPTY_SCALE_DESKTOP = 0.7;
const DEFAULT_EMPTY_SCALE_MOBILE = 0.45;
const WHEEL_ZOOM_STEP = 0.08;
const BUTTON_ZOOM_MULTIPLIER = 1.2;
const PAN_EXCLUDED_SELECTORS = ["canvas-pan-exclude"];

const EMPTY_CANVAS_BOUNDS: CanvasBounds = {
  minX: 0,
  minY: 0,
  maxX: CANVAS_SIZE,
  maxY: CANVAS_SIZE,
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  centerX: CANVAS_SIZE / 2,
  centerY: CANVAS_SIZE / 2,
};

const isKeyboardInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

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
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
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
      ? {
          left: 16,
          right: 16,
          top: 72,
          bottom: mobileBottomReserve + 64,
        }
      : {
          left: 24,
          right: 24,
          top: 56,
          bottom: 80,
        };

  return getWorkspaceInsetsFromObstacles(
    { width: containerRect.width, height: containerRect.height },
    obstacles,
    minimumInsets,
  );
};

const CanvasContent = ({
  screens,
  projectNavigation,
  designTokens,
  selectedScreen,
  scale,
  tool,
  isTemporaryPan,
  onSelectScreen,
  onCanvasClick,
  selectedElementScreenId,
  selectedElementDrawgleId,
  onElementSelected,
  onElementSelectionLost,
  onCanvasNavigation,
  onExportCode,
}: {
  screens: ScreenData[];
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  selectedScreen?: ScreenData | null;
  scale: number;
  tool: CanvasTool;
  isTemporaryPan: boolean;
  onSelectScreen?: (screen: ScreenData | null) => void;
  onCanvasClick?: () => void;
  selectedElementScreenId?: string | null;
  selectedElementDrawgleId?: string | null;
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
}) => {
  return (
    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
      <div
        className="relative h-[10000px] w-[10000px]"
        onClick={(event) => {
          if (event.target === event.currentTarget && tool !== "pan" && !isTemporaryPan) {
            onCanvasClick?.();
          }
        }}
      >
        {screens.map((screen) => (
          <ScreenNode
            key={screen.id}
            screen={screen}
            projectNavigation={projectNavigation}
            designTokens={designTokens}
            isSelected={selectedScreen?.id === screen.id}
            onClick={() => onSelectScreen?.(screen)}
            scale={scale}
            canvasTool={tool}
            isTemporaryCanvasPan={isTemporaryPan}
            selectionMode={tool === "element-select"}
            selectedDrawgleId={
              selectedElementScreenId === screen.id ? selectedElementDrawgleId ?? null : null
            }
            onElementSelected={onElementSelected}
            onElementSelectionLost={onElementSelectionLost}
            onCanvasNavigation={onCanvasNavigation}
            onExportCode={onExportCode}
          />
        ))}
      </div>
    </TransformComponent>
  );
};

export function CanvasStage({
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
}: {
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
  onExportCode?: (
    cleanScreenCode: string,
    cleanNavigationCode: string,
    screenName: string,
    tokenCss: string,
    googleFontAssetLinks: string,
    activeNavigationItemId: string | null,
  ) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const panGestureRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const knownScreenIdsRef = useRef<Set<string>>(new Set());
  const screenIdsHydratedRef = useRef(false);
  const initialFitCompletedRef = useRef(false);
  const pendingFocusScreenIdRef = useRef<string | null>(null);
  const [initialScale, setInitialScale] = useState<number | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport | null>(null);
  const [workspaceInsets, setWorkspaceInsets] =
    useState<CanvasViewportInsets>(EMPTY_CANVAS_INSETS);
  const [cameraReadyVersion, setCameraReadyVersion] = useState(0);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMousePanning, setIsMousePanning] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const screenBounds = useMemo(() => getScreensVisualBounds(screens), [screens]);
  const visibleWorkspace = useMemo(
    () => (viewport ? getVisibleWorkspace(viewport, workspaceInsets) : null),
    [viewport, workspaceInsets],
  );
  const dockCenterX = viewport
    ? Math.min(
        Math.max(visibleWorkspace?.centerX ?? viewport.width / 2, 180),
        Math.max(180, viewport.width - 180),
      )
    : null;
  const isTemporaryPan = isSpacePressed;
  const isPanToolActive = tool === "pan" || isTemporaryPan;
  const canUseCamera = Boolean(viewport) && cameraReadyVersion > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialScale(window.innerWidth < 768 ? DEFAULT_EMPTY_SCALE_MOBILE : DEFAULT_EMPTY_SCALE_DESKTOP);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateViewport = () => {
      setViewport({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      setWorkspaceInsets(getMeasuredWorkspaceInsets(container, mobileBottomReserve));
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    const observeObstacles = () => {
      document.querySelectorAll<HTMLElement>("[data-canvas-obstacle]").forEach((element) => {
        observer.observe(element);
      });
      updateViewport();
    };
    observeObstacles();
    const mutationObserver = new MutationObserver(observeObstacles);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updateViewport);
    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [mobileBottomReserve]);

  const getCurrentTransform = useCallback((): CanvasTransformState | null => {
    const controls = cameraRef.current;
    if (!controls) {
      return null;
    }

    return {
      x: controls.instance.state.positionX,
      y: controls.instance.state.positionY,
      scale: controls.instance.state.scale,
    };
  }, []);

  const applyCameraTransform = useCallback((transform: CanvasTransformState) => {
    const controls = cameraRef.current;
    if (!controls?.instance.isInitialized) {
      return false;
    }

    controls.setTransform(transform.x, transform.y, clampCanvasScale(transform.scale), 0);
    return true;
  }, []);

  const fitAll = useCallback(() => {
    if (!viewport) {
      return false;
    }

    const transform = screenBounds
      ? getFitTransform(screenBounds, viewport, workspaceInsets)
      : getCenteredTransform(
          EMPTY_CANVAS_BOUNDS,
          viewport,
          workspaceInsets,
          viewport.width < 768 ? DEFAULT_EMPTY_SCALE_MOBILE : DEFAULT_EMPTY_SCALE_DESKTOP,
        );
    return applyCameraTransform(transform);
  }, [applyCameraTransform, screenBounds, viewport, workspaceInsets]);

  const focusScreen = useCallback(
    (screen: ScreenData | null) => {
      if (!viewport || !screen) {
        return false;
      }

      return applyCameraTransform(
        getFitTransform(getScreenVisualBounds(screen), viewport, workspaceInsets),
      );
    },
    [applyCameraTransform, viewport, workspaceInsets],
  );

  const zoomAroundPoint = useCallback(
    (nextScale: number, point: { x: number; y: number }) => {
      const current = getCurrentTransform();
      if (!current) {
        return false;
      }

      return applyCameraTransform(getZoomAroundPointTransform(current, nextScale, point));
    },
    [applyCameraTransform, getCurrentTransform],
  );

  const zoomAroundWorkspaceCenter = useCallback(
    (nextScale: number) => {
      if (!visibleWorkspace) {
        return false;
      }
      return zoomAroundPoint(nextScale, {
        x: visibleWorkspace.centerX,
        y: visibleWorkspace.centerY,
      });
    },
    [visibleWorkspace, zoomAroundPoint],
  );

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      const current = getCurrentTransform();
      if (!current) {
        return false;
      }
      return applyCameraTransform({
        x: current.x + deltaX,
        y: current.y + deltaY,
        scale: current.scale,
      });
    },
    [applyCameraTransform, getCurrentTransform],
  );

  const captureCamera = useCallback((controls: ReactZoomPanPinchContentRef | null) => {
    cameraRef.current = controls;
    if (!controls) {
      return;
    }
    setCanvasScale(controls.instance.state.scale);
    setCameraReadyVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!canUseCamera || initialFitCompletedRef.current) {
      return;
    }
    if (fitAll()) {
      initialFitCompletedRef.current = true;
    }
  }, [cameraReadyVersion, canUseCamera, fitAll]);

  useEffect(() => {
    const currentIds = new Set(screens.map((screen) => screen.id));
    if (!screenIdsHydratedRef.current) {
      screenIdsHydratedRef.current = true;
      knownScreenIdsRef.current = currentIds;
      return;
    }

    const newlyAddedScreens = screens.filter(
      (screen) => !knownScreenIdsRef.current.has(screen.id),
    );
    knownScreenIdsRef.current = currentIds;
    if (newlyAddedScreens.length === 0) {
      return;
    }

    pendingFocusScreenIdRef.current = newlyAddedScreens[newlyAddedScreens.length - 1].id;
  }, [screens]);

  useEffect(() => {
    const pendingScreenId = pendingFocusScreenIdRef.current;
    if (!canUseCamera || !pendingScreenId) {
      return;
    }

    const pendingScreen = screens.find((screen) => screen.id === pendingScreenId) ?? null;
    if (pendingScreen && focusScreen(pendingScreen)) {
      pendingFocusScreenIdRef.current = null;
    }
  }, [cameraReadyVersion, canUseCamera, focusScreen, screens]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyboardInputTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePressed(true);
        return;
      }
      if (key === "escape" || key === "v") {
        onToolChange?.("pointer");
        return;
      }
      if (key === "h") {
        onToolChange?.("pan");
        return;
      }
      if (key === "0") {
        event.preventDefault();
        zoomAroundWorkspaceCenter(1);
        return;
      }
      if (event.shiftKey && key === "1") {
        event.preventDefault();
        fitAll();
        return;
      }
      if (event.shiftKey && key === "2" && selectedScreen) {
        event.preventDefault();
        focusScreen(selectedScreen);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
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
  }, [fitAll, focusScreen, onToolChange, selectedScreen, zoomAroundWorkspaceCenter]);

  if (initialScale === null) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none dg-dashed-grid-bg"
      style={{
        cursor: isMousePanning ? "grabbing" : isPanToolActive ? "grab" : "default",
      }}
    >
      <TransformWrapper
        ref={captureCamera}
        initialScale={initialScale}
        minScale={0.1}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        smooth={false}
        doubleClick={{ disabled: true }}
        panning={{
          allowLeftClickPan: isPanToolActive,
          allowMiddleClickPan: true,
          velocityDisabled: true,
          excluded: PAN_EXCLUDED_SELECTORS,
        }}
        wheel={{ step: WHEEL_ZOOM_STEP, wheelDisabled: true }}
        trackPadPanning={{
          disabled: false,
          velocityDisabled: true,
          excluded: ["canvas-pan-exclude"],
        }}
        pinch={{ excluded: ["canvas-pan-exclude"] }}
        onInit={captureCamera}
        onPanningStart={() => setIsMousePanning(true)}
        onPanningStop={() => setIsMousePanning(false)}
        onTransform={(controls, transform) => {
          if (!cameraRef.current) {
            captureCamera(controls);
          }
          setCanvasScale(transform.scale);
        }}
      >
        {() => {
          const handleCanvasNavigation = (message: CanvasNavigationMessage) => {
            const container = containerRef.current;
            if (!container) {
              return;
            }

            if (message.type === "drawgleCanvasZoom") {
              const current = getCurrentTransform();
              if (!current) {
                return;
              }
              const rect = container.getBoundingClientRect();
              const point = {
                x: message.clientX - rect.left,
                y: message.clientY - rect.top,
              };
              zoomAroundPoint(current.scale * Math.exp(-message.deltaY * 0.0025), point);
              return;
            }
            if (message.type === "drawgleCanvasPanBy") {
              panBy(message.deltaX, message.deltaY);
              return;
            }

            const gesture = panGestureRef.current;
            if (message.type === "drawgleCanvasPanStart") {
              gesture.active = true;
              gesture.lastX = message.clientX;
              gesture.lastY = message.clientY;
              setIsMousePanning(true);
              return;
            }
            if (message.type === "drawgleCanvasPanMove" && gesture.active) {
              panBy(message.clientX - gesture.lastX, message.clientY - gesture.lastY);
              gesture.lastX = message.clientX;
              gesture.lastY = message.clientY;
              return;
            }
            if (message.type === "drawgleCanvasPanEnd") {
              gesture.active = false;
              setIsMousePanning(false);
            }
          };

          return (
            <CanvasContent
              screens={screens}
              projectNavigation={projectNavigation}
              designTokens={designTokens}
              selectedScreen={selectedScreen}
              scale={canvasScale}
              tool={tool}
              isTemporaryPan={isTemporaryPan}
              onSelectScreen={onSelectScreen}
              onCanvasClick={onCanvasClick}
              selectedElementScreenId={selectedElementScreenId}
              selectedElementDrawgleId={selectedElementDrawgleId}
              onElementSelected={onElementSelected}
              onElementSelectionLost={onElementSelectionLost}
              onCanvasNavigation={handleCanvasNavigation}
              onExportCode={onExportCode}
            />
          );
        }}
      </TransformWrapper>

      <CanvasToolDock
        tool={tool}
        zoomPercent={Math.round(canvasScale * 100)}
        canFocus={Boolean(selectedScreen)}
        hasSelectedElement={hasSelectedElement}
        selectedElementCanEditText={selectedElementCanEditText}
        selectedElementCanEditDesign={selectedElementCanEditDesign}
        disabled={disabled}
        workspaceCenterX={dockCenterX}
        onToolChange={onToolChange}
        onZoomOut={() => {
          const current = getCurrentTransform();
          if (current) {
            zoomAroundWorkspaceCenter(current.scale / BUTTON_ZOOM_MULTIPLIER);
          }
        }}
        onResetZoom={() => zoomAroundWorkspaceCenter(1)}
        onFitCanvas={fitAll}
        onFocusSelection={() => focusScreen(selectedScreen ?? null)}
        onZoomIn={() => {
          const current = getCurrentTransform();
          if (current) {
            zoomAroundWorkspaceCenter(current.scale * BUTTON_ZOOM_MULTIPLIER);
          }
        }}
        onEditSelectedText={onEditSelectedText}
        onEditSelectedDesign={onEditSelectedDesign}
        onClearSelectedElement={onClearSelectedElement}
      />
    </div>
  );
}
