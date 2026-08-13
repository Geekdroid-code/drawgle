import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database, ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import type {
  GenerationScopeContract,
  NavigationPlan,
  ProjectRoadmap,
  RoadmapBuildRecommendation,
  ProjectRoadmapItem,
  ScreenPlan,
  ScreenStateVariantPlan,
  ReferenceMode,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type ProjectScreenRoadmapInsert = Database["public"]["Tables"]["project_screen_roadmap"]["Insert"];
type ExistingRoadmapItem = Pick<ProjectScreenRoadmapRow, "id" | "stable_key" | "parent_item_id" | "generated_screen_id" | "status" | "kind" | "name" | "state_key" | "state_label">;

export const PROJECT_ROADMAP_UPSERT_OPTIONS = {
  onConflict: "project_id,stable_key",
  defaultToNull: false,
} as const;

const priorityRank = {
  required: 0,
  core: 1,
  recommended: 2,
  optional: 3,
} as const;

const roadmapStatusRank: Record<ProjectRoadmapItem["status"], number> = {
  ready: 0,
  building: 1,
  queued: 2,
  planned: 3,
  failed: 4,
  dismissed: 5,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const roadmapSlug = (value: string, fallback = "screen") => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
};

export const roadmapIdentityFingerprint = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

export const screenRoadmapKey = (name: string) => `screen:${roadmapSlug(name)}`;

export const stateRoadmapKey = (parentKey: string, stateKey: string) =>
  `${parentKey}:state:${roadmapSlug(stateKey, "state")}`;

const roadmapStateItem = (
  parent: ProjectRoadmapItem,
  variant: ScreenStateVariantPlan,
  sequence: number,
): ProjectRoadmapItem => ({
  stableKey: variant.roadmapStableKey ?? stateRoadmapKey(parent.stableKey, variant.stateKey),
  parentStableKey: parent.stableKey,
  kind: "state",
  name: `${parent.name} - ${variant.stateLabel}`,
  description: variant.description,
  priority: variant.explicitlyRequested ? "required" : "recommended",
  status: "planned",
  source: variant.explicitlyRequested ? "prompt" : "planner",
  explicitlyRequested: Boolean(variant.explicitlyRequested),
  sequence,
  tranche: parent.tranche,
  dependencyKeys: [parent.stableKey],
  stateKey: variant.stateKey,
  stateLabel: variant.stateLabel,
  stateRole: variant.stateRole,
  triggerLabel: variant.triggerLabel,
  metadata: { editInstruction: variant.editInstruction, defaultSelected: variant.defaultSelected },
});

export function buildProjectRoadmap({
  screens,
  navigationPlan,
  requestedParentCount,
  tranche = 1,
  plannedItems = [],
}: {
  screens: ScreenPlan[];
  navigationPlan?: NavigationPlan | null;
  requestedParentCount?: number | null;
  tranche?: number;
  plannedItems?: ProjectRoadmapItem[];
}): ProjectRoadmap {
  const items: ProjectRoadmapItem[] = plannedItems.map((item) => ({ ...item }));
  const seen = new Set(items.map((item) => item.stableKey));

  screens.forEach((screen, index) => {
    const proposedStableKey = screen.roadmapStableKey ?? screenRoadmapKey(screen.name);
    const existingIndex = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => item.kind === "screen" && (
        item.stableKey === proposedStableKey || roadmapIdentityFingerprint(item.name) === roadmapIdentityFingerprint(screen.name)
      ))
      .sort((left, right) =>
        Number(Boolean(right.item.generatedScreenId)) - Number(Boolean(left.item.generatedScreenId))
        || Number(right.item.stableKey === proposedStableKey) - Number(left.item.stableKey === proposedStableKey)
        || roadmapStatusRank[left.item.status] - roadmapStatusRank[right.item.status]
        || left.item.sequence - right.item.sequence
      )[0]?.itemIndex ?? -1;
    const existing = existingIndex >= 0 ? items[existingIndex] : null;
    const stableKey = existing?.stableKey ?? proposedStableKey;
    const parent: ProjectRoadmapItem = {
      stableKey,
      kind: "screen",
      screenType: screen.type,
      name: screen.name,
      description: screen.description,
      priority: screen.roadmapPriority ?? existing?.priority ?? (index < 5 ? "core" : "recommended"),
      status: existing?.status ?? "planned",
      source: screen.explicitlyRequested ? "prompt" : existing?.source ?? "planner",
      explicitlyRequested: Boolean(screen.explicitlyRequested ?? existing?.explicitlyRequested),
      sequence: existing?.sequence ?? index,
      tranche: existing?.tranche ?? tranche,
      dependencyKeys: existing?.dependencyKeys ?? [],
      metadata: {
        ...(existing?.metadata ?? {}),
        chromePolicy: screen.chromePolicy ? {
          chrome: screen.chromePolicy.chrome,
          showPrimaryNavigation: screen.chromePolicy.showPrimaryNavigation,
          showsBackButton: screen.chromePolicy.showsBackButton,
        } : null,
        navigationItemId: screen.navigationItemId ?? null,
      },
    };
    if (existingIndex >= 0) items[existingIndex] = parent;
    else {
      seen.add(stableKey);
      items.push(parent);
    }
    for (const variant of screen.stateVariants ?? []) {
      const proposedChild = roadmapStateItem(parent, variant, items.length);
      const existingChildIndex = items.findIndex((item) =>
        item.kind === "state" &&
        item.parentStableKey === parent.stableKey &&
        roadmapIdentityFingerprint(item.stateKey ?? item.stateLabel ?? item.name) === roadmapIdentityFingerprint(variant.stateKey || variant.stateLabel)
      );
      const child = existingChildIndex >= 0
        ? { ...proposedChild, stableKey: items[existingChildIndex].stableKey, sequence: items[existingChildIndex].sequence }
        : proposedChild;
      if (existingChildIndex >= 0) items[existingChildIndex] = child;
      else if (!seen.has(child.stableKey)) {
        seen.add(child.stableKey);
        items.push(child);
      }
    }
  });

  for (const navigationItem of navigationPlan?.items ?? []) {
    const linkedName = navigationItem.linkedScreenName?.trim();
    const name = linkedName || navigationItem.label;
    const stableKey = screenRoadmapKey(name);
    if (seen.has(stableKey) || items.some((item) => item.kind === "screen" && roadmapIdentityFingerprint(item.name) === roadmapIdentityFingerprint(name))) continue;
    seen.add(stableKey);
    items.push({
      stableKey,
      kind: "screen",
      screenType: "root",
      name,
      description: navigationItem.role,
      priority: "recommended",
      status: "planned",
      source: "navigation",
      explicitlyRequested: false,
      sequence: items.filter((item) => item.kind === "screen").length,
      tranche,
      dependencyKeys: [],
      metadata: { navigationItemId: navigationItem.id },
    });
  }

  const plannedParentCount = items.filter((item) => item.kind === "screen").length;
  const requested = requestedParentCount ?? plannedParentCount;
  return {
    version: 1,
    requestedParentCount: requestedParentCount ?? null,
    plannedParentCount,
    remainingUnplannedCount: Math.max(0, requested - plannedParentCount),
    tranche,
    items,
  };
}

