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

// Include the latest no-reference run, otherwise an older non-null image can
// silently revive discarded evidence. Legacy rows retain project-reference behavior.
export async function findLatestProjectReference({ admin, projectId, ownerId, excludeGenerationRunId }: {
  admin: AdminClient; projectId: string; ownerId: string; excludeGenerationRunId?: string | null;
}): Promise<{ imagePath: string | null; policy: "no_reference" | "curated_evidence" | "project_reference" } | null> {
  let query = admin.from("generation_runs").select("image_path, metadata")
    .eq("project_id", projectId).eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(1);
  if (excludeGenerationRunId) query = query.neq("id", excludeGenerationRunId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const metadata = data.metadata as Record<string, unknown> | null;
  if (metadata?.referencePolicy === "no_reference") return { imagePath: null, policy: "no_reference" };
  if (!data.image_path) return null;
  return { imagePath: data.image_path, policy: metadata?.referencePolicy === "curated_evidence" || metadata?.referenceSource === "curated"
    ? "curated_evidence" : "project_reference" };
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
