import "server-only";

import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import { roadmapIdentityFingerprint, roadmapSlug, stateRoadmapKey } from "@/lib/generation/project-roadmap";

export type StateProposalScreen = {
  id: string;
  name: string;
  status?: string | null;
  roadmap_item_id?: string | null;
};

export type ScreenStateProposalRequest = {
  targetScreenId?: string | null;
  parentScreenName?: string | null;
  existingRoadmapItemId?: string | null;
  stateLabel: string;
  stateRole: string;
  triggerLabel: string;
  description: string;
  editInstruction: string;
};

export type ResolvedScreenStateProposal = {
  parentScreen: StateProposalScreen;
  parentRoadmapItem: ProjectScreenRoadmapRow;
  existingStateItem: ProjectScreenRoadmapRow | null;
  state: {
    stateKey: string;
    stateLabel: string;
    stateRole: string;
    triggerLabel: string;
    description: string;
    editInstruction: string;
  };
};

const sameIdentity = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && roadmapIdentityFingerprint(left) === roadmapIdentityFingerprint(right));

export function resolveScreenStateProposal({
  request,
  screens,
  roadmapRows,
}: {
  request: ScreenStateProposalRequest;
  screens: StateProposalScreen[];
  roadmapRows: ProjectScreenRoadmapRow[];
}): ResolvedScreenStateProposal {
  const directScreen = request.targetScreenId
    ? screens.find((screen) => screen.id === request.targetScreenId)
    : null;
  const namedScreens = request.parentScreenName
    ? screens.filter((screen) => sameIdentity(screen.name, request.parentScreenName))
    : [];
  const parentScreen = directScreen ?? (namedScreens.length === 1 ? namedScreens[0] : null);

  if (!parentScreen) {
    throw new Error(namedScreens.length > 1
      ? "More than one screen matches that parent. Select the exact screen and try again."
      : "The parent screen could not be resolved to an existing canvas screen.");
  }
  if (parentScreen.status && parentScreen.status !== "ready") {
    throw new Error("The parent screen must finish building before a state can be created from it.");
  }

  const parentRoadmapCandidates = roadmapRows.filter((row) =>
    row.kind === "screen" && (
      row.id === parentScreen.roadmap_item_id ||
      row.generated_screen_id === parentScreen.id
    )
  );
  const parentRoadmapItem = parentRoadmapCandidates.find((row) => row.generated_screen_id === parentScreen.id)
    ?? parentRoadmapCandidates[0]
    ?? null;
  if (!parentRoadmapItem) {
    throw new Error("The parent screen is not linked to the project roadmap yet. Refresh the project and try again.");
  }
  if (parentRoadmapItem.status !== "ready" || parentRoadmapItem.generated_screen_id !== parentScreen.id) {
    throw new Error("The parent roadmap entry is stale and cannot safely create a state.");
  }

  const requestedState = request.existingRoadmapItemId
    ? roadmapRows.find((row) => row.id === request.existingRoadmapItemId) ?? null
    : null;
  if (requestedState && (requestedState.kind !== "state" || requestedState.parent_item_id !== parentRoadmapItem.id)) {
    throw new Error("The selected state does not belong to the resolved parent screen.");
  }

  const normalizedStateKey = roadmapSlug(requestedState?.state_key ?? request.stateLabel, "state");
  const matchingStates = roadmapRows.filter((row) =>
    row.kind === "state" &&
    row.parent_item_id === parentRoadmapItem.id &&
    (sameIdentity(row.state_key, normalizedStateKey) || sameIdentity(row.state_label, request.stateLabel))
  );
  const existingStateItem = requestedState ?? (matchingStates.length === 1 ? matchingStates[0] : null);
  if (matchingStates.length > 1 && !requestedState) {
    throw new Error("This parent has multiple roadmap states with the same identity. Repair the roadmap before building it.");
  }
  if (existingStateItem?.status === "ready" || existingStateItem?.generated_screen_id) {
    throw new Error("That state already exists on the canvas.");
  }

  const metadata = existingStateItem?.metadata && typeof existingStateItem.metadata === "object" && !Array.isArray(existingStateItem.metadata)
    ? existingStateItem.metadata as Record<string, unknown>
    : {};
  const existingInstruction = typeof metadata.editInstruction === "string" && metadata.editInstruction.trim()
    ? metadata.editInstruction.trim()
    : null;

  return {
    parentScreen,
    parentRoadmapItem,
    existingStateItem,
    state: {
      stateKey: existingStateItem?.state_key ?? normalizedStateKey,
      stateLabel: existingStateItem?.state_label ?? request.stateLabel,
      stateRole: existingStateItem?.state_role ?? request.stateRole,
      triggerLabel: existingStateItem?.trigger_label ?? request.triggerLabel,
      description: existingStateItem?.description ?? request.description,
      editInstruction: existingInstruction ?? request.editInstruction,
    },
  };
}

export function newStateRoadmapStableKey(parentStableKey: string, stateKey: string) {
  return stateRoadmapKey(parentStableKey, stateKey);
}

export function findExactPlannedStateCandidate({
  prompt,
  targetScreenId,
  roadmapRows,
}: {
  prompt: string;
  targetScreenId?: string | null;
  roadmapRows: ProjectScreenRoadmapRow[];
}): { parent: ProjectScreenRoadmapRow; state: ProjectScreenRoadmapRow } | null {
  const promptIdentity = roadmapIdentityFingerprint(prompt);
  const parentById = new Map(roadmapRows.filter((row) => row.kind === "screen").map((row) => [row.id, row]));
  const candidates = roadmapRows
    .filter((row) => row.kind === "state" && (row.status === "planned" || row.status === "failed") && row.parent_item_id)
    .map((state) => ({ state, parent: parentById.get(state.parent_item_id!) ?? null }))
    .filter((entry): entry is { state: ProjectScreenRoadmapRow; parent: ProjectScreenRoadmapRow } => Boolean(
      entry.parent?.generated_screen_id &&
      entry.parent.status === "ready" &&
      (!targetScreenId || entry.parent.generated_screen_id === targetScreenId),
    ))
    .filter(({ state }) => {
      const stateIdentity = roadmapIdentityFingerprint(state.state_label ?? state.state_key ?? state.name);
      return stateIdentity.length >= 4 && promptIdentity.includes(stateIdentity);
    })
    .sort((left, right) =>
      roadmapIdentityFingerprint(right.state.state_label ?? right.state.name).length -
      roadmapIdentityFingerprint(left.state.state_label ?? left.state.name).length
    );

  if (candidates.length === 0) return null;
  const bestLength = roadmapIdentityFingerprint(candidates[0].state.state_label ?? candidates[0].state.name).length;
  const equallySpecific = candidates.filter((candidate) =>
    roadmapIdentityFingerprint(candidate.state.state_label ?? candidate.state.name).length === bestLength
  );
  return equallySpecific.length === 1 ? candidates[0] : null;
}
