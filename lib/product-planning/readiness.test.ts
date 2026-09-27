import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { reviewProductReadiness } from "./readiness";
import { appointmentFlow } from "./flow-test-fixtures";
import { productFixture } from "./test-fixtures";

describe("bounded product readiness review", () => {
  beforeEach(() => mocks.generate.mockReset());
  it("assesses product completeness independently of visual scope preferences", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ requestedScope: "focused", scopeEvidence: "Only onboarding for now", journeys: [], ready: false, issues: ["The purchase journey ends at browsing; map how a shopper completes a purchase even if it will be designed later."] }) });
    const result = await reviewProductReadiness(productFixture(), "Only onboarding for now");
    expect(result.ready).toBe(false);
    const request = mocks.generate.mock.calls[0][0];
    expect(request.config.systemInstruction).toContain("Reject a scope that silently omits named user-facing features");
    expect(JSON.stringify(request.contents)).toContain("Orders");
    expect(JSON.stringify(request.contents)).toContain("Only onboarding for now");
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it("does not turn a narrow recreation into another discovery call", async () => {
    const state = productFixture();
    state.input = { ...state.input, imagePath: "reference.webp", imageReferenceMode: "recreate" };
    expect(await reviewProductReadiness(state, "Recreate these screens")).toEqual({ ready: true, issues: [] });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("fails closed on malformed or unavailable review responses", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "not json" }).mockRejectedValueOnce(new Error("unavailable"));
    await expect(reviewProductReadiness(productFixture(), "Start")).rejects.toThrow();
    await expect(reviewProductReadiness(productFixture(), "Start")).rejects.toThrow("unavailable");
  });
  it("does not accept a contradictory ready flag alongside unresolved gaps", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ requestedScope: "whole_product", scopeEvidence: "Start", journeys: [], ready: true, issues: ["A core journey has no outcome."] }) });
    expect((await reviewProductReadiness(productFixture(), "Start")).ready).toBe(false);
  });
  it("returns saved journey membership when the reviewer omits a completion from its key list", async () => {
    const { state, roadmap, review } = appointmentFlow();
    review.journeys[0].outputKeys = [roadmap[0].stableKey];
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify(review) });
    const result = await reviewProductReadiness(state, review.scopeEvidence, {
      history: [{ role: "user", content: review.scopeEvidence }], roadmap,
    });
    expect(result.ready).toBe(true);
    expect(result.coverage?.journeys[0].outputKeys).toEqual(roadmap.map(item => item.stableKey));
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].contents)).toContain("savedJourneyGraph");
  });
});
