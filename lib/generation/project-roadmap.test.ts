import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildRoadmapSelectionScopeContract,
  PROJECT_ROADMAP_UPSERT_OPTIONS,
  buildProjectRoadmap,
  buildProjectRoadmapUpsertRows,
  canonicalizeRoadmapItems,
  screenRoadmapKey,
  selectRoadmapBuildRecommendation,
  resolveRoadmapBuildSelection,
  stateRoadmapKey,
} from "@/lib/generation/project-roadmap";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import type { ProjectRoadmapItem, ScreenPlan } from "@/lib/types";

const screen = (name: string, index: number): ScreenPlan => ({
  name,
  type: index === 0 ? "root" : "detail",
  description: `${name} product surface`,
  roadmapStableKey: screenRoadmapKey(name),
});

const roadmapRow = (patch: Partial<ProjectScreenRoadmapRow> & Pick<ProjectScreenRoadmapRow, "id" | "stable_key" | "name">): ProjectScreenRoadmapRow => ({
  project_id: "project",
  owner_id: "owner",
  parent_item_id: null,
  generated_screen_id: null,
  kind: "screen",
  screen_type: "root",
  description: `${patch.name} description`,
  priority: "recommended",
  status: "planned",
  source: "planner",
  explicitly_requested: false,
  sequence: 0,
  tranche: 1,
  dependency_keys: [],
  state_key: null,
  state_label: null,
  state_role: null,
  trigger_label: null,
  identity_fingerprint: null,
  identity_exception: false,
  metadata: {},
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
  ...patch,
});

