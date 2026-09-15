import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateStateDialog } from "./CreateStateDialog";
import type { ScreenData } from "@/lib/types";

const parent = { id: "parent", name: "Today", status: "ready" } as ScreenData;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("manual state dialog", () => {
  it("preserves the description while another generation runs and submits once", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ generationRunId: "run" }) });
    vi.stubGlobal("fetch", fetch);
    const onClose = vi.fn(); const onQueued = vi.fn().mockResolvedValue(undefined);
    const view = render(<CreateStateDialog screen={parent} projectId="project" busy onClose={onClose} onQueued={onQueued} />);
    const field = screen.getByLabelText("Describe the state you want");
    fireEvent.change(field, { target: { value: "Show no habits with a helpful next action" } });
    expect((screen.getByRole("button", { name: "Create state" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/10 credits/)).toBeTruthy();
    view.rerender(<CreateStateDialog screen={parent} projectId="project" busy={false} onClose={onClose} onQueued={onQueued} />);
    expect((field as HTMLTextAreaElement).value).toContain("Show no habits");
    fireEvent.click(screen.getByRole("button", { name: "Create state" }));
    fireEvent.click(screen.getByRole("button", { name: /Creating/ }));
    await waitFor(() => expect(onQueued).toHaveBeenCalledWith("run"));
    expect(fetch).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("reuses the request identity after an uncertain response and keeps the draft", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Network interrupted"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ generationRunId: "run" }) });
    vi.stubGlobal("fetch", fetch);
    const onQueued = vi.fn().mockResolvedValue(undefined);
    render(<CreateStateDialog screen={parent} projectId="project" busy={false} onClose={vi.fn()} onQueued={onQueued} />);
    fireEvent.change(screen.getByLabelText("Describe the state you want"), { target: { value: "Show filters open" } });
    fireEvent.click(screen.getByRole("button", { name: "Create state" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Network interrupted"));
    fireEvent.click(screen.getByRole("button", { name: "Create state" }));
    await waitFor(() => expect(onQueued).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(JSON.parse(fetch.mock.calls[1][1].body));
  });
});
