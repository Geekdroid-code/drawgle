import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(async (key: string, _options?: { scope: string }) => `global:${key}`), trigger: vi.fn(async () => ({})) }));
vi.mock("@trigger.dev/sdk", () => ({ idempotencyKeys: { create: mocks.create }, tasks: { trigger: mocks.trigger } }));
import { designerFixture } from "./test-fixtures";
import { enqueueScopePreparation } from "./scope-preparation-task";

describe("scope preparation dispatch", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is off unless explicitly enabled, because unused preparations cost a planning pass", async () => {
    vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", undefined);
    vi.stubEnv("DRAWGLE_SCOPE_PREPARATION", undefined);
    mocks.trigger.mockClear();
    const state = designerFixture();
    state.scope = { ...state.scope!, status: "proposed" };
    await enqueueScopePreparation({} as never, "project", "owner", state);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("uses a global exact-snapshot key and changes it when shared design changes", async () => {
    vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", undefined);
    vi.stubEnv("DRAWGLE_SCOPE_PREPARATION", "on");
    let tokens: unknown = null;
    const admin = { from: (table: string) => {
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: table === "projects"
          ? { design_tokens: tokens, project_charter: null } : { plan: null }, error: null }) };
      return query;
    } };
    const state = designerFixture();
    state.scope = { ...state.scope!, status: "proposed" };
    await enqueueScopePreparation(admin as never, "project", "owner", state);
    tokens = { accent: "changed" };
    await enqueueScopePreparation(admin as never, "project", "owner", state);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][0]).not.toBe(mocks.create.mock.calls[1][0]);
    expect(mocks.create.mock.calls[0][1]).toEqual({ scope: "global" });
    expect(mocks.trigger).toHaveBeenCalledTimes(2);
  });
});
