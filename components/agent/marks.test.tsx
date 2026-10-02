import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AgentMark, StepMark } from "./marks";

const markOf = (container: HTMLElement) => container.querySelector("[data-mark], [data-agent]");

describe("the agent's step marks", () => {
  afterEach(() => cleanup());

  it("draws each state as its own rounded mark", () => {
    for (const status of ["queued", "active", "done", "failed", "skipped"] as const) {
      const { container, unmount } = render(<StepMark status={status} />);
      expect(markOf(container)?.getAttribute("data-mark")).toBe(status);
      unmount();
    }
  });

  it("settles a step in only when it finishes while the person watches, not when history loads", () => {
    const loaded = render(<StepMark status="done" />);
    expect(loaded.container.querySelector(".dg-mark-pop")).toBeNull();
    loaded.unmount();

    const live = render(<StepMark status="active" />);
    live.rerender(<StepMark status="done" />);
    expect(live.container.querySelector(".dg-mark-pop")).not.toBeNull();
    expect(live.container.querySelector(".dg-mark-draw")).not.toBeNull();
  });

  it("shows the agent circling while it works and the Drawgle mark at rest", () => {
    expect(markOf(render(<AgentMark state="working" />).container)?.getAttribute("data-agent")).toBe("working");
    cleanup();
    expect(markOf(render(<AgentMark state="idle" />).container)?.getAttribute("data-agent")).toBe("idle");
  });
});
