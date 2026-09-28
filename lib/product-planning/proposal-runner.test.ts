import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPlanning } from "./model";
import type { FunctionalItem } from "./functional-plan";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), review: vi.fn(), inspect: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./readiness", () => ({ reviewProductReadiness: mocks.review }));
vi.mock("./inspect-reference", () => ({ inspectProductReference: mocks.inspect }));
import { createProductPlanning, readProductPlanning } from "./model";
import { runProposalPlanner } from "./proposal-runner";
import { PlanningConflict } from "./store";

const projectId = "11111111-1111-4111-8111-111111111111";
const userMessageId = "22222222-2222-4222-8222-222222222222";
const candidate = {
  facts: [
    ["identity", "family", "Family task planner"], ["actors", "parent", "Parents"],
    ["jobs", "manage", "Manage household tasks"], ["journeys", "daily", "See and finish today's chores"],
    ["surfaces", "today", "Today's task view"],
  ].map(([section, ref, detail]) => ({ section, ref, label: ref, detail, source: "assumption", evidence: "", links: [], blocking: false })),
  removeFactIds: [], removeOutputKeys: [],
  outputs: [{ ref: "today", name: "Today", description: "A usable household task list",
    surfaceRefs: ["today"], journeyRefs: ["daily"], decisionRefs: [], dependencyRefs: [],
    actions: [{ label: "Complete task", destinationRef: null, outcome: "Mark the task complete inline" }],
    information: "Tasks, assignees and due time", entryCondition: "Parent opens the app",
    outcome: "Parent sees and completes today's tasks", inlineStates: ["Completed task appears checked"], sequence: 0 }],
  scope: { goal: "Design the daily task flow", rationale: "The user requested daily household tasks",
    outputRefs: ["today"], surfaceRefs: ["today"] },
};

function harness() {
  let state: ProductPlanning = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null,
    originalRequest: "Design a family task planner" });
  state.evidenceAssessment = { turnId: "turn", mode: "product", productReady: true, experienceReady: true,
    gaps: [], delegation: "", rationale: "The screen tasks are clear" };
  let rows: Array<{ item: FunctionalItem; status: string; screenId: string | null }> = [];
  const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ neq: () => Promise.resolve({
    data: rows.map(row => ({ metadata: { functional: row.item }, status: row.status,
      generated_screen_id: row.screenId })), error: null,
  }) }) }) }) }) };
  const persist = vi.fn(async (next: ProductPlanning) => { state = { ...next, revision: state.revision + 1 }; return state; });
  const commit = vi.fn(async (next: ProductPlanning, items: FunctionalItem[], removeKeys: string[]) => {
    rows = rows.filter(row => !removeKeys.includes(row.item.stableKey));
    for (const item of items) {
      const index = rows.findIndex(row => row.item.stableKey === item.stableKey);
      if (index < 0) rows.push({ item, status: "planned", screenId: null });
      else rows[index] = { ...rows[index], item };
    }
    state = { ...next, revision: state.revision + 1 };
    return state;
  });
  const enqueueProjectDesign = vi.fn(async (): Promise<void> => undefined);
  const run = (resumeSavedReview = false) => runProposalPlanner({ admin: admin as never, projectId, ownerId: "owner",
    clientTurnId: "turn", userMessageId, prompt: "Design a family task planner",
    originalRequest: "Design a family task planner", assessment: state.evidenceAssessment!,
    history: [], conversation: [{ role: "user", content: "Design a family task planner" }],
    resumeSavedReview, getState: () => state, persist, commit,
    enqueueProjectDesign, progress: vi.fn(async () => undefined) });
  return { run, commit, persist, enqueueProjectDesign, getState: () => state, getRows: () => rows };
}

