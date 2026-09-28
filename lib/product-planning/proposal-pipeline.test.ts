import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), shortlist: vi.fn(), trigger: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock("@/lib/generation/curated-style-references", () => ({
  shortlistCuratedStyleReferences: mocks.shortlist, loadCuratedStyleReferenceImage: vi.fn(),
}));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => vi.fn() }));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: vi.fn() }));
import { runProductDesigner } from "./designer";
import { createProductPlanning, readProductPlanning } from "./model";
import { experienceFixture } from "./test-fixtures";
import { productDesignerMemoryStore } from "@/scripts/lib/product-designer-memory-store";

const brief = "Design a task app where I see today's tasks and mark them complete inline.";
const candidate = {
  facts: [
    ["identity", "tasks", "Task manager"], ["actors", "person", "Person managing tasks"],
    ["jobs", "complete", "Complete daily tasks"], ["journeys", "daily", "See and complete today's tasks"],
    ["surfaces", "today", "Today's tasks"],
  ].map(([section, ref, detail]) => ({ section, ref, label: ref, detail, source: "assumption" })),
  outputs: [{ ref: "today", name: "Today", description: "Review and finish today's tasks",
    surfaceRefs: ["today"], journeyRefs: ["daily"],
    actions: [{ label: "Complete", destinationRef: null, outcome: "Mark the task complete inline" }],
    information: "Tasks and due times", entryCondition: "Person opens the app",
    outcome: "The task is complete", inlineStates: ["Checked completed task"] }],
  scope: { goal: "Design daily tasks", rationale: "The user requested daily tasks",
    outputRefs: ["today"], surfaceRefs: ["today"] },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DRAWGLE_DESIGN_FLOW_PLANNER", "proposal");
  vi.stubEnv("DRAWGLE_EARLY_PROJECT_DESIGN_MODE", "off");
  vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", "false");
  mocks.shortlist.mockResolvedValue([]);
  mocks.generate.mockImplementation(async ({ config, contents }) => {
    const fields = config.responseSchema.properties;
    if (fields.productReady) return { text: JSON.stringify({ productReady: true, experienceReady: true,
      gaps: [], recommendations: [], screenFlowPreview: [], delegation: "", rationale: "The task is clear" }) };
    if (fields.outputs) return { text: JSON.stringify(candidate) };
    if (fields.requestedScope) {
      const input = JSON.parse(contents[0].parts[0].text);
      const id = (section: string) => input.blueprint.find((fact: { section: string }) => fact.section === section).id;
      const key = input.wholeProductRoadmap[0].stableKey;
      return { text: JSON.stringify({ ready: true, issues: [], requestedScope: "whole_product", scopeMessageIndex: 0,
        journeys: [{ journeyId: id("journeys"), actorId: id("actors"), jobId: id("jobs"),
          entryKey: key, completionKeys: [key], outcome: "Person completes the task inline" }] }) };
    }
    throw new Error("Unexpected model dependency");
  });
});
afterEach(() => vi.unstubAllEnvs());

it.each([false, true])("reaches a persisted approval through real planning modules when a speculative curated source is missing: %s", async missingSavedImage => {
  const initial = createProductPlanning({ originalRequest: brief, imagePath: missingSavedImage ? "owner/prompt-images/missing.webp" : null,
    referenceSource: missingSavedImage ? "curated" : "none", imageReferenceMode: "style", stylePresetSlug: null });
  if (missingSavedImage) initial.experience = { ...experienceFixture(),
    referencePath: initial.input.imagePath, referenceId: "old-library-image", provenance: "curated",
    requirementsKey: "[]", compatibility: { compatible: true, conflicts: [], transfer: "Spacing", rationale: "Previously available" } };
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: "project", owner_id: "owner", product_planning: initial }],
    project_screen_roadmap: [], project_messages: [],
  };
  await runProductDesigner({ admin: productDesignerMemoryStore(tables), projectId: "project", ownerId: "owner",
    prompt: brief, originalPrompt: brief, clientTurnId: "first-design-turn", enqueueMemory: false });
  const saved = readProductPlanning(tables.projects[0].product_planning)!;
  expect(saved.scope?.status).toBe("proposed");
  expect(saved.scope?.journeyCoverage?.[0].outputKeys).toEqual(saved.scope?.outputKeys);
  expect(saved.experience?.provenance).toBe("prompt_synthesis");
  expect(saved.input.imagePath).toBeNull();
  expect(saved.input.referencePreference).toBeUndefined();
  expect(saved.lease).toBeNull();
  const reply = tables.project_messages.find(message => (message.metadata as Record<string, unknown>)?.productTurnComplete);
  expect(reply?.metadata).toMatchObject({ productScopeProposal: { scope: { status: "proposed" } } });
  expect(reply?.metadata).not.toHaveProperty("productPlanningFailure");
  expect(mocks.generate).toHaveBeenCalledTimes(3); // assessment, proposal, substantive review
  expect(mocks.trigger).not.toHaveBeenCalled();
  expect(tables.screens ?? []).toHaveLength(0);
  expect(tables.generation_runs ?? []).toHaveLength(0);
});
