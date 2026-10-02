import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => { throw new Error("The block must not read claims it was given."); } }));

import type { FlowFulfillment } from "@/lib/agent/flow-build";
import type { FlowBuildGroup } from "@/lib/agent/flow-messages";
import type { GenerationRunData } from "@/lib/types";
import { FlowBuildBlock } from "./FlowBuildBlock";

const ROOT = "root-approval";
const group: FlowBuildGroup = {
  anchorMessageId: "approval-message",
  approval: {
    id: ROOT, goal: "Make travel feel social.", existingKeys: [],
    outputs: ["Feed", "Planner", "Spot"].map((name, index) => ({ stableKey: `screen:${index}`, name, kind: "screen" as const, parentStableKey: null, sequence: index + 1 })),
  },
  progress: [],
  journals: [],
};
const root = (status: GenerationRunData["status"], error: string | null = null): GenerationRunData => ({
  id: ROOT, projectId: "p", ownerId: "o", prompt: "", status, error, createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  metadata: { productPlanning: { scope: { manifest: [] } } },
});
const claim = (index: number, status: FlowFulfillment["status"]): FlowFulfillment =>
  ({ outputKey: `screen:${index}`, status, screenId: status === "ready" ? `s${index}` : null, generationRunId: "batch" });

describe("an approved flow's build in chat", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("shows one live line and a row per approved screen, using the claims it was given", () => {
    render(<FlowBuildBlock projectId="p" group={group} runs={[root("building")]} isLatest fulfillments={[claim(0, "ready"), claim(1, "claimed")]} />);
    expect(screen.getByRole("status").textContent).toBe("Designing Planner…");
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByText("Designed Feed")).toBeTruthy();
    expect(screen.getByText("Spot")).toBeTruthy();
    expect(screen.getByText("Planned 3 screens")).toBeTruthy();
    expect(screen.queryByText(/batch|outputs/i)).toBeNull();
  });

  it("folds a finished build to one sentence and opens it on a click", () => {
    render(<FlowBuildBlock projectId="p" group={group} runs={[root("completed")]} isLatest fulfillments={null} />);
    expect(screen.getByText("Generation complete")).toBeTruthy();
    expect(screen.getByText("All 3 screens are on the canvas.")).toBeTruthy();
    expect(screen.queryByText("Designed Feed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Generation complete/ }));
    expect(screen.getByText("Designed Feed")).toBeTruthy();
  });

  it("resumes a paused flow through the same endpoint the old card used", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ generationRunId: ROOT }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<FlowBuildBlock projectId="p" group={group} isLatest
      runs={[root("failed", "Some approved screens could not be built. Completed screens are kept; resume to retry the failed ones and finish the flow.")]}
      fulfillments={[claim(0, "ready"), claim(1, "ready"), claim(2, "failed")]} />);
    expect(screen.getByText("2 of 3 on the canvas. 1 screen couldn't be built; resume to try it again.")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resume and retry" })); });
    const calls = fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe("/api/projects/p/product-generation");
    expect(JSON.parse(String(calls[0][1].body))).toMatchObject({ action: "resume", approvalId: ROOT });
  });

  it("shows the endpoint's own words when a resume is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "A batch is still running" }), { status: 409 })));
    render(<FlowBuildBlock projectId="p" group={group} isLatest runs={[root("canceled")]} fulfillments={[claim(0, "ready")]} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resume" })); });
    expect(screen.getByRole("alert").textContent).toContain("A batch is still running");
  });
});
