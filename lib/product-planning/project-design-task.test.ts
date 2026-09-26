import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(async (key: string) => `global:${key}`), preset: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ idempotencyKeys: { create: mocks.create } }));
vi.mock("@/lib/published-style-presets", () => ({ resolvePublishedStylePreset: mocks.preset }));
import { createProductPlanning } from "./model";
import { projectDesignTaskIdentity } from "./project-design-task";

describe("project design task identity", () => {
  it("uses one global key containing the resolved preset version", async () => {
    mocks.preset.mockResolvedValue({ version: 7 });
    const state = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: "linen" });
    const first = await projectDesignTaskIdentity(state, "project");
    const second = await projectDesignTaskIdentity(state, "project", 7);
    expect(first).toEqual(second);
    expect(mocks.create).toHaveBeenCalledWith(`project-design:project:${first.key}`, { scope: "global" });
  });
});
