import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { Type } from "@google/genai";
import { z } from "zod";
import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import type { PromptImagePayload } from "@/lib/types";
import type { ProductExperience } from "./experience";
import type { PlanningStore } from "./store";
import { loadPlanningReference } from "./references";

export const sourceHash = (image: PromptImagePayload) => createHash("sha256").update(image.data).digest("hex");
const boundsSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1) });
const candidatesSchema = z.array(z.object({ index: z.number().int().positive(), bounds: boundsSchema })).max(24);

export async function cropSourceFrame(image: PromptImagePayload, bounds: z.infer<typeof boundsSchema>) {
  const checked = boundsSchema.parse(bounds);
  if (checked.x + checked.width > 1 || checked.y + checked.height > 1) throw new Error("Source bounds exceed the composite.");
  const source = Buffer.from(image.data, "base64");
  const metadata = await sharp(source).metadata();
  const left = Math.floor(checked.x * metadata.width!);
  const top = Math.floor(checked.y * metadata.height!);
  const width = Math.min(metadata.width! - left, Math.ceil(checked.width * metadata.width!));
  const height = Math.min(metadata.height! - top, Math.ceil(checked.height * metadata.height!));
  if (width < 120 || height < 120) throw new Error("Source frame lacks usable detail.");
  const data = await sharp(source).extract({ left, top, width, height }).webp({ lossless: true }).toBuffer();
  return { data: data.toString("base64"), mimeType: "image/webp" };
}

// Geometry alone cannot prove that a crop includes the right overlay/shadow.
// Verify proposed crops against the full source pixels before persisting approval evidence.
export async function verifySourceDetails(admin: PlanningStore, ownerId: string, image: PromptImagePayload, raw: unknown): Promise<NonNullable<ProductExperience["sourceFrames"]>> {
  const parsed = candidatesSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.length || new Set(parsed.data.map(f => f.index)).size !== parsed.data.length) return [];
  const candidates: Array<z.infer<typeof candidatesSchema>[number] & { image: PromptImagePayload }> = [];
  for (const frame of parsed.data) {
    try { candidates.push({ ...frame, image: await cropSourceFrame(image, frame.bounds) }); } catch { /* Full source remains authoritative. */ }
  }
  if (!candidates.length) return [];
  const policy = geminiPolicyForTask("project_planning", {
    maxOutputTokens: 1000, responseMimeType: "application/json",
    systemInstruction: "Verify each labelled candidate crop against the first image (the full original composite). Approve its index only if it is exactly that one-based source frame in reading order, includes its entire visible UI/overlay/chrome/shadows and contains no neighbouring frame. Reject uncertainty or cut content. Do not approve just because coordinates are valid. Return approvedIndices only; no design interpretation.",
    responseSchema: { type: Type.OBJECT, properties: { approvedIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } } }, required: ["approvedIndices"] },
  });
  let approved: number[];
  try {
    const response = await createGeminiClient().models.generateContent({ model: policy.model, config: policy.config,
      contents: [{ role: "user", parts: [{ text: "Full original composite" }, { inlineData: image },
        ...candidates.flatMap(frame => [{ text: `Candidate frame ${frame.index}` }, { inlineData: frame.image }])] }] });
    approved = z.object({ approvedIndices: z.array(z.number().int().positive()).max(24) }).parse(JSON.parse(response.text || "{}")).approvedIndices;
  } catch { return []; }
  const frames: NonNullable<ProductExperience["sourceFrames"]> = [];
  for (const frame of candidates.filter(frame => approved.includes(frame.index))) {
    const hash = sourceHash(frame.image);
    const path = `${ownerId}/prompt-images/crop-v1-${hash}.webp`;
    const { error } = await admin.storage.from("generation-assets").upload(path, Buffer.from(frame.image.data, "base64"), { contentType: "image/webp", upsert: true });
    if (error) throw error;
    frames.push({ index: frame.index, bounds: frame.bounds, sourceHash: sourceHash(image), path, hash, transformVersion: 1 });
  }
  return frames;
}

export async function loadSourceDetail(admin: PlanningStore, ownerId: string, image: PromptImagePayload, experience: ProductExperience | null | undefined, index: number) {
  const frame = experience?.sourceFrames?.find(frame => frame.index === index);
  if (!frame || frame.sourceHash !== sourceHash(image)) return null;
  const crop = await loadPlanningReference(admin, frame.path, ownerId);
  if (!crop || sourceHash(crop) !== frame.hash) throw new Error("Approved source derivative changed. Restore the approved evidence before retrying.");
  return crop;
}