describe("single-candidate proposal turn", () => {
  beforeEach(() => {
    mocks.generate.mockReset().mockResolvedValue({ text: JSON.stringify(candidate), usageMetadata: {
      promptTokenCount: 100, candidatesTokenCount: 200 } });
    mocks.review.mockReset().mockResolvedValue({ ready: true, issues: [] });
    mocks.inspect.mockReset().mockResolvedValue({ experience: {
      provenance: "prompt_synthesis", referencePath: null, referenceId: null, referenceHash: null,
      requirementsKey: "[]", compatibility: { compatible: true, conflicts: [], transfer: "Use a clear hierarchy", rationale: "Prompt direction" },
      observations: "No reference", direction: "Warm and precise", informationHierarchy: "Tasks first",
      navigation: "Today is entry", adaptations: "Match the family context",
    } });
  });

  it("commits one atomic candidate before showing approval", async () => {
    const h = harness();
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.getState().scope?.status).toBe("proposed");
    expect(readProductPlanning(h.getState())?.scope?.status).toBe("proposed");
    expect(h.getRows()).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.review).toHaveBeenCalledTimes(1);
  });

  it("does not claim approval after a stale atomic write", async () => {
    const h = harness();
    h.commit.mockRejectedValueOnce(new PlanningConflict("A newer turn won."));
    await expect(h.run()).rejects.toBeInstanceOf(PlanningConflict);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("reviews the saved flow while speculative token preparation is still enqueueing", async () => {
    const h = harness();
    let releasePreparation: (() => void) | undefined;
    h.enqueueProjectDesign.mockImplementationOnce(() => new Promise<void>(resolve => {
      releasePreparation = resolve;
    }));
    const pending = h.run();
    await vi.waitFor(() => expect(mocks.review).toHaveBeenCalledTimes(1));
    expect(h.getState().scope?.status).toBe("draft");
    releasePreparation?.();
    expect((await pending).failure).toBeUndefined();
    expect(h.getState().scope?.status).toBe("proposed");
  });

  it("keeps approval available if speculative token enqueue fails", async () => {
    const h = harness();
    h.enqueueProjectDesign.mockRejectedValueOnce(new Error("Background task unavailable"));
    expect((await h.run()).failure).toBeUndefined();
    expect(h.getState().scope?.status).toBe("proposed");
  });

  it("does not label a reference outage as a gap in the screen graph", async () => {
    const h = harness();
    mocks.inspect.mockRejectedValueOnce(Object.assign(new Error("private provider response"), { status: 503 }));
    const result = await h.run();
    expect(result.failure).toMatchObject({ stage: "reference_inspection", code: "REFERENCE_INSPECTION_HTTP_503" });
    expect(JSON.stringify(result)).not.toContain("private provider response");
    expect(h.getState().scope?.status).toBe("draft");
    expect(h.getState().scope?.reviewIssues).toBeUndefined();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("does not regenerate a valid proposal when the reviewer returns malformed JSON", async () => {
    const h = harness();
    mocks.review.mockRejectedValueOnce(new SyntaxError("private malformed response"));
    const result = await h.run();
    expect(result.failure).toMatchObject({ stage: "flow_review", code: "FLOW_REVIEW_RESPONSE_JSON" });
    expect(h.getState().scope?.reviewIssues).toBeUndefined();
    expect(h.getRows()).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.review).toHaveBeenCalledOnce();
  });

  it.each(["reference", "approval"])("reports the actual %s save failure without pretending review rejected it", async phase => {
    const h = harness();
    const save = h.persist.getMockImplementation()!;
    h.persist.mockImplementation(async next => {
      if ((phase === "reference" && next.experience) || (phase === "approval" && next.scope?.status === "proposed")) {
        throw { code: "XX000", message: "private database detail" };
      }
      return save(next);
    });
    const result = await h.run();
    expect(result.failure?.code).toBe(phase === "reference" ? "REFERENCE_SAVE_XX000" : "SCOPE_SAVE_XX000");
    expect(JSON.stringify(result)).not.toContain("private database detail");
    expect(h.getState().scope?.status).toBe("draft");
    expect(h.getState().scope?.reviewIssues).toBeUndefined();
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(h.persist).toHaveBeenCalledTimes(phase === "reference" ? 1 : 2);
  });

  it("rechecks a saved review failure before rewriting an already valid flow", async () => {
    const h = harness();
    expect((await h.run()).failure).toBeUndefined();
    const saved = h.getState();
    await h.persist({ ...saved, scope: { ...saved.scope!, status: "draft",
      reviewIssues: ["The reviewer omitted the saved entry screen."],
      reviewedContentRevision: saved.contentRevision ?? 0 } });
    mocks.generate.mockClear();
    mocks.review.mockClear();

    expect((await h.run(true)).failure).toBeUndefined();
    expect(h.getState().scope?.status).toBe("proposed");
    expect(h.getState().scope?.reviewIssues).toBeUndefined();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.review).toHaveBeenCalledTimes(1);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it("records only a sanitized phase when a candidate needs structural repair", async () => {
    const h = harness();
    mocks.generate.mockResolvedValueOnce({ text: "{" })
      .mockResolvedValueOnce({ text: JSON.stringify(candidate) });
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(result.performance).toContainEqual(expect.objectContaining({
      stage: "proposal_structure_rejection", errorCode: "JSON_PARSE",
    }));
    expect(result.performance.find(entry => entry.stage === "proposal_structure_rejection"))
      .not.toHaveProperty("issues");
    expect(mocks.review).toHaveBeenCalledTimes(1);
  });

  it("repairs the cited coverage issue without re-running discovery", async () => {
    const h = harness();
    mocks.review.mockResolvedValueOnce({ ready: false, issues: ["The completion state is unclear."] })
      .mockResolvedValueOnce({ ready: true, issues: [] });
    mocks.generate.mockImplementationOnce(async () => ({ text: JSON.stringify(candidate) }))
      .mockImplementationOnce(async (request) => {
        const current = JSON.parse(request.contents[0].parts[0].text);
        expect(current.repair.issues).toContain("The completion state is unclear.");
        const key = h.getRows()[0].item.stableKey;
        expect(current.savedJourneyGraph.selectedKeys).toEqual([key]);
        expect(current.savedJourneyGraph.journeys).toEqual([
          expect.objectContaining({ outputKeys: [key], independentEntryCandidates: [key] }),
        ]);
        return { text: JSON.stringify({ ...candidate,
          facts: candidate.facts.map(fact => fact.ref === "today"
            ? { ...fact, detail: "A renamed description of the same task view" } : fact),
          outputs: [{ ...candidate.outputs[0], existingKey: key,
          inlineStates: ["Completed task appears checked with a timestamp"] }],
          scope: { ...candidate.scope, outputRefs: [key] } }) };
      });
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(h.getState().scope?.status).toBe("proposed");
    expect(h.getRows()).toHaveLength(1);
    expect(h.getState().blueprint.facts.filter(fact => fact.section === "surfaces")).toHaveLength(1);
    expect(h.getState().blueprint.facts.find(fact => fact.section === "surfaces")?.detail)
      .toBe("Today's task view");
    expect(mocks.review).toHaveBeenCalledTimes(2);
    expect(mocks.inspect).toHaveBeenCalledTimes(1);
  });
});
