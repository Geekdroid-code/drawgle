import "server-only";

import { createHash, createHmac, randomUUID } from "crypto";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import {
  getFalKey,
  getOptionalPexelsApiKey,
  getOptionalPixabayApiKey,
  getR2Config,
  getVisualAssetsWebhookSecret,
} from "@/lib/env/server";
import { generateEmbedding } from "@/lib/generation/embeddings";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AssetRequirement,
  DesignTokens,
  LlmLogFn,
  ProjectAssetManifest,
  ProjectCharter,
  ScreenAssetManifest,
  ScreenPlan,
  VisualAssetProvider,
  VisualAssetRole,
  VisualAssetSource,
  VisualAssetType,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type VisualAssetRow = Database["public"]["Tables"]["visual_assets"]["Row"];
type AssetGenerationJobRow = Database["public"]["Tables"]["asset_generation_jobs"]["Row"];

const FAL_MODEL = "fal-ai/gpt-image-1.5";
const FAL_QUEUE_BASE = "https://queue.fal.run";
const MAX_REQUIREMENTS = 8;
const MAX_CRITICAL_GENERATED_ASSETS = 3;
const FAL_POLL_INTERVAL_MS = 2500;
const FAL_MAX_POLLS = 36;

const VisualAssetRoleSchema = z.enum([
  "hero_cutout",
  "product_cutout",
  "avatar",
  "section_photo",
  "background_photo",
  "product_photo",
  "decorative_object",
  "map_texture",
]);

const VisualAssetTypeSchema = z.enum(["transparent_png", "photo", "illustration", "icon_like"]);

const AssetRequirementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  screenName: z.string().trim().min(1).max(100),
  role: VisualAssetRoleSchema,
  subject: z.string().trim().min(3).max(260),
  assetType: VisualAssetTypeSchema,
  sourcePreference: z.enum(["user_upload", "internal_library", "stock", "ai_generated"]),
  desiredAspectRatio: z.enum(["1:1", "4:5", "5:4", "16:9", "free"]),
  transparentBackground: z.boolean(),
  placementHint: z.string().trim().min(1).max(500),
  priority: z.enum(["critical", "supporting", "optional"]),
  reuseKey: z.string().trim().min(1).max(160),
});

const AssetRequirementsResponseSchema = z.object({
  assetRequirements: z.array(AssetRequirementSchema).max(MAX_REQUIREMENTS).default([]),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJsonResponse = <T>(text: string): T => {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("The model did not return valid JSON.");
    }

    return JSON.parse(jsonMatch[0]) as T;
  }
};

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

const slugify = (value: string, fallback = "asset") => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
};

const sha256Hex = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");

const hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest();

const clampQuality = (value: number) => Math.max(0, Math.min(1, value));

