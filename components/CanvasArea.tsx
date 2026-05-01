"use client";

import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScreenNode, SCREEN_FRAME_HEIGHT, SCREEN_FRAME_WIDTH } from "./ScreenNode";
import type { SelectedElementInfo } from "./ScreenNode";

import type { DesignTokens, ProjectNavigationData, ScreenData } from "@/lib/types";

const CANVAS_SIZE = 10000;
const DEFAULT_EMPTY_SCALE_DESKTOP = 0.7;
const DEFAULT_EMPTY_SCALE_MOBILE = 0.45;
const MIN_CANVAS_SCALE = 0.1;
const MAX_CANVAS_SCALE = 4;
const FIT_SCALE_REDUCTION = 0.9;
const CHAT_PANEL_RESERVED_WIDTH = 416;
const WHEEL_ZOOM_STEP = 0.02;
const PAN_EXCLUDED_SELECTORS = ["canvas-pan-exclude"];
const INITIAL_FIT_REQUEST_VERSION = 0;
const MOBILE_TOP_RESERVED_HEIGHT = 88;
const MOBILE_DEFAULT_BOTTOM_RESERVED_HEIGHT = 150;
// Vertical space reserved for the external label bar above each phone frame.
// Must match the `paddingTop` / top-shift in ScreenNode (currently 44 px).
const SCREEN_LABEL_BAR_HEIGHT = 16;

type ViewportSize = {
  width: number;
  height: number;
};

type ScreenBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const clampScale = (scale: number) => Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, scale));

const getUsableViewport = (viewport: ViewportSize, mobileBottomReserve = MOBILE_DEFAULT_BOTTOM_RESERVED_HEIGHT) => {
  if (viewport.width >= 768) {
    return {
      top: 0,
      bottom: 0,
      width: viewport.width,
      height: viewport.height,
      centerY: viewport.height / 2,
    };
  }

  const top = MOBILE_TOP_RESERVED_HEIGHT;
  const bottom = mobileBottomReserve;
  const height = Math.max(280, viewport.height - top - bottom);

  return {
    top,
    bottom,
    width: viewport.width,
    height,
    centerY: top + height / 2,
  };
};

const getScreenBounds = (screens: ScreenData[]): ScreenBounds | null => {
  if (screens.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const screen of screens) {
    minX = Math.min(minX, screen.x);
    // Include the label bar that floats above the phone frame.
    minY = Math.min(minY, screen.y - SCREEN_LABEL_BAR_HEIGHT);
    maxX = Math.max(maxX, screen.x + SCREEN_FRAME_WIDTH);
    maxY = Math.max(maxY, screen.y + SCREEN_FRAME_HEIGHT);
  }

  const width = Math.max(maxX - minX, SCREEN_FRAME_WIDTH);
  const height = Math.max(maxY - minY, SCREEN_FRAME_HEIGHT);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
};

const getFitTransform = (screenBounds: ScreenBounds, viewport: ViewportSize, mobileBottomReserve?: number) => {
  const usableViewport = getUsableViewport(viewport, mobileBottomReserve);
  const scale = clampScale(Math.min(usableViewport.width / screenBounds.width, usableViewport.height / screenBounds.height) * FIT_SCALE_REDUCTION);

  return {
    positionX: viewport.width / 2 - screenBounds.centerX * scale,
    positionY: usableViewport.centerY - screenBounds.centerY * scale,
    scale,
  };
};

const getSelectedScreenTransform = (screen: ScreenData, viewport: ViewportSize, scale: number, mobileBottomReserve?: number) => {
  const usableViewport = getUsableViewport(viewport, mobileBottomReserve);
  const reservedWidth = viewport.width >= 768 ? CHAT_PANEL_RESERVED_WIDTH : 0;
  const visualCenterX = viewport.width / 2 + reservedWidth / 2;
  const centerX = screen.x + SCREEN_FRAME_WIDTH / 2;
  // Offset the vertical centre upward by half the label bar so the
  // phone + its label appear visually centred in the viewport.
  const centerY = screen.y + SCREEN_FRAME_HEIGHT / 2 - SCREEN_LABEL_BAR_HEIGHT / 2;

  return {
    positionX: visualCenterX - centerX * scale,
    positionY: usableViewport.centerY - centerY * scale,
    scale: clampScale(scale),
  };
};

