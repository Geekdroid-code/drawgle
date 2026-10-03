import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenData } from "@/lib/types";
import { EXIT_HISTORY_PREVIEW_EVENT, HistoryControls, RESTORE_HISTORY_PREVIEW_EVENT } from "./HistoryControls";

const projectId = "11111111-1111-4111-8111-111111111111";
const screenId = "22222222-2222-4222-8222-222222222222";
const screen: ScreenData = { id: screenId, projectId, userId: "", name: "Profile", code: "<main>Current</main>",
  sourceLoaded: true, prompt: "", status: "ready", x: 0, y: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const listing = { revision: 4, canUndo: true, canRedo: true,
  entries: [{ id: "33333333-3333-4333-8333-333333333333", label: "Edited Profile", createdAt: "2026-01-01T00:00:00Z", isCurrent: true }] };
let calls: Array<{ url: string; init?: RequestInit }> = [];
const renderControls = (overrides: Partial<React.ComponentProps<typeof HistoryControls>> = {}) => render(<>
  <input aria-label="Text editor" />
  <HistoryControls projectId={projectId} target={{ context: "screen", screenId }} screenName="Profile"
    screens={[screen]} onApplied={vi.fn()} {...overrides} />
</>);
beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/history/") && !url.endsWith("/history")) return { ok: true, json: async () => ({ id: listing.entries[0].id,
      label: "Edited Profile", payload: { code: "<main>Current</main>" }, beforePayload: { code: "<main>Earlier</main>" } }) };
    if (init?.method === "POST") return { ok: true, json: async () => ({ status: "success", revision: 5 }) };
    return { ok: true, json: async () => listing };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("contextual history controls", () => {
  it.each(["screen", "tokens"] as const)("does not intercept undo/redo for hidden %s controls", async context => {
    const view = renderControls({ shortcutsEnabled: false, target: context === "screen" ? { context, screenId } : { context } });
    const label = context === "screen" ? "Undo change to Profile" : "Undo design-token change";
    await waitFor(() => expect(view.getByLabelText(label).hasAttribute("disabled")).toBe(false));
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(document, { key: "z", ...modifiers })).toBe(true);
      expect(fireEvent.keyDown(document, { key: "z", shiftKey: true, ...modifiers })).toBe(true);
    }
    fireEvent.keyDown(document, { key: "y", ctrlKey: true });
    act(() => { window.dispatchEvent(new CustomEvent("drawgle-history-action", { detail: "undo" })); });
    expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  });
  it("removes shortcuts when visible controls close, including local draft undo", async () => {
    const local = { hasLocalHistory: true, canUndo: true, canRedo: false, undo: vi.fn(), redo: vi.fn(), saving: false, stale: false };
    const props = { projectId, target: { context: "screen" as const, screenId }, screens: [screen], onApplied: vi.fn(), local };
    const view = render(<HistoryControls {...props} shortcutsEnabled />);
    fireEvent.keyDown(document, { key: "z", ctrlKey: true }); expect(local.undo).toHaveBeenCalledOnce();
    view.rerender(<HistoryControls {...props} shortcutsEnabled={false} />);
    fireEvent.keyDown(document, { key: "z", ctrlKey: true }); expect(local.undo).toHaveBeenCalledOnce();
    view.rerender(<HistoryControls {...props} shortcutsEnabled />);
    fireEvent.keyDown(document, { key: "z", metaKey: true }); expect(local.undo).toHaveBeenCalledTimes(2);
    expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  });
  it("keeps native text undo and uses the active screen for design shortcuts", async () => {
    const view = renderControls();
    await waitFor(() => expect(view.getByLabelText("Undo change to Profile").hasAttribute("disabled")).toBe(false));
    const input = view.getByLabelText("Text editor");
    input.focus(); fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(calls.filter(c => c.init?.method === "POST")).toHaveLength(0);
    input.blur(); fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    await waitFor(() => expect(calls.filter(c => c.init?.method === "POST")).toHaveLength(1));
    expect(JSON.parse(calls.find(c => c.init?.method === "POST")!.init!.body as string).action).toBe("undo");
  });
  it("does nothing without a context and blocks drafts", async () => {
    const noContext = renderControls({ target: null });
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    expect(calls.filter(c => c.init?.method === "POST")).toHaveLength(0);
    noContext.unmount();
    const blocked = renderControls({ disabledReason: "Save or discard the current draft." });
    await blocked.findByLabelText("Undo change to Profile");
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    expect(calls.filter(c => c.init?.method === "POST")).toHaveLength(0);
  });
  it("shows a retained screen entry on the canvas, before the change first, and offers restore", async () => {
    const user = userEvent.setup();
    const onCanvasPreviewChange = vi.fn();
    const view = renderControls({ onCanvasPreviewChange });
    await user.click(await view.findByLabelText("Recent changes"));
    await user.click(await view.findByText(/Edited Profile/));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith({ context: "screen", screenId, code: "<main>Earlier</main>", label: "Edited Profile", side: "before" }));
    expect(view.getByText(/The canvas shows this screen before the change/)).toBeTruthy();
    expect(view.queryByTitle("History preview")).toBeNull();
    await user.click(view.getByText("Restore this version"));
    await waitFor(() => expect(calls.some(c => c.init?.method === "POST" && JSON.parse(c.init.body as string).action === "restore" && JSON.parse(c.init.body as string).side === "before")).toBe(true));
  });
  it("never falls through into saved undo while a local redo branch exists", async () => {
    const local = { hasLocalHistory: true, canUndo: false, canRedo: true, undo: vi.fn(), redo: vi.fn(), saving: false, stale: false };
    const view = renderControls({ local });
    await waitFor(() => expect(view.getByLabelText("Redo adjustment").hasAttribute("disabled")).toBe(false));
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    fireEvent.click(view.getByLabelText("Redo adjustment"));
    expect(local.redo).toHaveBeenCalledOnce(); expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  });
  it("retries a disconnected recovery with the same request ID and revision", async () => {
    const originalFetch = fetch;
    let failed = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && !failed) { failed = true; calls.push({ url, init }); throw new Error("Connection lost"); }
      return originalFetch(url, init);
    }));
    const view = renderControls();
    await waitFor(() => expect(view.getByLabelText("Undo change to Profile").hasAttribute("disabled")).toBe(false));
    fireEvent.click(view.getByLabelText("Undo change to Profile"));
    await view.findByRole("alert");
    await waitFor(() => expect(view.getByLabelText("Undo change to Profile").hasAttribute("disabled")).toBe(false));
    fireEvent.click(view.getByLabelText("Undo change to Profile"));
    await waitFor(() => expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(2));
    const bodies = calls.filter(call => call.init?.method === "POST").map(call => JSON.parse(call.init!.body as string));
    expect(bodies[0].requestId).toBe(bodies[1].requestId); expect(bodies[0].expectedRevision).toBe(bodies[1].expectedRevision);
  });
  it("renders history inside its panel slot and returns to properties without a floating sheet", async () => {
    const host = document.createElement("div"); host.setAttribute("aria-label", "Inspector history area"); document.body.append(host);
    const view = renderControls({ panelTarget: host });
    fireEvent.click(view.getByLabelText("Recent changes"));
    await waitFor(() => expect(host.querySelector('[aria-label="Saved changes"]')).toBeTruthy());
    expect(view.queryByRole("dialog")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Back to properties" }));
    expect(host.children).toHaveLength(0);
    expect(view.getByLabelText("Recent changes").getAttribute("aria-expanded")).toBe("false"); host.remove();
  });
  it("switches the canvas with Before/After and restores the chosen side", async () => {
    const user = userEvent.setup(); const onCanvasPreviewChange = vi.fn(); const view = renderControls({ onCanvasPreviewChange });
    await user.click(view.getByLabelText("Recent changes"));
    await user.click(await view.findByText("Edited Profile"));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ code: "<main>Earlier</main>", side: "before" })));
    await user.click(view.getByRole("button", { name: "After change" }));
    expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ code: "<main>Current</main>", side: "after" }));
    await user.click(view.getByText("Restore this version"));
    await waitFor(() => expect(calls.some(call => call.init?.method === "POST" && JSON.parse(call.init.body as string).side === "after")).toBe(true));
    // a restored version is the current design: the canvas stops previewing
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(null));
  });

  it("returns the canvas to the current design on Exit preview, on leaving history, and on closing", async () => {
    const user = userEvent.setup(); const onCanvasPreviewChange = vi.fn(); const view = renderControls({ onCanvasPreviewChange });
    await user.click(view.getByLabelText("Recent changes"));
    await user.click(await view.findByText("Edited Profile"));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ side: "before" })));
    act(() => { window.dispatchEvent(new Event(EXIT_HISTORY_PREVIEW_EVENT)); });
    expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(null);
    expect(await view.findByText("Edited Profile")).toBeTruthy();
    await user.click(view.getByText("Edited Profile"));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ side: "before" })));
    await user.click(view.getByRole("button", { name: "Back to history" }));
    expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(null);
    await user.click(view.getByText("Edited Profile"));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ side: "before" })));
    view.unmount();
    expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(null);
  });

  it("restores the version the canvas shows from the preview bar, as on a phone", async () => {
    const user = userEvent.setup(); const onCanvasPreviewChange = vi.fn(); const view = renderControls({ onCanvasPreviewChange });
    // nothing to restore until a version is on the canvas
    act(() => { window.dispatchEvent(new Event(RESTORE_HISTORY_PREVIEW_EVENT)); });
    expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
    await user.click(view.getByLabelText("Recent changes"));
    await user.click(await view.findByText("Edited Profile"));
    await user.click(view.getByRole("button", { name: "After change" }));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ side: "after" })));
    act(() => { window.dispatchEvent(new Event(RESTORE_HISTORY_PREVIEW_EVENT)); });
    await waitFor(() => expect(calls.some(call => call.init?.method === "POST" && JSON.parse(call.init.body as string).action === "restore" && JSON.parse(call.init.body as string).side === "after")).toBe(true));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(null));
  });

  it("opens where history starts on After, with nothing before it to show or restore", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/history/") && !url.endsWith("/history")) return { ok: true, json: async () => ({ id: listing.entries[0].id, label: "Created the design system",
        payload: { tokens: { tokens: { radii: { app: "16px" } } } }, beforePayload: { tokens: null }, startingPoint: true }) };
      if (init?.method === "POST") return { ok: true, json: async () => ({ status: "success", revision: 5 }) };
      return { ok: true, json: async () => ({ revision: 4, canUndo: false, canRedo: false,
        entries: [{ ...listing.entries[0], label: "Created the design system", startingPoint: true }] }) };
    }));
    const user = userEvent.setup(); const onCanvasPreviewChange = vi.fn();
    const view = renderControls({ target: { context: "tokens" }, onCanvasPreviewChange });
    await waitFor(() => expect(view.getByLabelText("Undo design-token change").hasAttribute("disabled")).toBe(true));
    await user.click(view.getByLabelText("Recent changes"));
    await user.click(await view.findByText("Created the design system"));
    await waitFor(() => expect(onCanvasPreviewChange).toHaveBeenLastCalledWith(expect.objectContaining({ context: "tokens", side: "after" })));
    expect(view.getByRole("button", { name: "Before change" }).hasAttribute("disabled")).toBe(true);
    expect(view.getByText(/Generation created this design system, so nothing comes before it/)).toBeTruthy();
    await user.click(view.getByText("Restore this version"));
    await waitFor(() => expect(calls.some(call => call.init?.method === "POST" && JSON.parse(call.init.body as string).side === "after")).toBe(true));
    expect(calls.some(call => call.init?.method === "POST" && JSON.parse(call.init.body as string).side === "before")).toBe(false);
  });

  it("keeps the canvas on the current design while an adjustment or another job is pending", async () => {
    const user = userEvent.setup(); const onCanvasPreviewChange = vi.fn();
    const view = renderControls({ onCanvasPreviewChange, disabledReason: "Wait for the active design job to finish." });
    await user.click(view.getByLabelText("Recent changes"));
    await user.click(await view.findByText("Edited Profile"));
    expect(await view.findByText(/Finish or discard the pending change to see this version on the canvas/)).toBeTruthy();
    expect(onCanvasPreviewChange.mock.calls.every(([preview]) => preview === null)).toBe(true);
  });
});
