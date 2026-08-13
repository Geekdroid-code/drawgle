import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";

const TARGET_PROJECT_ID = "473dd8b7-0556-47b0-89e3-b4c9a29cfe84";
const PROVIDER_STABLE_KEY = "screen:provider-booking";
const PROVIDER_NAME = "Provider Booking";
const PROVIDER_DESCRIPTION = "Select a nearby groomer or veterinarian, review services and provider details, choose an available date and time, and confirm the visit.";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
};
const projectId = valueAfter("--project-id");

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const fail = (message: string): never => {
  throw new Error(`Repair guard rejected the project: ${message}`);
};

async function main() {
  if (!projectId) fail("pass --project-id explicitly");
  if (projectId !== TARGET_PROJECT_ID) fail(`this repair only supports ${TARGET_PROJECT_ID}`);

  const admin = createAdminClient();
  const [{ data: project, error: projectError }, { data: runs, error: runsError }, { data: roadmapData, error: roadmapError }] = await Promise.all([
    admin.from("projects").select("id, owner_id, prompt").eq("id", projectId).maybeSingle(),
    admin.from("generation_runs").select("id, requested_screen_count, metadata, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    admin.from("project_screen_roadmap").select("*").eq("project_id", projectId).order("tranche", { ascending: true }).order("sequence", { ascending: true }),
  ]);
  if (projectError) throw projectError;
  if (runsError) throw runsError;
  if (roadmapError) throw roadmapError;
  if (!project) fail("project was not found");
  if (project.prompt.trim().toLowerCase() !== "build a hyper-local pet grooming and vet visits app the premium one") {
    fail("project prompt no longer matches the known incident");
  }

  const incidentRun = (runs ?? []).find((run) => {
    const scope = record(record(run.metadata).scopeContract);
    const diagnostics = Array.isArray(scope.diagnostics) ? scope.diagnostics : [];
    return run.requested_screen_count === 1
      && scope.finalScreenCount === 1
      && scope.imageScreenCount === 2
      && diagnostics.some((item) => typeof item === "string" && item.includes("trailing action count"));
  });
  if (!incidentRun) fail("the bad one-screen scope fingerprint was not found");

  const rows = (roadmapData ?? []) as ProjectScreenRoadmapRow[];
  const dashboard = rows.find((row) => row.kind === "screen" && row.name === "Premium Pet Dashboard");
  if (!dashboard || dashboard.status !== "ready" || !dashboard.generated_screen_id) {
    fail("the ready Premium Pet Dashboard parent was not found");
  }
  const petSelector = rows.find((row) =>
    row.kind === "state"
    && (row.state_label === "Pet Selector" || row.name === "Pet Selector"));
  if (!petSelector || petSelector.parent_item_id !== dashboard.id || petSelector.status !== "planned") {
    const stateSummary = rows
      .filter((row) => row.kind === "state")
      .map((row) => `${row.name} (${row.status}, parent ${row.parent_item_id ?? "none"})`)
      .join(", ") || "none";
    fail(`the planned Pet Selector state is missing or no longer belongs to the dashboard; current states: ${stateSummary}`);
  }

  const existingProvider = rows.find((row) =>
    row.kind === "screen"
    && (row.stable_key === PROVIDER_STABLE_KEY || row.name === PROVIDER_NAME));
  const unexpectedParents = rows.filter((row) => row.kind === "screen" && row.id !== dashboard.id && row.id !== existingProvider?.id);
  if (unexpectedParents.length > 0) {
    fail(`unexpected parent screens exist: ${unexpectedParents.map((row) => row.name).join(", ")}`);
  }
  if (existingProvider && (
    existingProvider.stable_key !== PROVIDER_STABLE_KEY
    || existingProvider.name !== PROVIDER_NAME
    || existingProvider.kind !== "screen"
  )) {
    fail("an incompatible Provider Booking roadmap row already exists");
  }

  const report = {
    mode: apply ? "apply" : "dry-run",
    projectId,
    incidentRunId: incidentRun.id,
    dashboard: { id: dashboard.id, stableKey: dashboard.stable_key, status: dashboard.status },
    providerBooking: existingProvider
      ? { action: "already-present", id: existingProvider.id, status: existingProvider.status }
      : { action: "insert", stableKey: PROVIDER_STABLE_KEY, status: "planned" },
    petSelector: { id: petSelector.id, action: petSelector.sequence === 2 ? "unchanged" : "move-to-sequence-2" },
    backupPath: null as string | null,
  };

  if (apply) {
    const backupDir = join(process.cwd(), "repair-backups", "scope-incidents");
    await mkdir(backupDir, { recursive: true });
    report.backupPath = join(backupDir, `${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(report.backupPath, JSON.stringify({ project, runs, roadmap: rows }, null, 2), "utf8");

    if (!existingProvider) {
      const { error: insertError } = await admin.from("project_screen_roadmap").insert({
        project_id: projectId,
        owner_id: project.owner_id,
        parent_item_id: null,
        generated_screen_id: null,
        stable_key: PROVIDER_STABLE_KEY,
        kind: "screen",
        screen_type: "detail",
        name: PROVIDER_NAME,
        description: PROVIDER_DESCRIPTION,
        priority: "core",
        status: "planned",
        source: "planner",
        explicitly_requested: false,
        sequence: 1,
        tranche: dashboard.tranche,
        dependency_keys: [dashboard.stable_key],
        state_key: null,
        state_label: null,
        state_role: null,
        trigger_label: null,
        metadata: {
          recoveryReason: "Recovered the missing second parent screen from the deterministic trailing-count parser incident.",
          recoveryVersion: 1,
          sourceGenerationRunId: incidentRun.id,
        },
      });
      if (insertError) throw insertError;
    }

    if (petSelector.sequence !== 2) {
      const { error: stateUpdateError } = await admin
        .from("project_screen_roadmap")
        .update({ sequence: 2 })
        .eq("id", petSelector.id)
        .eq("status", "planned");
      if (stateUpdateError) throw stateUpdateError;
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
