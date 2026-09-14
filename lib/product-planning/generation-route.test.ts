import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ tables: {} as Record<string, Array<Record<string, unknown>>>, trigger: vi.fn(), credits: vi.fn() }));
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }, error: null }) } }) }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock("@/lib/credits", () => ({ adminCreditService: { hasCredits: mocks.credits } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from(table: string) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  let update: Record<string, unknown> | null = null;
  let insert: Record<string, unknown> | null = null;
  const execute = (single = false) => {
    const rows = mocks.tables[table] ??= [];
    if (insert) rows.push({ ...insert, id: "33333333-3333-4333-8333-333333333333", created_at: new Date().toISOString() });
    const matches = rows.filter((row) => filters.every((test) => test(row)));
    if (update) matches.forEach((row) => Object.assign(row, update));
    return { data: structuredClone(single ? insert ? rows.at(-1) : matches[0] ?? null : matches), error: null, count: matches.length };
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push((row) => key === "product_planning->>revision" ? String((row.product_planning as { revision: number }).revision) === value : row[key] === value); return query; },
    in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
    not: (key: string, _operator: string, value: unknown) => { filters.push((row) => row[key] !== value); return query; },
    order: () => query, limit: () => query,
    update: (value: Record<string, unknown>) => { update = value; return query; },
    insert: (value: Record<string, unknown>) => { insert = value; return query; },
    single: async () => execute(true), maybeSingle: async () => execute(true),
    then: (resolve: (value: ReturnType<typeof execute>) => void) => Promise.resolve(execute()).then(resolve),
  };
  return query;
} }) }));
import { POST } from "@/app/api/generations/route";
import { proposeProductScope, readProductPlanning } from "./model";
import { productFixture } from "./test-fixtures";
const request = (extra: Record<string, unknown> = {}) => new Request("http://localhost/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, clientRequestId: requestId, prompt: "Approve", productApproval: { revision: 0 }, ...extra }) });

describe("approved scope through the existing generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tables = { projects: [{ id: projectId, owner_id: ownerId, design_tokens: null, product_planning: proposeProductScope(productFixture()) }], generation_runs: [], project_messages: [] };
    mocks.trigger.mockResolvedValue({ id: "trigger-run" });
    mocks.credits.mockResolvedValue({ hasCredits: true, currentBalance: 500 });
  });
  it("queues the same project with the server snapshot and curated first-generation policy", async () => {
    const response = await POST(request({ plannedScreens: [{ name: "Manifesto" }] }));
    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.projectId).toBe(projectId);
    expect(mocks.trigger).toHaveBeenCalledOnce();
    const task = mocks.trigger.mock.calls[0][1];
    expect(task.projectId).toBe(projectId);
    expect(task.isNewProject).toBe(true);
    expect(task.referencePolicy).toBe("curated_fallback");
    expect(task.productPlanning.scope).toMatchObject({ status: "approved", surfaceIds: ["onboarding"] });
    expect(task.scopeContract.screens.map((screen: { name: string }) => screen.name)).toEqual(["Onboarding"]);
    expect(task.plannedScreens).toBeNull();
    expect(readProductPlanning(mocks.tables.projects[0].product_planning)?.phase).toBe("canvas");
    expect(mocks.tables.project_messages[0].content).toContain("Approved:");
    expect(mocks.tables.screens ?? []).toEqual([]);
    expect((await POST(request())).status).toBe(202);
    expect(mocks.trigger).toHaveBeenCalledOnce();
    expect(mocks.tables.generation_runs).toHaveLength(1);
  });
  it("restores the proposal when task dispatch fails", async () => {
    mocks.trigger.mockRejectedValueOnce(new Error("Task dispatch unavailable"));
    expect((await POST(request())).status).toBe(500);
    const state = readProductPlanning(mocks.tables.projects[0].product_planning)!;
    expect(state.phase).toBe("discovery");
    expect(state.scope?.status).toBe("proposed");
    expect(state.lease).toBeNull();
    expect(mocks.tables.generation_runs[0].status).toBe("failed");
  });
  it("rejects insufficient credits before creating a generation or changing product phase", async () => {
    mocks.credits.mockResolvedValueOnce({ hasCredits: false, currentBalance: 0 });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.tables.generation_runs).toEqual([]);
    expect(readProductPlanning(mocks.tables.projects[0].product_planning)?.phase).toBe("discovery");
  });
});