export function buildProjectRoadmapUpsertRows({
  items,
  projectId,
  ownerId,
  existingByKey,
  parentIds,
  updatedAt = new Date().toISOString(),
}: {
  items: ProjectRoadmapItem[];
  projectId: string;
  ownerId: string;
  existingByKey: Map<string, ExistingRoadmapItem>;
  parentIds?: Map<string, string>;
  updatedAt?: string;
}): ProjectScreenRoadmapInsert[] {
  return items.map((item) => {
    const current = existingByKey.get(item.stableKey);
    const row: ProjectScreenRoadmapInsert = {
      project_id: projectId,
      owner_id: ownerId,
      parent_item_id: item.parentStableKey ? parentIds?.get(item.parentStableKey) ?? null : null,
      generated_screen_id: current?.generated_screen_id ?? item.generatedScreenId ?? null,
      stable_key: item.stableKey,
      kind: item.kind,
      screen_type: item.screenType ?? null,
      name: item.name,
      description: item.description,
      priority: item.priority,
      status: current && ["ready", "queued", "building"].includes(current.status)
        ? current.status
        : item.status,
      source: item.source,
      explicitly_requested: item.explicitlyRequested,
      sequence: item.sequence,
      tranche: item.tranche,
      dependency_keys: item.dependencyKeys,
      state_key: item.stateKey ?? null,
      state_label: item.stateLabel ?? null,
      state_role: item.stateRole ?? null,
      trigger_label: item.triggerLabel ?? null,
      metadata: (item.metadata ?? {}) as never,
      updated_at: updatedAt,
    };
    const persistedId = current?.id ?? (typeof item.id === "string" && item.id.trim() ? item.id : null);
    return persistedId ? { ...row, id: persistedId } : row;
  });
}

