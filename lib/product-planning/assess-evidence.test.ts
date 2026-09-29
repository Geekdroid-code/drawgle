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
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, gaps: [{ decisionKey: "onboarding-screen", decisionType: "screen_flow", requiresUserInput: true, whyUserMustDecide: "The entry screen changes", area: "product", question: "Which screen should open the shopping flow?", consequence: "Changes the screen path", choices: [{ label: "Welcome", description: "Show a brief welcome view." }, { label: "Catalog", description: "Show products first." }, { label: "Preferences", description: "Show a preference view first." }] }] }) });
    const assessment = await assessProductEvidence({ state: designerFixture(), prompt: "Premium T-shirts", turnId: "turn", history: [], reference: null });
    expect(evidenceAllowsProposal(assessment)).toBe(false);
  });
  it("suppresses backend and output-format questions from the model response", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, productReady: false, gaps: [{
      decisionKey: "animation-output", decisionType: "product_behavior", requiresUserInput: true,
      whyUserMustDecide: "The output format changes implementation", area: "product",
      question: "What should be the primary output for animated photos?", consequence: "Changes file handling",
      choices: [{ label: "MP4", description: "Export video." }, { label: "GIF", description: "Export image." }, { label: "Live Photo", description: "Export live photo." }],
    }] }) });
    const assessment = await assessProductEvidence({ state: designerFixture(), prompt: "Design my photo app", turnId: "turn", history: [], reference: null });
    expect(assessment.gaps).toEqual([]);
    expect(evidenceAllowsProposal(assessment)).toBe(true);
  });
  it("drops fabricated delegation without paying for another model call", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, delegation: "Decide everything" }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Premium", turnId: "turn", history: [], reference: null });
    expect(result).toMatchObject({ productReady: true, gaps: [], delegation: "" });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("normalizes long preview lines, odd keys and missing reasons instead of rejecting the assessment", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, productReady: false,
      screenFlowPreview: ["Today: " + "see every chore for the whole family with who owns it and when it is due ".repeat(4)],
      recommendations: [{ decisionKey: "Visual Style", recommendation: "Use warm neutrals", rationale: "" }],
      gaps: [{ area: "product", decisionKey: "Home Entry!", decisionType: "screen_flow", question: "Which screen should families see first?",
        consequence: "Changes the visible flow", choices: [{ label: "Today", description: "Today's chores" },
          { label: "Family", description: "Each member" }, { label: "Calendar", description: "The week" }] }] }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Design a family chore app", turnId: "turn", history: [], reference: null });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(result.screenFlowPreview?.[0].length).toBeLessThanOrEqual(180);
    expect(result.recommendations?.[0]).toMatchObject({ decisionKey: "visual_style", recommendation: "Use warm neutrals" });
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]).toMatchObject({ decisionKey: "home_entry", requiresUserInput: true, whyUserMustDecide: "Changes the visible flow" });
    expect(evidenceAllowsProposal(result)).toBe(false);
  });
  it("never returns a blocking question without renderable choices", async () => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ ...ready, productReady: false, gaps: [{
      area: "product", decisionKey: "home-entry", decisionType: "screen_flow", requiresUserInput: true,
      whyUserMustDecide: "The entry changes", question: "Which screen should families see first?",
      consequence: "Changes the visible flow",
    }] }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Design a family app", turnId: "turn", history: [], reference: null });
    expect(result).toMatchObject({ productReady: true, experienceReady: true, gaps: [] });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("keeps exact recreation strict when frame assessment cannot be validated", async () => {
    const state = designerFixture();
    state.input.imagePath = "owner/reference.png";
    state.input.imageReferenceMode = "recreate";
    mocks.generate.mockResolvedValue({ text: "{}" });
    await expect(assessProductEvidence({ state, prompt: "Recreate these frames", turnId: "turn",
      history: [], reference: { data: "pixels", mimeType: "image/png" } })).rejects.toThrow(/source-frame selection/);
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
  it("drops invalid mode questions without another model call", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, gaps: [{ area: "mode", question: "Recreate supplied images?", consequence: "Which mode?" }] }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "My product", turnId: "turn", history: [], reference: null });
    expect(result.gaps).toEqual([]);
    expect(evidenceAllowsProposal(result)).toBe(true);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("keeps only an exact user delegation quote and never invents user approval", async () => {
    mocks.generate.mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Please make every product decision for me" }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ...ready, delegation: "Make low-risk assumptions" }) });
    expect((await assessProductEvidence({ state: designerFixture(), prompt: "Make low-risk assumptions", turnId: "turn", history: [], reference: null })).delegation).toBe("");
    expect((await assessProductEvidence({ state: designerFixture(), prompt: "Make low-risk assumptions", turnId: "turn", history: [], reference: null })).delegation).toBe("Make low-risk assumptions");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
  it("retries a transient provider fault instead of dropping the assessment", async () => {
    mocks.generate.mockRejectedValueOnce(Object.assign(new Error("overloaded"), { status: 503 }))
      .mockResolvedValueOnce({ text: JSON.stringify({ ...ready, screenFlowPreview: ["Today: review chores"] }) });
    const result = await assessProductEvidence({ state: designerFixture(), prompt: "Design a chore app", turnId: "turn", history: [], reference: null });
    expect(result.screenFlowPreview).toEqual(["Today: review chores"]);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
});
