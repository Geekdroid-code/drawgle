import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPlanning } from "./model";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: async () => true }));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), assess: vi.fn(), review: vi.fn(), state: null as ProductPlanning | null, messages: [] as Array<Record<string, unknown>>, save: vi.fn() }));
vi.mock("./assess-evidence", () => ({ assessProductEvidence: mocks.assess }));
vi.mock("./functional-store", () => ({ readFunctionalRoadmap: async () => [], updateFunctionalRoadmap: vi.fn(), snapshotFunctionalScope: async (_a: unknown, _p: string, _o: string, state: ProductPlanning) => ({ ...state, scope: { ...state.scope!, manifest: [functionalFixture()] } }) }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./store", async (original) => ({ ...await original<typeof import("./store")>(), loadProductPlanning: async () => structuredClone(mocks.state), saveProductPlanning: mocks.save }));
vi.mock("./references", () => ({ loadPlanningReference: async () => null, storePlanningReference: async () => "owner/new.webp" }));
vi.mock("./readiness", () => ({ reviewProductReadiness: mocks.review }));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => async () => ({ ok: true, data: { screens: [] } }) }));
vi.mock("@/lib/supabase/queries", () => ({
  fetchProjectMessages: async () => mocks.messages,
  insertProjectMessage: async (_admin: unknown, input: Record<string, unknown>) => {
    const message = { ...input, id: "22222222-2222-4222-8222-222222222222" };
    mocks.messages.push(message); return message;
  },
}));
import { runProductDesigner } from "./designer";
import { createProductPlanning } from "./model";
import { productFixture, experienceFixture, functionalFixture } from "./test-fixtures";

