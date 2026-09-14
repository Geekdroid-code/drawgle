import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ existing: null as { id: string; owner_id: string } | null, rpc: vi.fn(), store: vi.fn(), user: { id: "owner" } as { id: string } | null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.existing, error: null }) }; return query;
} }) }));
vi.mock("./references", () => ({ storePlanningReference: mocks.store }));
import { POST } from "@/app/api/projects/route";
const projectId = "11111111-1111-4111-8111-111111111111";
const request = () => new Request("http://localhost/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientRequestId: projectId, prompt: "Tacozz T-shirts", stylePresetSlug: "minimal" }) });
describe("real project creation before generation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.existing = null; mocks.user = { id: "owner" }; mocks.rpc.mockResolvedValue({ data: projectId, error: null }); });
  it("atomically persists the initial prompt and planning state without requesting generation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ projectId });
    expect(mocks.rpc.mock.calls[0]).toMatchObject(["create_planning_project", {
      input_owner_id: "owner", input_prompt: "Tacozz T-shirts",
      input_product_planning: { phase: "discovery", scope: null, blueprint: { facts: [] }, input: { stylePresetSlug: "minimal" } },
      input_message_metadata: { action: "product_initial_prompt", clientTurnId: `initial:${projectId}` },
    }]);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("returns the original project on retry and refuses another owner's request ID", async () => {
    mocks.existing = { id: projectId, owner_id: "owner" };
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.existing.owner_id = "other";
    expect((await POST(request())).status).toBe(409);
  });
  it("requires authentication before storing any input", async () => {
    mocks.user = null;
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });
});