const appBaseUrl = () =>
  (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const buildWebhookUrl = () => {
  const url = new URL("/api/fal/assets/webhook", appBaseUrl());
  url.searchParams.set("secret", getVisualAssetsWebhookSecret());
  return url.toString();
};

const requirementText = (requirement: AssetRequirement) =>
  compact([
    requirement.role,
    requirement.assetType,
    requirement.subject,
    requirement.transparentBackground ? "transparent background" : "opaque photo",
    requirement.placementHint,
  ].join(" "));

const stableReuseKey = (requirement: AssetRequirement) =>
  slugify(requirement.reuseKey || `${requirement.role}-${requirement.subject}-${requirement.assetType}`);

const imageSizeForRequirement = (requirement: AssetRequirement) => {
  if (requirement.desiredAspectRatio === "4:5") return "1024x1536";
  if (requirement.desiredAspectRatio === "5:4" || requirement.desiredAspectRatio === "16:9") return "1536x1024";
  if (/person|woman|man|full body|standing|trainer|athlete|model/i.test(requirement.subject)) return "1024x1536";
  if (requirement.role === "background_photo" || requirement.role === "section_photo") return "1536x1024";
  return "1024x1024";
};

const stockOrientationForRequirement = (requirement: AssetRequirement) => {
  if (requirement.desiredAspectRatio === "4:5") return "portrait";
  if (requirement.desiredAspectRatio === "5:4" || requirement.desiredAspectRatio === "16:9") return "landscape";
  return "square";
};

const objectFitForRequirement = (requirement: AssetRequirement): ScreenAssetManifest["objectFit"] =>
  requirement.transparentBackground || requirement.assetType === "transparent_png" ? "contain" : "cover";

const objectPositionForRequirement = (requirement: AssetRequirement) => {
  if (/bottom/i.test(requirement.placementHint)) return "bottom center";
  if (/left/i.test(requirement.placementHint)) return "center left";
  if (/right/i.test(requirement.placementHint)) return "center right";
  return "center";
};

const isStockEligible = (requirement: AssetRequirement) =>
  !requirement.transparentBackground &&
  requirement.assetType === "photo" &&
  ["avatar", "section_photo", "background_photo", "product_photo", "map_texture"].includes(requirement.role);

const isAiEligible = (requirement: AssetRequirement) =>
  requirement.transparentBackground ||
  requirement.assetType === "transparent_png" ||
  requirement.assetType === "illustration" ||
  requirement.assetType === "icon_like";

const assetPlannerInstruction = `You are Drawgle's visual asset planner.
Return strict JSON only. Your job is to list only the external bitmap assets that the generated mobile screens truly need.

Do not ask for decorative blobs, gradients, icons, charts, simple cards, or anything CSS/SVG can build.
Use stock photos for non-transparent photos: avatars, section photos, background photos, generic product photos, and map/scene textures.
Use transparent PNGs only for UI-critical cutouts: hero people, product cutouts, premium objects, device mockups, mascots, and foreground objects.
Never request exact real brands, logos, celebrities, private people, or trademarked products unless the user supplied assets.
Cap the output at ${MAX_REQUIREMENTS} assets and at most ${MAX_CRITICAL_GENERATED_ASSETS} critical transparent/AI assets.

For each asset, set sourcePreference:
- "stock" for non-transparent photographic needs.
- "ai_generated" for transparent PNG cutouts or generic premium foreground objects.
- "internal_library" when a reusable generic asset is likely enough.
- "user_upload" only when the user explicitly references their own product/logo/person/photo.

Return this exact shape:
{
  "assetRequirements": [
    {
      "id": "fitness-hero-yoga-cutout",
      "screenName": "Onboarding",
      "role": "hero_cutout",
      "subject": "athletic woman doing a seated yoga stretch",
      "assetType": "transparent_png",
      "sourcePreference": "ai_generated",
      "desiredAspectRatio": "4:5",
      "transparentBackground": true,
      "placementHint": "large hero image inside rounded pastel panel, contain, bottom aligned",
      "priority": "critical",
      "reuseKey": "fitness-yoga-woman-seated-cutout"
    }
  ]
}`;

export async function planVisualAssets({
  prompt,
  screens,
  charter,
  designTokens,
  llmLog,
}: {
  prompt: string;
  screens: ScreenPlan[];
  charter?: ProjectCharter | null;
  designTokens?: DesignTokens | null;
  llmLog?: LlmLogFn;
}): Promise<AssetRequirement[]> {
  if (screens.length === 0) {
    return [];
  }

  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("project_planning", {
    systemInstruction: assetPlannerInstruction,
    responseMimeType: "application/json",
    temperature: 0.12,
    maxOutputTokens: 4096,
  });
  const parts = [
    {
      text: [
        `User Prompt: ${prompt}`,
        charter ? `Project Charter:\n${JSON.stringify(charter, null, 2).slice(0, 6000)}` : null,
        designTokens?.tokens ? `Design Tokens Available: yes` : "Design Tokens Available: no",
        `Screen Briefs:\n${screens.map((screen) => `- ${screen.name} (${screen.type}): ${screen.description}`).join("\n\n").slice(0, 10000)}`,
      ].filter(Boolean).join("\n\n"),
    },
  ];

  if (llmLog) {
    const systemInstruction = typeof policy.config.systemInstruction === "string" ? policy.config.systemInstruction : "";
    llmLog("[LLM INPUT] visual-asset-plan", {
      model: policy.model,
      systemInstructionLength: systemInstruction.length,
      systemInstruction,
      userPartCount: parts.length,
      userParts: parts.map((part) => part.text),
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: { parts },
      config: policy.config,
    });

    if (llmLog && response.usageMetadata) {
      llmLog("[TOKEN USAGE] visual-asset-plan", response.usageMetadata as Record<string, unknown>);
    }

    const raw = parseJsonResponse<unknown>(response.text || "{}");
    const parsed = AssetRequirementsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return [];
    }

    let generatedCriticalCount = 0;
    return parsed.data.assetRequirements
      .filter((requirement) => screens.some((screen) => screen.name === requirement.screenName))
      .map((requirement) => ({
        ...requirement,
        reuseKey: stableReuseKey(requirement),
      }))
      .filter((requirement) => {
        if (requirement.priority !== "critical" || !isAiEligible(requirement)) {
          return true;
        }

        generatedCriticalCount += 1;
        return generatedCriticalCount <= MAX_CRITICAL_GENERATED_ASSETS;
      });
  } catch (error) {
    console.warn("[visual-assets] Asset planning failed; continuing without external assets", error);
    return [];
  }
}

