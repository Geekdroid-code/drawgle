import "server-only";
import { isScreenScopedRun } from "./reference-authority";

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
  return (await findLatestProjectReference({ admin, projectId, ownerId, excludeGenerationRunId }))?.imagePath ?? null;
}

// Include the latest no-reference run, otherwise an older non-null image can
// silently revive discarded evidence. Legacy rows retain project-reference behavior.
export async function findLatestProjectReference({ admin, projectId, ownerId, excludeGenerationRunId }: {
  admin: AdminClient; projectId: string; ownerId: string; excludeGenerationRunId?: string | null;
}): Promise<{ imagePath: string | null; policy: "no_reference" | "curated_evidence" | "project_reference" } | null> {
  // Page past scoped attachments; never lose the source on long-lived projects.
  for (let offset = 0; ; offset += 100) {
    let query = admin.from("generation_runs").select("image_path, metadata")
      .eq("project_id", projectId).eq("owner_id", ownerId).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99);
    if (excludeGenerationRunId) query = query.neq("id", excludeGenerationRunId);
    const { data: rows, error } = await query;
    if (error) throw error;
    const data = rows?.find(row => !isScreenScopedRun(row.metadata as Record<string, unknown> | null));
    if (data) {
      const metadata = data.metadata as Record<string, unknown> | null;
      if (metadata?.referencePolicy === "no_reference") return { imagePath: null, policy: "no_reference" };
      if (!data.image_path) return null;
      return { imagePath: data.image_path, policy: metadata?.referencePolicy === "curated_evidence" || metadata?.referenceSource === "curated"
        ? "curated_evidence" : "project_reference" };
    }
    if (!rows || rows.length < 100) return null;
  }
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
