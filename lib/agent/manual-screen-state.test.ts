import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ trigger: vi.fn(), credits: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock("@/lib/credits", () => ({ adminCreditService: { hasCredits: mocks.credits } }));
import { approveScreenStateProposal } from "./screen-state-approval";

const proposal = { version: 1, prompt: "Show the filter menu", parentScreenId: "parent", parentScreenName: "Today", parentRoadmapItemId: "parent-roadmap",
  status: "pending", expiresAt: "2099-01-01", state: { stateKey: "filter", stateLabel: "Filter", stateRole: "custom", triggerLabel: "Filter", description: "Open filters", editInstruction: "Keep the header and show filters" } };
function fixture() {
  const tables: Record<string, Record<string, any>[]> = {
    projects: [{ id: "project", owner_id: "owner", product_planning: null }],
    project_messages: [{ id: "request", project_id: "project", owner_id: "owner", metadata: { screenStateProposal: structuredClone(proposal) } }],
    screens: [{ id: "parent", project_id: "project", owner_id: "owner", code: "<main>Today</main>", status: "ready", generation_run_id: "parent-run" }],
    project_screen_roadmap: [
      { id: "parent-roadmap", project_id: "project", owner_id: "owner", kind: "screen", stable_key: "screen:today", name: "Today", description: "Daily habits", metadata: {}, screen_type: "root" },
      { id: "state-roadmap", project_id: "project", owner_id: "owner", kind: "state", stable_key: "state:filter", name: "Filter", description: "Open filters", metadata: { editInstruction: "Show filters" }, state_key: "filter", state_label: "Filter", state_role: "custom", trigger_label: "Filter" },
    ], generation_runs: [], project_navigation: [],
  };
  const admin = { rpc: vi.fn(async () => {
    if (!tables.generation_runs.length) tables.generation_runs.push({ id: "run", owner_id: "owner", status: "queued", trigger_run_id: null,
      metadata: { stateRoadmapItemId: "state-roadmap", parentRevisionHash: "revision", queuedMessageId: "queued" } });
    tables.project_messages[0].metadata.screenStateProposal.approvedGenerationRunId = "run";
    return { data: { generationRunId: "run" }, error: null };
  }), from(table: string) {
    const filters: ((row: Record<string, any>) => boolean)[] = []; let patch: Record<string, unknown> | null = null;
    const execute = (single = false) => {
      const rows = tables[table].filter(row => filters.every(test => test(row)));
      if (patch) rows.forEach(row => Object.assign(row, structuredClone(patch)));
      return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
    };
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; },
      update: (value: Record<string, unknown>) => { patch = value; return query; }, single: async () => execute(true), maybeSingle: async () => execute(true),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve) };
    return query;
  } };
  return { admin: admin as never, tables, rpc: admin.rpc };
}
beforeEach(() => { vi.clearAllMocks(); mocks.credits.mockResolvedValue({ hasCredits: true, currentBalance: 50 }); mocks.trigger.mockResolvedValue({ id: "trigger" }); });
describe("manual state dispatch recovery", () => {
  it("retries an uncertain dispatch with identical saved payload and idempotency key", async () => {
    const { admin, tables } = fixture();
    const args = { admin, ownerId: "owner", projectId: "project", proposalMessageId: "request" };
    mocks.trigger.mockRejectedValueOnce(new Error("Response lost"));
    await expect(approveScreenStateProposal(args)).rejects.toThrow("Response lost");
    expect(tables.generation_runs).toHaveLength(1);
    expect(await approveScreenStateProposal(args)).toMatchObject({ generationRunId: "run" });
    expect(mocks.trigger.mock.calls[1]).toEqual(mocks.trigger.mock.calls[0]);
    expect(mocks.trigger.mock.calls[0][2].idempotencyKey).toBe("state-run:run");
    expect(mocks.trigger.mock.calls[0][1].retryContext.sourceGenerationRunId).toBe("parent-run");
    await approveScreenStateProposal(args);
    expect(mocks.trigger).toHaveBeenCalledTimes(2);
    expect(mocks.credits).toHaveBeenCalledTimes(1);
    expect(tables.screens[0].code).toBe("<main>Today</main>");
  });
  it("rejects missing ownership and insufficient credit before claiming or dispatching", async () => {
    const { admin, rpc } = fixture();
    const args = { admin, ownerId: "other", projectId: "project", proposalMessageId: "request" };
    await expect(approveScreenStateProposal(args)).rejects.toMatchObject({ status: 404 });
    mocks.credits.mockResolvedValue({ hasCredits: false, currentBalance: 0 });
    await expect(approveScreenStateProposal({ ...args, ownerId: "owner" })).rejects.toMatchObject({ status: 402 });
    expect(rpc).not.toHaveBeenCalled(); expect(mocks.trigger).not.toHaveBeenCalled();
  });
});
