import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorControl, Choices, Segments } from "@/components/visual-editor/controls";

afterEach(cleanup);
describe("shared inspector interactions", () => {
  it("retains a gradient until explicitly choosing a solid or token color", async () => {
    const change = vi.fn(), user = userEvent.setup();
    render(<ColorControl label="Fill" property="background-color" value="#FFF" gradient tokens={[{ name: "--dg-color-action-primary", path: "color.action.primary", label: "Primary", value: "#3563EE" }]} onChange={change} />);
    expect(screen.getByText("Gradient")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open Fill color picker" }));
    expect(change).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use Primary" }));
    expect(change).toHaveBeenCalledWith("var(--dg-color-action-primary)");
  });
  it("a matching project color is not linked merely by opening its picker", async () => {
    const change = vi.fn(), user = userEvent.setup();
    render(<ColorControl label="Text" property="color" value="#3563EE" tokens={[{ name: "--dg-color-text-high-emphasis", path: "color.text.high_emphasis", label: "Primary text", value: "#3563EE" }]} onChange={change} />);
    await user.click(screen.getByRole("button", { name: "Open Text color picker" })); await user.keyboard("{Escape}");
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText("#3563EE")).toBeTruthy();
  });
  it("the compact palette keeps every token reachable by keyboard", async () => {
    const change = vi.fn(), user = userEvent.setup();
    const tokens = Array.from({ length: 14 }, (_, index) => ({ name: `--dg-color-action-${index}`, path: "color.action.primary", label: `Color ${index}`, value: "#3563EE" }));
    render(<ColorControl label="Fill" property="background-color" value="#FFFFFF" tokens={tokens} onChange={change} />);
    await user.click(screen.getByRole("button", { name: "Open Fill color picker" }));
    screen.getByRole("button", { name: "Use Color 0" }).focus();
    for (let index = 0; index < 13; index++) await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Use Color 13" }));
    expect(change).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(change).toHaveBeenCalledWith("var(--dg-color-action-13)");
  });
  it("custom dropdown values stay unchanged until a deliberate keyboard selection", async () => {
    const change = vi.fn(), user = userEvent.setup();
    render(<Choices label="Weight" value="450" choices={["400", "500", "700"]} onChange={change} />);
    expect(screen.getByText("Custom · 450")).toBeTruthy();
    await user.click(screen.getByRole("combobox", { name: "Weight" }));
    expect(change).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(change).toHaveBeenCalledWith("400");
  });
  it("segmented selections support arrow keys without emitting on mount", () => {
    const change = vi.fn();
    render(<Segments label="Direction" value="row" options={[{ value: "row", label: "Row" }, { value: "column", label: "Column" }]} onChange={change} />);
    expect(change).not.toHaveBeenCalled(); fireEvent.keyDown(screen.getByRole("button", { name: "Row" }), { key: "ArrowRight" });
    expect(change).toHaveBeenCalledWith("column"); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Column" }));
  });
});
