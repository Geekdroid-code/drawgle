import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScreenData } from "@/lib/types";

const triggerState = vi.hoisted(() => ({ streams: null as Record<string, string[]> | null }));

vi.mock("@trigger.dev/react-hooks", () => ({
  useRealtimeRunWithStreams: () => ({ streams: triggerState.streams }),
}));

import { ScreenNode } from "./ScreenNode";

const screen: ScreenData = {
  id: "selection-screen",
  projectId: "project",
  userId: "user",
  name: "Selection screen",
  code: "<main><button>Choose me</button></main>",
  prompt: "",
  x: 100,
  y: 100,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("ScreenNode element selection messaging", () => {
  afterEach(() => {
    triggerState.streams = null;
    vi.restoreAllMocks();
    cleanup();
  });

  it("marks streamed generation output as provisional until it is committed", () => {
    triggerState.streams = {
      code: ['<div class="min-h-screen"><h1>Preview</h1></div>'],
    };
    const buildingScreen: ScreenData = {
      ...screen,
      status: "building",
      triggerRunId: "run_building",
      streamPublicToken: "public-token",
    };

    const { getByRole } = render(<ScreenNode screen={buildingScreen} />);

    expect(getByRole("status").textContent).toContain("Finalizing");
  });

  it("shows the source preloader only for explicitly unloaded screen code", () => {
    const { container, rerender } = render(<ScreenNode screen={screen} readOnly />);

    expect(container.querySelector(".drawgle-preload-scan")).toBeNull();

    rerender(<ScreenNode screen={{ ...screen, sourceLoaded: false }} readOnly />);

    expect(container.querySelector(".drawgle-preload-scan")).not.toBeNull();
  });

  it("updates only the highlight when selectedDrawgleId changes", async () => {
    const { container, rerender } = render(
      <ScreenNode screen={screen} selectionMode selectedDrawgleId={null} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.contentWindow).toBeTruthy();
    const postMessage = vi.spyOn(iframe!.contentWindow!, "postMessage");

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe!.contentWindow,
          data: { type: "drawgleIframeReady" },
        }),
      );
    });
    postMessage.mockClear();

    rerender(
      <ScreenNode screen={screen} selectionMode selectedDrawgleId="selected-element" />,
    );

    const messageTypes = postMessage.mock.calls.map(([message]) => message.type);
    expect(messageTypes).toContain("setSelectedDrawgleId");
    expect(messageTypes).not.toContain("updateCode");
  });
  it("sends style previews without enabling class replacement", async () => {
    const { container, rerender } = render(
      <ScreenNode screen={screen} selectionMode selectedDrawgleId="dg-button" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.contentWindow).toBeTruthy();
    const postMessage = vi.spyOn(iframe!.contentWindow!, "postMessage");

    await act(async () => {
      rerender(
        <ScreenNode
          screen={screen}
          selectionMode
          selectedDrawgleId="dg-button"
          selectedElementPreview={{
            drawgleId: "dg-button",
            styles: { "padding-top": "24px" },
            className: "p-0 rounded-none",
          }}
        />,
      );
    });

    const previewMessage = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "previewSelectedElement");

    expect(previewMessage).toMatchObject({
      type: "previewSelectedElement",
      drawgleId: "dg-button",
      styles: { "padding-top": "24px" },
      className: "p-0 rounded-none",
      allowClassNamePreview: false,
    });
  });

  it("allows class replacement only for explicit class previews", async () => {
    const { container, rerender } = render(
      <ScreenNode screen={screen} selectionMode selectedDrawgleId="dg-button" />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.contentWindow).toBeTruthy();
    const postMessage = vi.spyOn(iframe!.contentWindow!, "postMessage");

    await act(async () => {
      rerender(
        <ScreenNode
          screen={screen}
          selectionMode
          selectedDrawgleId="dg-button"
          selectedElementPreview={{
            drawgleId: "dg-button",
            styles: {},
            className: "flex rounded-xl dg-surface-card",
            allowClassNamePreview: true,
          }}
        />,
      );
    });

    const previewMessage = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "previewSelectedElement");

    expect(previewMessage).toMatchObject({
      type: "previewSelectedElement",
      className: "flex rounded-xl dg-surface-card",
      allowClassNamePreview: true,
    });
  });

  it("guards iframe class replacement behind the explicit preview flag", () => {
    const { container } = render(<ScreenNode screen={screen} selectionMode />);
    const iframe = container.querySelector("iframe");

    expect(iframe?.getAttribute("srcdoc")).toContain("payload.allowClassNamePreview === true && typeof payload.className === 'string'");
  });

  it("keeps generated HTML hidden until Tailwind utilities are actually computed", () => {
    const { container } = render(<ScreenNode screen={screen} />);
    const srcDoc = container.querySelector("iframe")?.getAttribute("srcdoc") ?? "";

    expect(srcDoc).toContain("html:not([data-drawgle-style-ready]) #root");
    expect(srcDoc).toContain("function isTailwindCssApplied()");
    expect(srcDoc).toContain("if (styleRuntimeReady && isTailwindCssApplied())");
    expect(srcDoc).not.toContain("if (window.tailwind && !window.__drawgleTailwindLoadFailed)");
    expect(srcDoc).toContain("Preview styling could not load. Refresh to retry; the saved screen is safe.");
  });

  it("persists one bounded rendered-quality report per code hash and viewport", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { container } = render(<ScreenNode screen={screen} />);
    const iframe = container.querySelector("iframe");
    const payload = {
      type: "drawgleQualityDiagnostics",
      codeHash: "fnv1a-12345678",
      viewport: { width: 390, height: 844 },
      issues: [{ code: "horizontal_overflow", drawgleId: null, measured: { scrollWidth: 400 } }],
    };

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { source: iframe!.contentWindow, data: payload }));
      window.dispatchEvent(new MessageEvent("message", { source: iframe!.contentWindow, data: payload }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/screens/selection-screen/quality-diagnostics",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("never writes rendered-quality telemetry from read-only previews", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { container } = render(<ScreenNode screen={screen} readOnly />);
    const iframe = container.querySelector("iframe");

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: iframe!.contentWindow,
        data: {
          type: "drawgleQualityDiagnostics",
          codeHash: "fnv1a-12345678",
          viewport: { width: 390, height: 844 },
          issues: [],
        },
      }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
