import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadProductPlanning, saveProductPlanning } from "./store";
import { productFixture } from "./test-fixtures";

describe("project planning persistence", () => {
  it("constrains every write to owner, project and expected revision", async () => {
    const query = { update: vi.fn(() => query), eq: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: { id: "project" }, error: null })) };
    const admin = { from: vi.fn(() => query) };
    const state = productFixture();
    const next = await saveProductPlanning(admin, "project", "owner", state, state);
    expect(query.eq.mock.calls).toEqual([["id", "project"], ["owner_id", "owner"], ["product_planning->>revision", "0"]]);
    expect(next.revision).toBe(1);
    expect(state.revision).toBe(0);
  });
  it("rejects a concurrent stale writer instead of silently losing decisions", async () => {
    const query = { update: () => query, eq: () => query, select: () => query, maybeSingle: async () => ({ data: null, error: null }) };
    await expect(saveProductPlanning({ from: () => query }, "project", "owner", productFixture(), productFixture())).rejects.toThrow(/another turn/);
  });
  it("loads only the caller's project and propagates database failure", async () => {
    const query = { select: () => query, eq: vi.fn(() => query), single: async () => ({ data: null, error: new Error("unavailable") }) };
    await expect(loadProductPlanning({ from: () => query }, "project", "owner")).rejects.toThrow("unavailable");
    expect(query.eq.mock.calls).toEqual([["id", "project"], ["owner_id", "owner"]]);
  });
});
