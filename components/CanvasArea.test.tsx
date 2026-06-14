import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScreenData } from "@/lib/types";

const testState = vi.hoisted(() => ({
  updateScreenPosition: vi.fn(() => Promise.resolve()),
  lastFlowProps: null as Record<string, unknown> | null,
  setViewportCalls: [] as Array<{ x: number; y: number; zoom: number }>,
  fitViewCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/supabase/queries", () => ({
  updateScreenPosition: testState.updateScreenPosition,
}));

vi.mock("./ScreenNode", () => ({
  ScreenNode: ({ screen: nodeScreen }: { screen: ScreenData }) => (
    <div data-testid={`screen-${nodeScreen.id}`}>{nodeScreen.name}</div>
  ),
}));

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  useNodesInitialized: () => true,
  useNodesState: (initialNodes: Array<Record<string, unknown>>) => {
    const [nodes, setNodes] = useState(initialNodes);
    const onNodesChange = (changes: Array<Record<string, unknown>>) => {
      setNodes((current) =>
        current.map((node) => {
          const change = changes.find((entry) => entry.id === node.id);
          if (!change) return node;
          if (change.type === "position" && change.position) {
            return { ...node, position: change.position };
          }
          if (change.type === "dimensions" && change.dimensions) {
            return { ...node, measured: change.dimensions };
          }
          return node;
        }),
      );
    };
    return [nodes, setNodes, onNodesChange];
  },
  ReactFlow: (props: Record<string, unknown>) => {
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const viewportRef = useRef(viewport);
    const propsRef = useRef(props);
    viewportRef.current = viewport;
    propsRef.current = props;
    testState.lastFlowProps = props;

    useEffect(() => {
      const instance = {
        viewportInitialized: true,
        getViewport: () => viewportRef.current,
        getZoom: () => viewportRef.current.zoom,
        setViewport: async (next: { x: number; y: number; zoom: number }) => {
          testState.setViewportCalls.push(next);
          viewportRef.current = next;
          setViewport(next);
          (props.onMove as ((event: null, value: typeof next) => void) | undefined)?.(null, next);
          return true;
        },
        getNodes: () => propsRef.current.nodes,
        getNode: (id: string) =>
          (propsRef.current.nodes as Array<{ id: string }>).find((node) => node.id === id),
        fitView: async (options: Record<string, unknown>) => {
          testState.fitViewCalls.push(options);
          const next = { x: 100, y: 80, zoom: Array.isArray(options.nodes) && options.nodes.length === 1 ? 0.8 : 0.6 };
          testState.setViewportCalls.push(next);
          viewportRef.current = next;
          setViewport(next);
          (props.onMove as ((event: null, value: typeof next) => void) | undefined)?.(null, next);
          return true;
        },
      };
      (props.onInit as ((value: typeof instance) => void) | undefined)?.(instance);
      // The mock deliberately initializes once, matching React Flow's onInit contract.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div data-testid="react-flow" data-viewport={JSON.stringify(viewport)} />;
  },
}));

import { CanvasStage } from "./CanvasArea";

