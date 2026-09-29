import { proposalResponseFixture } from "./test-fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPlanning } from "./model";
import type { FunctionalItem } from "./functional-plan";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), inspect: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./inspect-reference", () => ({ inspectProductReference: mocks.inspect }));
import { createProductPlanning, readProductPlanning } from "./model";
import { runProposalPlanner, type PlanningRequest } from "./proposal-runner";
import { PlanningConflict } from "./store";

const projectId = "11111111-1111-4111-8111-111111111111";
const userMessageId = "22222222-2222-4222-8222-222222222222";
const candidate = {
  facts: [
    ["identity", "family", "Family task planner"], ["actors", "parent", "Parents"],
    ["jobs", "manage", "Manage household tasks"], ["journeys", "daily", "See and finish today's chores"],
    ["surfaces", "today", "Today's task view"],
  ].map(([section, ref, detail]) => ({ section, ref, label: ref, detail, source: "assumption", evidence: "", links: [] })),
  outputs: [{ ref: "today", name: "Today", description: "A usable household task list",
    surfaceRefs: ["today"], journeyRefs: ["daily"], decisionRefs: [], dependencyRefs: [],
    actions: [{ label: "Complete task", destinationRef: null, outcome: "Mark the task complete inline" }],
    information: "Tasks, assignees and due time", entryCondition: "Parent opens the app",
    outcome: "Parent sees and completes today's tasks", inlineStates: ["Completed task appears checked"], sequence: 0 }],
  scope: { goal: "Design the daily task flow", rationale: "The user requested daily household tasks",
    outputRefs: ["today"], surfaceRefs: ["today"] },
};
const promptExperience = {
  provenance: "prompt_synthesis", referencePath: null, referenceId: null, referenceHash: null,
  requirementsKey: "[]", compatibility: { compatible: true, conflicts: [], transfer: "Use a clear hierarchy", rationale: "Prompt direction" },
  observations: "No reference", direction: "Warm and precise", informationHierarchy: "Tasks first",
  navigation: "Today is entry", adaptations: "Match the family context",
};

function harness() {
  let state: ProductPlanning = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null,
    originalRequest: "Design a family task planner" });
  state.evidenceAssessment = { turnId: "turn", mode: "product", productReady: true, experienceReady: true,
    gaps: [], delegation: "", rationale: "The screen tasks are clear", screenFlowPreview: ["Today: see and finish chores"] };
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
  const run = (request: PlanningRequest = { kind: "new_request", text: "Design a family task planner" }) => runProposalPlanner({
    admin: admin as never, projectId, ownerId: "owner", clientTurnId: "turn", userMessageId, request,
    originalRequest: "Design a family task planner", assessment: state.evidenceAssessment!,
    history: [], conversation: [{ role: "user", content: "Design a family task planner" }],
    userEvidence: ["Design a family task planner"], getState: () => state, persist, commit,
    enqueueProjectDesign, progress: vi.fn(async () => undefined) });
  return { run, commit, persist, enqueueProjectDesign, getState: () => state, getRows: () => rows,
    setState: (next: ProductPlanning) => { state = next; } };
}
const respond = (value: unknown) => ({ text: JSON.stringify(value), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 } });

