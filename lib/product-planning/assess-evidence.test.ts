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
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, gaps: [{ area: "product", question: "What does onboarding do?", consequence: "Changes the required steps", choices: [{ label: "Introduce", description: "Brand introduction" }, { label: "Personalize", description: "Useful preferences" }, { label: "Shop", description: "Begin shopping" }] }] }) });
    const assessment = await assessProductEvidence({ state: designerFixture(), prompt: "Premium T-shirts", turnId: "turn", history: [], reference: null });
    expect(evidenceAllowsProposal(assessment)).toBe(false);
  });
  it("rejects fabricated delegation and recreation without an image", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Decide everything" }) });
    const input = { state: designerFixture(), prompt: "Premium", turnId: "turn", history: [], reference: null };
    await expect(assessProductEvidence(input)).rejects.toThrow(/delegation/);
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, mode: "recreate" }) });
    await expect(assessProductEvidence(input)).rejects.toThrow(/recreation/);
  });
  it("requires a user's mode decision before reinterpreting a recreation reference", async () => {
    const state = designerFixture(); state.input.imageReferenceMode = "recreate";
    const input = { state, prompt: "Make an app", turnId: "turn", history: [], reference: { data: "pixels", mimeType: "image/png" as const } };
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify(ready) });
    expect((await assessProductEvidence(input)).mode).toBe("clarify_mode");
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, modeChangeEvidence: "Adapt it to my product" }) });
    expect((await assessProductEvidence({ ...input, prompt: "Adapt it to my product" })).mode).toBe("product");
  });
  it("repairs a paraphrased delegation quote once without inventing user approval", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Please make every product decision for me" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Make low-risk assumptions" }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Make low-risk assumptions", turnId: "turn", history: [], reference: null });
    expect(result.delegation).toBe("Make low-risk assumptions");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
});
