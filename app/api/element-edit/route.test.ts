import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, read, replay, persist, trigger, projectRead } = vi.hoisted(() => ({
  getUser: vi.fn(), read: vi.fn(), replay: vi.fn(), persist: vi.fn(), trigger: vi.fn(), projectRead: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: projectRead }) }) }) }) }));
vi.mock("@/lib/design-history/persistence", () => ({ readDesignTarget: read, readDesignRequestReplay: replay, persistDesignChange: persist }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger } }));
import { POST } from "./route";

const projectId = "11111111-1111-4111-8111-111111111111";
const screenId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";
const operations = [{ type: "deleteElement", targetDrawgleId: "card" }];
const run = (extra: object = {}) => POST(new Request("http://localhost/api/element-edit", { method: "POST",
  body: JSON.stringify({ projectId, screenId, drawgleId: "card", operations, expectedRevision: 4, requestId, ...extra }) }));
const fingerprint = `element-edit:${createHash("sha256").update(JSON.stringify({ drawgleId: "card", operations })).digest("hex")}`;

describe("deterministic edit request replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    projectRead.mockResolvedValue({ data: { id: projectId, owner_id: ownerId, design_tokens: null }, error: null });
    read.mockResolvedValue({ ready: true, revision: 4, payload: { code: '<main data-drawgle-id="root"><article data-drawgle-id="card">Card</article></main>' } });
    persist.mockResolvedValue({ status: "success", revision: 5 });
    trigger.mockResolvedValue({ id: "memory-job" });
    replay.mockResolvedValue({ status: "success", revision: 5, replayed: true });
  });
  it("stores the same fingerprint checked by a retry", async () => {
    expect((await run()).status).toBe(200);
    expect(persist.mock.calls[0][2]).toMatchObject({ requestId, expectedRevision: 4, origin: fingerprint });
    expect(persist.mock.calls[0][2].payload.code).not.toContain('data-drawgle-id="card"');
  });
  it.each(["screen", "navigation"])("acknowledges a lost response without repeating destructive %s operations", async targetType => {
    read.mockResolvedValue({ ready: true, revision: 5, payload: targetType === "screen" ? { code: "<main>Already deleted</main>" } : { shellCode: "<nav>Already deleted</nav>" } });
    const result = await run({ targetType });
    expect(await result.json()).toMatchObject({ ok: true, revision: 5, replayed: true });
    expect(replay.mock.calls[0][1]).toMatchObject({ ownerId, target: { context: targetType } });
    expect(replay.mock.calls[0][2]).toEqual({ expectedRevision: 4, requestId, origin: fingerprint });
    expect(persist).not.toHaveBeenCalled(); expect(trigger).not.toHaveBeenCalled();
  });
  it("rejects stale or mismatched requests without modifying newer source", async () => {
    read.mockResolvedValue({ ready: true, revision: 6, payload: { code: "<main>Newer source</main>" } });
    replay.mockResolvedValue({ status: "stale_revision" });
    expect((await run()).status).toBe(409); expect(persist).not.toHaveBeenCalled();
  });
  it("checks ownership before looking up a replay", async () => {
    projectRead.mockResolvedValue({ data: { id: projectId, owner_id: "another-owner" }, error: null });
    expect((await run()).status).toBe(404); expect(replay).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  });
});