const makeScreen = (id: string, x: number, y: number): ScreenData => ({
  id,
  projectId: "project",
  userId: "user",
  name: `Screen ${id}`,
  code: "<main />",
  prompt: "",
  x,
  y,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

const defaultProps = {
  screens: [makeScreen("one", 100, 100), makeScreen("two", 700, 100)],
  selectedScreen: null,
  tool: "pointer" as const,
  hasSelectedElement: false,
  selectedElementCanEditText: false,
  selectedElementCanEditDesign: false,
};

describe("CanvasStage React Flow viewport controls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    testState.lastFlowProps = null;
    testState.setViewportCalls.length = 0;
    testState.fitViewCalls.length = 0;
    testState.updateScreenPosition.mockClear();
  });

  it("changes the mounted viewport from the real zoom and reset dock controls", async () => {
    render(<CanvasStage {...defaultProps} />);
    await waitFor(() => expect(testState.setViewportCalls.length).toBeGreaterThan(0));

    const callsAfterInitialFit = testState.setViewportCalls.length;
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(testState.setViewportCalls.length).toBe(callsAfterInitialFit + 1));
    expect(screen.getByRole("button", { name: /Reset zoom to 100%/ }).textContent).not.toBe("100%");

    fireEvent.click(screen.getByRole("button", { name: /Reset zoom to 100%/ }));
    await waitFor(() => {
      expect(testState.setViewportCalls.at(-1)?.zoom).toBe(1);
      expect(screen.getByRole("button", { name: /Reset zoom to 100%/ }).textContent).toBe("100%");
    });

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await waitFor(() => expect(testState.setViewportCalls.at(-1)?.zoom).toBeLessThan(1));
  });

  it("runs Fit and shows Focus only with a selected screen", async () => {
    const { rerender } = render(<CanvasStage {...defaultProps} />);
    await waitFor(() => expect(testState.setViewportCalls.length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /Focus selected screen/ })).toBeNull();

    const callsBeforeFit = testState.setViewportCalls.length;
    fireEvent.click(screen.getByRole("button", { name: /Fit all screens/ }));
    await waitFor(() => expect(testState.setViewportCalls.length).toBe(callsBeforeFit + 1));

    rerender(<CanvasStage {...defaultProps} selectedScreen={defaultProps.screens[0]} />);
    const focus = await screen.findByRole("button", { name: /Focus selected screen/ });
    fireEvent.click(focus);
    await waitFor(() => expect(testState.setViewportCalls.at(-1)?.zoom).toBeGreaterThan(0));
    expect(testState.updateScreenPosition).not.toHaveBeenCalled();
  });

  it("persists coordinates only from a matching Pointer drag transaction", async () => {
    render(<CanvasStage {...defaultProps} />);
    await waitFor(() => expect(testState.lastFlowProps).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: /Fit all screens/ }));
    expect(testState.updateScreenPosition).not.toHaveBeenCalled();

    await act(async () => {
      const onNodeDragStart = testState.lastFlowProps?.onNodeDragStart as
        | ((event: null, node: { id: string; position: { x: number; y: number } }) => void)
        | undefined;
      const onNodeDragStop = testState.lastFlowProps?.onNodeDragStop as
        | ((event: null, node: { id: string; position: { x: number; y: number } }) => void)
        | undefined;
      onNodeDragStop?.(null, { id: "one", position: { x: 192, y: 240 } });
      onNodeDragStart?.(null, { id: "one", position: { x: 92, y: 40 } });
      onNodeDragStop?.(null, { id: "one", position: { x: 192, y: 240 } });
    });

    expect(testState.updateScreenPosition).toHaveBeenCalledOnce();
    expect(testState.updateScreenPosition).toHaveBeenCalledWith({}, "one", 200, 300);
  });

  it("accepts React Flow measurement changes without persisting coordinates", async () => {
    render(<CanvasStage {...defaultProps} />);
    await waitFor(() => expect(testState.lastFlowProps).not.toBeNull());

    expect(testState.lastFlowProps?.onNodesChange).toBeTypeOf("function");

    await act(async () => {
      const onNodesChange = testState.lastFlowProps?.onNodesChange as
        | ((changes: Array<Record<string, unknown>>) => void)
        | undefined;
      onNodesChange?.([
        { id: "one", type: "dimensions", dimensions: { width: 406, height: 920 } },
      ]);
    });

    await waitFor(() => {
      const nodes = testState.lastFlowProps?.nodes as Array<{
        id: string;
        measured?: { width: number; height: number };
      }>;
      expect(nodes.find((node) => node.id === "one")?.measured).toEqual({ width: 406, height: 920 });
    });
    expect(testState.updateScreenPosition).not.toHaveBeenCalled();
  });

  it("preserves node positions and viewport while element selection changes repeatedly", async () => {
    const { rerender } = render(
      <CanvasStage
        {...defaultProps}
        selectedScreen={defaultProps.screens[0]}
        selectedElementScreenId="one"
        selectedElementDrawgleId="first-element"
      />,
    );
    await waitFor(() => expect(testState.lastFlowProps).not.toBeNull());
    const readPositions = () =>
      (testState.lastFlowProps?.nodes as Array<{ id: string; position: { x: number; y: number } }>)
        .map(({ id, position }) => ({ id, position }));
    const initialPositions = structuredClone(readPositions());
    const initialViewport = structuredClone(testState.setViewportCalls.at(-1));
    const cameraCallCount = testState.setViewportCalls.length;

    await act(async () => {
      const onNodesChange = testState.lastFlowProps?.onNodesChange as
        | ((changes: Array<Record<string, unknown>>) => void)
        | undefined;
      onNodesChange?.([
        { id: "one", type: "dimensions", dimensions: { width: 406, height: 920 } },
      ]);
    });

    for (const drawgleId of ["second-element", "third-element", "fourth-element"]) {
      rerender(
        <CanvasStage
          {...defaultProps}
          selectedScreen={defaultProps.screens[0]}
          selectedElementScreenId="one"
          selectedElementDrawgleId={drawgleId}
        />,
      );
    }

    expect(readPositions()).toEqual(initialPositions);
    expect(
      (testState.lastFlowProps?.nodes as Array<{ id: string; measured?: unknown }>)
        .find((node) => node.id === "one")?.measured,
    ).toEqual({ width: 406, height: 920 });
    expect(testState.setViewportCalls).toHaveLength(cameraCallCount);
    expect(testState.setViewportCalls.at(-1)).toEqual(initialViewport);
    expect(testState.updateScreenPosition).not.toHaveBeenCalled();
  });

  it("keeps the canvas dock below workspace overlays", async () => {
    const { container } = render(<CanvasStage {...defaultProps} />);
    await waitFor(() => expect(testState.lastFlowProps).not.toBeNull());

    const dock = container.querySelector("[data-canvas-obstacle='bottom']");
    expect(dock?.classList.contains("z-40")).toBe(true);
    expect(dock?.className).not.toContain("z-[90]");
  });
});
