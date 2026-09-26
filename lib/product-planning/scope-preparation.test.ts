import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assetsForScopePlan, projectScopePlanForKeys, readScopePreparation, scopePreparationKey, scopePreparationPlanningState } from "./scope-preparation";
import { designerFixture, functionalFixture } from "./test-fixtures";
import { formatProductTruth, scopedGenerationPrompt } from "./generation-context";

describe("approval-card preparation identity", () => {
  it("survives approval bookkeeping but expires on scope, reference, or shared design changes", () => {
    const proposed = designerFixture();
    proposed.scope!.status = "proposed";
    const shared = { designTokens: null, navigationPlan: null, charter: null };
    const keys = ["screen:onboarding"];
    const key = scopePreparationKey(proposed, keys, shared);
    const approved = { ...proposed, revision: proposed.revision + 2,
      scope: { ...proposed.scope!, status: "approved" as const, approvedRevision: proposed.revision + 2 } };
    expect(scopePreparationKey(approved, keys, shared)).toBe(key);
    expect(scopePreparationKey({ ...approved, phase: "canvas" }, keys, shared)).toBe(key);
    expect(scopePreparationKey(approved, ["screen:shop"], shared)).not.toBe(key);
    expect(scopePreparationKey({ ...approved, contentRevision: (approved.contentRevision ?? 0) + 1 }, keys, shared)).not.toBe(key);
    expect(scopePreparationKey({ ...approved, experience: { ...approved.experience!, referenceHash: "new-pixels" } }, keys, shared)).not.toBe(key);
    expect(scopePreparationKey(approved, keys, { ...shared, navigationPlan: { version: 2 } as never })).not.toBe(key);
  });
  it("distinguishes a saved plan from completed asset planning", async () => {
    const row = { design_tokens: {}, reference_analysis: null,
      plan: { screens: [{ name: "Welcome" }], charter: {}, navigationPlan: {} },
      asset_requirements: [], assets_ready: false, created_at: "2026-09-26T00:00:00Z",
      expires_at: new Date(Date.now() + 60_000).toISOString() };
    const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: row, error: null }),
    }) }) }) }) }) } as never;
    const pending = await readScopePreparation(admin, "project", "owner", "key");
    expect(pending?.assetsReady).toBe(false);
    expect(pending?.assetRequirements).toBeNull();
    row.assets_ready = true;
    const ready = await readScopePreparation(admin, "project", "owner", "key");
    expect(ready?.assetRequirements).toEqual([]);
  });
  it("passes the same product content to the planner before and just after approval", () => {
    const proposed = designerFixture();
    proposed.scope!.status = "proposed";
    const revision = proposed.contentRevision ?? 0;
    const early = scopePreparationPlanningState(proposed, revision)!;
    const queued = { ...proposed, phase: "canvas" as const, revision: proposed.revision + 2,
      scope: { ...proposed.scope!, status: "approved" as const,
        approvedRevision: proposed.revision, generationRunId: "11111111-1111-4111-8111-111111111111" } };
    const late = scopePreparationPlanningState(queued, revision)!;
    expect(scopedGenerationPrompt(late, ["screen:onboarding"]))
      .toBe(scopedGenerationPrompt(early, ["screen:onboarding"]));
    expect(formatProductTruth(late, true)).toBe(formatProductTruth(early, true));
  });
  it("projects only the requested approved screen while retaining shared navigation", () => {
    const state = designerFixture();
    state.scope!.manifest = [functionalFixture("screen:first", "First", 0), functionalFixture("screen:second", "Second", 1)];
    const navigationPlan = { enabled: true, items: [{ id: "home", label: "Home" }] };
    const plan = { screens: [{ name: "First", description: "First brief" }, { name: "Second", description: "Second brief" }],
      charter: {}, navigationPlan, screenCountContract: { exactCount: 2, source: "named_screens" },
    } as never;
    const projected = projectScopePlanForKeys(plan, state, ["screen:first", "screen:second"], ["screen:first"], "internal_style");
    expect(projected?.screens.map(screen => screen.name)).toEqual(["First"]);
    expect(projected?.screens[0].roadmapStableKey).toBe("screen:first");
    expect(projected?.navigationPlan).toBe(navigationPlan);
    expect(projected?.screenCountContract?.exactCount).toBe(1);
    expect(assetsForScopePlan(projected!, plan, [
      { id: "first-asset", screenName: "First" }, { id: "second-asset", screenName: "Second" },
    ] as never)?.map(asset => asset.id)).toEqual(["first-asset"]);
    expect(assetsForScopePlan(projected!, { screens: [
      { name: "First" }, { name: "First" },
    ] } as never, [] as never)).toBeNull();
    expect(projectScopePlanForKeys(plan, state, ["screen:first", "screen:second"], ["screen:missing"], "internal_style")).toBeNull();
  });
});
