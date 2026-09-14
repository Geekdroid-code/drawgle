import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningConversation } from "./PlanningConversation";
import { productFixture } from "@/lib/product-planning/test-fixtures";
import { proposeProductScope } from "@/lib/product-planning/model";
import type { ProjectData } from "@/lib/types";
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
});
