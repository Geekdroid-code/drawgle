import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { storeUserImageAssetFromBytes, storeUserImageAssetFromRemoteUrl } from "@/lib/user-image-assets";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  try {
    const isJson = req.headers.get("content-type")?.includes("application/json");
    const jsonBody = isJson ? await req.json() as Record<string, unknown> : null;
    const formData = isJson ? null : await req.formData();
    const projectId = String((jsonBody?.projectId ?? formData?.get("projectId")) ?? "");
    const screenId = String((jsonBody?.screenId ?? formData?.get("screenId")) ?? "") || null;
    const targetKind = String((jsonBody?.targetKind ?? formData?.get("targetKind")) ?? "");
    const targetDrawgleId = String((jsonBody?.targetDrawgleId ?? formData?.get("targetDrawgleId")) ?? "");
    const imageUrl = typeof jsonBody?.imageUrl === "string" ? jsonBody.imageUrl : "";
    const file = formData?.get("file");

    if (!projectId || (!imageUrl && !(file instanceof File))) {
      return NextResponse.json({ error: "projectId and an image file or imageUrl are required." }, { status: 400 });
    }

    if (file instanceof File && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPEG, WebP, or GIF image." }, { status: 400 });
    }

    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image must be 4MB or smaller after browser optimization." }, { status: 400 });
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

    const data = imageUrl
      ? await storeUserImageAssetFromRemoteUrl({
          admin,
          ownerId: user.id,
          projectId,
          screenId,
          targetKind,
          targetDrawgleId,
          imageUrl,
        })
      : await storeUserImageAssetFromBytes({
          admin,
          ownerId: user.id,
          projectId,
          screenId,
          targetKind,
          targetDrawgleId,
          bytes: new Uint8Array(await (file as File).arrayBuffer()),
          contentType: (file as File).type,
          filename: (file as File).name,
        });

    return NextResponse.json({
      id: data.id,
      url: data.url,
      width: data.width,
      height: data.height,
      mimeType: data.mimeType,
    });
  } catch (error) {
    console.error("User image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image upload failed." },
      { status: 500 },
    );
  }
}
