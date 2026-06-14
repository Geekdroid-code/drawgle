import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CANVAS_SCALE,
  MIN_CANVAS_SCALE,
  clampCanvasScale,
  getFitTransform,
  getScreenVisualBounds,
  getScreensVisualBounds,
  getVisibleWorkspace,
  getWorkspaceInsetsFromObstacles,
  getZoomAroundPointTransform,
} from "./canvas-camera";

test("visible workspace accounts for overlay insets", () => {
  const workspace = getVisibleWorkspace(
    { width: 1200, height: 800 },
    { top: 64, right: 24, bottom: 80, left: 420 },
  );

  assert.deepEqual(workspace, {
    left: 420,
    top: 64,
    right: 1176,
    bottom: 720,
    width: 756,
    height: 656,
    centerX: 798,
    centerY: 392,
  });
});

test("workspace obstacle measurements produce framing insets", () => {
  const insets = getWorkspaceInsetsFromObstacles(
    { width: 1400, height: 900 },
    [
      { role: "left", left: 16, top: 80, right: 420, bottom: 880 },
      { role: "right", left: 960, top: 64, right: 1384, bottom: 884 },
      { role: "top", left: 16, top: 16, right: 240, bottom: 48 },
      { role: "bottom", left: 520, top: 820, right: 880, bottom: 868 },
    ],
    { top: 56, right: 24, bottom: 80, left: 24 },
  );

  assert.deepEqual(insets, { top: 60, right: 452, bottom: 92, left: 432 });
});

test("fit transform centers all screen bounds in the visible workspace", () => {
  const bounds = getScreensVisualBounds([
    { x: 100, y: 200 },
    { x: 700, y: 200 },
  ]);
  assert.ok(bounds);

  const transform = getFitTransform(
    bounds,
    { width: 1400, height: 900 },
    { top: 60, right: 20, bottom: 100, left: 420 },
  );

  const workspace = getVisibleWorkspace(
    { width: 1400, height: 900 },
    { top: 60, right: 20, bottom: 100, left: 420 },
  );
  assert.equal(
    Math.round(bounds.centerX * transform.scale + transform.x),
    Math.round(workspace.centerX),
  );
  assert.equal(
    Math.round(bounds.centerY * transform.scale + transform.y),
    Math.round(workspace.centerY),
  );
});

test("focus bounds include the screen label and frame decorations", () => {
  const bounds = getScreenVisualBounds({ x: 100, y: 200 });

  assert.ok(bounds.minX < 100);
  assert.ok(bounds.minY < 200);
  assert.ok(bounds.maxX > 490);
  assert.ok(bounds.maxY > 1044);
});

test("focus transform centers the selected screen in the visible workspace", () => {
  const viewport = { width: 1200, height: 800 };
  const insets = { top: 60, right: 24, bottom: 92, left: 432 };
  const bounds = getScreenVisualBounds({ x: 1800, y: 1200 });
  const transform = getFitTransform(bounds, viewport, insets);
  const workspace = getVisibleWorkspace(viewport, insets);

  assert.equal(
    Math.round(bounds.centerX * transform.scale + transform.x),
    Math.round(workspace.centerX),
  );
  assert.equal(
    Math.round(bounds.centerY * transform.scale + transform.y),
    Math.round(workspace.centerY),
  );
});

test("zoom around point preserves the focal canvas coordinate", () => {
  const state = { x: -300, y: -200, scale: 0.5 };
  const point = { x: 700, y: 400 };
  const before = {
    x: (point.x - state.x) / state.scale,
    y: (point.y - state.y) / state.scale,
  };

  const next = getZoomAroundPointTransform(state, 1.25, point);
  const after = {
    x: (point.x - next.x) / next.scale,
    y: (point.y - next.y) / next.scale,
  };

  assert.deepEqual(after, before);
});

test("scale clamping retains the supported zoom range", () => {
  assert.equal(clampCanvasScale(0.01), MIN_CANVAS_SCALE);
  assert.equal(clampCanvasScale(8), MAX_CANVAS_SCALE);
});
