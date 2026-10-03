import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { navigationSnapshotSchema, historyResultSchema } from "@/lib/design-history/types";
import { persistDesignChange, readDesignTarget } from "@/lib/design-history/persistence";
import { ensureDrawgleIds } from "@/lib/drawgle-dom";
import { navigationEditIntent, type NavigationEditIntent } from "@/lib/navigation-edit-intent";
import { applyNavigationDesignEdit, indexNavigationShell, renderDeterministicNavigationShell, validateNavigationShell } from "@/lib/project-navigation";
import type { DesignTokens, NavigationPlan, ProjectCharter } from "@/lib/types";
import { findNavigationSource, navigationFromScreen } from "./navigation-source";
import { redesignNavigation, resolveNavigationMembership } from "./navigation-design-edit";
import { editLegacyNavigation } from "./legacy-navigation-edit";

type Request = {
  projectId: string; ownerId: string; userMessageId: string; prompt: string;
  screenId?: string | null; sourceReferences?: Array<{ screenId: string }> | null;
  intent?: NavigationEditIntent | null;
  selectedElementTarget?: "screen" | "navigation" | null;
  selectedElementDrawgleId?: string | null;
};

/** Navigation and its screen assignments are one history transaction; screen HTML is never regenerated. */
export async function executeNavigationEdit(admin: SupabaseClient<Database>, request: Request, designTokens: DesignTokens | null, projectCharter: ProjectCharter | null) {
  const [{ data: saved, error: navError }, { data: rows, error: screenError }] = await Promise.all([
    admin.from("project_navigation").select("plan, shell_code, design_revision").eq("project_id", request.projectId).eq("owner_id", request.ownerId).maybeSingle(),
    admin.from("screens").select("id, name, code, chrome_policy, navigation_item_id, parent_screen_id, state_key, roadmap_item_id")
      .eq("project_id", request.projectId).eq("owner_id", request.ownerId).order("sort_index", { ascending: true }),
  ]);
  if (navError) throw navError;
  if (screenError) throw screenError;
  const screens = (rows ?? []).map(row => ({ ...row, code: row.code ?? "" }));
  if (request.screenId && !screens.some(screen => screen.id === request.screenId)) throw new Error("The navigation target screen is no longer available.");
  const identity = { projectId: request.projectId, ownerId: request.ownerId, target: { context: "navigation" as const } };
  const snapshot = saved ? await readDesignTarget(admin, identity) : null;
  if (saved && snapshot?.revision !== saved.design_revision) throw new Error("Navigation changed while the edit was starting. Please retry.");
  const before = snapshot ? navigationSnapshotSchema.parse(snapshot.payload) : null;
  let assignments = before?.assignments ?? screens.map(screen => ({
    screenId: screen.id, chromePolicy: screen.chrome_policy as Record<string, unknown> | null,
    navigationItemId: screen.navigation_item_id, parentScreenId: screen.parent_screen_id,
    stateKey: screen.state_key, roadmapItemId: screen.roadmap_item_id,
  }));
  const storedPlan = saved?.plan as unknown as NavigationPlan | null;
  let plan = storedPlan?.enabled && storedPlan.items.length >= 2 ? storedPlan : null;
  let shell = plan ? plan.version === 2 ? renderDeterministicNavigationShell(plan) : saved?.shell_code ?? "" : "";
  if (plan && !validateNavigationShell(shell, plan)) throw new Error("The saved shared navigation needs repair before it can be reused.");
  const intent = request.intent ?? navigationEditIntent(request.prompt, true) ?? "edit";
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
  const legacyElementEdit = !creating && intent === "edit" && plan.version !== 2;
  if (legacyElementEdit) {
    shell = await editLegacyNavigation({ prompt: request.prompt, shell, plan, designTokens, projectCharter,
      drawgleId: request.selectedElementTarget === "navigation" ? request.selectedElementDrawgleId : null });
  } else if (creating || intent === "redesign") plan = await redesignNavigation(context, plan);
  else if (intent === "edit") {
    const deterministic = applyNavigationDesignEdit(plan, request.prompt);
    // Keep the existing explicit rename operation. Appearance requests need the project's style context,
    // even when a keyword could otherwise select a generic built-in bar.
    plan = JSON.stringify(deterministic.items) !== JSON.stringify(plan.items)
      ? { ...plan, items: deterministic.items }
      : await redesignNavigation(context, plan);
  }
  // A reuse request never passes the accepted visual design through generation.
  if (!legacyElementEdit && (plan.version === 2 || creating || intent !== "reuse")) shell = renderDeterministicNavigationShell(plan);
  shell = ensureDrawgleIds(shell, "dg-nav").code;
  if (!validateNavigationShell(shell, plan)) throw new Error("The shared navigation did not pass validation; no changes were saved.");
  const payload = navigationSnapshotSchema.parse({ plan, shellCode: shell, assignments });
  const changed = JSON.stringify(before) !== JSON.stringify(payload);
  if (changed) {
    if (snapshot) {
      const result = await persistDesignChange(admin, identity, { expectedRevision: snapshot.revision, requestId: request.userMessageId,
        payload, label: intent === "reuse" ? "Reused shared navigation" : "Redesigned shared navigation", origin: "ai-edit" });
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
  return { changed, message: changed ? intent === "reuse" && !creating ? "Applied the shared project navigation, preserving its design and icons." : "Updated the shared project navigation." : "This screen already uses the shared project navigation." };
}
