import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildProjectRoadmap, screenRoadmapKey, selectRoadmapBuildRecommendation, stateRoadmapKey } from "@/lib/generation/project-roadmap";
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
  metadata: {},
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
  ...patch,
});

describe("project roadmap", () => {
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

  it("selects at most five parents and eight total outputs for the next tranche", () => {
    const parents = Array.from({ length: 6 }, (_, index) => roadmapRow({
      id: `parent-${index}`,
      stable_key: `screen:parent-${index}`,
      name: `Parent ${index + 1}`,
      priority: "core",
      sequence: index,
    }));
    const recommendation = selectRoadmapBuildRecommendation(parents);

    expect(recommendation?.kind).toBe("parent_batch");
    expect(recommendation?.plannedScreens).toHaveLength(5);
    expect(recommendation?.outputCount).toBe(5);
    expect(recommendation?.estimatedCredits).toBe(100);
    expect(recommendation?.remainingCount).toBe(6);
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
    expect(recommendation?.parentScreenId).toBe("screen-ready");
    expect(recommendation?.roadmapItemIds).toEqual([child.id]);
    expect(recommendation?.plannedScreens[0].stateVariants?.[0].stateKey).toBe("delete");
  });
});
