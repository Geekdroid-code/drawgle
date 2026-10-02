export type CanvasTool = "pointer" | "element-select" | "pan";

export type CanvasViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasTransformState = CanvasPoint & {
  scale: number;
};

export type CanvasNavigationMessage =
  | {
      type: "drawgleCanvasZoom";
      clientX: number;
      clientY: number;
      deltaY: number;
    }
  | {
      type: "drawgleCanvasPanStart";
      clientX: number;
      clientY: number;
    }
  | {
      type: "drawgleCanvasPanMove";
      clientX: number;
      clientY: number;
    }
  | {
      type: "drawgleCanvasPanEnd";
    }
  | {
      type: "drawgleCanvasPanBy";
      deltaX: number;
      deltaY: number;
    };

export const SCREEN_FRAME_WIDTH = 390;
export const SCREEN_FRAME_HEIGHT = 844;

/**
 * How the canvas draws screens: "phone" shows every screen as a 390×844 phone whose page scrolls inside it, with the
 * shared bar pinned; "full" shows each page at its full height, for reading and editing. Phone view is the default.
 */
export type CanvasFrameMode = "full" | "phone";
export const DEFAULT_CANVAS_FRAME_MODE: CanvasFrameMode = "phone";
/** Device-like corners for a screen in phone view; a full-length page keeps the plain card corners. */
export const PHONE_FRAME_RADIUS = 36;
export const FULL_FRAME_RADIUS = 16;

/**
 * The view the canvas draws: picking an element needs the whole page (a phone's page can't be scrolled while
 * picking), so phone view steps aside while the select tool is on.
 */
export const effectiveCanvasFrameMode = (preferred: CanvasFrameMode, tool: CanvasTool): CanvasFrameMode =>
  tool === "element-select" ? "full" : preferred;

/** A screen's frame height on the canvas: a phone in phone view, otherwise its measured page height. */
export const screenFrameHeight = (mode: CanvasFrameMode, measuredHeight?: number | null) =>
  mode === "phone" ? SCREEN_FRAME_HEIGHT : measuredHeight ?? SCREEN_FRAME_HEIGHT;

// Includes the external label, frame buttons, glow, and lower drag badge spacing.
export const SCREEN_VISUAL_INSETS: CanvasViewportInsets = {
  top: 60,
  right: 4,
  bottom: 12,
  left: 4,
};

export const EMPTY_CANVAS_INSETS: CanvasViewportInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