export function canonicalizeRoadmapItems(
  items: ProjectRoadmapItem[],
  existingItems: ExistingRoadmapItem[],
): ProjectRoadmapItem[] {
  const existingByKey = new Map(existingItems.map((item) => [item.stable_key, item]));
  const existingParentByIdentity = new Map<string, ExistingRoadmapItem>();
  for (const item of existingItems) {
    if (item.kind !== "screen") continue;
    const identity = roadmapIdentityFingerprint(item.name);
    const current = existingParentByIdentity.get(identity);
    const itemIsBetter = !current
      || (Boolean(item.generated_screen_id) && !current.generated_screen_id)
      || (Boolean(item.generated_screen_id) === Boolean(current.generated_screen_id)
        && roadmapStatusRank[item.status] < roadmapStatusRank[current.status]);
    if (itemIsBetter) existingParentByIdentity.set(identity, item);
  }

  const aliases = new Map<string, string>();
  const canonicalParents = items.filter((item) => item.kind === "screen").map((item) => {
    const exact = existingByKey.get(item.stableKey);
    const identityMatch = existingParentByIdentity.get(roadmapIdentityFingerprint(item.name));
    const existing = identityMatch?.generated_screen_id && !exact?.generated_screen_id
      ? identityMatch
      : exact ?? identityMatch;
    const stableKey = existing?.stable_key ?? item.stableKey;
    aliases.set(item.stableKey, stableKey);
    return { ...item, stableKey };
  });
  const parentIdByStableKey = new Map(existingItems
    .filter((item) => item.kind === "screen")
    .map((item) => [item.stable_key, item.id]));
  const existingStateByIdentity = new Map<string, ExistingRoadmapItem>();
  for (const item of existingItems) {
    if (item.kind !== "state" || !item.parent_item_id) continue;
    const identity = roadmapIdentityFingerprint(item.state_key ?? item.state_label ?? item.name);
    existingStateByIdentity.set(`${item.parent_item_id}:${identity}`, item);
  }

  const canonicalStates = items.filter((item) => item.kind === "state").map((item) => {
    const parentStableKey = aliases.get(item.parentStableKey ?? "") ?? item.parentStableKey;
    const parentId = parentStableKey ? parentIdByStableKey.get(parentStableKey) : null;
    const identity = roadmapIdentityFingerprint(item.stateKey ?? item.stateLabel ?? item.name);
    const existing = existingByKey.get(item.stableKey)
      ?? (parentId ? existingStateByIdentity.get(`${parentId}:${identity}`) : null);
    const stableKey = existing?.stable_key ?? item.stableKey;
    aliases.set(item.stableKey, stableKey);
    return { ...item, stableKey, parentStableKey };
  });

  return [...canonicalParents, ...canonicalStates].map((item) => ({
    ...item,
    dependencyKeys: item.dependencyKeys.map((key) => aliases.get(key) ?? key),
  }));
}

