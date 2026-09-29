import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), trigger: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ createGeminiClient: () => ({ models: { generateContent: mocks.generate } }) }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger }, idempotencyKeys: { create: async (key: string) => key } }));
vi.mock("@/lib/generation/curated-style-references", () => ({ shortlistCuratedStyleReferences: vi.fn(async () => []), loadCuratedStyleReferenceImage: vi.fn() }));
vi.mock("@/lib/generation/reference-image", () => ({ normalizeReferenceImage: async (image: { data: string; mimeType: string }) =>
  ({ image, sha256: "a".repeat(64) }) }));
vi.mock("@/lib/agent/project-tools", () => ({ projectReadToolDeclarations: [], createProjectReadToolExecutor: () => vi.fn() }));
vi.mock("@/lib/generation/message-memory", () => ({ persistProjectMessageMemoryPair: vi.fn() }));
import { runProductDesigner } from "./designer";
import { readProductPlanning, type ProductPlanning } from "./model";
import { productDesignerMemoryStore } from "@/scripts/lib/product-designer-memory-store";

// Sanitized replays of the production projects that stopped on 2026-09-28
// (8968251e..., 2f7c810c...). Owner IDs and storage paths are synthetic; the
// saved planning shape, facts and screens are the ones that failed.
const owner = "owner";
const imagePath = "owner/prompt-images/reference.webp";
const request = "Build a premium task management app";
const questionMessageId = "f883ee7b-c886-4cc6-8ed2-a7a2fb5a67c2";
const referenceExperience = {
  direction: "Adopt the soft-premium aesthetic: light grey background, cobalt blue for active states, heavy rounding.",
  navigation: "A pill-shaped bottom navigation bar with soft-edged icons.",
  provenance: "user_upload" as const,
  adaptations: "Use the reference's large rounded cards for the Daily Task View.",
  referenceId: null,
  observations: "A soft minimalist interface with layered cards and a vibrant cobalt accent.",
  compatibility: { transfer: "Cobalt accent, extreme radii, layered depth.", conflicts: [], rationale: "Aligned.", compatible: true },
  referencePath: imagePath,
  referenceHash: "70964a5194b8bfe90ca3d9217e7cc5ebdb8802f464a92a8c9aeff0dbd63fa95c",
  requirementsKey: "[]",
  informationHierarchy: "Task titles bold and large; metadata in medium grey.",
};
const questionAssessment = {
  gaps: [{ area: "product" as const, question: "What is the primary view for the calendar section?",
    consequence: "This defines if we design a full-month grid or a focused daily schedule view.",
    choices: [{ label: "Monthly Grid", description: "A standard calendar month view with dots indicating tasks on specific days." },
      { label: "Weekly Timeline", description: "A horizontal scrolling week view showing scheduled tasks hour-by-hour." },
      { label: "Combined Agenda View", description: "A small date picker at the top with a vertical list of upcoming tasks below." }],
    decisionKey: "calendar_navigation", decisionType: "screen_flow" as const, requiresUserInput: true,
    whyUserMustDecide: "It changes which calendar screens are designed." }],
  mode: "product" as const, turnId: "initial:project", rationale: "One calendar decision changes the screens.",
  delegation: "", productReady: false, experienceReady: false, recommendations: [], screenFlowPreview: [],
};
const baseInput = { imagePath, originalRequest: request, referenceSource: "user" as const, stylePresetSlug: null, imageReferenceMode: "style" as const };
const fact = (id: string, section: string, label: string, detail: string, source = "assumption", evidence = "") => ({
  id, label, links: [], detail, source, status: "active", section, blocking: false, evidence,
  messageId: "45be0820-aab2-475e-a85d-d71e356d8ab4", provenance: { basis: source === "user" ? "direct" : "inferred", recommendationMessageId: null },
  supersededBy: null });
