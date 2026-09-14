import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, filters: [] as unknown[][], resume: vi.fn(), result: { data: { id: "run" } as unknown, error: null } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => {
  const query = { update: () => query, eq: (...args: unknown[]) => { mocks.filters.push(args); return query; }, not: () => query, in: () => query,
    select: () => query, maybeSingle: async () => mocks.result };
  return { from: () => query, rpc: async (name: string, args: Record<string, unknown>) => { mocks.filters.push([name, args]); return mocks.result; } };
} }));
vi.mock("./resume-generation", () => ({ resumeProductGeneration: mocks.resume }));
import { POST } from "@/app/api/projects/[projectId]/product-generation/route";
const projectId = "11111111-1111-4111-8111-111111111111";
const approvalId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const invoke = (action = "resume") => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ approvalId, requestId, action }) }), { params: Promise.resolve({ projectId }) });
describe("approved generation actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: "owner" }; mocks.filters = []; mocks.result.data = { id: approvalId }; mocks.resume.mockResolvedValue({ generationRunId: approvalId }); });
  it("requires authentication before any action", async () => {
    mocks.user = null;
    expect((await invoke()).status).toBe(401);
    expect(mocks.resume).not.toHaveBeenCalled();
  });
  it("passes the authenticated owner, project and stable request identity into resume", async () => {
    expect((await invoke()).status).toBe(202);
    expect(mocks.resume).toHaveBeenCalledWith(expect.anything(), "owner", projectId, approvalId, requestId);
  });
  it("scopes cancellation to the owner and project and rejects absent approvals", async () => {
    expect((await invoke("cancel")).status).toBe(200);
    expect(mocks.filters).toContainEqual(["cancel_product_generation", { input_owner_id: "owner", input_project_id: projectId, input_approval_id: approvalId }]);
    mocks.result.data = null;
    expect((await invoke("cancel")).status).toBe(409);
  });
});
