/**
 * Copies recent ready screens, as the export menu receives them, to scripts/export-fidelity/out/corpus-db.json for
 * compare.ts. Read-only: it selects rows and writes a local, git-ignored file. No model calls.
 *
 *   pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/export-fidelity/collect.ts [screens=60]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ExportProjectContext } from "@/lib/export-pipeline";
import { prepareExportSnapshot } from "@/lib/export/snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

const limit = Number(process.argv[2] ?? 60);
const outDirectory = path.join(process.cwd(), "scripts", "export-fidelity", "out");

async function main() {
  const admin = createAdminClient();
  const { data: recent, error } = await admin.from("screens").select("id, project_id")
    .eq("status", "ready").not("code", "is", null).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not list screens: ${error.message}`);

  const byProject = new Map<string, string[]>();
  for (const row of recent ?? []) byProject.set(row.project_id, [...(byProject.get(row.project_id) ?? []), row.id]);

  const contexts: ExportProjectContext[] = [];
  for (const [projectId, screenIds] of byProject) {
    const [project, screens, navigation] = await Promise.all([
      admin.from("projects").select("*").eq("id", projectId).single(),
      admin.from("screens").select("*").in("id", screenIds),
      admin.from("project_navigation").select("*").eq("project_id", projectId).maybeSingle(),
    ]);
    if (project.error || screens.error || navigation.error) {
      console.warn(`Skipped a project: ${(project.error ?? screens.error ?? navigation.error)?.message}`);
      continue;
    }
    try {
      contexts.push(prepareExportSnapshot({ project: project.data, screens: screens.data, navigation: navigation.data, specificationSources: [] }, screenIds, false));
    } catch (failure) {
      console.warn(`Skipped a project: ${failure instanceof Error ? failure.message : failure}`);
    }
  }

  await mkdir(outDirectory, { recursive: true });
  await writeFile(path.join(outDirectory, "corpus-db.json"), JSON.stringify(contexts));
  console.log(`Saved ${contexts.reduce((sum, context) => sum + context.screens.length, 0)} screens from ${contexts.length} projects.`);
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exit(1);
});