const screen = (stableKey: string, name: string, sequence: number, journeyId: string, surfaceId: string, actions: Array<{ label: string; outcome: string; destinationKey: string | null }>) => ({
  kind: "screen", name, actions, outcome: `${name} outcome`, sequence, stateKey: null, rendering: "product_screen", stableKey,
  journeyIds: [journeyId], surfaceIds: [surfaceId], decisionIds: [], description: `${name} description`, information: `${name} information`,
  inlineStates: [], triggerLabel: "", dependencyKeys: [], entryCondition: `${name} entry`, editInstruction: "", parentStableKey: null,
  referenceScreenIndex: null });

function database(planning: unknown, messages: Array<Record<string, unknown>>, roadmap: Array<Record<string, unknown>> = []) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    projects: [{ id: "project", owner_id: owner, product_planning: planning }],
    project_screen_roadmap: roadmap.map(item => ({ project_id: "project", owner_id: owner, stable_key: item.stableKey,
      metadata: { functional: item }, status: "planned", generated_screen_id: null })),
    project_messages: messages.map((message, index) => ({ project_id: "project", owner_id: owner,
      created_at: new Date(Date.UTC(2026, 8, 28, 15, 58, index)).toISOString(), ...message })),
  };
  const admin = productDesignerMemoryStore(tables);
  return { tables, admin };
}
const initialMessages = [
  { id: "7a1ea613-7919-4da4-b7de-9b8cfbe6bf51", role: "user", content: request, metadata: { action: "product_initial_prompt", clientTurnId: "initial:project" } },
  { id: questionMessageId, role: "model", content: "Let's shape the screens and flow.", metadata: { clientTurnId: "initial:project",
    productTurnComplete: "initial:project", productQuestions: questionAssessment.gaps.map(({ question, consequence, choices, decisionKey }) =>
      ({ question, consequence, choices, decisionKey })), productScopeProposal: null } },
];
const saved = (tables: Record<string, Array<Record<string, unknown>>>) => readProductPlanning(tables.projects[0].product_planning)!;
const reply = (tables: Record<string, Array<Record<string, unknown>>>) =>
  tables.project_messages.filter(message => (message.metadata as Record<string, unknown>)?.productTurnComplete).at(-1)!;
const modelCalls = (kind: "proposal" | "inspection" | "assessment") => mocks.generate.mock.calls.filter(([request]) => {
  const properties = request.config.responseSchema?.properties ?? {};
  return kind === "proposal" ? Boolean(properties.outputs) : kind === "inspection" ? Boolean(properties.observations) : Boolean(properties.productReady);
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DRAWGLE_DESIGN_FLOW_PLANNER", "proposal");
  vi.stubEnv("DRAWGLE_EARLY_PROJECT_DESIGN_MODE", "off");
  vi.stubEnv("DRAWGLE_PROGRESSIVE_GENERATION_ENABLED", "false");
  mocks.trigger.mockResolvedValue({ id: "run" });
});
afterEach(() => vi.unstubAllEnvs());

