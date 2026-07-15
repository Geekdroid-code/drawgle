import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findExactPlannedStateCandidate, resolveScreenStateProposal } from "@/lib/agent/screen-state-proposal";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";

const roadmapRow = (patch: Partial<ProjectScreenRoadmapRow> & Pick<ProjectScreenRoadmapRow, "id" | "stable_key" | "name">): ProjectScreenRoadmapRow => {
  const { id, stable_key, name, ...overrides } = patch;
  return ({
  id,
  project_id: "project",
  owner_id: "owner",
  parent_item_id: null,
  generated_screen_id: null,
  stable_key,
  kind: "screen",
  screen_type: "root",
  name,
  description: `${name} description`,
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
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
  ...overrides,
});
};

const request = {
  targetScreenId: "screen-dashboard",
  parentScreenName: "Financial Dashboard / Digital Wallet",
  existingRoadmapItemId: "state-wallet",
  stateLabel: "Wallet Selection",
  stateRole: "overlay",
  triggerLabel: "All Wallets",
  description: "Shows available wallets.",
  editInstruction: "Preserve the dashboard and open the wallet selector.",
};

describe("screen state proposal resolution", () => {
  it("uses the roadmap row linked to the actual parent screen and reuses its planned state", () => {
    const parent = roadmapRow({
      id: "parent-ready",
      stable_key: "screen:financial-dashboard",
      name: "Financial Dashboard",
      status: "ready",
      generated_screen_id: "screen-dashboard",
    });
    const orphanAlias = roadmapRow({
      id: "parent-alias",
      stable_key: "screen:financial-dashboard-digital-wallet",
      name: "Financial Dashboard / Digital Wallet",
    });
    const state = roadmapRow({
      id: "state-wallet",
      stable_key: "screen:financial-dashboard:state:wallet-selection",
      name: "Financial Dashboard - Wallet Selection",
      kind: "state",
      screen_type: null,
      parent_item_id: parent.id,
      state_key: "wallet-selection",
      state_label: "Wallet Selection",
      state_role: "overlay",
      trigger_label: "All Wallets",
      metadata: { editInstruction: "Open the existing wallet selection overlay." },
    });

    const resolved = resolveScreenStateProposal({
      request,
      screens: [{ id: "screen-dashboard", name: "Financial Dashboard", status: "ready", roadmap_item_id: parent.id }],
      roadmapRows: [orphanAlias, parent, state],
    });

    expect(resolved.parentRoadmapItem.id).toBe(parent.id);
    expect(resolved.existingStateItem?.id).toBe(state.id);
    expect(resolved.state.editInstruction).toBe("Open the existing wallet selection overlay.");
  });

  it("rejects a state id that belongs to another parent", () => {
    const parent = roadmapRow({ id: "parent-ready", stable_key: "screen:dashboard", name: "Dashboard", status: "ready", generated_screen_id: "screen-dashboard" });
    const otherParent = roadmapRow({ id: "other-parent", stable_key: "screen:other", name: "Other", status: "ready", generated_screen_id: "screen-other" });
    const otherState = roadmapRow({ id: "state-wallet", stable_key: "screen:other:state:wallet", name: "Other - Wallet", kind: "state", parent_item_id: otherParent.id });

    expect(() => resolveScreenStateProposal({
      request,
      screens: [{ id: "screen-dashboard", name: "Dashboard", status: "ready", roadmap_item_id: parent.id }],
      roadmapRows: [parent, otherParent, otherState],
    })).toThrow("does not belong");
  });

  it("recovers an exact planned state when the router incorrectly calls it a new screen", () => {
    const parent = roadmapRow({ id: "parent-ready", stable_key: "screen:dashboard", name: "Dashboard", status: "ready", generated_screen_id: "screen-dashboard" });
    const walletState = roadmapRow({
      id: "wallet-state",
      stable_key: "screen:dashboard:state:wallet-selection",
      name: "Dashboard - Wallet Selection",
      kind: "state",
      parent_item_id: parent.id,
      state_key: "wallet-selection",
      state_label: "Wallet Selection",
    });

    expect(findExactPlannedStateCandidate({
      prompt: "I would go with Wallet Selection state first for this main dashboard screen.",
      targetScreenId: "screen-dashboard",
      roadmapRows: [parent, walletState],
    })?.state.id).toBe(walletState.id);
  });
});
