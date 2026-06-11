import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminAuthError, requireAdminUser } from "@/lib/admin-auth";
import { importCuratedVisualAssetFromBytes } from "@/lib/generation/visual-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const UploadMetadataSchema = z.object({
  subject: z.string().trim().min(3).max(260),
  role: z.enum([
    "hero_cutout",
    "product_cutout",
    "avatar",
    "section_photo",
    "background_photo",
    "product_photo",
    "decorative_object",
    "map_texture",
  ]),
  assetType: z.enum(["transparent_png", "photo", "illustration", "icon_like"]).default("transparent_png"),
  hasAlpha: z.boolean().default(true),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  reuseKey: z.string().trim().min(1).max(160).optional(),
  license: z.string().trim().max(240).nullable().optional(),
});

const parseTags = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

const parseBoolean = (value: FormDataEntryValue | null, fallback: boolean) => {
  if (value === null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

export async function POST(req: Request) {
  try {
    const user = await requireAdminUser();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPEG, or WebP image." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image must be 12MB or smaller." }, { status: 413 });
    }

    const parsed = UploadMetadataSchema.safeParse({
      subject: formData.get("subject"),
      role: formData.get("role"),
      assetType: formData.get("assetType") || undefined,
      hasAlpha: parseBoolean(formData.get("hasAlpha"), file.type === "image/png" || file.type === "image/webp"),
      tags: parseTags(formData.get("tags")),
      reuseKey: formData.get("reuseKey") || undefined,
      license: formData.get("license") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await importCuratedVisualAssetFromBytes({
      admin,
      bytes,
      contentType: file.type,
      subject: parsed.data.subject,
      role: parsed.data.role,
      assetType: parsed.data.assetType,
      hasAlpha: parsed.data.hasAlpha,
      tags: parsed.data.tags,
      reuseKey: parsed.data.reuseKey,
      license: parsed.data.license,
      metadata: {
        adminUploaded: true,
        uploadedBy: user.id,
        uploadedByEmail: user.email ?? null,
        originalFilename: file.name || null,
        importedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      id: saved.asset.id,
      subject: saved.asset.subject,
      role: saved.asset.role,
      assetType: saved.asset.asset_type,
      publicUrl: saved.asset.public_url,
      displayUrl: saved.displayVariant?.public_url ?? saved.asset.public_url,
      width: saved.displayVariant?.width ?? saved.asset.width,
      height: saved.displayVariant?.height ?? saved.asset.height,
      hasAlpha: saved.asset.has_alpha,
      verificationStatus: saved.asset.verification_status,
      verificationScore: saved.asset.verification_score,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Curated asset upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Curated asset upload failed." },
      { status: 500 },
    );
  }
}
