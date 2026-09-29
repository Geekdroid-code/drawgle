import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("./references", () => ({ loadPlanningReference: async () => ({ data: "pixels", mimeType: "image/webp" }), storePlanningReference: vi.fn() }));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => vi.fn() }));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: vi.fn() }));
import { runProductDesigner } from "./designer";
import { productDesignerMemoryStore } from "@/scripts/lib/product-designer-memory-store";
import { applyProductPatch, createProductPlanning, readProductPlanning } from "./model";
import { functionalItemSchema } from "./functional-plan";
import { experienceFixture } from "./test-fixtures";

function appointmentFlow() {
  const state = applyProductPatch(createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }), { operations: [
    ...[
      ["identity", "clinic", "Book clinic appointments"], ["actors", "patient", "Patient booking care"],
      ["jobs", "book", "Obtain a confirmed appointment"], ["journeys", "booking", "Choose availability and confirm a reservation"],
      ["surfaces", "appointments", "Appointment availability and reservation"],
    ].map(([section, id, detail]) => ({ op: "put_fact", fact: { section, id, label: id, detail, source: "assumption" } })),
    { op: "set_scope", goal: "The complete booking app", rationale: "Complete the patient's job", surfaceIds: ["appointments"],
      outputKeys: ["screen:availability", "state:availability:reserved"] },
  ] }, "11111111-1111-4111-8111-111111111111");
  const availability = functionalItemSchema.parse({ stableKey: "screen:availability", kind: "screen", name: "Availability",
    surfaceIds: ["appointments"], journeyIds: ["booking"], description: "Choose a time and reserve it",
    information: "Doctor, date and available times", entryCondition: "Patient opens booking", outcome: "Appointment reserved",
    actions: [{ label: "Reserve", destinationKey: "state:availability:reserved", outcome: "Reserve the selected appointment" }],
    inlineStates: ["If the slot was taken, refresh availability and keep the date"], sequence: 0 });
  const reserved = functionalItemSchema.parse({ ...availability, stableKey: "state:availability:reserved", kind: "state", name: "Reserved",
    parentStableKey: availability.stableKey, stateKey: "reserved", triggerLabel: "Reservation succeeds",
    editInstruction: "Show the confirmed appointment details in place of available times", actions: [], sequence: 1 });
  return { state, roadmap: [availability, reserved], request: "Build the complete booking app" };
}

beforeEach(() => { vi.stubEnv("DRAWGLE_DESIGN_FLOW_PLANNER", "legacy"); mocks.generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
it("repairs failed inline-flow persistence through the real stores, assessment and scope snapshot", async () => {
  const { state: mapped, roadmap, request } = appointmentFlow();
  // Ordinary confirmation is inline, not a paid state frame in a new scope.
  const removed = roadmap.pop()!;
  roadmap[0].actions = [{ label: "Reserve", destinationKey: null, outcome: removed.outcome }];
  roadmap[0].inlineStates.push(removed.description);
  mapped.scope!.outputKeys = [roadmap[0].stableKey];
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
    return designerReplies.shift();
  });
  await runProductDesigner({ admin, projectId: "project", ownerId: "owner", prompt: request,
    originalPrompt: request, clientTurnId: "repair-turn", enqueueMemory: false });
  const saved = readProductPlanning(tables.projects[0].product_planning)!;
  expect(writes).toBe(2);
  expect(saved.scope?.status).toBe("proposed");
  expect(saved.scope?.manifest?.map(item => item.stableKey)).toEqual(roadmap.map(item => item.stableKey));
  // No separate model review runs before the approval card.
  expect(mocks.generate).toHaveBeenCalledTimes(4); // assessment + three designer rounds
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
