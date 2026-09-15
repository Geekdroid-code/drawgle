import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { bindApprovedScreenPlans } from "./screen-plan-contract";
import { reusableProductOutputs } from "./retry-outputs";
import { designerFixture, functionalFixture } from "./test-fixtures";
import type { PlanningStore } from "./store";
import type { FunctionalItem } from "./functional-plan";

const stateItem = (parent: string, index: number): FunctionalItem => ({
  ...functionalFixture(`state:${parent}:empty`, `${parent} empty`, index), kind: "state",
  parentStableKey: `screen:${parent}`, stateKey: "empty", referenceScreenIndex: index,
});

function failedOutputs(items: FunctionalItem[]): PlanningStore {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    project_screen_roadmap: items.map(item => ({ id: item.stableKey, stable_key: item.stableKey })),
    screens: items.map(item => ({ id: `failed:${item.stableKey}`, roadmap_item_id: item.stableKey })),
  };
  return { from: (table: string) => {
    const query = { select: () => query, eq: () => query, in: () => query, order: () => query,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: tables[table], error: null }).then(resolve) };
    return query;
  } } as unknown as PlanningStore;
}

describe("approved output identity through execution and retry", () => {
  it("keeps two legacy states with the same short key distinct, even with stale style reference indices", async () => {
    const items = [stateItem("today", 1), stateItem("history", 2)];
    const retry = await reusableProductOutputs(failedOutputs(items), "project", "owner", items, false);
    expect(retry.reuseScreenIdsByName).toEqual({});
    expect(retry.reuseStateVariantIdsByKey).toEqual({
      "state:today:empty": "failed:state:today:empty", "state:history:empty": "failed:state:history:empty",
    });
  });
  it("retries supplied recreation state frames in the image-aware screen builder", async () => {
    const items = [stateItem("payment", 2)];
    const retry = await reusableProductOutputs(failedOutputs(items), "project", "owner", items, true);
    expect(retry.reuseStateVariantIdsByKey).toEqual({});
    expect(retry.reuseScreenIdsByName).toEqual({ "payment empty": "failed:state:payment:empty" });
  });
  it("binds supplied frame 2 independently of returned order and rejects changed identities or missing evidence", () => {
    const state = designerFixture();
    state.input.imageReferenceMode = "recreate";
    state.scope!.manifest = [{ ...functionalFixture("screen:payment", "Payment", 0), referenceScreenIndex: 1 }, stateItem("payment", 2)];
    const screens = [{ name: "payment empty", type: "detail" as const, description: "Floating payment pills" },
      { name: "Payment", type: "root" as const, description: "Wallet" }];
    const bound = bindApprovedScreenPlans(state, undefined, screens, 2);
    expect(bound.map(screen => [screen.roadmapStableKey, screen.referenceScreenIndex])).toEqual([
      ["screen:payment", 1], ["state:payment:empty", 2],
    ]);
    expect(bound.every(screen => screen.stateVariants.length === 0)).toBe(true);
    expect(() => bindApprovedScreenPlans(state, undefined, screens.slice(0, 1), 2)).toThrow(/identities/);
    expect(() => bindApprovedScreenPlans(state, undefined, screens, 1)).toThrow(/observed/);
  });
});
