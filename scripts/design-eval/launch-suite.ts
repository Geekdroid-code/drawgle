/**
 * The launch test set: replays approval cards the founder already approved, through the real production pipeline,
 * and checks every result automatically, so that a release is judged by a fixed set of projects instead of by
 * finding bugs one project at a time.
 *
 * A replay does what the Build button does after an approval (app/api/generations/route.ts): a new project with the
 * approved plan, its root generation run, and the generate-product-flow task. It skips the chat, so the same card
 * is built the same way every time; what varies is only what the models return.
 *
 *   plan                  lists the sources and what a run costs; changes nothing
 *   run [projectId ...]   replays each source's approval, waits for it, audits it (model money and in-app credits)
 *   audit <projectId ...> audits existing projects; changes nothing and costs nothing
 *
 * Run it with the app's environment, which it reads itself (never print it):
 *   pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/design-eval/launch-suite.ts plan
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { tasks } from "@trigger.dev/sdk";
import * as lucide from "lucide-react";

import { hexDeltaE } from "@/lib/color-lab";
import { SCREEN_GENERATION_CREDIT_COST, STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import { cardDisappearsIntoPage } from "@/lib/generation/prompts";
import { compileProductContent } from "@/lib/product-planning/content-contract";
import { productScopeContract } from "@/lib/product-planning/generation-context";
import { readProductPlanning, type ProductPlanning } from "@/lib/product-planning/model";
import { productReferenceExecution } from "@/lib/product-planning/reference-execution";
import { parseStoredNavigationPlan } from "@/lib/project-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DesignTokens, ProjectCharter } from "@/lib/types";
import type { generateProductFlowTask } from "@/trigger/generate-product-flow";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The founder's own approvals from the live tests of 2026-09-30, one per kind of project: a curated reference with
 * a full spec, a one-line idea, uploaded style references, Image to UI with fewer frames than steps, a bold look the
 * user asked for, a niche product, and a flow with a bottom bar.
 */
export const DEFAULT_SOURCES: Array<{ projectId: string; why: string }> = [
  { projectId: "50b9ab73-f881-4889-a17b-122cbb093210", why: "invoice tracker, full spec with colours and a curated reference" },
  { projectId: "dba0010e-1da8-4bd9-8fbb-27fb1df79e39", why: "private jet charters, a one-line idea" },
  { projectId: "9cde5aef-833b-4e96-a597-e6425c380a95", why: "habit tracker from an uploaded style" },
  { projectId: "b89aa8e1-cbe0-44cc-b5c7-31a6381ba0c8", why: "Image to UI with one frame and a four-step request" },
  { projectId: "2329071e-4e98-4035-b6ca-1ba41e7252f7", why: "neo-brutalist sneaker drops, a look the user asked for" },
  { projectId: "056b59db-7fcc-450d-930e-f6d2d5e0d199", why: "beekeeping log from an uploaded style, a niche product" },
  { projectId: "bcc377f9-a147-4942-899a-b1170a19de50", why: "hobby gear swapper" },
  { projectId: "3d367bbe-5e0c-4196-a1ed-cc49422d7241", why: "coffee-shop loyalty with numbers and a bottom bar" },
];

/** How long one replay may take before it is reported as stuck. */
const RUN_TIMEOUT_MS = 30 * 60_000;
const POLL_MS = 15_000;
/** A saved screen with fewer elements than this is blank, whatever its status says. */
const BLANK_SCREEN_ELEMENTS = 30;

const now = () => new Date().toISOString();
const elementCount = (code: string) => (code.match(/<[a-z][a-z0-9-]*\b/gi) ?? []).length;

type Source = { projectId: string; ownerId: string; name: string; snapshot: ProductPlanning };

/** The approved plan the Build button sent for a project: its first product generation's snapshot. */
async function readSource(admin: Admin, projectId: string): Promise<Source> {
  const { data: project, error: projectError } = await admin.from("projects").select("owner_id, name").eq("id", projectId).single();
  if (projectError) throw projectError;
  const { data: runs, error } = await admin.from("generation_runs").select("metadata, created_at")
    .eq("project_id", projectId).order("created_at", { ascending: true }).limit(20);
  if (error) throw error;
  for (const run of runs ?? []) {
    const metadata = run.metadata as Record<string, unknown> | null;
    if (metadata?.requestedFrom !== "nextjs-route") continue;
    const snapshot = readProductPlanning(metadata.productPlanning);
    if (snapshot?.scope?.status === "approved" && snapshot.scope.manifest?.length) {
      return { projectId, ownerId: project.owner_id, name: project.name, snapshot: { ...snapshot, lease: null } };
    }
  }
  throw new Error(`${projectId} has no approved product generation to replay`);
}

