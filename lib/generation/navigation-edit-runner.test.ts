// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/design-history/persistence", () => ({ persistDesignChange: vi.fn(), readDesignTarget: vi.fn() }));
vi.mock("./navigation-design-edit", () => ({ redesignNavigation: vi.fn(), resolveNavigationMembership: vi.fn(), reviseNavigationDestinations: vi.fn() }));
vi.mock("./legacy-navigation-edit", () => ({ editLegacyNavigation: vi.fn() }));
import { persistDesignChange, readDesignTarget } from "@/lib/design-history/persistence";
import { redesignNavigation, resolveNavigationMembership, reviseNavigationDestinations } from "./navigation-design-edit";
import { executeNavigationEdit } from "./navigation-edit-runner";
import { editLegacyNavigation } from "./legacy-navigation-edit";
import { defaultNavigationDesignContract, renderDeterministicNavigationShell } from "@/lib/project-navigation";
import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { navigationSnapshotSchema } from "@/lib/design-history/types";
import type { NavigationPlan } from "@/lib/types";

const projectId = "d7dad3eb-f21a-46e4-855c-1bfd039c888c";
const ownerId = "00000000-0000-4000-8000-000000000001";
const screenId = "00000000-0000-4000-8000-000000000002";
const request = { projectId, ownerId, screenId, userMessageId: "00000000-0000-4000-8000-000000000003", prompt: "add the bottom nav into this screen" };
const plan: NavigationPlan = {
  version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs", evidence: { source: "explicit-prompt", reason: "Requested" },
  visualBrief: "Premium pill", design: defaultNavigationDesignContract("floating dock"),
  items: [
    { id: "home", label: "Home", icon: "house", role: "Home", linkedScreenName: "Health Dashboard", availability: "generated" },
    { id: "health", label: "Health", icon: "activity", role: "Health and training", linkedScreenName: "Training Tracker", availability: "generated" },
    { id: "messages", label: "Messages", icon: "message-circle", role: "Messages", linkedScreenName: null, availability: "planned" },
  ], screenChrome: [],
};
const code = '<main><h1>Training Tracker</h1><section>Keep every exercise exactly</section></main>';
const screen = { id: screenId, name: "Training Tracker", code, chrome_policy: null, navigation_item_id: null, parent_screen_id: null, state_key: null, roadmap_item_id: null };
const before = navigationSnapshotSchema.parse({ plan, shellCode: ensureDrawgleIds(renderDeterministicNavigationShell(plan), "dg-nav").code,
  assignments: [{ screenId, chromePolicy: null, navigationItemId: null, parentScreenId: null, stateKey: null, roadmapItemId: null }] });
const roadmap = [{ id: "00000000-0000-4000-8000-000000000010", name: "Training Tracker", description: "Logs each workout", kind: "screen", generated_screen_id: screenId },
  { id: "00000000-0000-4000-8000-000000000011", name: "Coach Chat", description: "Messages with a coach", kind: "screen", generated_screen_id: null }];
