import "server-only";
import { Buffer } from "node:buffer";
import { normalizeReferenceImage } from "@/lib/generation/reference-image";
import type { PromptImagePayload } from "@/lib/types";
import type { PlanningStore } from "./store";

export async function storePlanningReference(admin: PlanningStore, ownerId: string, image: PromptImagePayload) {
  const normalized = await normalizeReferenceImage(image);
  const path = `${ownerId}/prompt-images/${normalized.sha256}.webp`;
  const { error } = await admin.storage.from("generation-assets").upload(path, Buffer.from(normalized.image.data, "base64"), {
    contentType: normalized.image.mimeType, upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function loadPlanningReference(admin: PlanningStore, path: string | null, ownerId: string): Promise<PromptImagePayload | null> {
  if (!path) return null;
  if (!path.startsWith(`${ownerId}/prompt-images/`) || path.includes("..")) throw new Error("The product reference does not belong to this project owner.");
  const { data, error } = await admin.storage.from("generation-assets").download(path);
  if (error) throw error;
  return { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mimeType: data.type || "image/webp" };
}
