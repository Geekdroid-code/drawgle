import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { planUiFlow } from "@/lib/generation/service";
import { approveProductScope, proposeProductScope } from "./model";
import { productFixture, designerFixture, functionalFixture } from "./test-fixtures";

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
    expect(request).toContain("generate the selected output manifest");
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
  it("plans one execution chunk against the full approved flow and experience", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("Captured planner request"));
    const base = designerFixture();
    base.scope!.manifest!.push(functionalFixture("screen:shop", "Shop", 1));
    const state = approveProductScope(proposeProductScope(base), base.revision);
    await expect(planUiFlow({ prompt: "Design Welcome", productPlanning: state, productExecutionKeys: ["screen:onboarding"], referenceMode: "user_style" })).rejects.toThrow("Captured planner request");
    const request = JSON.stringify(mocks.generate.mock.calls[0][0]);
    expect(request).toContain("screen:shop");
    expect(request).toContain("EXECUTION SELECTION");
    expect(request).toContain("Product-led restrained shopping");
    expect(request).toContain("Return exactly 1 screen");
    expect(request).not.toContain("initial app planning is capped at 5 screens");
  });
});
