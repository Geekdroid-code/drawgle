import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentComposer } from "./PromptBar";

describe("the composer while an approved flow builds", () => {
  afterEach(() => cleanup());

  it("offers Stop while nothing is typed, and Send again as soon as the person types", () => {
    const onStop = vi.fn();
    render(<AgentComposer variant="panel" onSubmit={vi.fn(async () => true)} onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop after the screens in progress" }));
    expect(onStop).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Make the header darker" } });
    expect(screen.queryByRole("button", { name: "Stop after the screens in progress" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("keeps the plain Send button when there is nothing to stop", () => {
    render(<AgentComposer variant="panel" onSubmit={vi.fn(async () => true)} />);
    expect(screen.queryByRole("button", { name: /Stop/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });
});
