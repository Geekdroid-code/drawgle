import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningConversation } from "./PlanningConversation";
import { productFixture } from "@/lib/product-planning/test-fixtures";
import { proposeProductScope } from "@/lib/product-planning/model";
import type { ProjectData } from "@/lib/types";
import { StrictMode } from "react";
import { PROJECT_REFRESH_EVENT } from "@/lib/project-refresh";
const project = (): ProjectData => ({ id: "11111111-1111-4111-8111-111111111111", userId: "owner", name: "Tacozz", prompt: "T-shirts", status: "draft", createdAt: "2026-09-14", updatedAt: "2026-09-14", productPlanning: productFixture() });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("planning within the existing chat lifecycle", () => {
  it("initializes once and retains the same project when state transitions to canvas", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ intent: "product_planning" }) }));
    vi.stubGlobal("fetch", fetch);
    const initial = project();
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<PlanningConversation project={initial} />); });
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({ projectId: initial.id, initializePlanning: true });
    await act(async () => { view.rerender(<PlanningConversation project={{ ...initial, productPlanning: { ...initial.productPlanning!, initialTurnComplete: true, phase: "canvas" } }} />); });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("sends a revision-bound approval to the same project's existing generation endpoint", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ generationRunId: "run" }) }));
    vi.stubGlobal("fetch", fetch);
    const initial = project();
    initial.productPlanning = { ...proposeProductScope(initial.productPlanning!), initialTurnComplete: true, revision: 42 };
    render(<PlanningConversation project={initial} />);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Approve & generate" })); });
    expect(fetch.mock.calls[0][0]).toBe("/api/generations");
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({ projectId: initial.id, productApproval: { revision: 42 } });
  });
  it("shares an in-flight initializer across Strict Mode and chat close/reopen", async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const initial = project();
    const view = render(<StrictMode><PlanningConversation project={initial} /></StrictMode>);
    expect(fetch).toHaveBeenCalledOnce();
    view.unmount();
    render(<PlanningConversation project={initial} />);
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => resolve(new Response("{}", { status: 200 })));
  });
  it("waits on an active server turn without posting again when chat opens", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const initial = project();
    initial.productPlanning = { ...initial.productPlanning!, lease: { id: "initial", expiresAt: new Date(Date.now() + 60_000).toISOString() } };
    const view = render(<PlanningConversation project={initial} />);
    expect(screen.queryByText(/Thinking through your product/i)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    view.rerender(<PlanningConversation project={{ ...initial, productPlanning: { ...initial.productPlanning, lease: null, initialTurnComplete: true } }} />);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refreshes once on 409 and does not retry on each project update", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Turn in progress" }), { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    const refresh = vi.fn();
    window.addEventListener(PROJECT_REFRESH_EVENT, refresh);
    try {
      const initial = project();
      let view!: ReturnType<typeof render>;
      await act(async () => { view = render(<PlanningConversation project={initial} />); });
      for (let revision = 1; revision <= 12; revision += 1) {
        await act(async () => view.rerender(<PlanningConversation project={{ ...initial, productPlanning: { ...initial.productPlanning!, revision } }} />));
      }
      expect(fetch).toHaveBeenCalledOnce();
      expect(refresh).toHaveBeenCalledOnce();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
    } finally { window.removeEventListener(PROJECT_REFRESH_EVENT, refresh); }
  });
  it("allows explicit retry after a failed initial request", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Temporary failure" }), { status: 500 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await act(async () => { render(<PlanningConversation project={project()} />); });
    expect(screen.getByRole("alert").textContent).toContain("Temporary failure");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
