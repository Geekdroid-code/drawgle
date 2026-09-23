import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenData } from "@/lib/types";
import { HistoryControls } from "./HistoryControls";

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
    screens={[screen]} navigation={null} tokens={null} onApplied={vi.fn()} {...overrides} />
</>);
beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/history/") && !url.endsWith("/history")) return { ok: true, json: async () => ({ id: listing.entries[0].id,
      label: "Edited Profile", payload: { code: "<main>Earlier</main>" } }) };
    if (init?.method === "POST") return { ok: true, json: async () => ({ status: "success", revision: 5 }) };
    return { ok: true, json: async () => listing };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("contextual history controls", () => {
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
  it("previews a retained screen entry and offers restore", async () => {
    const user = userEvent.setup();
    const view = renderControls();
    await user.click(await view.findByLabelText("Recent changes"));
    await user.click(await view.findByText(/Edited Profile/));
    expect(await view.findByTitle("History preview")).toBeTruthy();
    expect(view.getByText(/current shared tokens and navigation/)).toBeTruthy();
    await user.click(view.getByText("Restore this change"));
    await waitFor(() => expect(calls.some(c => c.init?.method === "POST" && JSON.parse(c.init.body as string).action === "restore")).toBe(true));
  });
});