export async function persistProjectRoadmap({
  admin,
  projectId,
  ownerId,
  roadmap,
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
  roadmap: ProjectRoadmap;
}) {
  const manifestItems = roadmap.items.map((item) => ({
    stable_key: item.stableKey,
    parent_stable_key: item.parentStableKey ?? null,
    kind: item.kind,
    screen_type: item.screenType ?? null,
    name: item.name,
    description: item.description,
    priority: item.priority,
    status: item.status,
    source: item.source,
    explicitly_requested: item.explicitlyRequested,
    sequence: item.sequence,
    tranche: item.tranche,
    dependency_keys: item.dependencyKeys,
    state_key: item.stateKey ?? null,
    state_label: item.stateLabel ?? null,
    state_role: item.stateRole ?? null,
    trigger_label: item.triggerLabel ?? null,
    metadata: item.metadata ?? {},
  }));
  const manifestResult = await admin.rpc("reconcile_project_roadmap_manifest", {
    input_owner_id: ownerId,
    input_project_id: projectId,
    input_items: manifestItems as never,
  });
  if (!manifestResult.error && Array.isArray(manifestResult.data)) {
    return manifestResult.data as unknown as ProjectScreenRoadmapRow[];
  }
  if (manifestResult.error && manifestResult.error.code !== "42883" && manifestResult.error.code !== "PGRST202") {
    throw manifestResult.error;
  }

  // Compatibility fallback for environments that have not applied the
  // transactional roadmap migration yet.
  const { data: existing, error: existingError } = await admin
    .from("project_screen_roadmap")
    .select("id, stable_key, parent_item_id, generated_screen_id, status, kind, name, state_key, state_label")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId);
  if (existingError) throw existingError;

  const existingItems = (existing ?? []) as ExistingRoadmapItem[];
  const existingByKey = new Map(existingItems.map((item) => [item.stable_key, item]));
  const canonicalItems = canonicalizeRoadmapItems(roadmap.items, existingItems);
  const parentItems = canonicalItems.filter((item) => item.kind === "screen");
  const childItems = canonicalItems.filter((item) => item.kind === "state");

  const upsertItems = async (items: ProjectRoadmapItem[], parentIds?: Map<string, string>) => {
    if (items.length === 0) return;
    const rows = buildProjectRoadmapUpsertRows({
      items,
      projectId,
      ownerId,
      existingByKey,
      parentIds,
    });
    const { error } = await admin
      .from("project_screen_roadmap")
      .upsert(rows, PROJECT_ROADMAP_UPSERT_OPTIONS);
    if (error) throw error;
  };

  await upsertItems(parentItems);
  const { data: persistedParents, error: parentError } = await admin
    .from("project_screen_roadmap")
    .select("id, stable_key")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .eq("kind", "screen");
  if (parentError) throw parentError;
  const persistedParentItems = (persistedParents ?? []) as Array<Pick<ProjectScreenRoadmapRow, "id" | "stable_key">>;
  const parentIds = new Map(persistedParentItems.map((item) => [item.stable_key, item.id]));
  await upsertItems(childItems, parentIds);

  const { data: persisted, error: persistedError } = await admin
    .from("project_screen_roadmap")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("tranche", { ascending: true })
    .order("sequence", { ascending: true });
  if (persistedError) throw persistedError;
  return persisted ?? [];
}

export async function getRoadmapRecommendations({
  admin,
  projectId,
  ownerId,
  limit = 5,
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
  limit?: number;
}) {
  const { data, error } = await admin
    .from("project_screen_roadmap")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("sequence", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as ProjectScreenRoadmapRow[];
  const statusByKey = new Map(rows.map((row) => [row.stable_key, row.status]));
  return rows
    .filter((row) => row.status === "planned" || row.status === "failed")
    .filter((row) => row.dependency_keys.every((dependency) => statusByKey.get(dependency) === "ready"))
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.sequence - right.sequence)
    .slice(0, limit);
}

export const stateVariantFromRoadmap = (row: ProjectScreenRoadmapRow): ScreenStateVariantPlan => {
  const metadata = asRecord(row.metadata);
  return {
    id: row.id,
    stateKey: row.state_key ?? roadmapSlug(row.name, "state"),
    stateLabel: row.state_label ?? row.name,
    stateRole: row.state_role ?? "alternate",
    triggerLabel: row.trigger_label ?? `Open ${row.state_label ?? row.name}`,
    description: row.description,
    editInstruction: typeof metadata.editInstruction === "string"
      ? metadata.editInstruction
      : `Adapt the parent screen into the ${row.state_label ?? row.name} state while preserving its design system and layout shell.`,
    defaultSelected: true,
    roadmapStableKey: row.stable_key,
    roadmapItemId: row.id,
    explicitlyRequested: row.explicitly_requested,
  };
};

