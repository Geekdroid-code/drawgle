import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { uploadToR2 } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
};

const sanitizeFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const projectId = String(formData.get("projectId") ?? "");
    const screenId = String(formData.get("screenId") ?? "") || null;
    const targetKind = String(formData.get("targetKind") ?? "");
    const targetDrawgleId = String(formData.get("targetDrawgleId") ?? "");
    const file = formData.get("file");

    if (!projectId || !(file instanceof File)) {
      return NextResponse.json({ error: "projectId and image file are required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPEG, WebP, or GIF image." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image must be 10MB or smaller." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (screenId) {
      const { data: screen, error: screenError } = await admin
        .from("screens")
        .select("id")
        .eq("id", screenId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (screenError || !screen) {
        return NextResponse.json({ error: "Screen not found." }, { status: 404 });
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const metadata = await sharp(Buffer.from(bytes)).metadata().catch(() => null);
    const extension = extensionForMimeType(file.type);
    const assetId = randomUUID();
    const safeFilename = sanitizeFilename(file.name);
    const key = `user-image-assets/${user.id}/${projectId}/${assetId}-${safeFilename}.${extension}`;
    const publicUrl = await uploadToR2({
      key,
      bytes,
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    });

    const { data, error } = await admin
      .from("user_image_assets")
      .insert({
        id: assetId,
        owner_id: user.id,
        project_id: projectId,
        screen_id: screenId,
        r2_key: key,
        public_url: publicUrl,
        mime_type: file.type,
        byte_size: bytes.byteLength,
        width: metadata?.width ?? null,
        height: metadata?.height ?? null,
        original_filename: file.name || null,
        target_drawgle_id: targetDrawgleId || null,
        target_kind: targetKind === "background" ? "background" : "img",
      })
      .select("id, public_url, width, height, mime_type")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      id: data.id,
      url: data.public_url,
      width: data.width,
      height: data.height,
      mimeType: data.mime_type,
    });
  } catch (error) {
    console.error("User image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image upload failed." },
      { status: 500 },
    );
  }
}