const manifestFromAsset = (asset: VisualAssetRow, requirement: AssetRequirement): ScreenAssetManifest => ({
  id: asset.id,
  requirementId: requirement.id,
  role: requirement.role,
  url: asset.public_url,
  width: asset.width,
  height: asset.height,
  hasAlpha: asset.has_alpha,
  alt: compact(requirement.subject),
  placementHint: requirement.placementHint,
  objectFit: objectFitForRequirement(requirement),
  objectPosition: objectPositionForRequirement(requirement),
  source: asset.source as VisualAssetSource,
  provider: asset.provider as VisualAssetProvider,
});

const findReusableAsset = async (admin: AdminClient, requirement: AssetRequirement): Promise<VisualAssetRow | null> => {
  const exact = await admin
    .from("visual_assets")
    .select("*")
    .eq("reuse_key", stableReuseKey(requirement))
    .eq("asset_type", requirement.assetType)
    .eq("has_alpha", requirement.transparentBackground)
    .gte("quality_score", 0.68)
    .order("quality_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exact.error) {
    console.warn("[visual-assets] Exact lookup failed", exact.error);
  } else if (exact.data) {
    return exact.data as VisualAssetRow;
  }

  try {
    const embedding = await generateEmbedding(requirementText(requirement), "RETRIEVAL_QUERY");
    const { data, error } = await admin.rpc("match_visual_assets", {
      query_embedding: embedding,
      p_asset_type: requirement.assetType,
      p_role: null,
      p_has_alpha: requirement.transparentBackground,
      match_threshold: requirement.priority === "critical" ? 0.64 : 0.58,
      match_count: 6,
    });

    if (error || !data?.length) {
      return null;
    }

    const best = data.find((candidate: { quality_score: number }) => candidate.quality_score >= 0.62);
    if (!best) {
      return null;
    }

    const { data: asset, error: assetError } = await admin
      .from("visual_assets")
      .select("*")
      .eq("id", best.asset_id)
      .maybeSingle();

    return assetError ? null : asset as VisualAssetRow | null;
  } catch (error) {
    console.warn("[visual-assets] Vector lookup failed", error);
    return null;
  }
};

const detectPngAlpha = (bytes: Uint8Array) => {
  if (bytes.length < 26) {
    return false;
  }

  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    return false;
  }

  const colorType = bytes[25];
  return colorType === 4 || colorType === 6;
};

const mimeExtension = (mimeType: string, fallback = "bin") => {
  if (/png/i.test(mimeType)) return "png";
  if (/webp/i.test(mimeType)) return "webp";
  if (/jpe?g/i.test(mimeType)) return "jpg";
  return fallback;
};

const r2PathEncode = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const uploadToR2 = async ({
  key,
  bytes,
  contentType,
}: {
  key: string;
  bytes: Uint8Array;
  contentType: string;
}) => {
  const config = getR2Config();
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const encodedPath = `/${config.bucket}/${r2PathEncode(key)}`;
  const url = `${endpoint}${encodedPath}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(bytes);
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n") + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    encodedPath,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, "auto");
  const dateRegionServiceKey = hmac(dateRegionKey, "s3");
  const signingKey = hmac(dateRegionServiceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(bytes),
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status}): ${await response.text()}`);
  }

  return `${config.publicBaseUrl}/${r2PathEncode(key)}`;
};

