import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { effectiveCanvasFrameMode, screenFrameHeight, SCREEN_FRAME_HEIGHT } from "@/lib/canvas-interactions";
import { CANVAS_FRAME_MODE_STORAGE_KEY, resetCanvasFrameModeForTests, useCanvasFrameMode } from "./use-canvas-frame-mode";

// The test environment's own localStorage is a partial stub, so each test gets an in-memory one.
const stored = new Map<string, string>();
const storage = {
  getItem: vi.fn((key: string) => stored.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { stored.set(key, String(value)); }),
};

describe("canvas view", () => {
  beforeEach(() => {
    stored.clear();
    storage.getItem.mockImplementation((key: string) => stored.get(key) ?? null);
    storage.setItem.mockImplementation((key: string, value: string) => { stored.set(key, String(value)); });
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    resetCanvasFrameModeForTests();
  });
  afterEach(() => resetCanvasFrameModeForTests());

  it("shows phones by default and remembers the person's choice", () => {
    const { result } = renderHook(() => useCanvasFrameMode());
    expect(result.current[0]).toBe("phone");
    act(() => result.current[1]("full"));
    expect(result.current[0]).toBe("full");
    expect(stored.get(CANVAS_FRAME_MODE_STORAGE_KEY)).toBe("full");

    resetCanvasFrameModeForTests();
    expect(renderHook(() => useCanvasFrameMode()).result.current[0]).toBe("full");
  });

  it("keeps working when the browser refuses storage", () => {
    storage.getItem.mockImplementation(() => { throw new Error("blocked"); });
    storage.setItem.mockImplementation(() => { throw new Error("blocked"); });
    const { result } = renderHook(() => useCanvasFrameMode());
    expect(result.current[0]).toBe("phone");
    act(() => result.current[1]("full"));
    expect(result.current[0]).toBe("full");
  });

  it("follows a choice made in another tab, and ignores anything that isn't a view", () => {
    const { result } = renderHook(() => useCanvasFrameMode());
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: CANVAS_FRAME_MODE_STORAGE_KEY, newValue: "full" }));
    });
    expect(result.current[0]).toBe("full");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: CANVAS_FRAME_MODE_STORAGE_KEY, newValue: "tablet" }));
    });
    expect(result.current[0]).toBe("phone");
  });

  it("draws full pages while elements are being picked, and phones again with any other tool", () => {
    expect(effectiveCanvasFrameMode("phone", "element-select")).toBe("full");
    expect(effectiveCanvasFrameMode("phone", "pointer")).toBe("phone");
    expect(effectiveCanvasFrameMode("phone", "pan")).toBe("phone");
    expect(effectiveCanvasFrameMode("full", "pointer")).toBe("full");
  });

  it("gives every screen a phone's height in phone view and its own height at full length", () => {
    expect(screenFrameHeight("phone", 1640)).toBe(SCREEN_FRAME_HEIGHT);
    expect(screenFrameHeight("full", 1640)).toBe(1640);
    expect(screenFrameHeight("full", undefined)).toBe(SCREEN_FRAME_HEIGHT);
  });
});
