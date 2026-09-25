import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPlanning } from "./model";
vi.mock("server-only", () => ({}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn().mockResolvedValue({ id: "prepared" }) } }));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: async () => true }));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), assess: vi.fn(), review: vi.fn(), loadReference: vi.fn(), snapshot: vi.fn(), state: null as ProductPlanning | null, messages: [] as Array<Record<string, unknown>>, save: vi.fn() }));
vi.mock("./assess-evidence", () => ({ assessProductEvidence: mocks.assess }));
vi.mock("./functional-store", () => ({ readFunctionalRoadmap: async () => [], updateFunctionalRoadmap: vi.fn(), snapshotFunctionalScope: mocks.snapshot,
  saveProductPatchWithRoadmap: (...args: unknown[]) => mocks.save(...args) }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./store", async (original) => ({ ...await original<typeof import("./store")>(), loadProductPlanning: async () => structuredClone(mocks.state), saveProductPlanning: mocks.save }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.loadReference, storePlanningReference: async () => "owner/new.webp" }));
vi.mock("./readiness", () => ({ reviewProductReadiness: mocks.review }));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => async () => ({ ok: true, data: { screens: [] } }) }));
vi.mock("@/lib/supabase/queries", () => ({
  fetchProjectMessages: async () => mocks.messages,
  insertProjectMessage: async (_admin: unknown, input: Record<string, unknown>) => {
    const message = { ...input, id: (input.id as string) ?? crypto.randomUUID() };
    mocks.messages.push(message); return message;
  },
  updateProjectMessage: async (_admin: unknown, input: Record<string, unknown>) => {
    const message = mocks.messages.find(m => m.id === input.messageId);
    if (message) {
      if (input.content !== undefined) message.content = input.content;
      if (input.metadata !== undefined) message.metadata = input.metadata;
    }
    return message;
  },
}));
import { runProductDesigner } from "./designer";
import { activeFacts, applyProductPatch, createProductPlanning } from "./model";
import { productFixture, experienceFixture, functionalFixture } from "./test-fixtures";
import { ProductToolError } from "./tool-failure";