const getEmptyCanvasTransform = (viewport: ViewportSize, mobileBottomReserve?: number) => {
  const usableViewport = getUsableViewport(viewport, mobileBottomReserve);
  const scale = viewport.width < 768 ? DEFAULT_EMPTY_SCALE_MOBILE : DEFAULT_EMPTY_SCALE_DESKTOP;

  return {
    positionX: viewport.width / 2 - (CANVAS_SIZE / 2) * scale,
    positionY: usableViewport.centerY - (CANVAS_SIZE / 2) * scale,
    scale,
  };
};

const CanvasControls = ({
  fitRequestVersion,
  screenBounds,
  selectedScreen,
  viewport,
  mobileBottomReserve,
}: {
  fitRequestVersion: number;
  screenBounds: ScreenBounds | null;
  selectedScreen: ScreenData | null;
  viewport: ViewportSize | null;
  mobileBottomReserve?: number;
}) => {
  const { setTransform, state } = useControls();
  const lastHandledFitRequestRef = useRef(INITIAL_FIT_REQUEST_VERSION);
  const lastSelectedSnapshotRef = useRef<{ id: string | null; x: number | null; y: number | null; scale: number | null }>({
    id: null,
    x: null,
    y: null,
    scale: null,
  });

  useEffect(() => {
    if (!viewport || fitRequestVersion === lastHandledFitRequestRef.current) {
      return;
    }

    lastHandledFitRequestRef.current = fitRequestVersion;

    if (!screenBounds || selectedScreen) {
      return;
    }

    const transform = getFitTransform(screenBounds, viewport, mobileBottomReserve);
    setTransform(transform.positionX, transform.positionY, transform.scale, 450);
  }, [fitRequestVersion, mobileBottomReserve, screenBounds, selectedScreen, setTransform, viewport]);

  useEffect(() => {
    if (!viewport || !selectedScreen) {
      lastSelectedSnapshotRef.current = { id: null, x: null, y: null, scale: null };
      return;
    }

    const previousSnapshot = lastSelectedSnapshotRef.current;
    const positionChanged = previousSnapshot.id !== selectedScreen.id || previousSnapshot.x !== selectedScreen.x || previousSnapshot.y !== selectedScreen.y;
    const scaleChanged = previousSnapshot.scale !== state.scale;

    lastSelectedSnapshotRef.current = {
      id: selectedScreen.id,
      x: selectedScreen.x,
      y: selectedScreen.y,
      scale: state.scale,
    };

    const transform = getSelectedScreenTransform(selectedScreen, viewport, state.scale, mobileBottomReserve);
    if (!positionChanged && !scaleChanged) {
      return;
    }

    const animationTime = positionChanged ? 400 : 0;

    setTransform(transform.positionX, transform.positionY, transform.scale, animationTime);
  }, [mobileBottomReserve, selectedScreen, setTransform, state.scale, viewport]);

  // Removed maximize/reset button and logic as requested

  // Custom zoom handlers for smooth 10% zoom steps
  const ZOOM_STEP = 1.05; // 5% zoom step
  const handleZoomIn = () => {
    const newScale = clampScale(state.scale * ZOOM_STEP);
    setTransform(state.positionX, state.positionY, newScale, 200);
  };

  const handleZoomOut = () => {
    const newScale = clampScale(state.scale / ZOOM_STEP);
    setTransform(state.positionX, state.positionY, newScale, 200);
  };

  return (
    <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50 flex h-8 items-center gap-1 rounded-full dg-panel px-1.5 backdrop-blur-xl">
      <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 rounded-full hover:bg-[#f7f7f8]">
        <ZoomIn className="h-4 w-4 text-gray-700" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 rounded-full hover:bg-[#f7f7f8]">
        <ZoomOut className="h-4 w-4 text-gray-700" />
      </Button>
    </div>
  );
};

const CanvasContent = ({
  screens,
  projectNavigation,
  designTokens,
  selectedScreen,
  onSelectScreen,
  selectionMode,
  preserveSelectionOnCanvasClick,
  selectedElementScreenId,
  selectedElementDrawgleId,
  onElementSelected,
}: {
  screens: ScreenData[];
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  selectedScreen?: ScreenData | null;
  onSelectScreen?: (screen: ScreenData | null) => void;
  selectionMode?: boolean;
  preserveSelectionOnCanvasClick?: boolean;
  selectedElementScreenId?: string | null;
  selectedElementDrawgleId?: string | null;
  onElementSelected?: (info: SelectedElementInfo) => void;
}) => {
  const { state } = useControls();
  const scale = state.scale;

  return (
    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
      <div
        className="w-[10000px] h-[10000px] relative"
        onClick={(e) => {
          if (e.target === e.currentTarget && !preserveSelectionOnCanvasClick) {
            onSelectScreen?.(null);
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
            selectionMode={selectionMode}
            selectedDrawgleId={selectedElementScreenId === screen.id ? selectedElementDrawgleId ?? null : null}
            onElementSelected={selectionMode ? onElementSelected : undefined}
          />
        ))}
      </div>
    </TransformComponent>
  );
};

export function CanvasArea({
  screens,
  projectNavigation,
  designTokens,
  fitRequestVersion = INITIAL_FIT_REQUEST_VERSION,
  selectedScreen,
  mobileBottomReserve = MOBILE_DEFAULT_BOTTOM_RESERVED_HEIGHT,
  onSelectScreen,
  selectionMode,
  preserveSelectionOnCanvasClick,
  selectedElementScreenId,
  selectedElementDrawgleId,
  onElementSelected,
}: {
  screens: ScreenData[];
  projectNavigation?: ProjectNavigationData | null;
  designTokens?: DesignTokens | null;
  fitRequestVersion?: number;
  selectedScreen?: ScreenData | null;
  mobileBottomReserve?: number;
  onSelectScreen?: (screen: ScreenData | null) => void;
  selectionMode?: boolean;
  preserveSelectionOnCanvasClick?: boolean;
  selectedElementScreenId?: string | null;
  selectedElementDrawgleId?: string | null;
  onElementSelected?: (info: SelectedElementInfo) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialScale, setInitialScale] = useState<number | null>(null);
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const screenBounds = useMemo(() => getScreenBounds(screens), [screens]);

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
    };

    updateViewport();

    const observer = new ResizeObserver(() => {
      updateViewport();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (initialScale === null) return null;

  return (
    <div ref={containerRef} className="relative h-full w-full dg-dashed-grid-bg">
      <TransformWrapper
        initialScale={initialScale}
        minScale={MIN_CANVAS_SCALE}
        maxScale={MAX_CANVAS_SCALE}
        centerOnInit
        limitToBounds={false}
        smooth={false}
        doubleClick={{ disabled: true }}
        panning={{ allowLeftClickPan: true, allowMiddleClickPan: true, excluded: PAN_EXCLUDED_SELECTORS }}
        wheel={{ step: WHEEL_ZOOM_STEP }}
      >
        <>
          <CanvasControls
            fitRequestVersion={fitRequestVersion}
            screenBounds={screenBounds}
            selectedScreen={selectedScreen || null}
            viewport={viewport}
            mobileBottomReserve={mobileBottomReserve}
          />
          <CanvasContent
            screens={screens}
            projectNavigation={projectNavigation}
            designTokens={designTokens}
            selectedScreen={selectedScreen}
            onSelectScreen={onSelectScreen}
            selectionMode={selectionMode}
            preserveSelectionOnCanvasClick={preserveSelectionOnCanvasClick}
            selectedElementScreenId={selectedElementScreenId}
            selectedElementDrawgleId={selectedElementDrawgleId}
            onElementSelected={onElementSelected}
          />
        </>
      </TransformWrapper>
    </div>
  );
}