describe("single-candidate proposal turn", () => {
  beforeEach(() => {
    mocks.generate.mockReset().mockResolvedValue(respond(proposalResponseFixture(candidate)));
    mocks.inspect.mockReset().mockResolvedValue({ experience: promptExperience });
  });

  it("reaches the approval card with one proposal call and no separate review", async () => {
    const h = harness();
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.getState().scope?.status).toBe("proposed");
    expect(readProductPlanning(h.getState())?.scope?.status).toBe("proposed");
    expect(h.getRows()).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.inspect).toHaveBeenCalledTimes(1);
    expect(result.performance.map(entry => entry.stage)).toEqual(["proposal", "candidate_assembly", "reference"]);
  });

  it("proposes the plan the reported projects stopped on: no task facts and loose references", async () => {
    const h = harness();
    mocks.generate.mockResolvedValue(respond(proposalResponseFixture({
      ...candidate,
      facts: candidate.facts.filter(fact => !["jobs", "journeys", "surfaces"].includes(fact.section)),
      outputs: [{ ...candidate.outputs[0], ref: "Daily View", surfaceRefs: ["Mobile App"], journeyRefs: ["Schedule"],
        decisionRefs: ["family"], actions: [{ label: "Open month", destinationRef: "Monthly Schedule", outcome: "Show the month" },
          { label: "Toggle complete", destinationRef: "Daily View", outcome: "Strike through the task" }] }],
      scope: { ...candidate.scope, outputRefs: ["daily view"], surfaceRefs: [] },
    })));
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    const state = h.getState();
    expect(state.scope?.status).toBe("proposed");
    expect(state.scope?.manifest?.[0].actions.map(action => action.destinationKey)).toEqual([null, null]);
    expect(state.scope?.surfaceIds).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("retries a transient provider fault and still proposes", async () => {
    const h = harness();
    mocks.generate.mockRejectedValueOnce(Object.assign(new Error("model overloaded"), { status: 503 }));
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(h.getState().scope?.status).toBe("proposed");
  });

  it("reports a non-transient provider rejection truthfully without saving anything", async () => {
    const h = harness();
    mocks.generate.mockRejectedValue(Object.assign(new Error("schema too complex"), { status: 400 }));
    const result = await h.run();
    expect(result.failure).toMatchObject({ stage: "proposal", code: "PROPOSAL_UNAVAILABLE_HTTP_400", retryable: true });
    expect(JSON.stringify(result)).not.toContain("schema too complex");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(h.commit).not.toHaveBeenCalled();
    expect(h.persist).not.toHaveBeenCalled();
  });

  it("asks once more only for an unreadable response", async () => {
    const h = harness();
    mocks.generate.mockResolvedValueOnce({ text: "{\"facts\": [" })
      .mockImplementationOnce(async request => {
        expect(JSON.parse(request.contents[0].parts[0].text).note).toMatch(/incomplete/);
        return respond(proposalResponseFixture(candidate));
      });
    const result = await h.run();
    expect(result.failure).toBeUndefined();
    expect(result.performance).toContainEqual(expect.objectContaining({ stage: "proposal_unusable" }));
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("stops after two unreadable responses without saving", async () => {
    const h = harness();
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ facts: [], outputs: [], scope: {} }) });
    const result = await h.run();
    expect(result.failure).toMatchObject({ stage: "proposal", code: "PROPOSAL_UNUSABLE" });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(h.commit).not.toHaveBeenCalled();
  });

  it("does not claim approval after a stale atomic write", async () => {
    const h = harness();
    h.commit.mockRejectedValueOnce(new PlanningConflict("A newer turn won."));
    await expect(h.run()).rejects.toBeInstanceOf(PlanningConflict);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it("proposes while speculative token preparation is still enqueueing", async () => {
    const h = harness();
    let releasePreparation: (() => void) | undefined;
    h.enqueueProjectDesign.mockImplementationOnce(() => new Promise<void>(resolve => { releasePreparation = resolve; }));
    const pending = h.run();
    await vi.waitFor(() => expect(h.enqueueProjectDesign).toHaveBeenCalledTimes(1));
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

  it("keeps the saved flow on a reference outage and names the real stage", async () => {
    const h = harness();
    mocks.inspect.mockRejectedValueOnce(Object.assign(new Error("private provider response"), { status: 503 }));
    const result = await h.run();
    expect(result.failure).toMatchObject({ stage: "reference_inspection", code: "REFERENCE_INSPECTION_HTTP_503" });
    expect(JSON.stringify(result)).not.toContain("private provider response");
    expect(h.getState().scope?.status).toBe("draft");
    expect(h.getRows()).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it.each(["reference", "approval"])("reports the actual %s save failure", async phase => {
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
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("reuses a valid visual direction instead of inspecting the reference again", async () => {
    const h = harness();
    h.setState({ ...h.getState(), experience: promptExperience as ProductPlanning["experience"] });
    expect((await h.run()).failure).toBeUndefined();
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(h.getState().scope?.status).toBe("proposed");
  });

  it("tells the planner that question answers refine, not replace, the assignment", async () => {
    const h = harness();
    mocks.generate.mockImplementationOnce(async request => {
      const payload = JSON.parse(request.contents[0].parts[0].text);
      expect(payload.assignment).toBe("Design a family task planner");
      expect(payload.latestMessage).toEqual({ kind: "question_answers", text: "Calendar view?\nMonthly grid" });
      expect(payload.designAssessment.screenFlowPreview).toEqual(["Today: see and finish chores"]);
      expect(request.config.systemInstruction).toMatch(/never narrow it to the answered topic/);
      return respond(proposalResponseFixture(candidate));
    });
    expect((await h.run({ kind: "question_answers", text: "Calendar view?\nMonthly grid" })).failure).toBeUndefined();
  });

  it("revises the saved screens on a later turn without duplicating them", async () => {
    const h = harness();
    await h.run();
    const key = h.getRows()[0].item.stableKey;
    mocks.generate.mockResolvedValueOnce(respond(proposalResponseFixture({ ...candidate,
      outputs: [{ ...candidate.outputs[0], ref: "today-v2", existingKey: key, inlineStates: ["Completed task shows a timestamp"] },
        { ...candidate.outputs[0], ref: "week", name: "Week", description: "See the week ahead", actions: [] }],
      scope: { ...candidate.scope, outputRefs: [key, "week"] } })));
    expect((await h.run({ kind: "new_request", text: "Add a week view" })).failure).toBeUndefined();
    expect(h.getRows().map(row => row.item.name)).toEqual(["Today", "Week"]);
    expect(h.getState().scope?.outputKeys?.[0]).toBe(key);
    expect(h.getState().blueprint.facts.filter(fact => fact.section === "surfaces")).toHaveLength(1);
  });
});
