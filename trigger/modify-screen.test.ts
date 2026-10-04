import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  execute: vi.fn(),
  balance: vi.fn(),
  enrich: vi.fn(),
  logError: vi.fn(),
  inserted: [] as unknown[],
}));

vi.mock("@trigger.dev/sdk", () => ({
  logger: { info: vi.fn(), error: mocks.logError },
  task: (config: unknown) => config,
}));
vi.mock("@/lib/generation/edit-runner", () => ({ executeModifyScreenTask: mocks.execute }));
vi.mock("@/lib/credits", () => ({ adminCreditService: { getUserCredits: mocks.balance } }));
vi.mock("@/lib/ai/error-handler", () => ({ cleanErrorMessage: (message: string) => message }));
vi.mock("@/trigger/enrich-screen-memory", () => ({ enrichScreenMemoryTask: { trigger: mocks.enrich } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    // The failure bookkeeping reads and writes project messages; none of it matters here.
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "contains", "order", "limit", "update"]) query[method] = () => query;
    query.maybeSingle = async () => ({ data: null, error: null });
    query.insert = async (row: unknown) => { mocks.inserted.push(row); return { error: null }; };
    return { rpc: mocks.rpc, from: () => query };
  },
}));

import { modifyScreenTask } from "@/trigger/modify-screen";

type Task = {
  run: (payload: Record<string, unknown>) => Promise<unknown>;
  onFailure: (input: { payload: Record<string, unknown>; error: unknown }) => Promise<void>;
};
const task = modifyScreenTask as unknown as Task;

const payload = (extra: Record<string, unknown> = {}) => ({
  projectId: "project-1",
  ownerId: "owner-1",
  prompt: "Make the button bigger",
  userMessageId: "message-1",
  screenId: "screen-1",
  selectedElementTarget: "screen",
  selectedElementHtml: "<button>Buy</button>",
  ...extra,
});
const rpcNames = () => mocks.rpc.mock.calls.map(([name]) => name);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserted.length = 0;
  mocks.rpc.mockResolvedValue({ data: { reservedCredits: 3, availableBalance: 97, idempotent: false }, error: null });
  mocks.execute.mockResolvedValue({ changed: true });
  mocks.balance.mockResolvedValue({ balance: 0 });
  mocks.enrich.mockResolvedValue(undefined);
});

describe("modify-screen credits", () => {
  it("reserves the edit's credits before the model runs and keeps them when the edit changes something", async () => {
    await task.run(payload());

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "reserve_edit_credits", expect.objectContaining({
      input_owner_id: "owner-1",
      input_project_id: "project-1",
      input_output_key: "edit:message-1",
      input_amount: 3,
    }));
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "capture_edit_credit", { input_owner_id: "owner-1", input_output_key: "edit:message-1" });
    expect(rpcNames()).not.toContain("release_edit_credit");
    expect(mocks.enrich).toHaveBeenCalledOnce();
  });

  it.each([
    ["a medium container", { selectedElementHtml: "x".repeat(2000) }, 10],
    ["a large section", { selectedElementHtml: "x".repeat(4000) }, 15],
    ["a whole screen", { selectedElementHtml: null }, 20],
    ["the shared navigation", { selectedElementTarget: "navigation", requestTargetsNavigation: true }, 20],
  ])("prices %s at %i credits", async (_label, extra, credits) => {
    await task.run(payload(extra));
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "reserve_edit_credits", expect.objectContaining({ input_amount: credits }));
  });

  it("hands the credits back when the edit changes nothing", async () => {
    mocks.execute.mockResolvedValue({ changed: false });
    await task.run(payload());

    expect(rpcNames()).toEqual(["reserve_edit_credits", "release_edit_credit"]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("release_edit_credit", expect.objectContaining({ input_output_key: "edit:message-1" }));
    expect(mocks.enrich).not.toHaveBeenCalled();
  });

  it("hands the credits back and rethrows the original error when the edit fails", async () => {
    mocks.execute.mockRejectedValue(new Error("model exploded"));
    await expect(task.run(payload())).rejects.toThrow("model exploded");

    expect(rpcNames()).toEqual(["reserve_edit_credits", "release_edit_credit"]);
  });

  it("never lets a failed release hide the edit's own error", async () => {
    mocks.execute.mockRejectedValue(new Error("model exploded"));
    mocks.rpc.mockImplementation(async (name: string) => (
      name === "release_edit_credit" ? { data: null, error: { message: "db down" } } : { data: {}, error: null }
    ));

    await expect(task.run(payload())).rejects.toThrow("model exploded");
    expect(mocks.logError).toHaveBeenCalledWith("Failed to release edit credits", expect.anything());
  });

  it("does not run the model when the balance cannot cover the edit", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Insufficient credits. Available: 2.00, Required: 3.00" } });
    mocks.balance.mockResolvedValue({ balance: 2 });

    await expect(task.run(payload())).rejects.toThrow(/Insufficient credits for Small Component Edit.*Required: 3.*Balance: 2/);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.inserted).toHaveLength(1);
  });

  it("does not run an unpaid edit when the reservation itself fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    await expect(task.run(payload())).rejects.toThrow(/Nothing was charged/);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.balance).not.toHaveBeenCalled();
  });

  it("returns the saved edit, and leaves the reservation to the sweep, when capture fails", async () => {
    mocks.rpc.mockImplementation(async (name: string) => (
      name === "capture_edit_credit" ? { data: null, error: { message: "db down" } } : { data: {}, error: null }
    ));

    await expect(task.run(payload())).resolves.toEqual({ changed: true });
    expect(mocks.logError).toHaveBeenCalledWith("Failed to capture edit credits after a successful edit", expect.anything());
    expect(rpcNames()).not.toContain("release_edit_credit");
  });

  it("releases a dead run's reservation from onFailure, the one path a timeout or crash still reaches", async () => {
    await task.onFailure({ payload: payload(), error: new Error("Maximum duration exceeded") });

    expect(mocks.rpc).toHaveBeenCalledWith("release_edit_credit", expect.objectContaining({
      input_owner_id: "owner-1",
      input_output_key: "edit:message-1",
    }));
  });
});
