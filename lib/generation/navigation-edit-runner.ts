import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { navigationSnapshotSchema, historyResultSchema } from "@/lib/design-history/types";
import { persistDesignChange, readDesignTarget } from "@/lib/design-history/persistence";
import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { navigationEditIntent, type NavigationEditIntent } from "@/lib/navigation-edit-intent";
import { indexNavigationShell, renderDeterministicNavigationShell, validateNavigationShell } from "@/lib/project-navigation";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";
import { findNavigationSource, navigationFromScreen } from "./navigation-source";
import { redesignNavigation, resolveNavigationMembership, reviseNavigationDestinations, type NavigationDesignNotes } from "./navigation-design-edit";
import { editLegacyNavigation } from "./legacy-navigation-edit";

type Request = {
  projectId: string; ownerId: string; userMessageId: string; prompt: string;
  screenId?: string | null; sourceReferences?: Array<{ screenId: string }> | null;
  intent?: NavigationEditIntent | null;
  selectedElementTarget?: "screen" | "navigation" | null;
  selectedElementDrawgleId?: string | null;
};
type Assignment = ReturnType<typeof navigationSnapshotSchema.parse>["assignments"][number];
/** The card the chat shows for the edit: the designer's own title and summary, and the tab changes as computed. */
export type NavigationDesignSummary = { title: string; summary: string; styleDiff: string | null };

const chromeOf = (policy: Record<string, unknown> | null | undefined) => typeof policy?.chrome === "string" ? policy.chrome : null;
const listLabels = (labels: string[]) => labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

/**
 * Screens follow the destinations: a screen whose tab was removed stops showing the bar, and a built top-level
 * screen that a new tab opens shows the bar with that tab active. Screen HTML is untouched.
 */
function followDestinations(plan: NavigationPlan, assignments: Assignment[], screens: Array<{ id: string; name: string }>) {
  const ids = new Set(plan.items.map(item => item.id));
  const opens = new Map(plan.items.flatMap(item => item.linkedScreenName ? [[item.linkedScreenName.toLowerCase(), item.id] as const] : []));
  const moved = new Map<string, string | null>();
  const next = assignments.map(assignment => {
    const name = screens.find(screen => screen.id === assignment.screenId)?.name;
    const opened = name && !assignment.parentScreenId ? opens.get(name.toLowerCase()) : undefined;
    if (name && opened && opened !== assignment.navigationItemId) {
      moved.set(name, opened);
      return { ...assignment, navigationItemId: opened, chromePolicy: { ...assignment.chromePolicy, chrome: "bottom-tabs", showPrimaryNavigation: true } };
    }
    if (assignment.navigationItemId && !ids.has(assignment.navigationItemId)) {
      if (name && !assignment.parentScreenId) moved.set(name, null);
      return { ...assignment, navigationItemId: null, chromePolicy: { ...assignment.chromePolicy, chrome: "top-bar", showPrimaryNavigation: false } };
    }
    return assignment;
  });
  const screenChrome = plan.screenChrome.filter(entry => !moved.has(entry.screenName) && (!entry.navigationItemId || ids.has(entry.navigationItemId)));
  for (const [screenName, navigationItemId] of moved) screenChrome.push({ screenName, chrome: navigationItemId ? "bottom-tabs" : "top-bar", navigationItemId });
  return { plan: { ...plan, screenChrome }, assignments: next };
}

/** What changed in the tabs, as lines for the chat card: computed, never taken from the model's description. */
function tabChanges(before: NavigationPlan["items"], after: NavigationPlan["items"]) {
  const lines: string[] = [];
  for (const item of after) {
    const old = before.find(previous => previous.id === item.id);
    if (!old) lines.push(`+ ${item.label} tab${item.linkedScreenName ? `, opens ${item.linkedScreenName}` : " (screen not built yet)"}`);
    else if (old.label !== item.label) lines.push(`Renamed ${old.label} to ${item.label}`);
    else if (old.icon !== item.icon) lines.push(`New ${item.label} icon`);
  }
  for (const old of before) if (!after.some(item => item.id === old.id)) lines.push(`- ${old.label} tab`);
  const kept = after.filter(item => before.some(old => old.id === item.id)).map(item => item.id);
  if (kept.join() !== before.filter(old => kept.includes(old.id)).map(old => old.id).join()) lines.push("Reordered the tabs");
  return lines;
}

