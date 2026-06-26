import type { ScreenData } from "@/lib/types";
import {
  SCREEN_FRAME_HEIGHT,
  SCREEN_FRAME_WIDTH,
  SCREEN_VISUAL_INSETS,
  type CanvasPoint,
  type CanvasTransformState,
  type CanvasViewportInsets,
} from "@/lib/canvas-interactions";

export const MIN_CANVAS_SCALE = 0.1;
export const MAX_CANVAS_SCALE = 4;
export const FIT_SCALE_REDUCTION = 0.9;

export type CanvasViewport = {
  width: number;
  height: number;
};

export type CanvasObstacle = {
  role: "left" | "right" | "top" | "bottom";
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type CanvasBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type VisibleWorkspace = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export const clampCanvasScale = (scale: number) =>
  Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, scale));

export const getWorkspaceInsetsFromObstacles = (
  viewport: CanvasViewport,
  obstacles: CanvasObstacle[],
  minimumInsets: CanvasViewportInsets,
): CanvasViewportInsets => {
  const insets = { ...minimumInsets };

  for (const obstacle of obstacles) {
    if (obstacle.role === "left") {
      insets.left = Math.max(insets.left, obstacle.right + 12);
    } else if (obstacle.role === "right") {
      insets.right = Math.max(insets.right, viewport.width - obstacle.left + 12);
    } else if (obstacle.role === "top") {
      insets.top = Math.max(insets.top, obstacle.bottom + 12);
    } else {
      insets.bottom = Math.max(insets.bottom, viewport.height - obstacle.top + 12);
    }
  }

  return insets;
};

export const getVisibleWorkspace = (
  viewport: CanvasViewport,
  insets: CanvasViewportInsets,
): VisibleWorkspace => {
  const left = Math.max(0, insets.left);
  const top = Math.max(0, insets.top);
  const right = Math.max(left, viewport.width - Math.max(0, insets.right));
  const bottom = Math.max(top, viewport.height - Math.max(0, insets.bottom));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

export const getScreenVisualBounds = (
  screen: Pick<ScreenData, "x" | "y"> & { height?: number },
): CanvasBounds => {
  const minX = screen.x - SCREEN_VISUAL_INSETS.left;
  const minY = screen.y - SCREEN_VISUAL_INSETS.top;
  const maxX = screen.x + SCREEN_FRAME_WIDTH + SCREEN_VISUAL_INSETS.right;
  const screenHeight = screen.height ?? SCREEN_FRAME_HEIGHT;
  const maxY = screen.y + screenHeight + SCREEN_VISUAL_INSETS.bottom;
  const width = maxX - minX;
  const height = maxY - minY;

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

export const getScreensVisualBounds = (
  screens: Array<Pick<ScreenData, "x" | "y"> & { height?: number }>,
): CanvasBounds | null => {
  if (screens.length === 0) {
    return null;
  }

  const first = getScreenVisualBounds(screens[0]);
  let minX = first.minX;
  let minY = first.minY;
  let maxX = first.maxX;
  let maxY = first.maxY;

  for (const screen of screens.slice(1)) {
    const bounds = getScreenVisualBounds(screen);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  const width = maxX - minX;
  const height = maxY - minY;

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

export const getFitTransform = (
  bounds: CanvasBounds,
  viewport: CanvasViewport,
  insets: CanvasViewportInsets,
): CanvasTransformState => {
  const workspace = getVisibleWorkspace(viewport, insets);
  const scale = clampCanvasScale(
    Math.min(workspace.width / bounds.width, workspace.height / bounds.height) *
      FIT_SCALE_REDUCTION,
  );

  return {
    x: workspace.centerX - bounds.centerX * scale,
    y: workspace.centerY - bounds.centerY * scale,
    scale,
  };
};

export const getCenteredTransform = (
  bounds: CanvasBounds,
  viewport: CanvasViewport,
  insets: CanvasViewportInsets,
  scale: number,
): CanvasTransformState => {
  const workspace = getVisibleWorkspace(viewport, insets);
  const nextScale = clampCanvasScale(scale);

  return {
    x: workspace.centerX - bounds.centerX * nextScale,
    y: workspace.centerY - bounds.centerY * nextScale,
    scale: nextScale,
  };
};

export const getZoomAroundPointTransform = (
  state: CanvasTransformState,
  nextScale: number,
  point: CanvasPoint,
): CanvasTransformState => {
  const scale = clampCanvasScale(nextScale);
  const canvasX = (point.x - state.x) / state.scale;
  const canvasY = (point.y - state.y) / state.scale;

  return {
    x: point.x - canvasX * scale,
    y: point.y - canvasY * scale,
    scale,
  };
};