const options = { admin: {}, projectId: "project", ownerId: "owner", prompt: "Design only onboarding.", clientTurnId: "initial:project", initialize: true };
const functionResponse = (calls: Array<{ name: string; args: unknown }>) => ({ functionCalls: calls, candidates: [{ content: { role: "model", parts: calls.map((call) => ({ functionCall: call })) } }] });
describe("product designer tool loop", () => {
  beforeEach(() => {
    vi.stubEnv("DRAWGLE_PLANNING_REPAIR_ENABLED", "true");
    mocks.generate.mockReset().mockResolvedValue({ text: "Continue from saved decisions." });
    mocks.snapshot.mockReset().mockImplementation(async (_a, _p, _o, state: ProductPlanning) => ({ ...state, scope: { ...state.scope!, manifest: [functionalFixture()] } }));
    mocks.loadReference.mockReset().mockResolvedValue(null);
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
  afterEach(() => vi.unstubAllEnvs());
  it("shows a prompt-grounded draft before the slower detailed planning rounds", async () => {
    mocks.assess.mockResolvedValue({ turnId: "initial:project", mode: "product", productReady: true,
      experienceReady: true, gaps: [], recommendations: [], delegation: "", rationale: "Screens are clear",
      screenFlowPreview: ["Today shows today's tasks", "Calendar opens the selected day"] });
    mocks.generate.mockImplementationOnce(async () => {
      expect(mocks.messages.some(message => (message.metadata as Record<string, unknown>)?.action === "product_flow_preview")).toBe(true);
      return { text: "Detailed planning complete." };
    });
    await runProductDesigner(options);
    const preview = mocks.messages.find(message => (message.metadata as Record<string, unknown>)?.action === "product_flow_preview");
    expect(preview?.content).toContain("- Today shows today's tasks\n- Calendar opens the selected day");
    expect(preview?.metadata).not.toHaveProperty("productTurnComplete");
  });
  it("repairs a rejected scope internally before persisting or claiming approval", async () => {
    mocks.state = { ...productFixture(), experience: experienceFixture() };
    mocks.state.input.imagePath = experienceFixture().referencePath;
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    mocks.snapshot.mockRejectedValueOnce(new ProductToolError("A state is missing", "SCOPE_OUTPUTS_MISSING", { missingKeys: ["state:welcome:complete"] }));
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "set_design_scope", args: {
      goal: "Invalid scope", rationale: "Will be rejected", surfaceIds: ["onboarding"], outputKeys: ["state:welcome:complete"],
    } }])).mockResolvedValueOnce({ text: "I could not complete the scope." })
      .mockResolvedValueOnce(functionResponse([{ name: "set_design_scope", args: {
        goal: "Valid scope", rationale: "The saved scope", surfaceIds: ["onboarding"], outputKeys: ["screen:onboarding"],
      } }, { name: "propose_scope", args: {} }])).mockResolvedValueOnce({ text: "Review the repaired scope." });
    await runProductDesigner({ ...options, initialize: false });
    expect(mocks.save.mock.calls.some(call => call[4].scope?.goal === "Invalid scope")).toBe(false);
    expect(mocks.state?.scope?.status).toBe("proposed");
    expect(mocks.messages.at(-1)?.metadata).not.toHaveProperty("productPlanningFailure");
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(mocks.generate.mock.calls[2][0].contents)).toContain("state:welcome:complete");
  });
  it("resumes a failed flow review from its saved issues without repeating evidence assessment", async () => {
    mocks.state = { ...productFixture(), experience: experienceFixture() };
    mocks.state.input.imagePath = experienceFixture().referencePath;
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    mocks.review.mockResolvedValueOnce({ ready: false, issues: ["The child tablet screen has no entry action."] })
      .mockResolvedValueOnce({ ready: true, issues: [] });
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "propose_scope", args: {} }]))
      .mockResolvedValueOnce({ text: "The entry needs repair." });
    await runProductDesigner({ ...options, initialize: false });
    expect(mocks.state?.scope?.reviewIssues).toContain("The child tablet screen has no entry action.");
    expect(mocks.state?.scope?.reviewedContentRevision).toBe(mocks.state?.contentRevision);
    const assessments = mocks.assess.mock.calls.length;
    mocks.generate.mockReset().mockResolvedValueOnce(functionResponse([{ name: "propose_scope", args: {} }]));
    await runProductDesigner({ ...options, initialize: false, resumeReview: true, clientTurnId: "resume-flow",
      prompt: "Continue screen design" });
    expect(mocks.assess.mock.calls.length).toBe(assessments);
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].contents)).toContain("child tablet screen has no entry action");
    expect(mocks.state?.scope?.status).toBe("proposed");
  });
  it("bounds unsuccessful repair and saves a controlled diagnostic with a recovery action", async () => {
    mocks.state = { ...productFixture(), experience: experienceFixture() };
    mocks.state.input.imagePath = experienceFixture().referencePath;
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    mocks.snapshot.mockRejectedValue({ code: "23514", message: "internal database detail" });
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "set_design_scope", args: {
      goal: "Rejected", rationale: "Invalid", surfaceIds: ["onboarding"], outputKeys: ["state:unknown:complete"],
    } }]));
    await runProductDesigner({ ...options, initialize: false });
    expect(mocks.generate).toHaveBeenCalledTimes(4);
    const metadata = mocks.messages.at(-1)?.metadata;
    expect(metadata).toMatchObject({ productScopeProposal: null, productPlanningFailure: {
      stage: "set_design_scope", code: "23514", retryable: true,
    } });
    expect(JSON.stringify(metadata)).not.toContain("internal database detail");
    expect(mocks.state?.lease).toBeNull();
    expect(mocks.state?.phase).toBe("discovery");
  });
  it("keeps the original request when recent history no longer contains the first prompt", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "Continuing." });
    await runProductDesigner({ ...options, initialize: false, originalPrompt: "Build a complete collaboration app" });
    expect(mocks.assess.mock.calls[0][0].history).toContainEqual({ role: "user", content: "Build a complete collaboration app" });
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].contents)).toContain("Build a complete collaboration app");
  });
  it("repairs answered blocking questions from a failed earlier turn before continuing", async () => {
    const questionMessageId = "33333333-3333-4333-8333-333333333333";
    const answerMessageId = "44444444-4444-4444-8444-444444444444";
    mocks.state = applyProductPatch(mocks.state!, { operations: [{ op: "put_fact", fact: {
      id: "q_portrait_assembly_logic", section: "questions", label: "Portrait assembly", detail: "Choose a method.",
      source: "assumption", evidence: "", blocking: true,
    } }] }, questionMessageId);
    mocks.messages.push({ id: questionMessageId, role: "model", content: "Choose below", metadata: { productQuestions: [{
      decisionKey: "portrait_assembly_logic", question: "How should portraits be assembled?", consequence: "Changes the workflow.",
      choices: [{ label: "AI composite", description: "Combine headshots." }, { label: "Collage", description: "Use a template." }, { label: "Canvas", description: "Place photos." }],
    }] } });
    mocks.messages.push({ id: answerMessageId, role: "user", content: "AI composite", metadata: { productAnswers: {
      messageId: questionMessageId, answers: [{ kind: "choice", index: 0 }],
    } } });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "resume" });
    expect(activeFacts(mocks.state!, "questions")).toEqual([]);
    expect(activeFacts(mocks.state!, "decisions")[0]).toMatchObject({ source: "user", detail: "AI composite: Combine headshots." });
  });
  it("can propose after replaying a previously answered blocking question", async () => {
    const questionMessageId = "33333333-3333-4333-8333-333333333333";
    mocks.state = { ...productFixture(), experience: experienceFixture() };
    mocks.state.input.imagePath = experienceFixture().referencePath;
    mocks.state = applyProductPatch(mocks.state, { operations: [{ op: "put_fact", fact: {
      id: "q_portrait_assembly_logic", section: "questions", label: "Portrait assembly", detail: "Choose a method.",
      source: "assumption", evidence: "", blocking: true,
    } }] }, questionMessageId);
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    mocks.messages.push({ id: questionMessageId, role: "model", content: "Choose below", metadata: { productQuestions: [{
      decisionKey: "portrait_assembly_logic", question: "How should portraits be assembled?", consequence: "Changes the workflow.",
      choices: [{ label: "AI composite", description: "Combine headshots." }, { label: "Collage", description: "Use a template." }, { label: "Canvas", description: "Place photos." }],
    }] } });
    mocks.messages.push({ id: "44444444-4444-4444-8444-444444444444", role: "user", content: "AI composite", metadata: { productAnswers: {
      messageId: questionMessageId, answers: [{ kind: "choice", index: 0 }],
    } } });
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "propose_scope", args: {} }]))
      .mockResolvedValueOnce({ text: "Review the scope." });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "resume" });
    expect(mocks.state?.scope?.status).toBe("proposed");
    expect(mocks.messages.at(-1)?.metadata).not.toHaveProperty("productPlanningFailure");
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
  it("returns a validated screen-flow question without waiting for the detailed planner", async () => {
    mocks.assess.mockResolvedValue({ turnId: "initial:project", mode: "product", productReady: false,
      experienceReady: false, delegation: "", recommendations: [], rationale: "A visible flow choice",
      gaps: [{ area: "product", decisionKey: "today-entry", decisionType: "screen_flow", requiresUserInput: true,
        whyUserMustDecide: "This changes where the Today action leads.", question: "Which screen opens when a parent taps a task on Today?",
        consequence: "Changes the task-detail flow.", choices: [
          { label: "Task detail", description: "Open a task detail screen." },
          { label: "Inline expansion", description: "Expand the task within Today." },
          { label: "Calendar day", description: "Open the relevant calendar day." },
        ] }],
    });
    await runProductDesigner(options);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.messages.at(-1)?.metadata).toMatchObject({ productQuestions: [{ decisionKey: "today-entry" }] });
    expect(mocks.state?.initialTurnComplete).toBe(true);
    expect(mocks.state?.lease).toBeNull();
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
  it("repairs a persisted no-image recreation default before assessment and keeps normal turns from changing mode", async () => {
    mocks.state!.input.imageReferenceMode = "recreate";
    delete mocks.state!.input.referenceSource;
    mocks.generate.mockResolvedValueOnce({ text: "Let's understand the product." });
    await runProductDesigner({ ...options, imageReferenceMode: "recreate" });
    expect(mocks.assess.mock.calls[0][0].state.input).toMatchObject({ imageReferenceMode: "style", referenceSource: "none", imagePath: null });
    expect(mocks.state!.input.imageReferenceMode).toBe("style");
  });
  it.each(["style", "recreate"] as const)("keeps a saved upload's %s mode on a text-only follow-up", async mode => {
    mocks.state!.input = { imagePath: "owner/prompt-images/reference.webp", imageReferenceMode: mode, stylePresetSlug: null };
    mocks.loadReference.mockResolvedValue({ data: "real-pixels", mimeType: "image/webp" });
    mocks.generate.mockResolvedValueOnce({ text: "Continuing with your product." });
    await runProductDesigner({ ...options, initialize: false, clientTurnId: "follow-up", imageReferenceMode: mode === "style" ? "recreate" : "style" });
    expect(mocks.state!.input).toMatchObject({ imageReferenceMode: mode, referenceSource: "user" });
    expect(mocks.assess.mock.calls[0][0].reference.data).toBe("real-pixels");
  });
  it("keeps canvas uploads outside project input, experience and blueprint", async () => {
    mocks.state = { ...productFixture(), phase: "canvas", experience: experienceFixture() };
    mocks.state.input.imagePath = "owner/project.webp";
    const input = { ...mocks.state.input };
    const blueprint = structuredClone(mocks.state.blueprint);
    mocks.loadReference.mockImplementation(async (_admin, path) => ({ data: path === "owner/project.webp" ? "project-pixels" : "chat-pixels", mimeType: "image/webp" }));
    await runProductDesigner({ ...options, initialize: false, image: { data: "chat-pixels", mimeType: "image/png" }, imageReferenceMode: "recreate" });
    expect(mocks.state!.input.imagePath).toBe(input.imagePath);
    expect(mocks.state!.input.imageReferenceMode).toBe(input.imageReferenceMode);
    expect(mocks.state!.experience).toEqual(experienceFixture());
    expect(mocks.state!.blueprint).toEqual(blueprint);
    expect(mocks.state!.screenReference).toMatchObject({ imagePath: "owner/new.webp" });
    expect(mocks.assess.mock.calls[0][0].reference.data).toBe("project-pixels");
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].contents)).toContain("chat-pixels");
    expect(JSON.stringify(mocks.generate.mock.calls[0][0].contents)).toContain("ATTACHMENT AUTHORITY");
  });
  it("uses the selected image control mode for a new upload", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "I'll use your reference." });
    await runProductDesigner({ ...options, initialize: false, image: { data: "new-pixels", mimeType: "image/png" }, imageReferenceMode: "recreate" });
    expect(mocks.state!.input).toMatchObject({ imageReferenceMode: "recreate", referenceSource: "user" });
    expect(mocks.assess.mock.calls[0][0].reference.data).toBe("new-pixels");
  });
  it("does not silently reinterpret a missing saved upload as a prompt-only project", async () => {
    mocks.state!.input.imagePath = "owner/prompt-images/missing.webp";
    mocks.state!.input.imageReferenceMode = "recreate";
    await expect(runProductDesigner(options)).rejects.toThrow(/saved reference/);
    expect(mocks.assess).not.toHaveBeenCalled();
    expect(mocks.state!.input.imageReferenceMode).toBe("recreate");
    expect(mocks.state!.lease).toBeNull();
  });
  it("cannot switch project mode from assessment output", async () => {
    mocks.assess.mockResolvedValueOnce({ turnId: "turn", mode: "recreate", modeChangeEvidence: "Design only onboarding.", productReady: true, experienceReady: true, gaps: [], delegation: "", rationale: "Model mistake" });
    mocks.generate.mockResolvedValueOnce({ text: "Product context retained." });
    await runProductDesigner(options);
    expect(mocks.state!.input.imageReferenceMode).toBe("style");
  });
  it("updates product and scope in multiple tools before proposing, with one continuous conversation", async () => {
    mocks.state!.input.imagePath = experienceFixture().referencePath;
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
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
    expect(mocks.generate).toHaveBeenCalledTimes(1);
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
  it("keeps a first-prompt design brief when bookkeeping and the evidence review are malformed", async () => {
    const prompt = "Design an organizer where parents add kids, activities, chores and reminders, then see today's work and a calendar.";
    mocks.messages[0].content = prompt;
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [{
      id: "Today screen", section: "surfaces", label: "Today", detail: "A Today view for chores and reminders",
      source: "user", evidence: prompt, provenance: { basis: "direct", recommendationMessageId: "" },
    }], supersessions: [] } }]))
      .mockResolvedValueOnce({ text: "{}" }) // The separate evidence reviewer returned an incomplete verdict.
      .mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [], supersessions: [] } }]))
      .mockResolvedValueOnce({ text: "I can design the Today and calendar flow." });
    await runProductDesigner({ ...options, prompt });
    expect(mocks.state?.blueprint.facts).toMatchObject([{ id: "today-screen", section: "surfaces", source: "assumption" }]);
    expect(mocks.messages.at(-1)?.metadata).not.toHaveProperty("productPlanningFailure");
    expect(mocks.messages.at(-1)?.content).toContain("Today and calendar");
  });
  it("does not silently reclassify user requirements when the evidence provider is unavailable", async () => {
    const prompt = "Design a Today screen for kids' chores.";
    mocks.messages[0].content = prompt;
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "update_product", args: { facts: [{
      id: "today", section: "surfaces", label: "Today", detail: "A Today screen for kids' chores",
      source: "user", evidence: prompt,
    }], supersessions: [] } }])).mockRejectedValueOnce(new Error("Evidence provider unavailable"));
    await runProductDesigner({ ...options, prompt });
    expect(mocks.state?.blueprint.facts).toHaveLength(0);
    expect(mocks.state?.lease).toBeNull();
    expect(mocks.messages.at(-1)?.metadata).toHaveProperty("productPlanningFailure");
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
    mocks.state = { ...productFixture(), experience: experienceFixture(), phase: "canvas", initialTurnComplete: true };
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
    expect(mocks.messages.at(-1)?.content).toContain("generation has not started");
  });
  it("records explicit no-reference intent through the actual native tool loop", async () => {
    const prompt = "Do not use any visual references; use my own design specification.";
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "set_reference_preference", args: { mode: "none", evidence: prompt } }]))
      .mockResolvedValueOnce({ text: '{"supported":true}' }).mockResolvedValueOnce({ text: "I'll use your design direction." });
    await runProductDesigner({ ...options, initialize: false, prompt });
    expect(mocks.state!.input.referencePreference).toMatchObject({ mode: "none", evidence: prompt });
    expect(mocks.state!.experience).toBeNull();
    expect(mocks.state!.input.imagePath).toBeNull();
    expect(mocks.state!.scope?.status).not.toBe("approved");
  });
  it("does not treat prompt-only input or delegation as a reference opt-out", async () => {
    const prompt = "Prompt only, use your best judgment.";
    mocks.generate.mockResolvedValueOnce(functionResponse([{ name: "set_reference_preference", args: { mode: "none", evidence: prompt } }]))
      .mockResolvedValueOnce({ text: '{"supported":false}' });
    await runProductDesigner({ ...options, initialize: false, prompt });
    expect(mocks.state!.input.referencePreference).toBeUndefined();
  });
  it("resolves a recovery card's explicit choice without inventing user intent", async () => {
    const { referenceRecoveryQuestions } = await import("./reference-preference");
    const messageId = "33333333-3333-4333-8333-333333333333";
    mocks.messages.push({ id: messageId, role: "model", content: "Choose evidence", metadata: { referenceRecovery: true, productQuestions: referenceRecoveryQuestions } });
    await runProductDesigner({ ...options, initialize: false, productAnswers: { messageId, answers: [{ kind: "choice", index: 2 }] } });
    expect(mocks.state!.input.referencePreference?.mode).toBe("none");
    expect(mocks.state!.scope?.status).not.toBe("approved");
  });
  it("skipping reference recovery never opts out", async () => {
    const { referenceRecoveryQuestions } = await import("./reference-preference");
    const messageId = "33333333-3333-4333-8333-333333333333";
    mocks.messages.push({ id: messageId, role: "model", content: "Choose evidence", metadata: { referenceRecovery: true, productQuestions: referenceRecoveryQuestions } });
    await runProductDesigner({ ...options, initialize: false, productAnswers: { messageId, answers: [{ kind: "skip" }] } });
    expect(mocks.state!.input.referencePreference).toBeUndefined();
  });
  it("new explicit uploads clear earlier no-reference choices and retain the chosen mode", async () => {
    mocks.state!.input.referencePreference = { mode: "none", evidence: "No references", messageId: "11111111-1111-4111-8111-111111111111" };
    await runProductDesigner({ ...options, initialize: false, image: { data: "new", mimeType: "image/png" }, imageReferenceMode: "recreate" });
    expect(mocks.state!.input.referencePreference).toBeUndefined();
    expect(mocks.state!.input.imageReferenceMode).toBe("recreate");
  });
  it("recreation uses the reconstruction-only runtime", async () => {
    const { reconstructionInstructions } = await import("./reconstruction");
    mocks.state!.input.imagePath = "owner/prompt-images/source.webp";
    mocks.state!.input.imageReferenceMode = "recreate";
    mocks.loadReference.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    await runProductDesigner({ ...options, initialize: false, prompt: "Recreate both visible frames exactly." });
    expect(mocks.generate.mock.calls[0][0].config.systemInstruction).toBe(reconstructionInstructions);
  });
  it("a new source preserves its actual recreation request downstream", async () => {
    const { scopedGenerationPrompt } = await import("./generation-context");
    mocks.state = productFixture();
    mocks.state.input.originalRequest = "Build a shopping app.";
    mocks.state.input.imageReferenceMode = "style";
    const request = "Recreate this timer screenshot exactly, changing only its title to Focus.";
    await runProductDesigner({ ...options, initialize: false, prompt: request, image: { data: "new-source", mimeType: "image/png" }, imageReferenceMode: "recreate" });
    expect(scopedGenerationPrompt(mocks.state!)).toContain(request);
  });
});
