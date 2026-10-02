/**
 * Exports what one project's chat and canvas show (its row, screens with their code, shared navigation, chat
 * messages, generation runs and the latest approval's claims) to scripts/design-eval/out/replay/<id>.json, for the
 * dev-only replay page (/dev/chat-replay). Read-only: it selects and writes a local, git-ignored file. No model calls.
 *
 *   pnpm exec tsx --env-file-if-exists=.env.local --conditions=react-server scripts/design-eval/export-replay.ts <project-id>...
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";

const OUT = path.join("scripts", "design-eval", "out", "replay");

async function exportProject(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const failed = (label: string, error: unknown) => new Error(`${label}: ${JSON.stringify(error)}`);
  const project = await admin.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (project.error) throw failed("project", project.error);
  if (!project.data) throw new Error(`Project ${projectId} not found.`);
  const screens = await admin.from("screens").select("*").eq("project_id", projectId).order("sort_index", { ascending: true });
  if (screens.error) throw failed("screens", screens.error);
  const navigation = await admin.from("project_navigation").select("*").eq("project_id", projectId).maybeSingle();
  if (navigation.error) throw failed("navigation", navigation.error);
  const messages = await admin.from("project_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (messages.error) throw failed("messages", messages.error);
  const runs = await admin.from("generation_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (runs.error) throw failed("runs", runs.error);
  const root = (runs.data ?? []).find((run) => {
    const metadata = (run.metadata ?? {}) as Record<string, unknown>;
    return Boolean((metadata.productPlanning as { scope?: { manifest?: unknown } } | undefined)?.scope?.manifest) && !metadata.productApprovalId;
  });
  const fulfillments = root
    ? await admin.from("product_output_fulfillments").select("*").eq("approval_id", root.id)
    : { data: [], error: null };
  if (fulfillments.error) throw failed("fulfillments", fulfillments.error);
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${projectId}.json`);
  await writeFile(file, JSON.stringify({
    exportedAt: new Date().toISOString(), project: project.data, screens: screens.data, navigation: navigation.data,
    messages: messages.data, runs: runs.data, fulfillments: fulfillments.data,
  }, null, 1));
  console.log(`${projectId}: ${screens.data?.length ?? 0} screens, ${messages.data?.length ?? 0} messages, ${runs.data?.length ?? 0} runs -> ${file}`);
}

async function main() {
  const ids = process.argv.slice(2).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  if (!ids.length) throw new Error("Pass one or more project ids.");
  const admin = createAdminClient();
  for (const id of ids) await exportProject(admin, id);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
