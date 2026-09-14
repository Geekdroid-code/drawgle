import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, project: {} as Record<string, unknown>, designer: vi.fn(), router: vi.fn(), trigger: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user }, error: null }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.project, error: null }) }; return query;
} }) }));
vi.mock("./designer", () => ({ runProductDesigner: mocks.designer }));
vi.mock("@/lib/agent/router", () => ({ routeAgentPrompt: mocks.router }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
import { POST as agentPost } from "@/app/api/agent/route";
import { POST as planPost } from "@/app/api/plan/route";
import { POST as generationPost } from "@/app/api/generations/route";
import { createProductPlanning } from "./model";
const projectId = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown) => new Request("http://localhost/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("planning API boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.user = { id: "owner" };
    mocks.project = { id: projectId, owner_id: "owner", prompt: "A T-shirt shop", product_planning: createProductPlanning({ imagePath: null, imageReferenceMode: "style", stylePresetSlug: null }) };
    mocks.designer.mockResolvedValue({ intent: "product_planning", message: "Let's map the product." });
  });
  it("routes unfinished projects directly to the product designer, never the edit router", async () => {
    const response = await agentPost(request({ projectId, prompt: "I want a premium T-shirt shop." }));
    expect(response.status).toBe(200);
    expect(mocks.designer).toHaveBeenCalledOnce();
    expect(mocks.router).not.toHaveBeenCalled();
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("initializes from the persisted prompt without generating screens", async () => {
    expect((await agentPost(request({ projectId, prompt: "", initializePlanning: true }))).status).toBe(200);
    expect(mocks.designer.mock.calls[0][0]).toMatchObject({ prompt: "A T-shirt shop", initialize: true, clientTurnId: `initial:${projectId}` });
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("checks authentication and project ownership before planning", async () => {
    mocks.user = null;
    expect((await agentPost(request({ projectId, prompt: "hello" }))).status).toBe(401);
    mocks.user = { id: "someone-else" };
    expect((await agentPost(request({ projectId, prompt: "hello" }))).status).toBe(404);
    expect(mocks.designer).not.toHaveBeenCalled();
  });
  it("prevents direct screen planning and new-project generation from bypassing approval", async () => {
    expect((await planPost(request({ projectId, prompt: "Create screens" }))).status).toBe(409);
    expect((await generationPost(request({ prompt: "Create a shop" }))).status).toBe(409);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
});
