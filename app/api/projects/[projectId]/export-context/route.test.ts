import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUser, rpc, prepare } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/export/snapshot", () => ({ prepareExportSnapshot: prepare }));
import { POST } from "./route";
const projectId = "11111111-1111-4111-8111-111111111111";
const screenId = "22222222-2222-4222-8222-222222222222";
const run = (body: unknown = { screenIds: [screenId] }) => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ projectId }) });
describe("export context authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "authenticated-owner" } }, error: null });
    rpc.mockResolvedValue({ data: { saved: true }, error: null });
    prepare.mockReturnValue({ screens: [] });
  });
  it("denies anonymous requests before database access", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await run()).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
  });
  it("binds ownership to authenticated identity and uses one snapshot read", async () => {
    expect((await run({ screenIds: [screenId], ownerId: "attacker-choice" })).status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_export_context", { input_project_id: projectId, input_owner_id: "authenticated-owner", input_screen_ids: [screenId] });
  });
  it("does not disclose an unavailable project", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await run()).status).toBe(404); expect(prepare).not.toHaveBeenCalled();
  });
  it("rejects duplicate and invalid screen IDs", async () => {
    expect((await run({ screenIds: [screenId, screenId] })).status).toBe(400);
    expect((await run({ screenIds: ["bad"] })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns explicit retry and refresh responses without exposing database diagnostics", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "PRIVATE_DATABASE_DETAIL" } });
    const failure = await run(); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain("PRIVATE_");
    prepare.mockImplementationOnce(() => { throw new Error("Unavailable screen"); });
    expect((await run()).status).toBe(409);
  });
});
