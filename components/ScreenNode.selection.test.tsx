import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScreenData } from "@/lib/types";

vi.mock("@trigger.dev/react-hooks", () => ({
  useRealtimeRunWithStreams: () => ({ streams: null }),
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
  afterEach(cleanup);

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
});
