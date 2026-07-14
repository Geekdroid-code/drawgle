import "server-only";

import { Buffer } from "node:buffer";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PromptImagePayload } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function findLatestProjectPromptImagePath({
  admin,
  projectId,
  ownerId,
  excludeGenerationRunId,
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
  excludeGenerationRunId?: string | null;
}): Promise<string | null> {
  let query = admin
    .from("generation_runs")
    .select("image_path")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .not("image_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (excludeGenerationRunId) {
    query = query.neq("id", excludeGenerationRunId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.image_path ?? null;
}

export async function loadStoredPromptImage(
  admin: AdminClient,
  imagePath?: string | null,
): Promise<PromptImagePayload | null> {
  if (!imagePath) return null;

  const { data, error } = await admin.storage.from("generation-assets").download(imagePath);
  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: data.type || "application/octet-stream",
  };
}
