import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: async () => ({ data: "pixels", mimeType: "image/webp" }), storePlanningReference: vi.fn() }));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => vi.fn() }));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: vi.fn() }));
import { runProductDesigner } from "./designer";
import { productDesignerMemoryStore } from "@/scripts/lib/product-designer-memory-store";
import { appointmentFlow } from "./flow-test-fixtures";
import { createProductPlanning, readProductPlanning } from "./model";
import { experienceFixture } from "./test-fixtures";

beforeEach(() => { mocks.generate.mockReset(); });
it("repairs failed inline-flow persistence through the real stores, assessment, scope snapshot and flow reviewer", async () => {
  const { state: mapped, roadmap, review } = appointmentFlow();
  // Ordinary confirmation is inline, not a paid state frame in a new scope.
  const removed = roadmap.pop()!;
  roadmap[0].actions = [{ label: "Reserve", destinationKey: null, outcome: removed.outcome }];
  roadmap[0].inlineStates.push(removed.description);
  mapped.scope!.outputKeys = [roadmap[0].stableKey];
  review.journeys[0].outputKeys = [roadmap[0].stableKey];
  review.journeys[0].completionKeys = [roadmap[0].stableKey];
  const initial = createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null });
  initial.experience = experienceFixture();
  initial.input.imagePath = initial.experience.referencePath;
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: "project", owner_id: "owner", product_planning: initial }], project_screen_roadmap: [], project_messages: [],
  };
  const admin = productDesignerMemoryStore(tables);
  const rpc = admin.rpc.bind(admin);
  let writes = 0;
  admin.rpc = async (name, args) => {
    writes += 1;
    if (writes === 1) return { error: { code: "23514", message: "Synthetic state-write rejection" } };
    return rpc(name, args);
  };
  const call = (name: string, args: unknown) => ({ name, args });
  const functionResponse = (calls: ReturnType<typeof call>[]) => ({ functionCalls: calls,
    candidates: [{ content: { role: "model", parts: calls.map(functionCall => ({ functionCall })) } }] });
  const functional = call("update_functional_plan", { items: roadmap, removeKeys: [] });
  const scope = call("set_design_scope", mapped.scope);
  const designerReplies = [
    functionResponse([call("update_product", { facts: mapped.blueprint.facts, supersessions: [] }), functional, scope]),
    { text: "I encountered a saved-state problem." },
    functionResponse([functional, scope, call("propose_scope", {})]),
    { text: "Review the complete booking journey." },
  ];
  mocks.generate.mockImplementation(async ({ config }) => {
    if (config.responseSchema?.properties?.productReady) return { text: JSON.stringify({ productReady: true, experienceReady: true, gaps: [], recommendations: [], delegation: "", rationale: "The booking behavior is explicit" }) };
    if (config.responseSchema?.properties?.requestedScope) return { text: JSON.stringify(review) };
    return designerReplies.shift();
  });
  await runProductDesigner({ admin, projectId: "project", ownerId: "owner", prompt: review.scopeEvidence,
    originalPrompt: review.scopeEvidence, clientTurnId: "repair-turn", enqueueMemory: false });
  const saved = readProductPlanning(tables.projects[0].product_planning)!;
  expect(writes).toBe(2);
  expect(saved.scope?.status).toBe("proposed");
  expect(saved.scope?.manifest?.map(item => item.stableKey)).toEqual(roadmap.map(item => item.stableKey));
  expect(saved.scope?.journeyCoverage).toEqual(review.journeys);
  expect(saved.scope?.requestedScope).toBe("whole_product");
  expect(saved.phase).toBe("discovery");
  expect(saved.lease).toBeNull();
  const modelMessage = tables.project_messages.find(m => m.role === "model");
  expect(modelMessage).toBeDefined();
  expect(modelMessage?.metadata).not.toHaveProperty("productPlanningFailure");
  const progressMessage = tables.project_messages.find(m => (m.metadata as Record<string, unknown>)?.action === "agent_turn_progress");
  expect(progressMessage).toBeDefined();
  expect((progressMessage?.metadata as Record<string, unknown>)?.agentStep).toMatchObject({ status: "completed" });
  expect(tables.generation_runs ?? []).toHaveLength(0);
  expect(tables.screens ?? []).toHaveLength(0);
});