const options = { admin: {}, projectId: "project", ownerId: "owner", prompt: "Design only onboarding.", clientTurnId: "initial:project", initialize: true };
const functionResponse = (calls: Array<{ name: string; args: unknown }>) => ({ functionCalls: calls, candidates: [{ content: { role: "model", parts: calls.map((call) => ({ functionCall: call })) } }] });
describe("product designer tool loop", () => {
  beforeEach(() => {
    mocks.generate.mockReset();
    mocks.assess.mockReset().mockResolvedValue({ turnId: "initial:project", mode: "product", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Detailed test brief" });
    mocks.review.mockReset().mockResolvedValue({ ready: true, issues: [] });
    mocks.state = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
    mocks.state.experience = experienceFixture();
    mocks.messages = [{ id: "11111111-1111-4111-8111-111111111111", role: "user", content: "Design only onboarding.", metadata: { action: "product_initial_prompt" } }];
    mocks.save.mockReset().mockImplementation(async (_admin, _project, _owner, previous, next) => {
      if (previous.revision !== mocks.state!.revision) throw new Error("Conflict");
      mocks.state = { ...next, revision: previous.revision + 1 };
      return structuredClone(mocks.state);
    });
  });
  it("persists interactive questions instead of a prose question dump", async () => {
    const gap = { area: "product", question: "How should shopping begin?", consequence: "Changes the first journey.", choices: [
      { label: "Brand introduction", description: "A short welcome before shopping." },
      { label: "Shop immediately", description: "Show products right away." },
      { label: "Useful preferences", description: "Personalize product recommendations." },
    ] };
    mocks.assess.mockResolvedValue({ turnId: "initial:project", mode: "product", productReady: false, experienceReady: true, gaps: [gap], delegation: "", rationale: "A material choice" });
    mocks.generate.mockResolvedValueOnce({ text: "Question 1: How should shopping begin? Question 2: What features?" });
    await runProductDesigner(options);
    expect(mocks.messages.at(-1)?.metadata).toMatchObject({ productQuestions: [{ question: gap.question, choices: gap.choices }] });
    expect(mocks.messages.at(-1)?.content).not.toContain("Question 1");
    expect(mocks.state?.scope).toBeNull();
  });
  it("does not turn skipped question text into user-confirmed product truth", async () => {
    const messageId = "33333333-3333-4333-8333-333333333333";
    mocks.messages.push({ id: messageId, role: "model", content: "Choose below", metadata: { productQuestions: [{
      question: "Users receive personalized recommendations", consequence: "Affects onboarding",
      choices: [{ label: "Brand", description: "Brand introduction" }, { label: "Preferences", description: "Collect useful preferences" }, { label: "Shop", description: "Shop immediately" }],
    }] } });
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [{
      id: "personalization", section: "decisions", label: "Personalization", detail: "Users receive personalized recommendations", source: "user", evidence: "Users receive personalized recommendations",
    }], supersessions: [] } }])).mockResolvedValueOnce({ text: "I'll keep that tentative." });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "skip-turn", productAnswers: { messageId, answers: [{ kind: "skip" }] } });
    expect(mocks.state?.blueprint.facts.find(fact => fact.id === "personalization")?.source).toBe("assumption");
    expect(mocks.messages.find(message => message.role === "user" && (message.metadata as Record<string, unknown>).clientTurnId === "skip-turn")?.metadata).toMatchObject({ productAnswerEvidence: [] });
  });
  it("updates product and scope in multiple tools before proposing, with one continuous conversation", async () => {
    const fixture = productFixture();
    mocks.generate
      .mockResolvedValueOnce(functionResponse([
        { name: "update_product", args: { facts: fixture.blueprint.facts, supersessions: [] } },
        { name: "set_design_scope", args: fixture.scope },
        { name: "propose_scope", args: {} },
      ]))
      .mockResolvedValueOnce({ text: "Onboarding first; shopping and orders stay in the roadmap." });
    await runProductDesigner(options);
    expect(mocks.state?.blueprint.facts).toHaveLength(fixture.blueprint.facts.length);
    expect(mocks.state?.scope?.surfaceIds).toEqual(["onboarding"]);
    expect(mocks.state?.scope?.status).toBe("proposed");
    expect(mocks.state?.phase).toBe("discovery");
    expect(mocks.state?.lease).toBeNull();
    expect(mocks.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(mocks.messages.at(-1)?.metadata).toMatchObject({ productTurnComplete: "initial:project" });
    await runProductDesigner(options);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });
  it("does not label an invented preference as user-confirmed", async () => {
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [{
      id: "fake", section: "decisions", label: "Curation", detail: "Users receive style curation", source: "user", evidence: "I want style curation",
    }], supersessions: [] } }])).mockResolvedValueOnce({ text: "Should onboarding introduce the brand or personalize shopping?" });
    await runProductDesigner(options);
    expect(mocks.state?.blueprint.facts[0]).toMatchObject({ id: "fake", source: "assumption" });
    const contents = mocks.generate.mock.calls[1][0].contents;
    expect(JSON.stringify(contents)).toContain("saved as assumptions");
  });
  it("keeps validated updates on provider failure and releases the turn for retry", async () => {
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [productFixture().blueprint.facts[0]], supersessions: [] } }]))
      .mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(runProductDesigner(options)).rejects.toThrow("Provider unavailable");
    expect(mocks.state?.blueprint.facts).toHaveLength(1);
    expect(mocks.state?.lease).toBeNull();
    expect(mocks.state?.initialTurnComplete).toBe(false);
  });
  it("rejects concurrent turns before any model or history mutation", async () => {
    mocks.state!.lease = { id: "other", expiresAt: new Date(Date.now() + 60000).toISOString() };
    await expect(runProductDesigner(options)).rejects.toThrow(/finishing/);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("continues product work after generation without resetting the canvas phase", async () => {
    mocks.state = { ...productFixture(), phase: "canvas", initialTurnComplete: true };
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "set_design_scope", args: { goal: "Add the orders flow", surfaceIds: ["orders"], rationale: "Track purchases" } }, { name: "propose_scope", args: {} }])).mockResolvedValueOnce({ text: "Ready to design Orders." });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "orders-turn", existingUserMessageId: "11111111-1111-4111-8111-111111111111" });
    expect(mocks.state?.phase).toBe("canvas");
    expect(mocks.state?.scope?.surfaceIds).toEqual(["orders"]);
    expect(mocks.state?.blueprint.facts.some((fact) => fact.id === "cart")).toBe(true);
  });
  it("does not expose an approval when readiness rejects product architecture", async () => {
    mocks.state = productFixture();
    mocks.state.experience = experienceFixture();
    mocks.review.mockResolvedValueOnce({ ready: false, issues: ["Map how the user's core job reaches completion."] });
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "propose_scope", args: {} }])).mockResolvedValueOnce({ text: "We need to map the purchase outcome before deciding the first scope." });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "review" });
    expect(mocks.state?.scope?.status).not.toBe("proposed");
    expect(mocks.messages.at(-1)?.metadata).toMatchObject({ productScopeProposal: null });
  });
  it("cannot clear evidence gaps by filling the blueprint with invented facts", async () => {
    mocks.assess.mockResolvedValue({ turnId: "initial:project", mode: "product", productReady: false, experienceReady: true, gaps: [{ area: "product", question: "What does onboarding do?", consequence: "Changes the shopping journey" }], delegation: "", rationale: "The user gave only a category and aesthetic." });
    const fixture = productFixture();
    mocks.generate.mockResolvedValueOnce(functionResponse([
      { name: "update_product", args: { facts: fixture.blueprint.facts, supersessions: [] } },
      { name: "set_design_scope", args: fixture.scope },
      { name: "propose_scope", args: {} },
    ])).mockResolvedValueOnce({ text: "Should onboarding introduce the brand or collect information used while shopping?" });
    await runProductDesigner(options);
    expect(mocks.state?.scope).toBeNull();
    expect(mocks.review).not.toHaveBeenCalled();
    const declarations = mocks.generate.mock.calls[0][0].config.tools[0].functionDeclarations;
    expect(declarations.some((tool: { name: string }) => tool.name === "propose_scope")).toBe(false);
    expect(mocks.state?.evidenceAssessment?.gaps).toHaveLength(1);
    expect(mocks.messages.at(-1)?.content).toContain("isn’t ready for approval");
  });
});