/** Navigation and its screen assignments are one history transaction; screen HTML is never regenerated. */
export async function executeNavigationEdit(admin: SupabaseClient<Database>, request: Request, designTokens: DesignTokens | null, projectCharter: ProjectCharter | null) {
  const [{ data: saved, error: navError }, { data: rows, error: screenError }, { data: roadmapRows, error: roadmapError }] = await Promise.all([
    admin.from("project_navigation").select("plan, shell_code, design_revision").eq("project_id", request.projectId).eq("owner_id", request.ownerId).maybeSingle(),
    admin.from("screens").select("id, name, code, chrome_policy, navigation_item_id, parent_screen_id, state_key, roadmap_item_id")
      .eq("project_id", request.projectId).eq("owner_id", request.ownerId).order("sort_index", { ascending: true }),
    admin.from("project_screen_roadmap").select("id, name, description, kind, generated_screen_id")
      .eq("project_id", request.projectId).eq("owner_id", request.ownerId).order("sequence", { ascending: true }),
  ]);
  if (navError) throw navError;
  if (screenError) throw screenError;
  if (roadmapError) throw roadmapError;
  const screens = (rows ?? []).map(row => ({ ...row, code: row.code ?? "" }));
  if (request.screenId && !screens.some(screen => screen.id === request.screenId)) throw new Error("The navigation target screen is no longer available.");
  const roadmap = (roadmapRows ?? []).filter(item => item.kind === "screen");
  const identity = { projectId: request.projectId, ownerId: request.ownerId, target: { context: "navigation" as const } };
  const snapshot = saved ? await readDesignTarget(admin, identity) : null;
  if (saved && snapshot?.revision !== saved.design_revision) throw new Error("Navigation changed while the edit was starting. Please retry.");
  const before = snapshot ? navigationSnapshotSchema.parse(snapshot.payload) : null;
  let assignments: Assignment[] = before?.assignments ?? screens.map(screen => ({
    screenId: screen.id, chromePolicy: screen.chrome_policy as Record<string, unknown> | null,
    navigationItemId: screen.navigation_item_id, parentScreenId: screen.parent_screen_id,
    stateKey: screen.state_key, roadmapItemId: screen.roadmap_item_id,
  }));
  const storedPlan = saved?.plan as unknown as NavigationPlan | null;
  let plan = storedPlan?.enabled && storedPlan.items.length >= 2 ? storedPlan : null;
  let shell = plan ? plan.version === 2 ? renderDeterministicNavigationShell(plan) : saved?.shell_code ?? "" : "";
  if (plan && !validateNavigationShell(shell, plan)) throw new Error("The saved shared navigation needs repair before it can be reused.");
  const intent = request.intent ?? navigationEditIntent(request.prompt, true) ?? "restyle";
  let sourceScreenId: string | null = null;
  if (!plan) {
    const references = request.sourceReferences?.map(reference => reference.screenId) ?? [];
    const source = findNavigationSource(screens.filter(screen => !screen.parent_screen_id), request.prompt, references, storedPlan);
    if (source) {
      plan = source.plan;
      sourceScreenId = source.screen.id;
      shell = renderDeterministicNavigationShell(plan);
    }
  }
  const targetIds = new Set<string>();
  if (sourceScreenId) targetIds.add(sourceScreenId);
  if (request.screenId && (intent === "reuse" || !storedPlan?.enabled)) targetIds.add(request.screenId);
  // A project-wide consistency request can repair already navigable screens without adding tabs to detail screens.
  if (sourceScreenId || (intent === "reuse" && /\b(?:all|every|across|different navs?|different navigation)\b/i.test(request.prompt))) {
    for (const screen of screens) {
      if (!screen.parent_screen_id && (screen.navigation_item_id || navigationFromScreen(screen, plan))) targetIds.add(screen.id);
    }
  }
  if (intent === "reuse" && targetIds.size === 0) throw new Error("I found the shared navigation. Which screen should use it?");
  const orderedScreens = [...screens].sort((a, b) => Number(b.id === request.screenId) - Number(a.id === request.screenId));
  const context = { prompt: request.prompt, designTokens, projectCharter, screens: orderedScreens, currentShellCode: shell };
  const creating = !plan;
  if (!plan) {
    if (targetIds.size === 0) throw new Error("Choose the screen that should receive the new shared navigation.");
    const membership = await resolveNavigationMembership(context, null, [...targetIds]);
    plan = { version: 2, decision: "project-native", enabled: true, kind: "bottom-tabs", items: membership.items,
      evidence: { source: "explicit-prompt", reason: request.prompt }, visualBrief: request.prompt, screenChrome: [] };
    assignments = assignments.map(assignment => {
      const match = membership.assignments.find(item => item.screenId === assignment.screenId);
      return match ? { ...assignment, navigationItemId: match.itemId, chromePolicy: { ...assignment.chromePolicy, chrome: "bottom-tabs", showPrimaryNavigation: true } } : assignment;
    });
  }
  const unresolved: string[] = [];
  const resolved = new Map<string, string>();
  const currentPlan = plan;
  for (const screenId of targetIds) {
    const screen = screens.find(item => item.id === screenId)!;
    const assigned = assignments.find(item => item.screenId === screenId)?.navigationItemId;
    const item = plan.items.find(item => item.id === assigned)
      ?? plan.items.find(item => item.linkedScreenName?.toLowerCase() === screen.name.toLowerCase())
      ?? plan.items.find(item => item.id === currentPlan.screenChrome.find(entry => entry.screenName.toLowerCase() === screen.name.toLowerCase())?.navigationItemId);
    if (item) resolved.set(screenId, item.id);
    else unresolved.push(screenId);
  }
  if (unresolved.length) {
    const membership = await resolveNavigationMembership(context, plan, unresolved);
    membership.assignments.forEach(item => resolved.set(item.screenId, item.itemId));
  }
  assignments = assignments.map(assignment => resolved.has(assignment.screenId)
    ? { ...assignment, navigationItemId: resolved.get(assignment.screenId)!, chromePolicy: { ...assignment.chromePolicy, chrome: "bottom-tabs", showPrimaryNavigation: true } }
    : assignment);
  plan = { ...plan, screenChrome: [...plan.screenChrome] };
  for (const [screenId, itemId] of resolved) {
    const screen = screens.find(item => item.id === screenId)!;
    plan.screenChrome = plan.screenChrome.filter(entry => entry.screenName.toLowerCase() !== screen.name.toLowerCase());
    plan.screenChrome.push({ screenName: screen.name, chrome: "bottom-tabs", navigationItemId: itemId });
    // Connect only planned destinations; secondary screens must not steal a root tab's link.
    plan.items = plan.items.map(item => item.id === itemId && !item.linkedScreenName
      ? { ...item, linkedScreenName: screen.name, availability: "generated" } : item);
  }
  // The designer sees each screen as it will be after this edit: its role, its chrome, and the tab it opens from.
  const designContext = {
    ...context,
    screens: orderedScreens.map(screen => {
      const assignment = assignments.find(item => item.screenId === screen.id);
      const role = roadmap.find(item => item.generated_screen_id === screen.id || item.id === screen.roadmap_item_id)?.description ?? null;
      return { id: screen.id, name: screen.name, code: screen.code, role, navigationItemId: assignment?.navigationItemId ?? null,
        chrome: chromeOf(assignment?.chromePolicy) ?? chromeOf(screen.chrome_policy as Record<string, unknown> | null), parentScreenId: screen.parent_screen_id };
    }),
    plannedScreens: roadmap.filter(item => !item.generated_screen_id && !screens.some(screen => screen.name.toLowerCase() === item.name.toLowerCase()))
      .map(item => ({ name: item.name, description: item.description })),
  };
  const previousItems = plan.items;
  let notes: NavigationDesignNotes = { title: null, summary: null };
  const legacyElementEdit = !creating && plan.version !== 2 && (intent === "restyle" || intent === "destinations");
  if (legacyElementEdit) {
    shell = await editLegacyNavigation({ prompt: request.prompt, shell, plan, designTokens, projectCharter,
      drawgleId: request.selectedElementTarget === "navigation" ? request.selectedElementDrawgleId : null });
  } else if (creating || intent === "restyle" || intent === "redesign") {
    ({ plan, notes } = await redesignNavigation(designContext, plan, creating ? "create" : intent === "redesign" ? "redesign" : "restyle"));
  } else if (intent === "destinations") {
    ({ plan, notes } = await reviseNavigationDestinations(designContext, plan));
  }
  if (plan.items !== previousItems) ({ plan, assignments } = followDestinations(plan, assignments, screens));
  // A reuse request never passes the accepted visual design through generation.
  if (!legacyElementEdit && (plan.version === 2 || creating || intent !== "reuse")) shell = renderDeterministicNavigationShell(plan);
  shell = ensureDrawgleIds(shell, "dg-nav").code;
  if (!validateNavigationShell(shell, plan)) throw new Error("The shared navigation did not pass validation; no changes were saved.");
  const payload = navigationSnapshotSchema.parse({ plan, shellCode: shell, assignments });
  const changed = JSON.stringify(before) !== JSON.stringify(payload);
  const label = creating ? "Created shared navigation" : { reuse: "Reused shared navigation", restyle: "Restyled shared navigation",
    redesign: "Redesigned shared navigation", destinations: "Changed navigation tabs" }[intent];
  if (changed) {
    if (snapshot) {
      const result = await persistDesignChange(admin, identity, { expectedRevision: snapshot.revision, requestId: request.userMessageId,
        payload, label, origin: "ai-edit" });
      if (result.status !== "success") throw new Error("Navigation or its screens changed during this edit. Please retry.");
    } else {
      const { data, error } = await admin.rpc("apply_navigation_repair", {
        input_project_id: request.projectId, input_owner_id: request.ownerId, input_expected_revision: null,
        input_request_id: request.userMessageId, input_payload: payload as unknown as Json,
        input_block_index: indexNavigationShell(shell) as unknown as Json,
      });
      if (error) throw error;
      if (historyResultSchema.parse(data).status !== "success") throw new Error("Navigation or its screens changed during this edit. Please retry.");
    }
  }
  if (intent === "reuse" && !creating) {
    return { changed, designSummary: null, message: changed ? "Applied the shared project navigation, preserving its design and icons." : "This screen already uses the shared project navigation." };
  }
  if (!changed) return { changed, designSummary: null, message: "The shared navigation already matches that request, so nothing changed." };
  const unbuilt = plan.items.filter(item => item.availability === "planned" && !previousItems.some(previous => previous.id === item.id)).map(item => item.label);
  const message = [
    notes.summary ?? (intent === "destinations" ? "Updated the navigation tabs." : "Updated the shared project navigation."),
    unbuilt.length ? `${listLabels(unbuilt)} ${unbuilt.length === 1 ? "doesn't have its screen" : "don't have their screens"} yet; ask me to create ${unbuilt.length === 1 ? "it" : "them"} when you're ready.` : "",
  ].filter(Boolean).join(" ");
  const diff = tabChanges(previousItems, plan.items);
  const designSummary: NavigationDesignSummary = {
    title: notes.title ?? label,
    summary: message,
    styleDiff: diff.length ? diff.join("\n") : null,
  };
  return { changed, designSummary, message };
}
