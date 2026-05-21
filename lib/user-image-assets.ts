import "server-only";

import { randomUUID } from "crypto";
import { lookup } from "dns/promises";
import net from "net";

import sharp from "sharp";

import { uploadToR2 } from "@/lib/r2";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const MAX_USER_IMAGE_BYTES = 8 * 1024 * 1024;
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

const isPrivateHostname = async (url: URL) => {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) return true;

  const directIp = net.isIP(hostname) ? hostname : null;
  const addresses = directIp
    ? [{ address: directIp }]
    : await lookup(hostname, { all: true }).catch(() => []);

  return addresses.some(({ address }) =>
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
    /^fc|^fd/i.test(address),
  );
};

const assertAllowedImage = (contentType: string, byteSize: number) => {
  const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image.");
  }

  if (byteSize > MAX_USER_IMAGE_BYTES) {
    throw new Error("Image must be 8MB or smaller.");
  }

  return mimeType;
};

const storedTargetKind = (targetKind?: string | null) =>
  targetKind === "background" ? "background" : "img";

export async function storeUserImageAssetFromBytes({
  admin,
  ownerId,
  projectId,
  screenId,
  targetKind,
  targetDrawgleId,
  bytes,
  contentType,
  filename,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  screenId?: string | null;
  targetKind?: string | null;
  targetDrawgleId?: string | null;
  bytes: Uint8Array;
  contentType: string;
  filename?: string | null;
}) {
  const mimeType = assertAllowedImage(contentType, bytes.byteLength);
  const metadata = await sharp(Buffer.from(bytes)).metadata().catch(() => null);
  const extension = extensionForMimeType(mimeType);
  const assetId = randomUUID();
  const safeFilename = sanitizeFilename(filename || "replacement-image");
  const key = `user-image-assets/${ownerId}/${projectId}/${assetId}-${safeFilename}.${extension}`;
  const publicUrl = await uploadToR2({
    key,
    bytes,
    contentType: mimeType,
    cacheControl: "public, max-age=31536000, immutable",
  });

  const { data, error } = await admin
    .from("user_image_assets")
    .insert({
      id: assetId,
      owner_id: ownerId,
      project_id: projectId,
      screen_id: screenId ?? null,
      r2_key: key,
      public_url: publicUrl,
      mime_type: mimeType,
      byte_size: bytes.byteLength,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      original_filename: filename || null,
      target_drawgle_id: targetDrawgleId || null,
      target_kind: storedTargetKind(targetKind),
    })
    .select("id, public_url, width, height, mime_type")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    url: data.public_url,
    width: data.width,
    height: data.height,
    mimeType: data.mime_type,
  };
}

export async function storeUserImageAssetFromRemoteUrl({
  admin,
  ownerId,
  projectId,
  screenId,
  targetKind,
  targetDrawgleId,
  imageUrl,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  screenId?: string | null;
  targetKind?: string | null;
  targetDrawgleId?: string | null;
  imageUrl: string;
}) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") {
    throw new Error("Use an HTTPS image URL.");
  }

  if (await isPrivateHostname(url)) {
    throw new Error("Private or local image URLs are not allowed.");
  }

  const response = await fetch(url, {
    headers: {
      Accept: "image/png,image/jpeg,image/webp,image/gif",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not download that image (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_USER_IMAGE_BYTES) {
    throw new Error("Image must be 8MB or smaller.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return storeUserImageAssetFromBytes({
    admin,
    ownerId,
    projectId,
    screenId,
    targetKind,
    targetDrawgleId,
    bytes,
    contentType,
    filename: url.pathname.split("/").pop() || "remote-image",
  });
}