const fetchRemoteBytes = async (url: string, fallbackMimeType = "application/octet-stream") => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}) from ${url}`);
  }

  const contentType = response.headers.get("content-type") || fallbackMimeType;
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    contentType,
  };
};

const saveAssetFromRemoteUrl = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  remoteUrl,
  source,
  provider,
  license,
  width,
  height,
  metadata,
}: {
  admin: AdminClient;
  ownerId: string | null;
  projectId: string | null;
  requirement: AssetRequirement;
  remoteUrl: string;
  source: VisualAssetSource;
  provider: VisualAssetProvider;
  license?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<VisualAssetRow> => {
  const fetched = await fetchRemoteBytes(remoteUrl);
  const extension = mimeExtension(fetched.contentType, requirement.transparentBackground ? "png" : "jpg");
  const assetId = randomUUID();
  const key = `visual-assets/${assetId}/original.${extension}`;
  const publicUrl = await uploadToR2({ key, bytes: fetched.bytes, contentType: fetched.contentType });
  const hasAlpha = requirement.transparentBackground || detectPngAlpha(fetched.bytes);
  const embedding = await generateEmbedding(requirementText(requirement), "RETRIEVAL_DOCUMENT").catch(() => null);

  const { data, error } = await admin
    .from("visual_assets")
    .insert({
      id: assetId,
      owner_id: ownerId,
      created_by_project_id: projectId,
      subject: requirement.subject,
      role: requirement.role,
      asset_type: requirement.assetType,
      source,
      provider,
      license: license ?? null,
      r2_key: key,
      public_url: publicUrl,
      width: width ?? 1024,
      height: height ?? 1024,
      has_alpha: hasAlpha,
      tags: [
        requirement.role,
        requirement.assetType,
        ...requirement.subject.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2).slice(0, 10),
      ],
      reuse_key: stableReuseKey(requirement),
      embedding: embedding as never,
      quality_score: clampQuality(requirement.priority === "critical" ? 0.78 : 0.68),
      metadata: {
        ...metadata,
        placementHint: requirement.placementHint,
        originalRemoteUrl: remoteUrl,
      } as never,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await admin.from("visual_asset_variants").insert({
    asset_id: assetId,
    variant: "original",
    r2_key: key,
    public_url: publicUrl,
    width: width ?? 1024,
    height: height ?? 1024,
    mime_type: fetched.contentType,
    byte_size: fetched.bytes.byteLength,
  });

  return data as VisualAssetRow;
};

const resolvePexelsStockAsset = async (
  admin: AdminClient,
  ownerId: string,
  projectId: string,
  requirement: AssetRequirement,
): Promise<VisualAssetRow | null> => {
  const apiKey = getOptionalPexelsApiKey();
  if (!apiKey || !isStockEligible(requirement)) {
    return null;
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", requirement.subject);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", stockOrientationForRequirement(requirement));

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    photos?: Array<{
      id: number;
      alt?: string;
      width?: number;
      height?: number;
      photographer?: string;
      url?: string;
      src?: Record<string, string>;
    }>;
  };
  const photo = payload.photos?.[0];
  if (!photo) {
    return null;
  }
  const remoteUrl = photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original;
  if (!remoteUrl) {
    return null;
  }

  return saveAssetFromRemoteUrl({
    admin,
    ownerId,
    projectId,
    requirement,
    remoteUrl,
    source: "stock",
    provider: "pexels",
    license: "Pexels API",
    width: photo.width,
    height: photo.height,
    metadata: {
      pexelsId: photo.id,
      photographer: photo.photographer,
      sourceUrl: photo.url,
      alt: photo.alt,
    },
  });
};

const resolvePixabayStockAsset = async (
  admin: AdminClient,
  ownerId: string,
  projectId: string,
  requirement: AssetRequirement,
): Promise<VisualAssetRow | null> => {
  const apiKey = getOptionalPixabayApiKey();
  if (!apiKey || !isStockEligible(requirement)) {
    return null;
  }

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", requirement.subject);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", stockOrientationForRequirement(requirement));
  url.searchParams.set("per_page", "3");
  url.searchParams.set("safesearch", "true");

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    hits?: Array<{
      id: number;
      largeImageURL?: string;
      webformatURL?: string;
      imageWidth?: number;
      imageHeight?: number;
      user?: string;
      pageURL?: string;
    }>;
  };
  const image = payload.hits?.[0];
  if (!image) {
    return null;
  }
  const remoteUrl = image?.largeImageURL ?? image?.webformatURL;
  if (!remoteUrl) {
    return null;
  }

  return saveAssetFromRemoteUrl({
    admin,
    ownerId,
    projectId,
    requirement,
    remoteUrl,
    source: "stock",
    provider: "pixabay",
    license: "Pixabay Content License",
    width: image.imageWidth,
    height: image.imageHeight,
    metadata: {
      pixabayId: image.id,
      photographer: image.user,
      sourceUrl: image.pageURL,
    },
  });
};

const falPromptForRequirement = (requirement: AssetRequirement) => {
  const transparent = requirement.transparentBackground || requirement.assetType === "transparent_png";
  return [
    `Create a premium mobile app asset: ${requirement.subject}.`,
    transparent
      ? "Transparent background, isolated foreground cutout, no environment, no UI, no text, no watermark, clean alpha edge."
      : "Clean commercial photo/illustration suitable for a premium mobile app, no text, no watermark.",
    `Use case: ${requirement.role}.`,
    `Placement: ${requirement.placementHint}.`,
    "High-end iOS app visual quality, realistic lighting, tasteful composition, production-ready asset.",
  ].join(" ");
};

const submitFalJob = async (input: Record<string, unknown>) => {
  const webhookUrl = buildWebhookUrl();
  const url = `${FAL_QUEUE_BASE}/${FAL_MODEL}?fal_webhook=${encodeURIComponent(webhookUrl)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${getFalKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`fal queue submit failed (${response.status}): ${await response.text()}`);
  }

  return await response.json() as {
    request_id: string;
    response_url?: string;
    status_url?: string;
  };
};

