import { NextResponse } from "next/server";
import { z } from "zod";

import { importCuratedVisualAsset } from "@/lib/generation/visual-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CuratedAssetSchema = z.object({
  imageUrl: z.string().url(),
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
  assetType: z.enum(["transparent_png", "photo", "illustration", "icon_like"]).optional(),
  hasAlpha: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  reuseKey: z.string().trim().min(1).max(160).optional(),
  license: z.string().trim().max(240).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ImportBodySchema = z.object({
  assets: z.array(CuratedAssetSchema).min(1).max(100),
});

export async function POST(req: Request) {
  const secret = process.env.CURATED_ASSET_IMPORT_SECRET?.trim();
  const authHeader = req.headers.get("authorization") ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ImportBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const results = [];
  for (const asset of parsed.data.assets) {
    const saved = await importCuratedVisualAsset({
      admin,
      imageUrl: asset.imageUrl,
      subject: asset.subject,
      role: asset.role,
      assetType: asset.assetType,
      hasAlpha: asset.hasAlpha,
      tags: asset.tags,
      reuseKey: asset.reuseKey,
      license: asset.license,
      width: asset.width,
      height: asset.height,
      metadata: asset.metadata,
    });
    results.push({
      id: saved.asset.id,
      subject: saved.asset.subject,
      publicUrl: saved.asset.public_url,
      displayUrl: saved.displayVariant?.public_url ?? saved.asset.public_url,
    });
  }

  return NextResponse.json({ imported: results.length, assets: results });
}
