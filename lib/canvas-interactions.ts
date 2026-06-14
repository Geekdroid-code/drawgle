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

// Includes the external label, frame buttons, glow, and lower drag badge spacing.
export const SCREEN_VISUAL_INSETS: CanvasViewportInsets = {
  top: 60,
  right: 8,
  bottom: 16,
  left: 8,
};

export const EMPTY_CANVAS_INSETS: CanvasViewportInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
