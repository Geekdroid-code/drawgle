import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), image: vi.fn(), message: vi.fn() }));
vi.mock("./store", async (original) => ({ ...await original<typeof import("./store")>(), loadProductPlanning: mocks.load, saveProductPlanning: mocks.save }));
vi.mock("./references", () => ({ loadPlanningReference: mocks.image }));
vi.mock("@/lib/supabase/queries", () => ({ insertProjectMessage: mocks.message }));
vi.mock("@/lib/credits", () => ({ adminCreditService: { hasCredits: async () => ({ hasCredits: true, currentBalance: 500 }) } }));
import { prepareProductApproval } from "./approval";
import { proposeProductScope } from "./model";
import { productFixture, designerFixture, functionalFixture } from "./test-fixtures";
const projectId = "11111111-1111-4111-8111-111111111111";
const query = { select: () => query, eq: () => query, in: () => query, limit: () => query, maybeSingle: vi.fn() };
const admin = { from: vi.fn(() => query) };

describe("server product scope approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(proposeProductScope(productFixture()));
    mocks.save.mockImplementation(async (_admin, _project, _owner, previous, next) => ({ ...next, revision: previous.revision + 1 }));
    mocks.image.mockResolvedValue(null);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
  });
  it("refuses generation before explicit approval without touching storage, credits or queue", async () => {
    await expect(prepareProductApproval(admin, "owner", { projectId, prompt: "yes" })).rejects.toThrow(/approve/);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
  it("ignores client-supplied plans and uses the approved server snapshot", async () => {
    const approval = await prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: 0 }, prompt: "Create Brand Manifesto", plannedScreens: [{ name: "Manifesto" }] });
    expect(approval?.body.prompt).toContain("Onboarding");
    expect(approval?.body.prompt).not.toContain("Manifesto");
    expect(approval?.body.scopeContract.finalScreenCount).toBe(1);
    expect(approval?.initialGeneration).toBe(true);
    expect(approval?.snapshot.blueprint.facts.some((fact) => fact.id === "orders")).toBe(true);
    await approval!.queued(projectId);
    expect(mocks.save.mock.calls.at(-1)?.[4]).toMatchObject({ phase: "canvas", lease: null, scope: { generationRunId: projectId, status: "approved" } });
    expect(mocks.message).toHaveBeenCalledOnce();
  });
  it("rejects stale approvals, duplicate approvals and concurrent generation", async () => {
    await expect(prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: 9 } })).rejects.toThrow(/changed/);
    query.maybeSingle.mockResolvedValue({ data: { id: "active" }, error: null });
    await expect(prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: 0 } })).rejects.toThrow(/already running/);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("requires a refreshed draft instead of silently removing old automatic states", async () => {
    const state = designerFixture();
    state.scope!.manifest!.push({ ...functionalFixture("state:empty", "Empty", 1), kind: "state", parentStableKey: "screen:onboarding", stateKey: "empty" });
    mocks.load.mockResolvedValue(state);
    await expect(prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: state.revision } })).rejects.toThrow(/refresh the scope/);
    expect(state.scope!.manifest).toHaveLength(2);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
  it("restores a proposal after queue failure without overwriting newer product work", async () => {
    const approval = await prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: 0 } });
    mocks.load.mockResolvedValue({ ...proposeProductScope(productFixture()), revision: 1 });
    await approval!.rollback();
    expect(mocks.save.mock.calls.at(-1)?.[4].scope.status).toBe("proposed");
    const calls = mocks.save.mock.calls.length;
    mocks.load.mockResolvedValue({ ...productFixture(), revision: 50 });
    await approval!.rollback();
    expect(mocks.save).toHaveBeenCalledTimes(calls);
  });
  it("preserves recreation evidence and the initial curated-reference path", async () => {
    const state = proposeProductScope(productFixture());
    state.input = { imagePath: "owner/reference.webp", imageReferenceMode: "recreate", stylePresetSlug: null };
    mocks.load.mockResolvedValue(state);
    mocks.image.mockResolvedValue({ data: "image", mimeType: "image/webp" });
    const approval = await prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: 0 } });
    expect(approval?.body.imageReferenceMode).toBe("recreate");
    expect(approval?.body.scopeContract.referenceMode).toBe("user_recreate");
    expect(approval?.initialGeneration).toBe(true);
  });
  it("allows legacy projects and normal canvas-generation requests", async () => {
    mocks.load.mockResolvedValue(null);
    expect(await prepareProductApproval(admin, "owner", { projectId })).toBeNull();
    mocks.load.mockResolvedValue({ ...productFixture(), phase: "canvas" });
    expect(await prepareProductApproval(admin, "owner", { projectId })).toBeNull();
  });
  it("verifies the reference and freezes every approved output beyond five screens", async () => {
    const state = designerFixture();
    state.scope!.manifest = Array.from({ length: 7 }, (_, index) => functionalFixture(`screen:${index}`, `Screen ${index}`, index));
    state.experience!.referenceHash = createHash("sha256").update("pixels").digest("hex");
    mocks.load.mockResolvedValue(proposeProductScope(state));
    mocks.image.mockResolvedValue({ data: "changed-pixels", mimeType: "image/webp" });
    await expect(prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: state.revision } })).rejects.toThrow(/reference changed/i);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.image.mockResolvedValue({ data: "pixels", mimeType: "image/webp" });
    const approval = await prepareProductApproval(admin, "owner", { projectId, productApproval: { revision: state.revision } });
    expect(approval?.snapshot.scope?.manifest).toHaveLength(7);
    expect(approval?.body.scopeContract.finalScreenCount).toBe(7);
  });
});