describe("replays of the projects that stopped in planning", () => {
  it("8968251e: the answered calendar question now reaches approval with the exact plan that failed", async () => {
    const planning = { version: 1, designerVersion: 2, planningProtocol: "proposal_v1", revision: 4, contentRevision: 0,
      phase: "discovery", blueprint: { facts: [] }, scope: null, initialTurnComplete: true, input: baseInput,
      evidenceAssessment: questionAssessment, resolvedDecisionKeys: [], lease: null, experience: null };
    const { tables, admin } = database(planning, initialMessages);
    await admin.storage.from().upload(imagePath, new TextEncoder().encode("reference-pixels"), { contentType: "image/webp" });
    mocks.generate.mockImplementation(async ({ config }) => {
      if (config.responseSchema?.properties?.outputs) return { text: JSON.stringify({
        // The candidate that was saved on 2026-09-28: no jobs fact, a self-link and a decision reference.
        facts: [
          { ref: "identity", section: "identity", label: "Zenith Tasks", detail: "A premium task management application focused on high-end aesthetics and streamlined productivity.", source: "assumption", evidence: "", links: [] },
          { ref: "actor", section: "actors", label: "Productivity Professional", detail: "An individual who manages complex schedules and values visual clarity and premium design.", source: "assumption", evidence: "", links: [] },
          { ref: "calendar-view", section: "decisions", label: "Primary Calendar View", detail: "The calendar section defaults to a Monthly Grid view with dots indicating tasks on specific days.", source: "user", evidence: "Monthly Grid: A standard calendar month view with dots indicating tasks on specific days.", links: [] },
          { ref: "schedule", section: "journeys", label: "Schedule Management", detail: "A journey from viewing the overall schedule to inspecting daily tasks and managing them.", source: "assumption", evidence: "", links: [] },
          { ref: "mobile", section: "surfaces", label: "Mobile App", detail: "The primary interaction surface for the task manager.", source: "assumption", evidence: "", links: [] },
        ],
        removeFactIds: [], removeOutputKeys: [],
        outputs: [
          { ref: "month", name: "Monthly Schedule", description: "A high-fidelity monthly calendar grid for tracking deadlines and availability.",
            surfaceRefs: ["mobile"], journeyRefs: ["schedule"], decisionRefs: ["calendar-view"], dependencyRefs: [],
            actions: [{ label: "Select Day", destinationRef: "day", outcome: "Focuses the view on a specific day's task list." },
              { label: "Add Task", destinationRef: null, outcome: "Opens a task creation overlay to add an item to the selected day." }],
            information: "A grid showing the current month; dates with tasks feature minimalist dots.", entryCondition: "User taps the Calendar tab.",
            outcome: "The user sees their monthly workload at a glance.", inlineStates: ["Month selection"], sequence: 1 },
          { ref: "day", name: "Daily Task View", description: "A focused list of tasks for a single chosen day.",
            surfaceRefs: ["mobile"], journeyRefs: ["schedule"], decisionRefs: [], dependencyRefs: [],
            actions: [{ label: "Back to Month", destinationRef: "month", outcome: "Returns to the full monthly grid view." },
              { label: "Toggle Complete", destinationRef: "day", outcome: "Updates task status and strikes through the item." }],
            information: "Timeline of the day's scheduled tasks.", entryCondition: "User selects a day on the Monthly Schedule.",
            outcome: "Detailed visibility into hourly commitments.", inlineStates: ["Task edit mode"], sequence: 2 },
        ],
        scope: { goal: "Design the primary calendar interface", rationale: "The user specified a monthly grid view.",
          outputRefs: ["month", "day"], surfaceRefs: ["mobile"] },
      }) };
      if (config.responseSchema?.properties?.observations) return { text: JSON.stringify({ ...referenceExperience, compatibility: referenceExperience.compatibility }) };
      throw new Error("Unexpected model call");
    });
    await runProductDesigner({ admin: admin as never, projectId: "project", ownerId: owner, prompt: "", originalPrompt: request,
      clientTurnId: "0c44eb54-b78f-48ff-a037-665011ffbd8f", enqueueMemory: false,
      productAnswers: { messageId: questionMessageId, answers: [{ kind: "choice", index: 0 }] } });
    const state = saved(tables);
    expect(reply(tables).metadata).not.toHaveProperty("productPlanningFailure");
    expect(state.scope?.status).toBe("proposed");
    expect(state.scope?.manifest?.map(item => item.name)).toEqual(["Monthly Schedule", "Daily Task View"]);
    expect(state.scope?.manifest?.[1].actions.map(action => action.destinationKey)).toEqual([state.scope?.outputKeys?.[0], null]);
    expect(state.blueprint.facts.find(item => item.section === "decisions")).toMatchObject({ source: "user" });
    expect(state.blueprint.facts.some(item => item.section === "jobs")).toBe(false);
    expect(modelCalls("assessment")).toHaveLength(0);
    expect(modelCalls("proposal")).toHaveLength(1);
    expect(modelCalls("inspection")).toHaveLength(1);
    expect(state.experience).toMatchObject({ provenance: "user_upload", referencePath: imagePath });
    expect(state.lease).toBeNull();
  });

  it("2f7c810c: Continue from the saved failure proposes without re-assessing or re-inspecting", async () => {
    const f = { identity: "f_c57f2ec8fcf38a3d536d", actors: "f_c317cd8bf4d12b74a574", entity: "f_8ce34c531f9f0504ddb9",
      journey: "f_db83fd1ffd8402e59eac", surface: "f_f6d2c0530757c014505b", decision: "f_8bc6a136f00cc2de7663" };
    const dashboard = screen("screen:422445f4869f0f6173b0", "Dashboard", 1, f.journey, f.surface, [
      { label: "View Calendar", outcome: "Opens the schedule.", destinationKey: "screen:5c420b652cd144b97b6d" },
      { label: "Open Task Details", outcome: "Shows sub-tasks.", destinationKey: "screen:897bddf4e4df7cea69df" }]);
    const calendar = screen("screen:5c420b652cd144b97b6d", "Calendar View", 2, f.journey, f.surface, [
      { label: "Home", outcome: "Returns to the dashboard.", destinationKey: dashboard.stableKey }]);
    const details = screen("screen:897bddf4e4df7cea69df", "Task Details", 3, f.journey, f.surface, [
      { label: "Back", outcome: "Returns to the list.", destinationKey: dashboard.stableKey }]);
    const planning = {
      version: 1, designerVersion: 2, planningProtocol: "proposal_v1", revision: 11, contentRevision: 3, phase: "discovery",
      input: baseInput, lease: null, initialTurnComplete: true, resolvedDecisionKeys: [],
      lastProposalOperationId: "37b61ddd-1740-407e-b75f-87cb62ead0d2",
      blueprint: { facts: [
        fact(f.identity, "identity", "Premium Task Manager", "A high-end personal and professional task management application."),
        fact(f.actors, "actors", "Productive Professional", "Users who value aesthetics and fluidity in their daily workflow management."),
        fact(f.entity, "entities", "Task", "Individual items with priority, status, sub-tasks, and assigned team members."),
        fact(f.journey, "journeys", "Daily Task Management", "User reviews their schedule and completes or organizes high-priority items."),
        fact(f.surface, "surfaces", "Mobile Application", "iOS and Android app with bottom navigation."),
        fact(f.decision, "decisions", "Glassmorphic Cards", "Use blurred backgrounds and cobalt blue accents for a premium depth effect."),
      ] },
      experience: referenceExperience,
      evidenceAssessment: { gaps: [], mode: "product", turnId: "initial:project", rationale: "The product concept is clear.",
        delegation: "", productReady: true, experienceReady: true, recommendations: [],
        screenFlowPreview: ["Dashboard: greeting, Today/Weekly filter and priority task cards.", "Calendar View: monthly or weekly grid.",
          "Task Details: members, sub-tasks and activity.", "Project Documents: shared files and notes."] },
      scope: { goal: "Repair and formalize the core premium task management flow.", status: "draft",
        manifest: [dashboard, calendar, details], rationale: "The original review issue was a system error.",
        boundaries: [], outputKeys: [dashboard.stableKey, calendar.stableKey, details.stableKey], surfaceIds: [f.surface],
        outputPolicy: "manual_states_v1", existingOutputs: [], generationRunId: null, approvedRevision: null, reviewedContentRevision: 3 },
    };
    const messages = [
      ...initialMessages.slice(0, 1),
      { id: "10bf6911-edd0-494c-bbee-3951669d5ece", role: "model", content: "The saved screen flow could not be reviewed right now.",
        metadata: { productTurnComplete: "first", productPlanningFailure: { stage: "flow_review", code: "REVIEW_UNAVAILABLE", summary: "x", retryable: true } } },
      { id: "824884e3-464f-4bac-8399-94cd7bd52066", role: "user", content: "Repair the saved screen-flow review issues using the existing facts and roadmap. Preserve my requested screens and visible flows, original request, and corrections. This is not approval to generate.",
        metadata: { action: "agent_turn_user", clientTurnId: "37b61ddd-1740-407e-b75f-87cb62ead0d2" } },
      { id: "edc8fde0-77da-4d15-9dd8-a8cc2060d746", role: "model", content: "The saved screen scope has an unresolved planning constraint.",
        metadata: { productTurnComplete: "37b61ddd-1740-407e-b75f-87cb62ead0d2", productPlanningFailure: { stage: "scope_validation", code: "SCOPE_VALIDATION_UNAVAILABLE", summary: "x", retryable: true } } },
    ];
    const { tables, admin } = database(planning, messages, [dashboard, calendar, details]);
    await admin.storage.from().upload(imagePath, new TextEncoder().encode("reference-pixels"), { contentType: "image/webp" });
    mocks.generate.mockImplementation(async ({ config, contents }) => {
      if (!config.responseSchema?.properties?.outputs) throw new Error("Only the proposal may call the model");
      const payload = JSON.parse(contents[0].parts[0].text);
      expect(payload.assignment).toBe(request);
      expect(payload.latestMessage.kind).toBe("continue");
      expect(JSON.stringify(payload)).not.toContain("Repair the saved screen-flow");
      expect(payload.currentRoadmap.map((item: { stableKey: string }) => item.stableKey)).toEqual([dashboard.stableKey, calendar.stableKey, details.stableKey]);
      return { text: JSON.stringify({ facts: [], removeFactIds: [], removeOutputKeys: [],
        outputs: [
          { ref: "dashboard", existingKey: dashboard.stableKey, name: "Dashboard", description: "Greeting, Today/Weekly filter and priority task cards.",
            surfaceRefs: [f.surface], journeyRefs: [f.journey], decisionRefs: [f.decision], dependencyRefs: [], actions: dashboard.actions.map(action =>
              ({ label: action.label, destinationRef: action.destinationKey, outcome: action.outcome })),
            information: "Greeting, filters, task stack, daily progress.", entryCondition: "App launch or Home tab.", outcome: "Priorities are clear.", inlineStates: ["Empty state"] },
          { ref: "documents", name: "Project Documents", description: "Shared files and notes for the workspace.", surfaceRefs: [f.surface], journeyRefs: [f.journey],
            decisionRefs: [], dependencyRefs: [], actions: [{ label: "Home", destinationRef: "Dashboard", outcome: "Back to the dashboard." }],
            information: "Recent files, notes and owners.", entryCondition: "Documents tab.", outcome: "The right file is found.", inlineStates: [] },
        ],
        scope: { goal: "Plan, review and complete premium tasks across dashboard, calendar, details and documents.", rationale: "The full requested app.",
          outputRefs: ["dashboard", calendar.stableKey, details.stableKey, "documents"], surfaceRefs: [f.surface] } }) };
    });
    await runProductDesigner({ admin: admin as never, projectId: "project", ownerId: owner, prompt: "Continue screen design",
      originalPrompt: request, clientTurnId: "continue-after-deploy", resumeReview: true, enqueueMemory: false });
    const state = saved(tables);
    expect(reply(tables).metadata).not.toHaveProperty("productPlanningFailure");
    expect(state.scope?.status).toBe("proposed");
    expect(state.scope?.goal).toBe("Plan, review and complete premium tasks across dashboard, calendar, details and documents.");
    expect(state.scope?.manifest?.map(item => item.name)).toEqual(["Dashboard", "Calendar View", "Task Details", "Project Documents"]);
    expect(state.scope?.manifest?.[3].actions[0].destinationKey).toBe(dashboard.stableKey);
    expect(modelCalls("assessment")).toHaveLength(0);
    expect(modelCalls("inspection")).toHaveLength(0);
    expect(modelCalls("proposal")).toHaveLength(1);
    const click = tables.project_messages.find(message => (message.metadata as Record<string, unknown>)?.clientTurnId === "continue-after-deploy" && message.role === "user");
    expect(click?.metadata).toMatchObject({ action: "product_planning_continue" });
  });
});

// Keep the fixture typed against the saved contract.
export type ReplayPlanning = ProductPlanning;
