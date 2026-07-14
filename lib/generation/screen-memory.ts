import "server-only";

import { buildScreenSummaryLocally, generateEmbedding } from "@/lib/generation/embeddings";
import { indexScreenCode, isScreenBlockIndexUsable } from "@/lib/generation/block-index";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ScreenBlockIndex } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ScreenMemoryRefreshResult = {
  screenId: string;
  status: "updated" | "unchanged" | "superseded" | "missing";
  rebuiltBlockIndex: boolean;
};

export async function refreshScreenRetrievalMemory(
  admin: AdminClient,
  screenId: string,
): Promise<ScreenMemoryRefreshResult> {
  const { data: screen, error } = await admin
    .from("screens")
    .select("id, name, prompt, code, summary, embedding, block_index, updated_at")
    .eq("id", screenId)
    .maybeSingle();

  if (error) throw error;
  if (!screen) return { screenId, status: "missing", rebuiltBlockIndex: false };

  const storedBlockIndex = screen.block_index as ScreenBlockIndex | null;
  const blockIndexUsable = isScreenBlockIndexUsable(screen.code, storedBlockIndex);
  const blockIndex = blockIndexUsable ? storedBlockIndex! : indexScreenCode(screen.code);
  const summary = buildScreenSummaryLocally(screen.name, screen.code, screen.prompt, blockIndex);
  const hasEmbedding = Array.isArray(screen.embedding) && screen.embedding.length > 0;

  if (screen.summary === summary && hasEmbedding && blockIndexUsable) {
    return { screenId, status: "unchanged", rebuiltBlockIndex: false };
  }

  const embedding = await generateEmbedding(summary, "RETRIEVAL_DOCUMENT");
  const { data: updated, error: updateError } = await admin
    .from("screens")
    .update({
      summary,
      embedding: embedding as never,
      block_index: blockIndex as never,
    })
    .eq("id", screenId)
    .eq("updated_at", screen.updated_at)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  return {
    screenId,
    status: updated ? "updated" : "superseded",
    rebuiltBlockIndex: !blockIndexUsable,
  };
}
