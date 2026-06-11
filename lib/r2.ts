import { getR2Config } from "@/lib/env/server";
import { r2PathEncode, uploadBytesToR2 } from "@/lib/r2-upload-core";

export { r2PathEncode };

export async function uploadToR2({
  key,
  bytes,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  cacheControl?: string;
}) {
  return uploadBytesToR2({ config: getR2Config(), key, bytes, contentType, cacheControl });
}
