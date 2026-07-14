import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";
import type {
  NavigationPlan,
  ProjectRoadmap,
  RoadmapBuildRecommendation,
  ProjectRoadmapItem,
  ScreenPlan,
  ScreenStateVariantPlan,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

const priorityRank = {
  required: 0,
  core: 1,
  recommended: 2,
  optional: 3,
} as const;

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
    const stableKey = screen.roadmapStableKey ?? screenRoadmapKey(screen.name);
    const existingIndex = items.findIndex((item) => item.stableKey === stableKey && item.kind === "screen");
    const existing = existingIndex >= 0 ? items[existingIndex] : null;
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
      const child = roadmapStateItem(parent, variant, items.length);
      if (!seen.has(child.stableKey)) {
        seen.add(child.stableKey);
        items.push(child);
      }
    }
  });

  for (const navigationItem of navigationPlan?.items ?? []) {
    const linkedName = navigationItem.linkedScreenName?.trim();
    const name = linkedName || navigationItem.label;
    const stableKey = screenRoadmapKey(name);
    if (seen.has(stableKey)) continue;
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
  const { data: existing, error: existingError } = await admin
    .from("project_screen_roadmap")
    .select("id, stable_key, parent_item_id, generated_screen_id, status")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId);
  if (existingError) throw existingError;

  const existingItems = (existing ?? []) as Array<Pick<ProjectScreenRoadmapRow, "id" | "stable_key" | "parent_item_id" | "generated_screen_id" | "status">>;
  const existingByKey = new Map(existingItems.map((item) => [item.stable_key, item]));
  const parentItems = roadmap.items.filter((item) => item.kind === "screen");
  const childItems = roadmap.items.filter((item) => item.kind === "state");

  const upsertItems = async (items: ProjectRoadmapItem[], parentIds?: Map<string, string>) => {
    if (items.length === 0) return;
    const rows = items.map((item) => {
      const current = existingByKey.get(item.stableKey);
      return {
        id: current?.id ?? item.id,
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
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await admin
      .from("project_screen_roadmap")
      .upsert(rows, { onConflict: "project_id,stable_key" });
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

const stateVariantFromRoadmap = (row: ProjectScreenRoadmapRow): ScreenStateVariantPlan => {
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

const screenPlanFromRoadmap = (
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
): RoadmapBuildRecommendation | null {
  const rowByKey = new Map(rows.map((row) => [row.stable_key, row]));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const eligible = rows
    .filter((row) => row.status === "planned" || row.status === "failed")
    .filter((row) => row.dependency_keys.every((key) => rowByKey.get(key)?.status === "ready"))
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.sequence - right.sequence);
  if (eligible.length === 0) return null;

  const parentCandidates = eligible.filter((row) => row.kind === "screen").slice(0, 5);
  if (parentCandidates.length > 0 && eligible[0]?.kind === "screen") {
    let stateCapacity = Math.max(0, 8 - parentCandidates.length);
    const plans = parentCandidates.map((parent) => {
      const variants = eligible
        .filter((row) => row.kind === "state" && row.parent_item_id === parent.id)
        .slice(0, stateCapacity)
        .map(stateVariantFromRoadmap);
      stateCapacity -= variants.length;
      return screenPlanFromRoadmap(parent, variants);
    });
    const stateIds = plans.flatMap((plan) => plan.stateVariants ?? []).map((variant) => variant.roadmapItemId).filter((id): id is string => Boolean(id));
    const outputCount = plans.length + stateIds.length;
    return {
      version: 1,
      kind: "parent_batch",
      title: plans.length === 1 ? `Build ${plans[0].name}` : `Build the next ${plans.length} screens`,
      detail: plans.map((plan) => plan.name).join(", "),
      plannedScreens: plans,
      roadmapItemIds: [...plans.map((plan) => plan.roadmapItemId!).filter(Boolean), ...stateIds],
      outputCount,
      estimatedCredits: outputCount * 20,
      remainingCount: eligible.length,
    };
  }

  const firstState = eligible.find((row) => row.kind === "state" && row.parent_item_id && rowById.get(row.parent_item_id)?.status === "ready");
  if (!firstState?.parent_item_id) return null;
  const parent = rows.find((row) => row.id === firstState.parent_item_id);
  if (!parent?.generated_screen_id) return null;
  const variants = eligible
    .filter((row) => row.kind === "state" && row.parent_item_id === parent.id)
    .slice(0, 3)
    .map(stateVariantFromRoadmap);
  if (variants.length === 0) return null;
  return {
    version: 1,
    kind: "state_batch",
    title: variants.length === 1 ? `Build ${variants[0].stateLabel}` : `Build ${variants.length} ${parent.name} states`,
    detail: variants.map((variant) => variant.stateLabel).join(", "),
    plannedScreens: [screenPlanFromRoadmap(parent, variants)],
    roadmapItemIds: variants.map((variant) => variant.roadmapItemId!).filter(Boolean),
    parentScreenId: parent.generated_screen_id,
    outputCount: variants.length,
    estimatedCredits: variants.length * 20,
    remainingCount: eligible.length,
  };
}

export async function createRoadmapBuildRecommendation({
  admin,
  projectId,
  ownerId,
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
}): Promise<RoadmapBuildRecommendation | null> {
  const { data, error } = await admin
    .from("project_screen_roadmap")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("tranche", { ascending: true })
    .order("sequence", { ascending: true });
  if (error) throw error;
  return selectRoadmapBuildRecommendation((data ?? []) as ProjectScreenRoadmapRow[]);
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
