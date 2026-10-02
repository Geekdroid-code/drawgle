import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScreenData } from "@/lib/types";

vi.mock("@trigger.dev/react-hooks", () => ({
  useRealtimeRunWithStreams: () => ({ streams: null }),
}));

import { ScreenNode } from "./ScreenNode";

const screen: ScreenData = {
  id: "frame-screen",
  projectId: "project",
  userId: "user",
  name: "Feed",
  code: "<main><h1>Feed</h1><section style=\"height:1600px\">Long page</section></main>",
  prompt: "",
  x: 100,
  y: 100,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

/** The phone-shaped container that holds the iframe. */
const frameOf = (container: HTMLElement) => container.querySelector("iframe")!.parentElement as HTMLElement;

async function readyIframe(container: HTMLElement) {
  const iframe = container.querySelector("iframe")!;
  const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", { source: iframe.contentWindow, data: { type: "drawgleIframeReady" } }));
  });
  return { iframe, postMessage };
}

const viewportMessages = (postMessage: ReturnType<typeof vi.spyOn>) =>
  postMessage.mock.calls.map(([message]) => message as { type: string; enabled?: boolean })
    .filter((message) => message.type === "setViewportMode")
    .map((message) => message.enabled);

describe("ScreenNode in phone view and at full length", () => {
  afterEach(() => cleanup());

  it("draws a phone whose page scrolls inside it", async () => {
    const { container } = render(<ScreenNode screen={screen} frameMode="phone" />);
    const { postMessage } = await readyIframe(container);
    expect(viewportMessages(postMessage)).toContain(true);
    expect(viewportMessages(postMessage)).not.toContain(false);
    expect(frameOf(container).style.height).toBe("844px");
    expect(frameOf(container).style.borderRadius).toBe("36px");
  });

  it("draws the whole page at full length and follows its measured height", async () => {
    const { container } = render(<ScreenNode screen={screen} frameMode="full" />);
    const { iframe, postMessage } = await readyIframe(container);
    expect(viewportMessages(postMessage)).toContain(false);
    expect(viewportMessages(postMessage)).not.toContain(true);
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { source: iframe.contentWindow, data: { type: "drawgleContentHeight", height: 1640 } }));
    });
    expect(frameOf(container).style.height).toBe("1640px");
    expect(frameOf(container).style.borderRadius).toBe("16px");
  });

  it("stays a phone when the person leaves interact mode in phone view", async () => {
    const { container } = render(<ScreenNode screen={screen} frameMode="phone" isSelected />);
    const { postMessage } = await readyIframe(container);
    postMessage.mockClear();
    await act(async () => {
      fireEvent.doubleClick(container.querySelector(".touch-none")!);
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    const types = postMessage.mock.calls.map(([message]) => (message as { type: string }).type);
    expect(types).toContain("enterInteractMode");
    expect(types).toContain("exitInteractMode");
    expect(viewportMessages(postMessage)).not.toContain(false);
    expect(frameOf(container).style.height).toBe("844px");
  });

  it("keeps today's interact mode at full length: a phone while interacting, the whole page after", async () => {
    const { container } = render(<ScreenNode screen={screen} frameMode="full" isSelected />);
    const { postMessage } = await readyIframe(container);
    postMessage.mockClear();
    await act(async () => {
      fireEvent.doubleClick(container.querySelector(".touch-none")!);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });
    expect(viewportMessages(postMessage)).toContain(true);
    expect(frameOf(container).style.height).toBe("844px");
    postMessage.mockClear();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(viewportMessages(postMessage)).toEqual([false]);
  });

  it("switches an open screen between the views without reloading it", async () => {
    const { container, rerender } = render(<ScreenNode screen={screen} frameMode="full" />);
    const { iframe, postMessage } = await readyIframe(container);
    const srcDoc = iframe.getAttribute("srcdoc");
    postMessage.mockClear();
    rerender(<ScreenNode screen={screen} frameMode="phone" />);
    expect(viewportMessages(postMessage)).toEqual([true]);
    expect(container.querySelector("iframe")!.getAttribute("srcdoc")).toBe(srcDoc);
  });
});
