import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
import { previewHistory, recoverDesign } from "./server";
const projectId = "11111111-1111-4111-8111-111111111111", ownerId = "22222222-2222-4222-8222-222222222222";
const screenId = "33333333-3333-4333-8333-333333333333", entryId = "44444444-4444-4444-8444-444444444444";
const target = { context: "screen" as const, screenId };
describe("history snapshot side", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns separate validated before and after snapshots for a deletion", async () => {
    rpc.mockResolvedValue({ data: { id: entryId, label: "Deleted element", createdAt: "2026-10-02", payload: { code: "<main>After</main>" }, beforePayload: { code: "<main>Before</main>" } }, error: null });
    const entry = await previewHistory(projectId,ownerId,target,entryId);
    expect(entry?.beforePayload).toEqual({ code: "<main>Before</main>" });
    expect(entry?.payload).toEqual({ code: "<main>After</main>" });
  });
  it("says when an entry is where history starts, and assumes not when an older database does not say", async () => {
    const tokens = { context: "tokens" as const };
    rpc.mockResolvedValueOnce({ data: { id: entryId, label: "Created the design system", createdAt: "2026-10-02", payload: { tokens: { tokens: { color: {} } } }, beforePayload: { tokens: null }, startingPoint: true }, error: null });
    expect((await previewHistory(projectId,ownerId,tokens,entryId))?.startingPoint).toBe(true);
    rpc.mockResolvedValueOnce({ data: { id: entryId, label: "Saved design tokens", createdAt: "2026-10-02", payload: { tokens: { tokens: {} } }, beforePayload: { tokens: { tokens: {} } } }, error: null });
    expect((await previewHistory(projectId,ownerId,tokens,entryId))?.startingPoint).toBe(false);
  });
  it.each(["before", "after"] as const)("restores the same %s side selected in the preview", async side => {
    rpc.mockResolvedValueOnce({ data: { code: `<main>${side}</main>` }, error: null });
    rpc.mockResolvedValueOnce({ data: { status: "success", revision: 5 }, error: null });
    await recoverDesign(projectId,ownerId,{ target, action: "restore", side, entryId, expectedRevision: 4, requestId: crypto.randomUUID() });
    const action = side === "before" ? "restore-before" : "restore";
    expect(rpc.mock.calls[0][1]).toMatchObject({ input_owner_id: ownerId, input_action: action, input_entry_id: entryId });
    expect(rpc.mock.calls[1][1]).toMatchObject({ input_owner_id: ownerId, input_action: action, input_entry_id: entryId, input_expected_revision: 4 });
    expect(rpc.mock.calls[1][1].input_block_index).toBeTruthy();
  });
});
