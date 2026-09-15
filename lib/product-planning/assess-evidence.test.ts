import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
import { assessProductEvidence } from "./assess-evidence";
import { designerFixture } from "./test-fixtures";
import { evidenceAllowsProposal } from "./evidence";
const ready = { mode: "product", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Detailed brief" };
describe("evidence assessment boundary", () => {
  beforeEach(() => mocks.generate.mockReset());
  it("sends actual reference pixels and user history, not just blueprint facts", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify(ready) });
    await assessProductEvidence({ state: designerFixture(), prompt: "Build my product", turnId: "turn", history: [{ role: "user", content: "No accounts" }], reference: { data: "pixels", mimeType: "image/png" } });
    const parts = mocks.generate.mock.calls[0][0].contents[0].parts;
    expect(parts[1].inlineData.data).toBe("pixels");
    expect(parts[0].text).toContain("No accounts");
  });
  it("cannot clear a returned gap using contradictory ready flags", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, gaps: [{ decisionKey: "onboarding-purpose", decisionType: "product_behavior", requiresUserInput: true, whyUserMustDecide: "Whether onboarding changes recommendations or just introduces the product", area: "product", question: "What does onboarding do?", consequence: "Changes the required steps", choices: [{ label: "Introduce", description: "Brand introduction" }, { label: "Personalize", description: "Useful preferences" }, { label: "Shop", description: "Begin shopping" }] }] }) });
    const assessment = await assessProductEvidence({ state: designerFixture(), prompt: "Premium T-shirts", turnId: "turn", history: [], reference: null });
    expect(evidenceAllowsProposal(assessment)).toBe(false);
  });
  it("rejects fabricated delegation after one internal repair", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, delegation: "Decide everything" }) });
    await expect(assessProductEvidence({ state: designerFixture(), prompt: "Premium", turnId: "turn", history: [], reference: null })).rejects.toThrow(/validate/);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
  it("does not ask about supplied screens for a legacy prompt-only project marked recreate", async () => {
    const state = designerFixture(); state.input.imagePath = null; state.input.imageReferenceMode = "recreate";
    mocks.generate.mockResolvedValue({ text: JSON.stringify(ready) });
    const result = await assessProductEvidence({ state, prompt: "Build a T-shirt app", turnId: "turn", history: [], reference: null });
    expect(result).toMatchObject({ mode: "product", gaps: [] });
    const request = mocks.generate.mock.calls[0][0];
    expect(JSON.parse(request.contents[0].parts[0].text).referenceContext).toMatchObject({ mode: "prompt", hasUserUpload: false, hasReferencePixels: false });
    expect(request.config.responseSchema.properties).not.toHaveProperty("mode");
  });
  it.each(["style", "recreate"] as const)("cannot reinterpret the user-selected %s mode even with a model quote", async mode => {
    const state = designerFixture(); state.input.imageReferenceMode = mode;
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, mode: mode === "style" ? "recreate" : "product", modeChangeEvidence: "Change it" }) });
    const result = await assessProductEvidence({ state, prompt: "Change it", turnId: "turn", history: [], reference: { data: "pixels", mimeType: "image/png" } });
    expect(result.mode).toBe(mode === "recreate" ? "recreate" : "product");
    expect(result.modeChangeEvidence).toBe("");
    expect(result.gaps).toEqual([]);
  });
  it("repairs invalid mode questions internally instead of showing them", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, gaps: [{ area: "mode", question: "Recreate supplied images?", consequence: "Which mode?" }] }) })
      .mockResolvedValueOnce({ text: JSON.stringify(ready) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "My product", turnId: "turn", history: [], reference: null });
    expect(result.gaps).toEqual([]);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mocks.generate.mock.calls[1][0].contents)).toContain("authoritative referenceContext");
  });
  it("repairs a paraphrased delegation quote once without inventing user approval", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Please make every product decision for me" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Make low-risk assumptions" }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Make low-risk assumptions", turnId: "turn", history: [], reference: null });
    expect(result.delegation).toBe("Make low-risk assumptions");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
});