export const screenPlanFromRoadmap = (
  row: ProjectScreenRoadmapRow,
  stateVariants: ScreenStateVariantPlan[] = [],
): ScreenPlan => {
  const metadata = asRecord(row.metadata);
  const chromePolicy = asRecord(metadata.chromePolicy);
  return {
    name: row.name,
    type: row.screen_type === "detail" ? "detail" : "root",
    description: row.description,
    roadmapStableKey: row.stable_key,
    roadmapItemId: row.id,
    roadmapPriority: row.priority,
    explicitlyRequested: row.explicitly_requested,
    chromePolicy: Object.keys(chromePolicy).length > 0 ? chromePolicy as unknown as ScreenPlan["chromePolicy"] : undefined,
    navigationItemId: typeof metadata.navigationItemId === "string" ? metadata.navigationItemId : null,
    stateVariants,
  };
};

export function selectRoadmapBuildRecommendation(
  rows: ProjectScreenRoadmapRow[],
  contextRoadmapItemIds: string[] = [],
): RoadmapBuildRecommendation | null {
  const rowByKey = new Map(rows.map((row) => [row.stable_key, row]));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const contextIds = new Set(contextRoadmapItemIds);
  const contextKeys = new Set(contextRoadmapItemIds.map((id) => rowById.get(id)?.stable_key).filter(Boolean));
  const contextualRank = (row: ProjectScreenRoadmapRow) => {
    if (row.parent_item_id && contextIds.has(row.parent_item_id)) return 0;
    if (row.dependency_keys.some((key) => contextKeys.has(key))) return 0;
    return 1;
  };
  const eligible = rows
    .filter((row) => row.status === "planned" || row.status === "failed")
    .filter((row) => row.dependency_keys.every((key) => rowByKey.get(key)?.status === "ready"))
    .sort((left, right) =>
      contextualRank(left) - contextualRank(right)
      || priorityRank[left.priority] - priorityRank[right.priority]
      || left.sequence - right.sequence
    );
  if (eligible.length === 0) return null;

  const suggestionFromRow = (row: ProjectScreenRoadmapRow) => ({
    roadmapItemId: row.id,
    kind: row.kind,
    name: row.kind === "state" ? row.state_label ?? row.name : row.name,
    description: (() => {
      const concise = row.description.replace(/\s+/g, " ").trim().slice(0, 239)
        || `Continue the product flow with ${row.name}.`;
      return /[.!?]$/.test(concise) ? concise : `${concise}.`;
    })(),
    parentName: row.parent_item_id ? rowById.get(row.parent_item_id)?.name ?? null : null,
  });

  if (eligible[0]?.kind === "screen") {
    const candidates = eligible.filter((row) => row.kind === "screen").slice(0, 3);
    return {
      version: 2,
      kind: "parent_batch",
      title: candidates.length === 1
        ? "A useful next screen would be:"
        : "These screens would fit naturally next:",
      items: candidates.map(suggestionFromRow),
    };
  }

  const firstState = eligible.find((row) => row.kind === "state" && row.parent_item_id && rowById.get(row.parent_item_id)?.status === "ready");
  if (!firstState?.parent_item_id) return null;
  const parent = rows.find((row) => row.id === firstState.parent_item_id);
  if (!parent?.generated_screen_id) return null;
  const variants = eligible
    .filter((row) => row.kind === "state" && row.parent_item_id === parent.id)
    .slice(0, 3);
  if (variants.length === 0) return null;
  return {
    version: 2,
    kind: "state_batch",
    title: variants.length === 1
      ? `A useful next state for ${parent.name} would be:`
      : `These ${parent.name} states would fit naturally next:`,
    items: variants.map(suggestionFromRow),
  };
}