const falGet = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Key ${getFalKey()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`fal request failed (${response.status}): ${await response.text()}`);
  }

  return await response.json() as T;
};

const pollFalResult = async (submitResult: { request_id: string; response_url?: string; status_url?: string }) => {
  const statusUrl = submitResult.status_url ?? `${FAL_QUEUE_BASE}/${FAL_MODEL}/requests/${submitResult.request_id}/status`;
  const resultUrl = submitResult.response_url ?? `${FAL_QUEUE_BASE}/${FAL_MODEL}/requests/${submitResult.request_id}`;

  for (let attempt = 0; attempt < FAL_MAX_POLLS; attempt++) {
    const status = await falGet<{ status: string; error?: string; response_url?: string }>(statusUrl);
    if (status.status === "COMPLETED") {
      return await falGet<Record<string, unknown>>(status.response_url ?? resultUrl);
    }

    if (status.error) {
      throw new Error(status.error);
    }

    await new Promise((resolve) => setTimeout(resolve, FAL_POLL_INTERVAL_MS));
  }

  throw new Error(`fal request did not complete before timeout: ${submitResult.request_id}`);
};

const createFalJobRow = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  requestPayload,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  requirement: AssetRequirement;
  requestPayload: Record<string, unknown>;
}) => {
  const { data, error } = await admin
    .from("asset_generation_jobs")
    .insert({
      owner_id: ownerId,
      project_id: projectId,
      requirement_id: requirement.id,
      reuse_key: stableReuseKey(requirement),
      provider: FAL_MODEL,
      model: FAL_MODEL,
      status: "queued",
      request_payload: requestPayload as never,
      attempts: 1,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as AssetGenerationJobRow;
};

const updateFalJob = async (admin: AdminClient, jobId: string, patch: Database["public"]["Tables"]["asset_generation_jobs"]["Update"]) => {
  const { error } = await admin
    .from("asset_generation_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
};

const imageFromFalPayload = (payload: unknown) => {
  const body = isRecord(payload) && isRecord(payload.payload) ? payload.payload : payload;
  if (!isRecord(body) || !Array.isArray(body.images)) {
    return null;
  }

  const image = body.images.find((candidate): candidate is Record<string, unknown> =>
    isRecord(candidate) && typeof candidate.url === "string",
  );
  if (!image) {
    return null;
  }

  return {
    url: image.url as string,
    width: typeof image.width === "number" ? image.width : null,
    height: typeof image.height === "number" ? image.height : null,
    contentType: typeof image.content_type === "string" ? image.content_type : null,
  };
};

const completeFalJobWithPayload = async ({
  admin,
  job,
  requirement,
  payload,
}: {
  admin: AdminClient;
  job: AssetGenerationJobRow;
  requirement: AssetRequirement;
  payload: unknown;
}) => {
  if (job.asset_id) {
    const { data } = await admin.from("visual_assets").select("*").eq("id", job.asset_id).maybeSingle();
    if (data) {
      return data as VisualAssetRow;
    }
  }

  const image = imageFromFalPayload(payload);
  if (!image) {
    throw new Error("fal payload did not contain an image URL.");
  }

  const asset = await saveAssetFromRemoteUrl({
    admin,
    ownerId: job.owner_id,
    projectId: job.project_id,
    requirement,
    remoteUrl: image.url,
    source: "ai_generated",
    provider: FAL_MODEL,
    license: "AI generated",
    width: image.width,
    height: image.height,
    metadata: {
      falRequestId: job.fal_request_id,
      falPayload: payload,
      model: FAL_MODEL,
    },
  });

  await updateFalJob(admin, job.id, {
    status: "completed",
    response_payload: payload as never,
    asset_id: asset.id,
    completed_at: new Date().toISOString(),
    error: null,
  });

  return asset;
};

const generateFalAsset = async ({
  admin,
  ownerId,
  projectId,
  requirement,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  requirement: AssetRequirement;
}) => {
  const modelInput = {
    prompt: falPromptForRequirement(requirement),
    image_size: imageSizeForRequirement(requirement),
    background: requirement.transparentBackground ? "transparent" : "opaque",
    quality: "medium",
    num_images: 1,
    output_format: requirement.transparentBackground ? "png" : "webp",
    sync_mode: false,
  };
  const requestPayload = {
    ...modelInput,
    screenName: requirement.screenName,
    role: requirement.role,
    subject: requirement.subject,
    assetType: requirement.assetType,
    desiredAspectRatio: requirement.desiredAspectRatio,
    transparentBackground: requirement.transparentBackground,
    placementHint: requirement.placementHint,
  };
  const job = await createFalJobRow({ admin, ownerId, projectId, requirement, requestPayload });

  try {
    const submitResult = await submitFalJob(modelInput);
    await updateFalJob(admin, job.id, {
      status: "submitted",
      fal_request_id: submitResult.request_id,
      request_payload: {
        ...requestPayload,
        falSubmit: submitResult,
      } as never,
    });

    const payload = await pollFalResult(submitResult);
    return await completeFalJobWithPayload({
      admin,
      job: {
        ...job,
        fal_request_id: submitResult.request_id,
      },
      requirement,
      payload,
    });
  } catch (error) {
    await updateFalJob(admin, job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

const resolveStockAsset = async (admin: AdminClient, ownerId: string, projectId: string, requirement: AssetRequirement) => {
  try {
    return await resolvePexelsStockAsset(admin, ownerId, projectId, requirement)
      ?? await resolvePixabayStockAsset(admin, ownerId, projectId, requirement);
  } catch (error) {
    console.warn("[visual-assets] Stock resolution failed", { requirementId: requirement.id, error });
    return null;
  }
};

const recordUsage = async ({
  admin,
  projectId,
  generationRunId,
  requirement,
  assetId,
}: {
  admin: AdminClient;
  projectId: string;
  generationRunId: string;
  requirement: AssetRequirement;
  assetId: string;
}) => {
  await admin.from("project_asset_usages").upsert({
    project_id: projectId,
    generation_run_id: generationRunId,
    asset_id: assetId,
    requirement_id: requirement.id,
    screen_name: requirement.screenName,
    placement_hint: requirement.placementHint,
  }, {
    onConflict: "project_id,generation_run_id,requirement_id,asset_id",
  });
};

export async function resolveProjectAssets({
  admin,
  ownerId,
  projectId,
  generationRunId,
  requirements,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  generationRunId: string;
  requirements: AssetRequirement[];
}): Promise<ProjectAssetManifest> {
  const assetsByScreen: ProjectAssetManifest["assetsByScreen"] = {};

  for (const requirement of requirements) {
    try {
      let asset = await findReusableAsset(admin, requirement);

      if (!asset && requirement.sourcePreference === "stock" && isStockEligible(requirement)) {
        asset = await resolveStockAsset(admin, ownerId, projectId, requirement);
      }

      if (!asset && isStockEligible(requirement)) {
        asset = await resolveStockAsset(admin, ownerId, projectId, requirement);
      }

      if (!asset && isAiEligible(requirement) && requirement.priority !== "optional") {
        asset = await generateFalAsset({ admin, ownerId, projectId, requirement });
      }

      if (!asset) {
        if (requirement.priority === "critical") {
          console.warn("[visual-assets] Critical asset unresolved; builder will use non-image fallback", requirement);
        }
        continue;
      }

      await recordUsage({ admin, projectId, generationRunId, requirement, assetId: asset.id });

      const manifest = manifestFromAsset(asset, requirement);
      assetsByScreen[requirement.screenName] = [
        ...(assetsByScreen[requirement.screenName] ?? []),
        manifest,
      ];
    } catch (error) {
      console.warn("[visual-assets] Requirement failed", {
        requirementId: requirement.id,
        subject: requirement.subject,
        error,
      });
    }
  }

  return {
    requirements,
    assetsByScreen,
  };
}

export async function completeFalAssetWebhook({
  admin,
  requestId,
  payload,
}: {
  admin: AdminClient;
  requestId: string;
  payload: unknown;
}) {
  const { data: job, error } = await admin
    .from("asset_generation_jobs")
    .select("*")
    .eq("fal_request_id", requestId)
    .maybeSingle();

  if (error || !job) {
    return { ok: false, reason: "job_not_found" };
  }

  const requestPayload = isRecord(job.request_payload) ? job.request_payload : {};
  const requirement = AssetRequirementSchema.safeParse({
    id: job.requirement_id,
    screenName: typeof requestPayload.screenName === "string" ? requestPayload.screenName : "Unknown Screen",
    role: typeof requestPayload.role === "string" ? requestPayload.role : "decorative_object",
    subject: typeof requestPayload.subject === "string" ? requestPayload.subject : job.reuse_key,
    assetType: typeof requestPayload.assetType === "string" ? requestPayload.assetType : "transparent_png",
    sourcePreference: "ai_generated",
    desiredAspectRatio: typeof requestPayload.desiredAspectRatio === "string" ? requestPayload.desiredAspectRatio : "1:1",
    transparentBackground: Boolean(requestPayload.transparentBackground ?? true),
    placementHint: typeof requestPayload.placementHint === "string" ? requestPayload.placementHint : "Use as a generated UI asset.",
    priority: "supporting",
    reuseKey: job.reuse_key,
  });

  if (!requirement.success) {
    await updateFalJob(admin, job.id, {
      status: "failed",
      error: "Unable to reconstruct asset requirement for webhook completion.",
      response_payload: payload as never,
    });
    return { ok: false, reason: "invalid_requirement" };
  }

  if (isRecord(payload) && payload.status === "ERROR") {
    await updateFalJob(admin, job.id, {
      status: "failed",
      error: JSON.stringify(payload).slice(0, 2000),
      response_payload: payload as never,
    });
    return { ok: false, reason: "fal_error" };
  }

  const asset = await completeFalJobWithPayload({
    admin,
    job: job as AssetGenerationJobRow,
    requirement: requirement.data,
    payload,
  });

  return { ok: true, assetId: asset.id };
}

export async function reconcilePendingFalAssetJobs({
  admin,
  limit = 10,
}: {
  admin: AdminClient;
  limit?: number;
}) {
  const { data: jobs, error } = await admin
    .from("asset_generation_jobs")
    .select("*")
    .in("status", ["submitted", "processing"])
    .not("fal_request_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error || !jobs?.length) {
    return { checked: 0, completed: 0 };
  }

  let completed = 0;
  for (const job of jobs as AssetGenerationJobRow[]) {
    if (!job.fal_request_id) continue;

    try {
      const status = await falGet<{ status: string; response_url?: string; error?: string }>(
        `${FAL_QUEUE_BASE}/${FAL_MODEL}/requests/${job.fal_request_id}/status`,
      );

      if (status.status !== "COMPLETED") {
        if (status.status === "IN_PROGRESS") {
          await updateFalJob(admin, job.id, { status: "processing" });
        }
        continue;
      }

      const payload = await falGet<Record<string, unknown>>(
        status.response_url ?? `${FAL_QUEUE_BASE}/${FAL_MODEL}/requests/${job.fal_request_id}`,
      );

      await completeFalAssetWebhook({ admin, requestId: job.fal_request_id, payload });
      completed += 1;
    } catch (err) {
      console.warn("[visual-assets] Reconcile failed", { jobId: job.id, err });
    }
  }

  return { checked: jobs.length, completed };
}
