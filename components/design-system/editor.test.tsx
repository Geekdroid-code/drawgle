import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeDesignTokens } from "@/lib/design-tokens";
import { DesignSystemEditor } from "@/components/DesignSystemEditor";
import { NumberControl } from "@/components/inspector/NumberControl";
import { ColorPicker } from "@/components/inspector/ColorPicker";
import { DesignTab } from "./DesignTab";
import { updateToken } from "./model";

const fixture = () => normalizeDesignTokens({ tokens: { color: { background: { primary: "#FAFAFA" }, action: { primary: "#3563EE" } },
  typography: { heading_font_family: "'Inter', sans-serif", body_font_family: "'Inter', sans-serif" },
  shadows: { surface: "0 2px 4px #0003, 0 8px 12px #0002" } } });
afterEach(cleanup);

describe("contextual project styles", () => {
  it("opening categories, font choices and custom shadows never changes tokens", async () => {
    const change = vi.fn(), user = userEvent.setup();
    render(<DesignSystemEditor value={fixture()} onChange={change} onSubmit={vi.fn()} layout="panel" />);
    await user.click(screen.getByRole("button", { name: "Type" }));
    expect(screen.queryByText(/Choose two different/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Heading font" }));
    await user.type(screen.getByRole("combobox", { name: "Search fonts" }), "Manrope");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Shape" }));
    await user.click(screen.getByRole("button", { name: /Surface shadow/ }));
    expect(screen.getByText(/multiple layers or inherited values/)).toBeTruthy();
    expect(screen.queryByLabelText("Blur")).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });
  it("search and keyboard selection change the chosen font only", async () => {
    const original = fixture(), change = vi.fn(), user = userEvent.setup();
    render(<DesignSystemEditor value={original} onChange={change} onSubmit={vi.fn()} layout="panel" />);
    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(screen.getByRole("button", { name: "Heading font" }));
    await user.type(screen.getByRole("combobox", { name: "Search fonts" }), "Manrope{Enter}");
    expect(change).toHaveBeenCalledTimes(1);
    const next = change.mock.calls[0][0];
    expect(next.tokens.typography.heading_font_family).toBe('"Manrope", sans-serif');
    expect(next.tokens.typography.body_font_family).toBe(original.tokens!.typography!.body_font_family);
    expect(next.tokens.color).toEqual(original.tokens!.color);
  });
  it("keeps paused editors read-only and footer actions connected", () => {
    const change = vi.fn(), save = vi.fn(), discard = vi.fn();
    const props = { tokenDraft: fixture(), tokenDirty: true, onTokenDraftChange: change, onSaveTokens: save, onDiscardTokens: discard };
    const view = render(<DesignTab {...props} generationActive />);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Discard" }) as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<DesignTab {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" })); fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(save).toHaveBeenCalledTimes(1); expect(discard).toHaveBeenCalledTimes(1); expect(change).not.toHaveBeenCalled();
  });
  it("an already open picker cannot mutate tokens when generation starts", async () => {
    const change = vi.fn(), user = userEvent.setup(), value = fixture();
    const view = render(<DesignSystemEditor value={value} onChange={change} onSubmit={vi.fn()} layout="panel" />);
    await user.click(screen.getByRole("button", { name: "Open Background color picker" }));
    view.rerender(<DesignSystemEditor value={value} onChange={change} onSubmit={vi.fn()} layout="panel" disabled />);
    fireEvent.change(screen.getByLabelText("Background value"), { target: { value: "#FF0000" } });
    expect(change).not.toHaveBeenCalled();
  });
  it("the full design approval editor retains its preview and submit callback", () => {
    const submit = vi.fn(), change = vi.fn();
    render(<DesignSystemEditor value={fixture()} onChange={change} onSubmit={submit} submitLabel="Save & Build" />);
    expect(document.querySelector(".dt-full-preview")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save & Build" }));
    expect(submit).toHaveBeenCalledTimes(1); expect(change).not.toHaveBeenCalled();
  });
  it("preserves numeric custom values through focus and blur", () => {
    const change = vi.fn();
    render(<NumberControl label="Spacing" value="1.4" unit="px" min={10} onChange={change} />);
    fireEvent.focus(screen.getByLabelText("Spacing")); fireEvent.blur(screen.getByLabelText("Spacing"));
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Spacing"), { target: { value: "7" } }); fireEvent.blur(screen.getByLabelText("Spacing"));
    expect(change).toHaveBeenLastCalledWith("10px");
  });
  it("keeps action gradient endpoints synchronized through the existing token updater", () => {
    const result = updateToken(fixture(), ["color", "action", "primary_gradient_end"], "#FF0000");
    expect(result.tokens!.color!.action!.primary_gradient_end).toBe("#FF0000");
    expect(result.tokens!.gradients!.action_primary).toContain("#FF0000");
  });
  it("opening an alpha picker preserves opacity and invalid typing never emits a change", async () => {
    const change = vi.fn(), user = userEvent.setup();
    function Picker() { const [value, setValue] = useState("rgba(10, 20, 30, 0.4)"); return <ColorPicker label="Fill" value={value} onChange={next => { change(next); setValue(next); }} />; }
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Open Fill color picker" }));
    expect(change).not.toHaveBeenCalled(); expect(screen.getByLabelText("Fill opacity").getAttribute("aria-valuenow")).toBe("40");
    fireEvent.change(screen.getByLabelText("Fill value"), { target: { value: "#1234567" } });
    expect(change).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Fill hue"), { key: "End" });
    expect(change.mock.lastCall?.[0]).toMatch(/0\.4\)$/);
  });
  it("changing HSL opacity preserves the actual color channels", async () => {
    const change = vi.fn(), user = userEvent.setup();
    function Picker() { const [value, setValue] = useState("hsl(180 100% 50%)"); return <ColorPicker label="Fill" value={value} onChange={next => { change(next); setValue(next); }} />; }
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Open Fill color picker" }));
    for (let index = 0; index < 5; index++) fireEvent.keyDown(screen.getByLabelText("Fill opacity"), { key: "PageDown" });
    expect(change).toHaveBeenCalledWith("rgba(0, 255, 255, 0.5)");
  });
});