export function resolveRoadmapBuildSelection({
  rows,
  kind,
  roadmapItemIds,
}: {
  rows: ProjectScreenRoadmapRow[];
  kind: RoadmapBuildRecommendation["kind"];
  roadmapItemIds: string[];
}): {
  plannedScreens: ScreenPlan[];
  parentScreenId: string | null;
  parentScreenCount: number;
  outputCount: number;
  outputNames: string[];
} {
  const uniqueIds = Array.from(new Set(roadmapItemIds));
  if (uniqueIds.length === 0 || uniqueIds.length > 3) throw new Error("Select between one and three suggested screens.");
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const rowByKey = new Map(rows.map((row) => [row.stable_key, row]));
  const selected = uniqueIds.map((id) => rowById.get(id));
  if (selected.some((row) => !row)) throw new Error("One or more suggested screens are unavailable.");
  const selectedRows = selected as ProjectScreenRoadmapRow[];
  if (selectedRows.some((row) => row.status !== "planned" && row.status !== "failed")) {
    throw new Error("These suggestions are stale. Refresh to see the next available screens.");
  }
  if (selectedRows.some((row) => row.dependency_keys.some((key) => rowByKey.get(key)?.status !== "ready"))) {
    throw new Error("A required earlier screen must be ready before this selection can be built.");
  }

  if (kind === "parent_batch") {
    if (selectedRows.some((row) => row.kind !== "screen")) throw new Error("The selected screen batch is invalid.");
    return {
      plannedScreens: selectedRows.map((row) => screenPlanFromRoadmap(row)),
      parentScreenId: null,
      parentScreenCount: selectedRows.length,
      outputCount: selectedRows.length,
      outputNames: selectedRows.map((row) => row.name),
    };
  }

  if (selectedRows.some((row) => row.kind !== "state")) throw new Error("The selected state batch is invalid.");
  const parentIds = new Set(selectedRows.map((row) => row.parent_item_id).filter(Boolean));
  if (parentIds.size !== 1) throw new Error("Selected states must belong to the same parent screen.");
  const parent = rowById.get(Array.from(parentIds)[0]!);
  if (!parent || parent.status !== "ready" || !parent.generated_screen_id) {
    throw new Error("The parent screen must be ready before its states can be built.");
  }
  return {
    plannedScreens: [screenPlanFromRoadmap(parent, selectedRows.map(stateVariantFromRoadmap))],
    parentScreenId: parent.generated_screen_id,
    parentScreenCount: 1,
    outputCount: selectedRows.length,
    outputNames: selectedRows.map((row) => row.state_label ?? row.name),
  };
}

export function buildRoadmapSelectionScopeContract({
  kind,
  selection,
  referenceMode,
}: {
  kind: RoadmapBuildRecommendation["kind"];
  selection: ReturnType<typeof resolveRoadmapBuildSelection>;
  referenceMode: ReferenceMode;
}): GenerationScopeContract {
  const parentNames = selection.plannedScreens.map((screen) => screen.name);
  const operationLabel = kind === "state_batch" ? "state" : "parent screen";
  return {
    version: 2,
    referenceMode,
    promptScreenCount: selection.parentScreenCount,
    namedScreenCount: selection.parentScreenCount,
    imageScreenCount: null,
    finalScreenCount: selection.parentScreenCount,
    countSource: "planning_mode",
    confidence: "high",
    conflictResolution: null,
    allScreensRequested: true,
    reason: `The server resolved ${selection.outputCount} persisted roadmap ${operationLabel} output${selection.outputCount === 1 ? "" : "s"}.`,
    diagnostics: [
      `Structured roadmap ${kind} selected ${selection.outputCount} output${selection.outputCount === 1 ? "" : "s"}: ${selection.outputNames.join(", ")}.`,
      "Persisted roadmap IDs are authoritative; semantic prompt confirmation was skipped.",
    ],
    groups: [],
    screens: parentNames.map((name, index) => ({
      index: index + 1,
      name,
      kind: kind === "state_batch" ? "state_parent" : "roadmap_screen",
    })),
    ambiguities: [],
    requiresConfirmation: false,
  };
}

export async function createRoadmapBuildRecommendation({
  admin,
  projectId,
  ownerId,
  contextRoadmapItemIds = [],
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
  contextRoadmapItemIds?: string[];
}): Promise<RoadmapBuildRecommendation | null> {
  const { data, error } = await admin
    .from("project_screen_roadmap")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("tranche", { ascending: true })
    .order("sequence", { ascending: true });
  if (error) throw error;
  return selectRoadmapBuildRecommendation((data ?? []) as ProjectScreenRoadmapRow[], contextRoadmapItemIds);
}

export async function markRoadmapItemForScreen({
  admin,
  roadmapItemId,
  screenId,
  status,
}: {
  admin: AdminClient;
  roadmapItemId?: string | null;
  screenId?: string | null;
  status: "building" | "ready" | "failed";
}) {
  if (!roadmapItemId) return;
  const patch = screenId ? { generated_screen_id: screenId, status } : { status };
  const { error } = await admin
    .from("project_screen_roadmap")
    .update(patch)
    .eq("id", roadmapItemId);
  if (error) throw error;
}
