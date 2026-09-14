import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ tables: {} as Record<string, Array<Record<string, any>>>, child: vi.fn(), credits: vi.fn(), rpc: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ task: (definition: unknown) => definition, tasks: { triggerAndWait: mocks.child } }));
vi.mock("@/lib/credits", () => ({ adminCreditService: { hasCredits: mocks.credits } }));
vi.mock("@/lib/supabase/queries", () => ({ insertProjectMessage: async () => ({ id: "message" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: (table: string) => {
  const filters: Array<(row: Record<string, any>) => boolean> = [];
  let patch: Record<string, any> | null = null;
  const execute = (single = false) => {
    const rows = (mocks.tables[table] ??= []).filter(row => filters.every(filter => filter(row)));
    if (patch) rows.forEach(row => Object.assign(row, patch));
    return { data: structuredClone(single ? rows[0] : rows), error: null };
  };
  const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
    neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
    update: (value: Record<string, any>) => { patch = value; return query; }, single: async () => execute(true), maybeSingle: async () => execute(true),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve) };
  return query;
} }) }));
import { generateProductFlowTask } from "@/trigger/generate-product-flow";
import { designerFixture, functionalFixture } from "./test-fixtures";
import { approveProductScope, proposeProductScope } from "./model";
import type { GenerateUiFlowPayload } from "@/trigger/generate-ui-flow";
const rootId = "11111111-1111-4111-8111-111111111111";
const owner = "owner"; const project = "project";
const invoke = (payload: GenerateUiFlowPayload) => (generateProductFlowTask as unknown as { run: (input: GenerateUiFlowPayload) => Promise<unknown> }).run(payload);
describe("durable approved-flow coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tables = { generation_runs: [{ id: rootId, status: "queued", metadata: {} }], product_output_fulfillments: [], projects: [{ id: project, owner_id: owner }], screens: [] };
    mocks.credits.mockResolvedValue({ hasCredits: true });
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "set_product_generation_progress") {
        const root = mocks.tables.generation_runs[0];
        if (root.status === "canceled" || (root.metadata.productAttempt ?? 0) !== args.input_attempt) return { data: false, error: null };
        if (args.input_status) root.status = args.input_status;
        root.error = args.input_error;
        if (args.input_progress) root.metadata.productProgress = args.input_progress;
        return { data: true, error: null };
      }
      const existing = mocks.tables.product_output_fulfillments.find(row => row.output_key === args.input_keys[0]);
      const id = existing?.generation_run_id ?? `batch-${mocks.tables.generation_runs.length}`;
      if (!existing) {
        mocks.tables.generation_runs.push({ id, status: "queued" });
        mocks.tables.product_output_fulfillments.push(...args.input_keys.map((key: string) => ({ approval_id: rootId, owner_id: owner, output_key: key, generation_run_id: id, status: "claimed", screen_id: null })));
      }
      return { data: id, error: null };
    });
    mocks.child.mockImplementation(async (_name, payload) => {
      const stateOnly = payload.retryContext?.mode === "state_variants";
      const outputs = payload.productPlanning.scope.manifest.filter((item: { stableKey: string; kind: string }) => payload.productExecutionKeys.includes(item.stableKey) && (!stateOnly || item.kind === "state"));
      mocks.tables.screens.push(...outputs.map((item: { name: string; kind: string; stateKey: string }, index: number) => ({
        id: `${payload.generationRunId}-${index}`, generation_run_id: payload.generationRunId, project_id: project,
        name: item.name, parent_screen_id: item.kind === "state" ? "parent" : null, state_key: item.kind === "state" ? item.stateKey : "base", status: "ready",
      })));
      return { ok: true };
    });
  });
  const payload = () => {
    const state = designerFixture();
    state.scope!.manifest = Array.from({ length: 7 }, (_, index) => functionalFixture(`screen:${index}`, `Screen ${index}`, index));
    const approved = approveProductScope(proposeProductScope(state), state.revision);
    return { generationRunId: rootId, projectId: project, ownerId: owner, prompt: "Build", productPlanning: approved };
  };
  it("finishes more than five screens across child runs and reports overall completion", async () => {
    expect(await invoke(payload())).toEqual({ completed: true });
    expect(mocks.child).toHaveBeenCalledTimes(7);
    for (const [, child] of mocks.child.mock.calls) {
      expect(child.productPlanning.scope.manifest).toHaveLength(7);
      expect(child.productExecutionKeys).toHaveLength(1);
      expect(child.scopeContract.finalScreenCount).toBe(1);
    }
    expect(mocks.tables.product_output_fulfillments.every(row => row.status === "ready")).toBe(true);
    expect(mocks.tables.generation_runs[0].status).toBe("completed");
    expect(mocks.tables.generation_runs[0].metadata.productProgress.delivered).toBe(7);
    await invoke(payload());
    expect(mocks.child).toHaveBeenCalledTimes(7);
  });
  it("pauses before claiming or dispatching a batch with insufficient credit", async () => {
    mocks.credits.mockResolvedValue({ hasCredits: false });
    expect(await invoke(payload())).toEqual({ paused: true });
    expect(mocks.rpc.mock.calls.some(([name]) => name === "claim_product_generation_batch")).toBe(false);
    expect(mocks.child).not.toHaveBeenCalled();
    expect(mocks.tables.generation_runs[0].status).toBe("failed");
  });
  it("delivers parent states across the eight-output limit before moving to another parent", async () => {
    const input = payload();
    const parent = input.productPlanning.scope!.manifest![0];
    const states = Array.from({ length: 9 }, (_, index) => ({ ...functionalFixture(`state:first:${index}`, `State ${index}`, index + 1), kind: "state" as const,
      parentStableKey: parent.stableKey, stateKey: `state-${index}`, triggerLabel: "Change selection", editInstruction: "Show the changed selection" }));
    input.productPlanning.scope!.manifest = [parent, ...states, input.productPlanning.scope!.manifest![1]];
    expect(await invoke(input)).toEqual({ completed: true });
    expect(mocks.child.mock.calls.map(([, child]) => child.productExecutionKeys.length)).toEqual([8, 2, 1]);
    const second = mocks.child.mock.calls[1][1];
    expect(second.retryContext.mode).toBe("state_variants");
    expect(second.retryContext.parentScreenId).toBeTruthy();
    expect(second.productPlanning.scope.manifest).toHaveLength(11);
    expect(mocks.tables.product_output_fulfillments).toHaveLength(11);
  });
  it("an old coordinator cannot continue a resumed approval", async () => {
    mocks.tables.generation_runs[0].metadata.productAttempt = 1;
    expect(await invoke(payload())).toEqual({ superseded: true });
    expect(mocks.child).not.toHaveBeenCalled();
    expect(mocks.tables.generation_runs[0].status).toBe("queued");
  });
  it("stops continuation after cancellation while preserving the settled current batch", async () => {
    const build = mocks.child.getMockImplementation()!;
    mocks.child.mockImplementationOnce(async (...args) => { const result = await build(...args); mocks.tables.generation_runs[0].status = "canceled"; return result; });
    expect(await invoke(payload())).toEqual({ canceled: true });
    expect(mocks.child).toHaveBeenCalledOnce();
    expect(mocks.tables.product_output_fulfillments[0].status).toBe("ready");
  });
});
