import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scrubber } from "./Scrubber";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("scrubber adjustments", () => {
  it("preserves opening values and supports precise, accelerated and bounded keyboard changes", () => {
    const change = vi.fn();
    function Control() { const [value, setValue] = useState(.4); return <Scrubber label="Opacity" value={value} min={.2} max={.8} step={.01} decimals={2}
      onValueChange={next => { change(next); setValue(next); }} />; }
    render(<Control />);
    const slider = screen.getByRole("slider");
    fireEvent.mouseEnter(slider); fireEvent.focus(slider); expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(slider, { key: "ArrowRight" }); expect(change).toHaveBeenLastCalledWith(.41);
    fireEvent.keyDown(slider, { key: "ArrowRight", shiftKey: true }); expect(change).toHaveBeenLastCalledWith(.51);
    fireEvent.keyDown(slider, { key: "Home" }); expect(change).toHaveBeenLastCalledWith(.2);
    fireEvent.keyDown(slider, { key: "End" }); expect(change).toHaveBeenLastCalledWith(.8);
    change.mockClear(); fireEvent.keyDown(slider, { key: "ArrowRight" }); fireEvent.keyDown(slider, { key: "Home", ctrlKey: true });
    expect(change).not.toHaveBeenCalled(); expect(slider.getAttribute("aria-valuetext")).toBe("0.80");
  });
  it("maps the full track to a stepped range, ignores other pointers and stops on cancellation", () => {
    // jsdom has no PointerEvent implementation; preserve real pointer properties in this fixture.
    class TestPointerEvent extends MouseEvent { pointerId: number; constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerId = init.pointerId ?? 1; } }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const change = vi.fn();
    render(<Scrubber label="Scale" value={1} min={.5} max={2.5} step={.1} decimals={1} onValueChange={change} />);
    const slider = screen.getByRole("slider");
    slider.setPointerCapture = vi.fn(); slider.releasePointerCapture = vi.fn();
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 100, width: 200 } as DOMRect);
    fireEvent.pointerDown(slider, { button: 0, clientX: 200, pointerId: 1 }); expect(change).toHaveBeenLastCalledWith(1.5);
    fireEvent.pointerMove(slider, { clientX: 200, pointerId: 1 }); expect(change).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(slider, { clientX: 500, pointerId: 2 }); expect(change).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(slider, { clientX: 500, pointerId: 1 }); expect(change).toHaveBeenLastCalledWith(2.5);
    fireEvent.pointerCancel(slider, { pointerId: 1 }); change.mockClear();
    fireEvent.pointerMove(slider, { clientX: 100, pointerId: 1 }); expect(change).not.toHaveBeenCalled();
  });
  it("blocks disabled, locked-fieldset and zero-range controls", () => {
    const change = vi.fn();
    render(<><Scrubber label="Disabled" value={40} disabled onValueChange={change} />
      <fieldset disabled><Scrubber label="Locked" value={40} onValueChange={change} /></fieldset>
      <Scrubber label="Fixed" value={40} min={40} max={40} onValueChange={change} /></>);
    for (const slider of screen.getAllByRole("slider")) fireEvent.keyDown(slider, { key: "End" });
    expect(change).not.toHaveBeenCalled(); expect(screen.getByLabelText("Disabled").tabIndex).toBe(-1);
  });
});
