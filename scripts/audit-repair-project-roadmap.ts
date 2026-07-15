import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readScreenPlanProposal } from "@/lib/agent/message-metadata";
import { roadmapIdentityFingerprint } from "@/lib/generation/project-roadmap";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectScreenRoadmapRow } from "@/lib/supabase/database.types";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
};
const projectId = valueAfter("--project-id");

const statusRank: Record<ProjectScreenRoadmapRow["status"], number> = {
  ready: 0,
  building: 1,
  queued: 2,
  planned: 3,
  failed: 4,
  dismissed: 5,
};

const identity = (row: ProjectScreenRoadmapRow) => roadmapIdentityFingerprint(
  row.kind === "state" ? row.state_key ?? row.state_label ?? row.name : row.name,
);

const pickSurvivor = (rows: ProjectScreenRoadmapRow[]) => rows.slice().sort((left, right) =>
  Number(Boolean(right.generated_screen_id)) - Number(Boolean(left.generated_screen_id))
  || statusRank[left.status] - statusRank[right.status]
  || left.created_at.localeCompare(right.created_at)
  || left.id.localeCompare(right.id)
)[0];

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function main() {
  const admin = createAdminClient();
  const rows: ProjectScreenRoadmapRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    let roadmapQuery = admin
      .from("project_screen_roadmap")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);
    if (projectId) roadmapQuery = roadmapQuery.eq("project_id", projectId);
    const { data: roadmapPage, error } = await roadmapQuery;
    if (error) throw error;
    rows.push(...((roadmapPage ?? []) as ProjectScreenRoadmapRow[]));
    if ((roadmapPage ?? []).length < 1000) break;
  }
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const groups = new Map<string, ProjectScreenRoadmapRow[]>();
  for (const row of rows) {
    const parentIdentity = row.kind === "state" && row.parent_item_id
      ? identity(rowById.get(row.parent_item_id) ?? row)
      : "root";
    const key = `${row.project_id}:${row.kind}:${parentIdentity}:${identity(row)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  const safeGroups = duplicateGroups
    .filter((group) => group.filter((row) => row.generated_screen_id).length <= 1)
    .sort((left, right) => Number(right[0]?.kind === "state") - Number(left[0]?.kind === "state"));
  const preservedConflicts = duplicateGroups.filter((group) => group.filter((row) => row.generated_screen_id).length > 1);
  const backup: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    projectId,
    rows: duplicateGroups.flat(),
  };
  let backupPath: string | null = null;

  if (apply) {
    const duplicateIds = duplicateGroups.flat().map((row) => row.id);
    const affectedProjectIds = Array.from(new Set(duplicateGroups.flat().map((row) => row.project_id)));
    const [{ data: screenReferences, error: screenReferenceError }, { data: creditReferences, error: creditReferenceError }, { data: messageReferences, error: messageReferenceError }] = await Promise.all([
      duplicateIds.length
        ? admin.from("screens").select("id, project_id, roadmap_item_id").in("roadmap_item_id", duplicateIds)
        : Promise.resolve({ data: [], error: null }),
      duplicateIds.length
        ? admin.from("credit_reservations").select("id, project_id, roadmap_item_id, status").in("roadmap_item_id", duplicateIds)
        : Promise.resolve({ data: [], error: null }),
      affectedProjectIds.length
        ? admin.from("project_messages").select("id, project_id, metadata").in("project_id", affectedProjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (screenReferenceError) throw screenReferenceError;
    if (creditReferenceError) throw creditReferenceError;
    if (messageReferenceError) throw messageReferenceError;
    backup.references = {
      screens: screenReferences ?? [],
      creditReservations: creditReferences ?? [],
      projectMessages: messageReferences ?? [],
    };
    const reportDir = join(process.cwd(), "reports", "roadmap-repair");
    await mkdir(reportDir, { recursive: true });
    backupPath = join(reportDir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");

    for (const group of safeGroups) {
      const survivor = pickSurvivor(group);
      for (const duplicate of group.filter((row) => row.id !== survivor.id)) {
        await Promise.all([
          admin.from("project_screen_roadmap").update({ parent_item_id: survivor.id }).eq("parent_item_id", duplicate.id),
          admin.from("screens").update({ roadmap_item_id: survivor.id }).eq("roadmap_item_id", duplicate.id),
          admin.from("credit_reservations").update({ roadmap_item_id: survivor.id }).eq("roadmap_item_id", duplicate.id),
        ]).then((results) => {
          const failed = results.find((result) => result.error);
          if (failed?.error) throw failed.error;
        });

        const projectRows = rows.filter((row) => row.project_id === duplicate.project_id && row.id !== duplicate.id);
        for (const item of projectRows.filter((row) => row.dependency_keys.includes(duplicate.stable_key))) {
          const dependencyKeys = Array.from(new Set(item.dependency_keys.map((key) => key === duplicate.stable_key ? survivor.stable_key : key)));
          const { error: dependencyError } = await admin.from("project_screen_roadmap").update({ dependency_keys: dependencyKeys }).eq("id", item.id);
          if (dependencyError) throw dependencyError;
        }

        const aliases = Array.from(new Set([
          ...((record(survivor.metadata).identityAliases as string[] | undefined) ?? []),
          duplicate.stable_key,
        ]));
        const { error: survivorError } = await admin.from("project_screen_roadmap").update({
          metadata: { ...record(survivor.metadata), identityAliases: aliases },
        }).eq("id", survivor.id);
        if (survivorError) throw survivorError;
        const { error: deleteError } = await admin.from("project_screen_roadmap").delete().eq("id", duplicate.id);
        if (deleteError) throw deleteError;
      }
    }

    for (const group of preservedConflicts) {
      const ids = group.map((row) => row.id);
      const { error: conflictError } = await admin.from("project_screen_roadmap").update({ identity_exception: true }).in("id", ids);
      if (conflictError) throw conflictError;
    }
  }

  const messages: Array<{ id: string; project_id: string; metadata: unknown }> = [];
  for (let offset = 0; ; offset += 1000) {
    let messageQuery = admin
      .from("project_messages")
      .select("id, project_id, metadata")
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);
    if (projectId) messageQuery = messageQuery.eq("project_id", projectId);
    const { data: messagePage, error: messageError } = await messageQuery;
    if (messageError) throw messageError;
    messages.push(...(messagePage ?? []));
    if ((messagePage ?? []).length < 1000) break;
  }
  const readyStateNamesByProject = new Map<string, Set<string>>();
  for (const row of rows.filter((item) => item.kind === "state" && rowById.get(item.parent_item_id ?? "")?.status === "ready")) {
    const names = readyStateNamesByProject.get(row.project_id) ?? new Set<string>();
    names.add(roadmapIdentityFingerprint(row.state_label ?? row.name));
    readyStateNamesByProject.set(row.project_id, names);
  }
  const staleProposalIds: string[] = [];
  for (const message of messages) {
    const metadata = record(message.metadata);
    const proposal = readScreenPlanProposal(metadata);
    if (!proposal || proposal.status !== "pending") continue;
    const proposedIdentity = roadmapIdentityFingerprint(proposal.screenPlan.name.replace(/\bstate\b/gi, ""));
    if (readyStateNamesByProject.get(message.project_id)?.has(proposedIdentity)) {
      staleProposalIds.push(message.id);
      if (apply) {
        const { error: updateError } = await admin.from("project_messages").update({
          metadata: {
            ...metadata,
            screenPlanProposal: { ...proposal, status: "expired" },
            repairDiagnostic: "Expired because this full-screen proposal duplicates a state of a ready parent.",
          },
        }).eq("id", message.id);
        if (updateError) throw updateError;
      }
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    projectId,
    scannedRows: rows.length,
    duplicateGroups: duplicateGroups.length,
    safeAliasGroups: safeGroups.map((group) => group.map((row) => ({ id: row.id, stableKey: row.stable_key, name: row.name, generatedScreenId: row.generated_screen_id }))),
    preservedGeneratedConflicts: preservedConflicts.map((group) => group.map((row) => ({ id: row.id, stableKey: row.stable_key, name: row.name, generatedScreenId: row.generated_screen_id }))),
    staleFullScreenStateProposalIds: staleProposalIds,
    backupPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
