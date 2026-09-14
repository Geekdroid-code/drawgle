import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { planUiFlow } from "@/lib/generation/service";
import { approveProductScope, proposeProductScope } from "./model";
import { productFixture } from "./test-fixtures";

describe("approved product snapshot into existing screen planner", () => {
  beforeEach(() => mocks.generate.mockReset());
  it("rejects unapproved product scope before any model or visual planning call", async () => {
    await expect(planUiFlow({ prompt: "Start", productPlanning: productFixture() })).rejects.toThrow(/approval/);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("supplies full product truth and exact approved scope as separate authorities", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const state = approveProductScope(proposeProductScope(productFixture()), 0);
    await expect(planUiFlow({ prompt: "Design onboarding", productPlanning: state, referenceMode: "internal_style" })).rejects.toThrow("Captured planner request");
    const request = JSON.stringify(mocks.generate.mock.calls[0][0]);
    expect(request).toContain("AUTHORITATIVE PRODUCT BLUEPRINT");
    expect(request).toContain("APPROVED DESIGN SCOPE");
    expect(request).toContain("Orders");
    expect(request).toContain("Onboarding");
    expect(request).toContain("only these surfaces");
  });
  it("keeps multi-screen recreation on the exact-recreate planner contract", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const base = productFixture();
    base.input = { ...base.input, imagePath: "reference.webp", imageReferenceMode: "recreate" };
    base.scope!.surfaceIds = ["onboarding", "shop", "cart"];
    const state = approveProductScope(proposeProductScope(base), 0);
    await expect(planUiFlow({ prompt: "Recreate three screens", productPlanning: state, referenceMode: "user_recreate" })).rejects.toThrow("Captured planner request");
    expect(JSON.stringify(mocks.generate.mock.calls[0][0])).toContain("exact_recreate");
  });
});
