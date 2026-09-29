import { createNavigationArchitecture } from "@/lib/navigation";
import { defaultNavigationDesignContract } from "@/lib/project-navigation";
import type { ProductPlanning, ScopeNavigation } from "@/lib/product-planning/model";
import type {
  NavigationArchitecture,
  NavigationDecision,
  NavigationDesignContract,
  NavigationEvidenceSource,
  NavigationPlan,
  PrimaryNavigationKind,
  ScreenChromeKind,
} from "@/lib/types";

/**
 * Whether the product has persistent navigation is decided in the flow the person approves, not by a
 * heuristic afterwards. This turns that decision into the blueprint's navigation plan, architecture
 * and root screens. The planner still supplies what only it knows, each destination's icon and role.
 */

const PLACEHOLDER_ICON = "circle";

/** The blueprint's snake_case form of a navigation design contract. */
export const blueprintNavigationDesign = (design: NavigationDesignContract) => ({
  anatomy: design.anatomy,
  width: design.width,
  labels: design.labels,
  active_treatment: design.activeTreatment,
  surface: design.surface,
  radius_px: design.radiusPx,
  safe_area_offset_px: design.safeAreaOffsetPx,
  item_gap_px: design.itemGapPx,
  icon_size_px: design.iconSizePx,
  border: design.border,
  elevation: design.elevation,
  center_action_item_id: design.centerActionItemId ?? null,
  inactive_treatment: design.inactiveTreatment ?? "plain",
  ...(design.activeFill ? { active_fill: design.activeFill } : {}),
});
// The two optional fields are optional in the planner's schema, and a plan may leave them out.
type BlueprintDesign = Omit<ReturnType<typeof blueprintNavigationDesign>, "center_action_item_id" | "inactive_treatment"> & {
  center_action_item_id?: string | null;
  inactive_treatment?: "plain" | "well";
};

interface BlueprintItem {
  id: string;
  label: string;
  icon: string;
  role: string;
  availability?: "generated" | "planned";
  linked_screen_name?: string | null;
}

interface BlueprintPlan {
  version: 2;
  decision: NavigationDecision;
  evidence: { source: NavigationEvidenceSource | null; reason: string };
  enabled?: boolean;
  kind?: "bottom-tabs" | "none";
  items: BlueprintItem[];
  design?: BlueprintDesign | null;
  visual_brief?: string;
  screen_chrome: Array<{ screen_name: string; chrome: ScreenChromeKind; navigation_item_id?: string | null }>;
}

interface BlueprintArchitecture {
  kind: NavigationArchitecture["kind"];
  primary_navigation: PrimaryNavigationKind;
  root_chrome: ScreenChromeKind;
  detail_chrome: ScreenChromeKind;
  consistency_rules: string[];
  rationale: string;
}

export interface ApprovableBlueprint {
  requires_bottom_nav?: boolean;
  navigation_architecture?: BlueprintArchitecture;
  navigation_plan?: BlueprintPlan;
  roadmap?: { items: Array<{ name: string; type: "root" | "detail" }> };
  charter: { navigationModel: string };
}