describe("project roadmap", () => {
  it("lets PostgreSQL generate IDs for new roadmap rows", () => {
    const item: ProjectRoadmapItem = {
      stableKey: "screen:booking-home",
      kind: "screen",
      screenType: "root",
      name: "Booking Home",
      description: "Taxi booking home",
      priority: "core",
      status: "planned",
      source: "prompt",
      explicitlyRequested: true,
      sequence: 0,
      tranche: 1,
      dependencyKeys: [],
    };
    const [row] = buildProjectRoadmapUpsertRows({
      items: [item],
      projectId: "project",
      ownerId: "owner",
      existingByKey: new Map(),
      updatedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(Object.prototype.hasOwnProperty.call(row, "id")).toBe(false);
    expect(PROJECT_ROADMAP_UPSERT_OPTIONS).toEqual({
      onConflict: "project_id,stable_key",
      defaultToNull: false,
    });
  });

  it("retains existing IDs and links child rows to persisted parents", () => {
    const parentKey = "screen:booking-home";
    const childKey = `${parentKey}:state:pickup-confirmation`;
    const existingParent = roadmapRow({ id: "parent-id", stable_key: parentKey, name: "Booking Home", status: "ready" });
    const child: ProjectRoadmapItem = {
      stableKey: childKey,
      parentStableKey: parentKey,
      kind: "state",
      name: "Booking Home - Pickup Confirmation",
      description: "Pickup confirmation state",
      priority: "required",
      status: "planned",
      source: "planner",
      explicitlyRequested: false,
      sequence: 1,
      tranche: 1,
      dependencyKeys: [parentKey],
      stateKey: "pickup-confirmation",
    };
    const [parentRow] = buildProjectRoadmapUpsertRows({
      items: [{
        stableKey: parentKey,
        kind: "screen",
        screenType: "root",
        name: "Booking Home",
        description: "Taxi booking home",
        priority: "core",
        status: "planned",
        source: "prompt",
        explicitlyRequested: true,
        sequence: 0,
        tranche: 1,
        dependencyKeys: [],
      }],
      projectId: "project",
      ownerId: "owner",
      existingByKey: new Map([[parentKey, existingParent]]),
    });
    const [childRow] = buildProjectRoadmapUpsertRows({
      items: [child],
      projectId: "project",
      ownerId: "owner",
      existingByKey: new Map(),
      parentIds: new Map([[parentKey, "parent-id"]]),
    });

    expect(parentRow).toMatchObject({ id: "parent-id", status: "ready" });
    expect(childRow.parent_item_id).toBe("parent-id");
    expect(Object.prototype.hasOwnProperty.call(childRow, "id")).toBe(false);
  });

  it("keeps the broader app roadmap while the detailed build batch stays at five parents", () => {
    const names = ["Home", "Search", "Saved", "Profile", "Settings", "Notifications", "Billing"];
    const plannedItems: ProjectRoadmapItem[] = names.map((name, index) => ({
      stableKey: screenRoadmapKey(name),
      kind: "screen",
      screenType: index === 0 ? "root" : "detail",
      name,
      description: `${name} product surface`,
      priority: index < 5 ? "core" : "recommended",
      status: "planned",
      source: "planner",
      explicitlyRequested: false,
      sequence: index,
      tranche: 1,
      dependencyKeys: [],
    }));

    const roadmap = buildProjectRoadmap({
      screens: names.slice(0, 5).map(screen),
      plannedItems,
      requestedParentCount: 7,
    });

    expect(roadmap.items.filter((item) => item.kind === "screen")).toHaveLength(7);
    expect(roadmap.plannedParentCount).toBe(7);
    expect(roadmap.remainingUnplannedCount).toBe(0);
  });

  it("links child states to their parent without counting them as parent screens", () => {
    const parentKey = screenRoadmapKey("Task Detail");
    const roadmap = buildProjectRoadmap({
      screens: [{
        ...screen("Task Detail", 0),
        stateVariants: [{
          id: "delete-confirmation",
          stateKey: "delete-confirmation",
          stateLabel: "Delete Confirmation",
          stateRole: "modal",
          triggerLabel: "Delete",
          description: "A destructive confirmation state.",
          editInstruction: "Open the delete confirmation modal.",
          defaultSelected: true,
        }],
      }],
      requestedParentCount: 1,
    });

    expect(roadmap.plannedParentCount).toBe(1);
    expect(roadmap.items).toHaveLength(2);
    expect(roadmap.items[1]).toMatchObject({
      kind: "state",
      parentStableKey: parentKey,
      stableKey: stateRoadmapKey(parentKey, "delete-confirmation"),
      dependencyKeys: [parentKey],
    });
  });

  it("suggests at most three parent screens without bundling plans or credits", () => {
    const parents = Array.from({ length: 6 }, (_, index) => roadmapRow({
      id: `parent-${index}`,
      stable_key: `screen:parent-${index}`,
      name: `Parent ${index + 1}`,
      priority: "core",
      sequence: index,
    }));
    const recommendation = selectRoadmapBuildRecommendation(parents);

    expect(recommendation?.kind).toBe("parent_batch");
    expect(recommendation?.items).toHaveLength(3);
    expect(recommendation?.items.map((item) => item.roadmapItemId)).toEqual(["parent-0", "parent-1", "parent-2"]);
    expect(recommendation).not.toHaveProperty("plannedScreens");
    expect(recommendation).not.toHaveProperty("estimatedCredits");
  });

  it("prioritizes an explicit child state once its parent is ready", () => {
    const parent = roadmapRow({
      id: "parent-ready",
      stable_key: "screen:task-detail",
      name: "Task Detail",
      status: "ready",
      generated_screen_id: "screen-ready",
    });
    const child = roadmapRow({
      id: "state-delete",
      stable_key: "screen:task-detail:state:delete",
      name: "Task Detail - Delete",
      kind: "state",
      screen_type: null,
      parent_item_id: parent.id,
      priority: "required",
      explicitly_requested: true,
      dependency_keys: [parent.stable_key],
      state_key: "delete",
      state_label: "Delete Confirmation",
      state_role: "modal",
      trigger_label: "Delete",
      metadata: { editInstruction: "Open the delete confirmation modal." },
    });
    const futureParent = roadmapRow({
      id: "parent-future",
      stable_key: "screen:settings",
      name: "Settings",
      priority: "recommended",
      sequence: 2,
    });
    const recommendation = selectRoadmapBuildRecommendation([parent, child, futureParent]);

    expect(recommendation?.kind).toBe("state_batch");
    expect(recommendation?.items.map((item) => item.roadmapItemId)).toEqual([child.id]);
    expect(recommendation?.items[0]).toMatchObject({
      kind: "state",
      name: "Delete Confirmation",
      parentName: "Task Detail",
    });
  });

  it("keeps an existing canonical stable key when a planner returns the same visible screen under a new key", () => {
    const canonical = roadmapRow({
      id: "dashboard-roadmap",
      stable_key: "screen:financial-dashboard",
      name: "Financial Dashboard",
      status: "ready",
      generated_screen_id: "dashboard-screen",
    });
    const incoming: ProjectRoadmapItem = {
      stableKey: "screen:financial-dashboard-digital-wallet",
      kind: "screen",
      screenType: "root",
      name: "Financial Dashboard",
      description: "Updated dashboard brief",
      priority: "core",
      status: "planned",
      source: "planner",
      explicitlyRequested: false,
      sequence: 0,
      tranche: 2,
      dependencyKeys: [],
    };

    const orphanAlias = roadmapRow({
      id: "dashboard-alias",
      stable_key: incoming.stableKey,
      name: "Financial Dashboard",
      status: "planned",
    });

    expect(canonicalizeRoadmapItems([incoming], [orphanAlias, canonical])[0].stableKey).toBe(canonical.stable_key);
  });

  it("deduplicates same-name parents inside a newly compiled roadmap", () => {
    const roadmap = buildProjectRoadmap({
      plannedItems: [{
        stableKey: "screen:financial-dashboard",
        kind: "screen",
        screenType: "root",
        name: "Financial Dashboard",
        description: "Existing dashboard",
        priority: "core",
        status: "ready",
        source: "existing",
        explicitlyRequested: true,
        sequence: 0,
        tranche: 1,
        dependencyKeys: [],
      }],
      screens: [{
        name: "Financial Dashboard",
        type: "root",
        description: "New planner wording",
        roadmapStableKey: "screen:financial-dashboard-digital-wallet",
      }],
    });

    expect(roadmap.items.filter((item) => item.kind === "screen")).toHaveLength(1);
    expect(roadmap.items[0].stableKey).toBe("screen:financial-dashboard");
  });

  it("ranks screens that directly follow the latest completed screen first", () => {
    const home = roadmapRow({ id: "home", stable_key: "screen:home", name: "Home", status: "ready" });
    const profile = roadmapRow({ id: "profile", stable_key: "screen:profile", name: "Profile", priority: "core", sequence: 1 });
    const checkout = roadmapRow({
      id: "checkout",
      stable_key: "screen:checkout",
      name: "Checkout",
      priority: "recommended",
      sequence: 8,
      dependency_keys: [home.stable_key],
    });

    const recommendation = selectRoadmapBuildRecommendation([home, profile, checkout], [home.id]);
    expect(recommendation?.items[0].roadmapItemId).toBe(checkout.id);
  });

  it("rehydrates only the selected parent screens from current roadmap rows", () => {
    const cart = roadmapRow({ id: "cart", stable_key: "screen:cart", name: "Cart" });
    const checkout = roadmapRow({ id: "checkout", stable_key: "screen:checkout", name: "Checkout" });
    const selection = resolveRoadmapBuildSelection({
      rows: [cart, checkout],
      kind: "parent_batch",
      roadmapItemIds: [checkout.id],
    });

    expect(selection.plannedScreens).toHaveLength(1);
    expect(selection.plannedScreens[0]).toMatchObject({ name: "Checkout", roadmapItemId: checkout.id });
    expect(selection).toMatchObject({ parentScreenCount: 1, outputCount: 1, outputNames: ["Checkout"] });
  });

  it("turns persisted state selections into a confirmation-free authoritative scope", () => {
    const parent = roadmapRow({ id: "parent", stable_key: "screen:home", name: "Home", status: "ready", generated_screen_id: "screen-home" });
    const firstState = roadmapRow({ id: "state-a", stable_key: "screen:home:state:a", name: "Pet Selector", state_label: "Pet Selector", kind: "state", parent_item_id: parent.id, dependency_keys: [parent.stable_key] });
    const secondState = roadmapRow({ id: "state-b", stable_key: "screen:home:state:b", name: "Visit Confirmation", state_label: "Visit Confirmation", kind: "state", parent_item_id: parent.id, dependency_keys: [parent.stable_key] });
    const selection = resolveRoadmapBuildSelection({
      rows: [parent, firstState, secondState],
      kind: "state_batch",
      roadmapItemIds: [firstState.id, secondState.id],
    });
    const scope = buildRoadmapSelectionScopeContract({
      kind: "state_batch",
      selection,
      referenceMode: "user_style",
    });

    expect(selection).toMatchObject({ parentScreenCount: 1, outputCount: 2, outputNames: ["Pet Selector", "Visit Confirmation"] });
    expect(scope).toMatchObject({
      countSource: "planning_mode",
      finalScreenCount: 1,
      requiresConfirmation: false,
      confidence: "high",
    });
    expect(scope.diagnostics.join(" ")).toContain("Persisted roadmap IDs are authoritative");
  });

  it("rejects stale selections and states from different parents", () => {
    const firstParent = roadmapRow({ id: "parent-a", stable_key: "screen:a", name: "First", status: "ready", generated_screen_id: "screen-a" });
    const secondParent = roadmapRow({ id: "parent-b", stable_key: "screen:b", name: "Second", status: "ready", generated_screen_id: "screen-b" });
    const firstState = roadmapRow({ id: "state-a", stable_key: "screen:a:state:x", name: "First State", kind: "state", parent_item_id: firstParent.id, dependency_keys: [firstParent.stable_key] });
    const secondState = roadmapRow({ id: "state-b", stable_key: "screen:b:state:y", name: "Second State", kind: "state", parent_item_id: secondParent.id, dependency_keys: [secondParent.stable_key] });

    expect(() => resolveRoadmapBuildSelection({
      rows: [firstParent, secondParent, firstState, secondState],
      kind: "state_batch",
      roadmapItemIds: [firstState.id, secondState.id],
    })).toThrow("same parent");

    expect(() => resolveRoadmapBuildSelection({
      rows: [{ ...firstState, status: "ready" }, firstParent],
      kind: "state_batch",
      roadmapItemIds: [firstState.id],
    })).toThrow("stale");
  });
});
