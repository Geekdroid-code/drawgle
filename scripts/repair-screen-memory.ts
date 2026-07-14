import { createAdminClient } from "@/lib/supabase/admin";
import { buildScreenSummaryLocally, generateEmbedding } from "@/lib/generation/embeddings";
import { indexScreenCode, isScreenBlockIndexUsable } from "@/lib/generation/block-index";
import type { ScreenBlockIndex } from "@/lib/types";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
};
const projectId = valueAfter("--project-id");
const cursor = valueAfter("--cursor");
const parsedLimit = Number.parseInt(valueAfter("--limit") ?? "100", 10);
const limit = Number.isFinite(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;
const parsedConcurrency = Number.parseInt(valueAfter("--concurrency") ?? "2", 10);
const concurrency = Number.isFinite(parsedConcurrency) ? Math.min(2, Math.max(1, parsedConcurrency)) : 2;

async function main() {
const admin = createAdminClient();
let query = admin
  .from("screens")
  .select("id, project_id, name, prompt, code, summary, embedding, block_index")
  .order("id", { ascending: true })
  .limit(limit);
if (projectId) query = query.eq("project_id", projectId);
if (cursor) query = query.gt("id", cursor);

const { data, error } = await query;
if (error) throw error;

const screens = data ?? [];
const report: Array<Record<string, unknown>> = [];
let nextIndex = 0;

const worker = async () => {
  while (nextIndex < screens.length) {
    const index = nextIndex;
    nextIndex += 1;
    const screen = screens[index];
    const storedIndex = screen.block_index as ScreenBlockIndex | null;
    const blockIndexUsable = isScreenBlockIndexUsable(screen.code, storedIndex);
    const blockIndex = blockIndexUsable ? storedIndex! : indexScreenCode(screen.code);
    const summary = buildScreenSummaryLocally(screen.name, screen.code, screen.prompt, blockIndex);
    const summaryChanged = summary !== screen.summary;
    const embeddingMissing = !Array.isArray(screen.embedding) || screen.embedding.length === 0;
    const needsRepair = summaryChanged || embeddingMissing || !blockIndexUsable;
    const item: Record<string, unknown> = {
      screenId: screen.id,
      projectId: screen.project_id,
      summaryChanged,
      embeddingMissing,
      blockIndexStale: !blockIndexUsable,
      applied: false,
    };

    if (apply && needsRepair) {
      const embedding = await generateEmbedding(summary, "RETRIEVAL_DOCUMENT");
      const { error: updateError } = await admin.from("screens").update({
        summary,
        embedding: embedding as never,
        block_index: blockIndex as never,
      }).eq("id", screen.id);
      if (updateError) throw updateError;
      item.applied = true;
    }
    report.push(item);
  }
};

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const pending = report.filter((item) => item.summaryChanged || item.embeddingMissing || item.blockIndexStale).length;
console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  scanned: screens.length,
  pending,
  applied: report.filter((item) => item.applied).length,
  nextCursor: screens.at(-1)?.id ?? cursor ?? null,
  report,
}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