const key = (value: string) => value.trim().toLowerCase();
const slug = (value: string, fallback: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;

/** The screens an approved destination can open: those in this flow, and those already built. */
export function approvedNavigationScreenNames(state: ProductPlanning): Map<string, string> {
  const names = new Map<string, string>();
  for (const output of state.scope?.existingOutputs ?? []) names.set(output.item.stableKey, output.item.name);
  for (const item of state.scope?.manifest ?? []) if (item.kind === "screen") names.set(item.stableKey, item.name);
  return names;
}

/** The screen names an approved bar links to, in destination order. */
export const approvedNavigationLinkedScreens = (navigation: ScopeNavigation, screenNames: ReadonlyMap<string, string>) =>
  navigation.persistent
    ? navigation.destinations.flatMap(destination => {
      const name = destination.screenKey ? screenNames.get(destination.screenKey) : undefined;
      return name ? [name] : [];
    })
    : [];

/** What the planner is told, as part of the input it plans from. The decision is not the planner's to change. */
export function formatApprovedNavigation(navigation: ScopeNavigation, screenNames: ReadonlyMap<string, string>) {
  if (!navigation.persistent) {
    return [
      "APPROVED NAVIGATION (binding): the person approved this flow without persistent navigation.",
      'Use decision "none", evidence.source null, no items and design null. Every screen uses its own top chrome.',
    ].join("\n");
  }
  const destinations = navigation.destinations.map(destination => {
    const screen = destination.screenKey ? screenNames.get(destination.screenKey) : undefined;
    return `${destination.label} (${screen ? `opens the screen "${screen}"` : "a later screen, no screen in this flow yet"})`;
  });
  return [
    "APPROVED NAVIGATION (binding): the person approved a persistent bottom navigation with exactly these destinations, in this order:",
    ...destinations.map((line, index) => `${index + 1}. ${line}`),
    'Use decision "project-native" with these labels. For each, give a specific Lucide icon and a one-sentence role. Do not add, remove, rename or reorder destinations. A destination that opens a screen in this flow is a root screen; a later one is planned with linked_screen_name null.',
  ].join("\n");
}

/** True when the plan already draws exactly what was approved, so nothing about it needs to change. */
export function navigationMatchesApproved(plan: NavigationPlan | null | undefined, navigation: ScopeNavigation) {
  const drawn = (plan?.enabled ? plan.items : []).map(item => key(item.label).slice(0, 18));
  const approved = navigation.persistent ? navigation.destinations.map(destination => key(destination.label).slice(0, 18)) : [];
  return drawn.length === approved.length && drawn.every((label, index) => label === approved[index]);
}

const architectureOf = (architecture: BlueprintArchitecture | undefined): NavigationArchitecture | null => architecture ? {
  kind: architecture.kind,
  primaryNavigation: architecture.primary_navigation,
  rootChrome: architecture.root_chrome,
  detailChrome: architecture.detail_chrome,
  consistencyRules: architecture.consistency_rules,
  rationale: architecture.rationale,
} : null;

const toBlueprintArchitecture = (architecture: NavigationArchitecture): BlueprintArchitecture => ({
  kind: architecture.kind,
  primary_navigation: architecture.primaryNavigation,
  root_chrome: architecture.rootChrome,
  detail_chrome: architecture.detailChrome,
  consistency_rules: architecture.consistencyRules,
  rationale: architecture.rationale,
});

/**
 * Overwrite the blueprint's navigation with the approved decision. A bar keeps exactly the approved
 * destinations, in order; each keeps the planner's icon, role and id when the planner named it. A
 * destination without a screen in this flow is planned. An approved "no navigation" is none.
 */
export function applyApprovedNavigation<B extends ApprovableBlueprint>(
  blueprint: B,
  approved: ScopeNavigation,
  screenNames: ReadonlyMap<string, string>,
): B {
  const persistent = approved.persistent && approved.destinations.length >= 2;
  const previous = blueprint.navigation_plan;
  const reason = approved.rationale.trim() || (persistent
    ? "The person approved this navigation with the screen flow."
    : "The person approved this flow without persistent navigation.");

  if (!persistent) {
    const architecture = createNavigationArchitecture({ requiresBottomNav: false });
    return {
      ...blueprint,
      requires_bottom_nav: false,
      navigation_architecture: { ...toBlueprintArchitecture(architecture), rationale: reason },
      navigation_plan: {
        version: 2,
        decision: "none",
        evidence: { source: "approved-scope", reason },
        enabled: false,
        kind: "none",
        items: [],
        design: null,
        visual_brief: "No persistent primary navigation. Use screen-purpose-specific chrome.",
        screen_chrome: (previous?.screen_chrome ?? []).map(entry => ({
          ...entry,
          chrome: entry.chrome === "bottom-tabs" ? "top-bar" as const : entry.chrome,
          navigation_item_id: null,
        })),
      },
      charter: { ...blueprint.charter, navigationModel: "Hierarchical screen-specific chrome without persistent primary navigation." },
    } as B;
  }

  // The planner's item for a destination: the one with its label, else the one that opens the same screen.
  const planned = previous?.items ?? [];
  const byLabel = new Map(planned.map(item => [key(item.label), item] as const));
  const byScreen = new Map(planned.flatMap(item => item.linked_screen_name ? [[key(item.linked_screen_name), item] as const] : []));
  const usedIds = new Set<string>();
  const items = approved.destinations.map((destination, index): BlueprintItem => {
    const linked = destination.screenKey ? screenNames.get(destination.screenKey) ?? null : null;
    const known = byLabel.get(key(destination.label)) ?? (linked ? byScreen.get(key(linked)) : undefined);
    const baseId = slug(known?.id || destination.label, `destination-${index + 1}`);
    let id = baseId;
    for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    usedIds.add(id);
    return {
      id,
      label: destination.label,
      icon: known?.icon?.trim() || PLACEHOLDER_ICON,
      role: known?.role?.trim() || `${destination.label} area of the product`,
      availability: linked ? "generated" : "planned",
      linked_screen_name: linked,
    };
  });

  const itemByScreen = new Map(items.flatMap(item => item.linked_screen_name ? [[key(item.linked_screen_name), item.id] as const] : []));
  const itemIds = new Set(items.map(item => item.id));
  const chrome = (previous?.screen_chrome ?? []).map(entry => {
    const itemId = itemByScreen.get(key(entry.screen_name));
    if (itemId) return { ...entry, chrome: "bottom-tabs" as const, navigation_item_id: itemId };
    const stale = Boolean(entry.navigation_item_id) && !itemIds.has(entry.navigation_item_id!);
    return { ...entry, chrome: entry.chrome === "bottom-tabs" ? "top-bar" as const : entry.chrome,
      navigation_item_id: stale ? null : entry.navigation_item_id ?? null };
  });
  for (const [screen, itemId] of itemByScreen) {
    if (chrome.some(entry => key(entry.screen_name) === screen)) continue;
    const name = items.find(item => item.id === itemId)!.linked_screen_name!;
    chrome.push({ screen_name: name, chrome: "bottom-tabs", navigation_item_id: itemId });
  }

  const visualBrief = previous?.visual_brief?.trim() || "Typed project navigation.";
  const architecture = createNavigationArchitecture({
    navigationArchitecture: { ...(architectureOf(blueprint.navigation_architecture) ?? createNavigationArchitecture({ requiresBottomNav: true })),
      kind: "bottom-tabs-app", primaryNavigation: "bottom-tabs", rootChrome: "bottom-tabs" },
    requiresBottomNav: true,
  });
  const linkedScreens = new Set(itemByScreen.keys());

  return {
    ...blueprint,
    requires_bottom_nav: true,
    navigation_architecture: { ...toBlueprintArchitecture(architecture), rationale: blueprint.navigation_architecture?.rationale || reason },
    navigation_plan: {
      version: 2,
      decision: "project-native",
      evidence: { source: "approved-scope", reason },
      enabled: true,
      kind: "bottom-tabs",
      items,
      design: previous?.design ?? blueprintNavigationDesign(defaultNavigationDesignContract(visualBrief)),
      visual_brief: visualBrief,
      screen_chrome: chrome,
    },
    // A screen the bar opens is a peer root screen, whatever the roadmap first called it.
    roadmap: blueprint.roadmap
      ? { ...blueprint.roadmap, items: blueprint.roadmap.items.map(item => linkedScreens.has(key(item.name)) ? { ...item, type: "root" as const } : item) }
      : blueprint.roadmap,
    charter: { ...blueprint.charter, navigationModel: `Shared bottom navigation between ${items.map(item => item.label).join(", ")}.` },
  } as B;
}
