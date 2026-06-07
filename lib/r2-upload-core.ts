import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";

export type R2UploadConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

const sha256Hex = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest();
export const r2PathEncode = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export async function uploadBytesToR2({ config, key, bytes, contentType, cacheControl = "public, max-age=31536000, immutable" }: {
  config: R2UploadConfig; key: string; bytes: Uint8Array; contentType: string; cacheControl?: string;
}) {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const encodedPath = `/${config.bucket}/${r2PathEncode(key)}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(bytes);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", encodedPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const signingKey = hmac(hmac(hmac(dateKey, "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const response = await fetch(`${endpoint}${encodedPath}`, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, "Cache-Control": cacheControl,
    },
    body: Buffer.from(bytes),
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status}): ${await response.text()}`);
  return `${config.publicBaseUrl.replace(/\/+$/, "")}/${r2PathEncode(key)}`;
}