const creditsOf = (snapshot: ProductPlanning) => (snapshot.scope?.manifest ?? [])
  .reduce((total, item) => total + (item.kind === "screen" ? SCREEN_GENERATION_CREDIT_COST : STATE_GENERATION_CREDIT_COST), 0);

/** A new project from a source's approval, started the way the Build button starts one. */
async function replay(admin: Admin, source: Source) {
  const { snapshot, ownerId } = source;
  const reference = productReferenceExecution(snapshot);
  const scopeContract = productScopeContract(snapshot, reference.mode);
  const productContent = compileProductContent(snapshot);
  const imageReferenceMode = reference.mode === "user_recreate" ? "recreate" as const : "style" as const;

  const { data: project, error: projectError } = await admin.from("projects").insert({
    owner_id: ownerId, name: `[Test] ${source.name}`.slice(0, 120), prompt: snapshot.scope!.goal, status: "queued",
    product_planning: snapshot as never, created_at: now(), updated_at: now(),
  }).select("id").single();
  if (projectError || !project) throw projectError ?? new Error("Failed to create the test project.");

  const { data: run, error: runError } = await admin.from("generation_runs").insert({
    project_id: project.id, owner_id: ownerId, prompt: snapshot.scope!.goal, image_path: reference.imagePath,
    requested_screen_count: scopeContract.finalScreenCount ?? null, status: "queued", created_at: now(), updated_at: now(),
    metadata: {
      generationEngineVersion: "v2", requestedFrom: "launch-suite", launchSuiteSource: source.projectId,
      sourceGenerationRunId: null, isNewProject: true, productPlanning: snapshot, productContextSnapshot: snapshot,
      performanceV1: { version: 1, requestAcceptedAt: now() }, requestedImageReferenceMode: imageReferenceMode,
      referencePolicy: reference.policy, referenceScope: "project", requestedDesignStyleId: null,
      requestedStylePresetSlug: snapshot.input.stylePresetSlug ?? null, requestedStylePresetVersion: null, designStyle: null,
      scopeContract, navigationArchitecture: null, navigationPlan: null, plannedScreens: null, screenPlanningSeeds: null,
      planningMode: null, baseState: null, stateVariants: [], selectedStateVariantIds: [], retryContext: null, productContent,
      roadmapBuild: null, roadmap: null, initialBatchItemKeys: [],
    } as never,
  }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Failed to create the test run.");

  // What the approval saves once its run is queued (lib/product-planning/approval.ts, queued()).
  const { error: queuedError } = await admin.from("projects").update({
    product_planning: { ...snapshot, phase: "canvas", lease: null, screenReference: null,
      scope: { ...snapshot.scope!, generationRunId: run.id }, input: { ...snapshot.input, imageReferenceMode: "style" } } as never,
  }).eq("id", project.id);
  if (queuedError) throw queuedError;

  const handle = await tasks.trigger<typeof generateProductFlowTask>("generate-product-flow", {
    generationRunId: run.id, projectId: project.id, ownerId, prompt: snapshot.scope!.goal, imagePath: reference.imagePath,
    imageReferenceMode, referencePolicy: reference.policy, referenceScope: "project", designStyleId: null,
    stylePresetSlug: snapshot.input.stylePresetSlug ?? null, designTokens: null, plannedScreens: null, screenPlanningSeeds: null,
    scopeContract, referenceAnalysis: null, navigationArchitecture: null, navigationPlan: null, projectCharter: null,
    productPlanning: snapshot, productContextSnapshot: snapshot, planningMode: "project", baseState: null, stateVariants: [],
    retryContext: null, productContent, projectRoadmap: null, initialBatchItemKeys: [], isNewProject: true,
  } as never, { concurrencyKey: ownerId, idempotencyKey: `generation:${run.id}`, idempotencyKeyTTL: "30d", ttl: "30m" });
  await admin.from("generation_runs").update({ trigger_run_id: handle.id, updated_at: now() }).eq("id", run.id);
  return { projectId: project.id, rootRunId: run.id };
}

async function waitForRun(admin: Admin, runId: string) {
  const started = Date.now();
  while (Date.now() - started < RUN_TIMEOUT_MS) {
    const { data, error } = await admin.from("generation_runs").select("status").eq("id", runId).single();
    if (error) throw error;
    if (["completed", "failed", "canceled"].includes(data.status)) return data.status as string;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return "timed out";
}

/** Lucide's own lookup: the PascalCase key, then the letters and digits alone (lib/lucide-runtime.ts). */
const lucideKeys = new Set(Object.keys(lucide));
const byLetters = new Map([...lucideKeys].map((key) => [key.toLowerCase(), key]));
const knownIcon = (name: string) => {
  const key = name.replace(/^([A-Z])|[\s\-_]+(\w)/g, (_, first: string, next: string) => next ? next.toUpperCase() : first.toLowerCase());
  return lucideKeys.has(key.charAt(0).toUpperCase() + key.slice(1)) || byLetters.has(name.replace(/[^a-z0-9]/gi, "").toLowerCase());
};

export type Finding = { level: "fail" | "warn"; check: string; detail: string };

/** Every check the founder has had to make by eye, made on a project's stored results. */
export async function auditProject(admin: Admin, projectId: string) {
  const findings: Finding[] = [];
  const fail = (check: string, detail: string) => findings.push({ level: "fail", check, detail });
  const warn = (check: string, detail: string) => findings.push({ level: "warn", check, detail });

  const { data: project, error } = await admin.from("projects").select("name, product_planning, project_charter, design_tokens").eq("id", projectId).single();
  if (error) throw error;
  const planning = readProductPlanning(project.product_planning);
  const charter = project.project_charter as ProjectCharter | null;
  const { data: screenRows } = await admin.from("screens").select("name, status, code, navigation_item_id, error").eq("project_id", projectId);
  const screens = (screenRows ?? []) as Array<{ name: string; status: string; code: string | null; navigation_item_id: string | null; error: string | null }>;
  const { data: navigationRow } = await admin.from("project_navigation").select("plan").eq("project_id", projectId).maybeSingle();
  const { data: runs } = await admin.from("generation_runs").select("id, status, error, metadata").eq("project_id", projectId);

  // Every approved screen was built.
  const approvedScreens = (planning?.scope?.manifest ?? []).filter((item) => item.kind === "screen").map((item) => item.name);
  const byName = new Map((screens ?? []).map((screen) => [screen.name.toLowerCase(), screen] as const));
  for (const name of approvedScreens) {
    const screen = byName.get(name.toLowerCase());
    if (!screen) fail("screens", `"${name}" was never created`);
    else if (screen.status !== "ready") fail("screens", `"${name}" is ${screen.status}${screen.error ? `: ${screen.error}` : ""}`);
    else if (elementCount(screen.code ?? "") < BLANK_SCREEN_ELEMENTS) fail("screens", `"${name}" is ready but nearly empty (${elementCount(screen.code ?? "")} elements)`);
  }
  for (const run of runs ?? []) {
    if (run.status === "failed" && run.error) warn("runs", `a run failed: ${String(run.error).slice(0, 160)}`);
  }

  // The component kit, and its bar when the project has one.
  const kit = charter?.componentKit;
  // A project's saved plan says "style" once its run is queued, so Image to UI is read from the charter.
  const recreate = charter?.projectOrigin === "image_to_ui";
  if (!recreate && approvedScreens.length >= 2) {
    if (!kit?.components?.length) warn("kit", "no component kit");
    else if (kit.components.length < 5) warn("kit", `a thin kit of ${kit.components.length} components`);
  }
  const kitTiming = (runs ?? []).map((run) => (run.metadata as Record<string, unknown> | null)?.performanceV1)
    .map((performance) => (performance as Record<string, unknown> | undefined)?.componentKit).find(Boolean);

  // The bottom bar: on when approved, each tab on its own screen, each screen lit by its own tab.
  const approvedNavigation = planning?.scope?.navigation;
  const plan = navigationRow ? parseStoredNavigationPlan(navigationRow.plan) : null;
  if (approvedNavigation?.persistent) {
    if (!plan?.enabled) fail("navigation", "the approved bottom bar is missing");
    else {
      if (!plan.design?.kit) warn("navigation", "the bar is a built-in one, not the kit's");
      const screenNames = new Set((screens ?? []).map((screen) => screen.name.toLowerCase()));
      const manifestKeys = new Set((planning?.scope?.manifest ?? []).map((item) => item.stableKey));
      for (const item of plan.items) {
        // A tab the card approved for a screen outside this flow opens nothing yet, by design; one for a screen the
        // flow builds must open it.
        const approved = (approvedNavigation.destinations ?? []).find((destination) => destination.label.toLowerCase() === item.label.toLowerCase());
        const outsideFlow = Boolean(approved && (!approved.screenKey || !manifestKeys.has(approved.screenKey)));
        if (!item.linkedScreenName) {
          if (outsideFlow) warn("navigation", `tab "${item.label}" is for a screen this flow does not build, so it opens nothing`);
          else fail("navigation", `tab "${item.label}" opens no screen`);
        } else if (!screenNames.has(item.linkedScreenName.toLowerCase())) {
          fail("navigation", `tab "${item.label}" opens "${item.linkedScreenName}", which does not exist`);
        }
      }
      for (const screen of screens ?? []) {
        if (!screen.navigation_item_id) continue;
        const item = plan.items.find((candidate) => candidate.id === screen.navigation_item_id);
        if (!item) fail("navigation", `"${screen.name}" lights tab "${screen.navigation_item_id}", which is not in the bar`);
        else if (item.linkedScreenName?.toLowerCase() !== screen.name.toLowerCase()) {
          fail("navigation", `"${screen.name}" lights tab "${item.label}", which opens "${item.linkedScreenName ?? "nothing"}"`);
        }
      }
      const manifestNames = new Map((planning?.scope?.manifest ?? []).map((item) => [item.stableKey, item.name]));
      for (const destination of approvedNavigation.destinations ?? []) {
        const screenName = destination.screenKey ? manifestNames.get(destination.screenKey) : undefined;
        if (screenName && !plan.items.some((item) => item.linkedScreenName?.toLowerCase() === screenName.toLowerCase())) {
          fail("navigation", `the approved tab "${destination.label}" does not open "${screenName}"`);
        }
      }
    }
  }

  // Icons that draw nothing.
  const iconNames = new Set<string>();
  for (const screen of screens ?? []) for (const match of (screen.code ?? "").matchAll(/data-lucide="([^"]+)"/g)) iconNames.add(match[1]);
  for (const item of plan?.items ?? []) iconNames.add(item.icon);
  const unknownIcons = [...iconNames].filter((name) => name !== "{{icon}}" && !knownIcon(name));
  if (unknownIcons.length) warn("icons", `icons Lucide may not have: ${unknownIcons.slice(0, 8).join(", ")}`);

  // Surfaces that disappear into the page.
  const tokens = project.design_tokens as DesignTokens | null;
  if (!recreate && cardDisappearsIntoPage(tokens)) {
    const inset = tokens?.tokens?.color?.surface?.inset;
    const page = tokens?.tokens?.color?.background?.primary;
    warn("surfaces", `cards are the page's colour; tiles rely on the inset fill (${inset ?? "none"}, ΔE ${hexDeltaE(inset, page)?.toFixed(1) ?? "?"} from the page)`);
  }

  return { projectId, name: project.name, pass: !findings.some((finding) => finding.level === "fail"), findings, kitTiming: kitTiming ?? null };
}

const printAudit = (audit: Awaited<ReturnType<typeof auditProject>>) => {
  console.log(`\n${audit.pass ? "PASS" : "FAIL"}  ${audit.name}  (${audit.projectId})`);
  if (audit.kitTiming) console.log(`      kit: ${JSON.stringify(audit.kitTiming).slice(0, 240)}`);
  for (const finding of audit.findings) console.log(`      ${finding.level === "fail" ? "✗" : "!"} [${finding.check}] ${finding.detail}`);
};

async function main() {
  const [command = "plan", ...ids] = process.argv.slice(2);
  const admin = createAdminClient();

  if (command === "audit") {
    if (!ids.length) throw new Error("Usage: launch-suite.ts audit <projectId ...>");
    for (const id of ids) printAudit(await auditProject(admin, id));
    return;
  }

  const sourceIds = ids.length ? ids : DEFAULT_SOURCES.map((source) => source.projectId);
  const sources = await Promise.all(sourceIds.map((id) => readSource(admin, id)));
  const credits = sources.reduce((total, source) => total + creditsOf(source.snapshot), 0);
  const screens = sources.reduce((total, source) => total + (source.snapshot.scope?.manifest ?? []).filter((item) => item.kind === "screen").length, 0);
  console.log(`${sources.length} projects, ${screens} screens, ${credits} in-app credits, and each screen's model builds plus one component kit per project.`);
  for (const source of sources) console.log(`  - ${source.name} (${source.projectId}): ${creditsOf(source.snapshot)} credits`);
  if (command !== "run") return;

  const results: Array<Awaited<ReturnType<typeof auditProject>> & { source: string; status: string }> = [];
  for (const source of sources) {
    const started = await replay(admin, source);
    console.log(`\nstarted ${source.name} as ${started.projectId}`);
    const status = await waitForRun(admin, started.rootRunId);
    console.log(`finished: ${status}`);
    const audit = await auditProject(admin, started.projectId);
    printAudit(audit);
    results.push({ source: source.projectId, status, ...audit });
  }
  const passed = results.filter((result) => result.pass).length;
  console.log(`\n${passed} of ${results.length} projects passed.`);
  mkdirSync("scripts/design-eval/out/launch-suite", { recursive: true });
  const file = `scripts/design-eval/out/launch-suite/${now().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(`report: ${file}`);
}

main().then(() => process.exit(0), (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