function client(saved: unknown = { plan, shell_code: before.shellCode, design_revision: 3 }, screens: unknown[] = [screen]) {
  const calls: string[] = [];
  const db = { from: vi.fn((table: string) => {
    calls.push(table);
    const result = { data: table === "screens" ? screens : table === "project_screen_roadmap" ? roadmap : saved, error: null };
    const query = { select: () => query, eq: () => query, order: async () => result, maybeSingle: async () => result };
    return query;
  }), rpc: vi.fn().mockResolvedValue({ data: { status: "success", revision: 1 }, error: null }) };
  return { db: db as unknown as Parameters<typeof executeNavigationEdit>[0], rpc: db.rpc, calls };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readDesignTarget).mockResolvedValue({ revision: 3, ready: true, payload: before });
  vi.mocked(persistDesignChange).mockResolvedValue({ status: "success", revision: 4 });
});
describe("shared navigation execution", () => {
  it("attaches the canonical nav without generating or editing screen HTML", async () => {
    const { db, calls } = client();
    const result = await executeNavigationEdit(db, request, null, null);
    expect(result.changed).toBe(true);
    expect(redesignNavigation).not.toHaveBeenCalled();
    expect(resolveNavigationMembership).not.toHaveBeenCalled();
    const change = vi.mocked(persistDesignChange).mock.calls[0][2];
    expect(change.expectedRevision).toBe(3);
    expect(change.payload).toMatchObject({ shellCode: before.shellCode, plan: { items: plan.items }, assignments: [{ navigationItemId: "health", chromePolicy: { showPrimaryNavigation: true } }] });
    expect(JSON.stringify(change.payload)).not.toContain("Keep every exercise");
    expect(calls).toEqual(["project_navigation", "screens", "project_screen_roadmap"]);
    expect(screen.code).toBe(code);
  });
  it("routes a premium redesign to generation and preserves the destination plan", async () => {
    const next = { ...plan, design: { ...plan.design!, radiusPx: 12 } };
    vi.mocked(redesignNavigation).mockResolvedValue({ plan: next, notes: { title: "Lifted dock", summary: "A lifted dock." } });
    const result = await executeNavigationEdit(client().db, { ...request, prompt: "create a new premium nav with modern style" }, null, null);
    expect(redesignNavigation).toHaveBeenCalledOnce();
    expect(vi.mocked(redesignNavigation).mock.calls[0][2]).toBe("redesign");
    expect(vi.mocked(persistDesignChange).mock.calls[0][2].payload).toMatchObject({ plan: next });
    expect(result).toMatchObject({ message: "A lifted dock.", designSummary: { title: "Lifted dock", styleDiff: null } });
  });
  it("follows the router's reading over the text backstop", async () => {
    vi.mocked(redesignNavigation).mockImplementation(async (_, current) => ({ plan: { ...current, design: { ...current.design!, radiusPx: 12 } }, notes: { title: null, summary: null } }));
    // The backstop reads "consistent" as reuse; the router knew it was a change of look.
    await executeNavigationEdit(client().db, { ...request, prompt: "make the nav consistent with the cards", intent: "restyle" }, null, null);
    expect(vi.mocked(redesignNavigation).mock.calls[0][2]).toBe("restyle");
  });
  it("lets a redesign add tabs, puts the bar on a built screen a new tab opens, and says which tabs await screens", async () => {
    const profileId = "00000000-0000-4000-8000-000000000004";
    const profile = { ...screen, id: profileId, name: "Profile", code: "<main>Profile</main>", chrome_policy: { chrome: "top-bar" } };
    const withProfile = navigationSnapshotSchema.parse({ ...before, assignments: [...before.assignments,
      { screenId: profileId, chromePolicy: { chrome: "top-bar" }, navigationItemId: null, parentScreenId: null, stateKey: null, roadmapItemId: null }] });
    vi.mocked(readDesignTarget).mockResolvedValue({ revision: 3, ready: true, payload: withProfile });
    const items = [...plan.items,
      { id: "profile", label: "Profile", icon: "user", role: "Account", linkedScreenName: "Profile", availability: "generated" as const },
      { id: "coach", label: "Coach", icon: "message-square", role: "Coaching", linkedScreenName: null, availability: "planned" as const }];
    vi.mocked(redesignNavigation).mockResolvedValue({ plan: { ...plan, items: items.filter(item => item.id !== "messages") }, notes: { title: "Ink dock", summary: "An ink dock." } });
    const result = await executeNavigationEdit(client(undefined, [screen, profile]).db, { ...request, prompt: "this nav is filthy, improve it", intent: "redesign" }, null, null);
    const context = vi.mocked(redesignNavigation).mock.calls[0][0];
    expect(context.screens.find(item => item.id === screenId)).toMatchObject({ role: "Logs each workout" });
    expect(context.plannedScreens).toEqual([{ name: "Coach Chat", description: "Messages with a coach" }]);
    const saved = vi.mocked(persistDesignChange).mock.calls[0][2].payload as typeof before;
    expect(saved.assignments.find(item => item.screenId === profileId)).toMatchObject({ navigationItemId: "profile", chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true } });
    expect((saved.plan as unknown as NavigationPlan).screenChrome).toContainEqual({ screenName: "Profile", chrome: "bottom-tabs", navigationItemId: "profile" });
    expect(result.designSummary?.styleDiff).toBe(["+ Profile tab, opens Profile", "+ Coach tab (screen not built yet)", "- Messages tab"].join("\n"));
    expect(result.message).toBe("An ink dock. Coach doesn't have its screen yet; ask me to create it when you're ready.");
  });
  it("stops showing the bar on a screen whose tab was removed", async () => {
    const assigned = navigationSnapshotSchema.parse({ ...before, assignments: [{ ...before.assignments[0], navigationItemId: "health", chromePolicy: { chrome: "bottom-tabs", showPrimaryNavigation: true } }] });
    vi.mocked(readDesignTarget).mockResolvedValue({ revision: 3, ready: true, payload: assigned });
    const coach = { id: "coach", label: "Coach", icon: "message-square", role: "Coaching", linkedScreenName: null, availability: "planned" as const };
    vi.mocked(reviseNavigationDestinations).mockResolvedValue({ plan: { ...plan, items: [...plan.items.filter(item => item.id !== "health"), coach] }, notes: { title: null, summary: null } });
    const result = await executeNavigationEdit(client().db, { ...request, prompt: "swap the health tab for a coach tab", intent: "destinations" }, null, null);
    expect(redesignNavigation).not.toHaveBeenCalled();
    const saved = vi.mocked(persistDesignChange).mock.calls[0][2];
    expect(saved.label).toBe("Changed navigation tabs");
    expect((saved.payload as typeof before).assignments[0]).toMatchObject({ navigationItemId: null, chromePolicy: { chrome: "top-bar", showPrimaryNavigation: false } });
    expect(result.designSummary?.styleDiff).toBe(["+ Coach tab (screen not built yet)", "- Health tab"].join("\n"));
  });
  it("stops on a stale snapshot before any design generation or write", async () => {
    vi.mocked(readDesignTarget).mockResolvedValue({ revision: 4, ready: true, payload: before });
    await expect(executeNavigationEdit(client().db, request, null, null)).rejects.toThrow("changed");
    expect(redesignNavigation).not.toHaveBeenCalled();
    expect(persistDesignChange).not.toHaveBeenCalled();
  });
  it("does not report a conflicting save as successful", async () => {
    vi.mocked(persistDesignChange).mockResolvedValue({ status: "stale_revision" });
    await expect(executeNavigationEdit(client().db, request, null, null)).rejects.toThrow("changed");
  });
  it("creates one shared nav when none exists instead of rewriting the selected screen", async () => {
    vi.mocked(resolveNavigationMembership).mockResolvedValue({ items: plan.items, assignments: [{ screenId, itemId: "health" }] });
    vi.mocked(redesignNavigation).mockImplementation(async (_, next) => ({ plan: { ...next, design: plan.design }, notes: { title: null, summary: null } }));
    const { db, rpc } = client(null);
    await executeNavigationEdit(db, request, null, null);
    expect(rpc).toHaveBeenCalledWith("apply_navigation_repair", expect.objectContaining({ input_expected_revision: null }));
    expect(vi.mocked(redesignNavigation).mock.calls[0][2]).toBe("create");
    expect(persistDesignChange).not.toHaveBeenCalled();
  });
  it("keeps the existing selected-element path for small edits to legacy navigation", async () => {
    const legacy = { ...plan, version: 1 as const };
    vi.mocked(readDesignTarget).mockResolvedValue({ revision: 3, ready: true, payload: navigationSnapshotSchema.parse({ ...before, plan: legacy }) });
    vi.mocked(editLegacyNavigation).mockResolvedValue(before.shellCode.replace("Primary navigation", "App navigation"));
    await executeNavigationEdit(client({ plan: legacy, shell_code: before.shellCode, design_revision: 3 }).db,
      { ...request, prompt: "change the nav label color", selectedElementTarget: "navigation", selectedElementDrawgleId: "dg-nav-item" }, null, null);
    expect(editLegacyNavigation).toHaveBeenCalledWith(expect.objectContaining({ drawgleId: "dg-nav-item" }));
    expect(redesignNavigation).not.toHaveBeenCalled();
    expect(vi.mocked(persistDesignChange).mock.calls[0][2].payload).toMatchObject({ plan: { version: 1 }, shellCode: expect.stringContaining("App navigation") });
  });
});
