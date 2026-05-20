import "server-only";

import { createHash, randomUUID } from "crypto";

import sharp from "sharp";
import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { geminiPolicyForTask } from "@/lib/ai/model-policy";
import {
  getOptionalPexelsApiKey,
  getOptionalPixabayApiKey,
} from "@/lib/env/server";
import { generateEmbedding } from "@/lib/generation/embeddings";
import { uploadToR2 } from "@/lib/r2";
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
  VisualAssetPriority,
  VisualAssetRole,
  VisualAssetSource,
  VisualAssetSourcePreference,
  VisualAssetType,
  VisualAssetVariantName,
  VisualAssetVerificationStatus,
  VisualAssetVisibility,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type VisualAssetRow = Database["public"]["Tables"]["visual_assets"]["Row"];
type VisualAssetVariantRow = Database["public"]["Tables"]["visual_asset_variants"]["Row"];

const MAX_REQUIREMENTS = 8;

type AssetVerificationResult = {
  status: VisualAssetVerificationStatus;
  score: number | null;
  notes: string;
};

type SavedAsset = {
  asset: VisualAssetRow;
  displayVariant: VisualAssetVariantRow | null;
};

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

const VisualAssetSourcePreferenceSchema = z.preprocess((value) => {
  if (value === "ai_generated") {
    return "internal_library";
  }
  return value;
}, z.enum(["user_upload", "internal_library", "stock"]));

const AssetRequirementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  screenName: z.string().trim().min(1).max(100),
  role: VisualAssetRoleSchema,
  subject: z.string().trim().min(3).max(260),
  assetType: VisualAssetTypeSchema,
  sourcePreference: VisualAssetSourcePreferenceSchema,
  desiredAspectRatio: z.enum(["1:1", "4:5", "5:4", "16:9", "free"]),
  transparentBackground: z.boolean(),
  placementHint: z.string().trim().min(1).max(500),
  priority: z.enum(["critical", "supporting", "optional"]),
  reuseKey: z.string().trim().min(1).max(160),
});

const AssetVerificationResponseSchema = z.object({
  approved: z.boolean().default(false),
  score: z.number().min(0).max(1).default(0),
  notes: z.array(z.string()).default([]),
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

const clampQuality = (value: number) => Math.max(0, Math.min(1, value));

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

const normalizeMatchKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const resolveRequirementScreenName = (screens: ScreenPlan[], requestedScreenName: string) => {
  const exact = screens.find((screen) => screen.name === requestedScreenName);
  if (exact) {
    return exact.name;
  }

  const requestedKey = normalizeMatchKey(requestedScreenName);
  const normalized = screens.find((screen) => normalizeMatchKey(screen.name) === requestedKey);
  if (normalized) {
    return normalized.name;
  }

  if (requestedKey.length >= 4) {
    const partial = screens.find((screen) => {
      const screenKey = normalizeMatchKey(screen.name);
      return screenKey.includes(requestedKey) || requestedKey.includes(screenKey);
    });
    if (partial) {
      return partial.name;
    }
  }

  return screens.length === 1 ? screens[0].name : null;
};

const isCriticalRequirement = (requirement: AssetRequirement) => requirement.priority === "critical";

const privateSubjectPattern = /\b(my|our|client|customer|brand|logo|trademark|company|founder|employee|team|user|profile|avatar|headshot|portrait|face|real person|celebrity|influencer|shoe brand|product brand)\b/i;

const personSubjectPattern = /\b(person|people|woman|man|girl|boy|trainer|athlete|model|human|face|portrait|avatar|headshot)\b/i;

const productSubjectPattern = /\b(product|pack|package|bottle|shoe|sneaker|bag|watch|device|phone|card|logo|brand)\b/i;

const determineVisibility = (source: VisualAssetSource, requirement: AssetRequirement): VisualAssetVisibility => {
  if (requirement.sourcePreference === "user_upload" || requirement.role === "avatar" || privateSubjectPattern.test(requirement.subject)) {
    return "owner_private";
  }

  if (personSubjectPattern.test(requirement.subject)) {
    return "owner_private";
  }

  if (requirement.role === "product_cutout" || requirement.role === "product_photo" || productSubjectPattern.test(requirement.subject)) {
    return "project_private";
  }

  if (source === "stock" || source === "ai_generated" || source === "internal_library") {
    return "public_reusable";
  }

  return "owner_private";
};

const isAssetVisibleToProject = (asset: VisualAssetRow, ownerId: string, projectId: string) => {
  const visibility = (asset.visibility ?? "owner_private") as VisualAssetVisibility;
  if (visibility === "public_reusable") return true;
  if (visibility === "owner_private") return asset.owner_id === ownerId;
  if (visibility === "project_private") return asset.created_by_project_id === projectId;
  return false;
};

const visibleAssets = (assets: VisualAssetRow[], ownerId: string, projectId: string) =>
  assets.filter((asset) =>
    isAssetVisibleToProject(asset, ownerId, projectId) &&
    ["verified", "skipped"].includes(asset.verification_status ?? "pending"),
  );

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

const imageHeavyIntentPattern = /\b(product|shop|shopping|ecommerce|commerce|store|catalog|cart|checkout|showcase|detail|shoe|sneaker|scooter|bike|car|vehicle|fleet|watch|headphone|chair|furniture|bag|clothing|fashion|food|meal|recipe|restaurant|snack|fitness|workout|yoga|health|trainer|education|coding|course|learn|student|onboarding|hero|photo|image|avatar|profile|map|tracking)\b/i;
const productIntentPattern = /\b(product|shop|shopping|ecommerce|commerce|store|catalog|cart|checkout|showcase|detail|shoe|sneaker|scooter|bike|car|vehicle|fleet|watch|headphone|chair|furniture|bag|clothing|fashion|bottle|device)\b/i;
const personIntentPattern = /\b(fitness|workout|yoga|health|trainer|athlete|meditation|wellness|coach|person|woman|man)\b/i;
const foodIntentPattern = /\b(food|meal|recipe|restaurant|snack|grocery|chips|drink|dish|nutrition)\b/i;
const educationIntentPattern = /\b(education|coding|course|learn|student|school|lesson|tutorial|developer|code)\b/i;
const mapIntentPattern = /\b(map|tracking|location|route|fleet|vehicle|delivery|live)\b/i;
const avatarIntentPattern = /\b(profile|avatar|account|social|community|team|friends)\b/i;

const screenLooksCriticalForImagery = (screen: ScreenPlan, text: string) =>
  /\b(onboarding|splash|welcome|hero|detail|showcase|product|profile)\b/i.test(screen.name) ||
  /\b(hero|large image|cutout|foreground|product image|photo-led|visual-led|illustration|mockup|showcase)\b/i.test(text);

const createInferredRequirement = ({
  id,
  screenName,
  role,
  subject,
  assetType,
  sourcePreference,
  desiredAspectRatio,
  transparentBackground,
  placementHint,
  priority,
}: {
  id: string;
  screenName: string;
  role: VisualAssetRole;
  subject: string;
  assetType: VisualAssetType;
  sourcePreference: VisualAssetSourcePreference;
  desiredAspectRatio: AssetRequirement["desiredAspectRatio"];
  transparentBackground: boolean;
  placementHint: string;
  priority: VisualAssetPriority;
}): AssetRequirement => ({
  id,
  screenName,
  role,
  subject,
  assetType,
  sourcePreference,
  desiredAspectRatio,
  transparentBackground,
  placementHint,
  priority,
  reuseKey: stableReuseKey({
    id,
    screenName,
    role,
    subject,
    assetType,
    sourcePreference,
    desiredAspectRatio,
    transparentBackground,
    placementHint,
    priority,
    reuseKey: `${role}-${subject}`,
  }),
});

const subjectForProductIntent = (text: string) => {
  if (/\bscooter\b/i.test(text)) return "premium electric scooter product cutout";
  if (/\b(sneaker|shoe|air max|trainer shoe)\b/i.test(text)) return "premium sneaker product cutout";
  if (/\b(car|vehicle|fleet)\b/i.test(text)) return "modern connected vehicle cutout";
  if (/\b(headphone|earbud)\b/i.test(text)) return "premium headphones product cutout";
  if (/\b(chair|furniture|sofa|lamp)\b/i.test(text)) return "premium furniture product object cutout";
  if (/\b(watch|smart watch)\b/i.test(text)) return "premium smartwatch product cutout";
  if (/\b(bag|clothing|fashion)\b/i.test(text)) return "premium fashion product cutout";
  return "premium product object cutout for the app concept";
};

const inferAssetRequirementForScreen = ({
  prompt,
  screen,
}: {
  prompt: string;
  screen: ScreenPlan;
}): AssetRequirement | null => {
  const text = compact(`${prompt} ${screen.name} ${screen.description}`);
  if (!imageHeavyIntentPattern.test(text)) {
    return null;
  }

  const isCritical = screenLooksCriticalForImagery(screen, text);
  const priority: VisualAssetPriority = isCritical ? "critical" : "supporting";
  const screenSlug = slugify(screen.name);

  if (productIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-product-cutout`,
      screenName: screen.name,
      role: "product_cutout",
      subject: subjectForProductIntent(text),
      assetType: "transparent_png",
      sourcePreference: "internal_library",
      desiredAspectRatio: "4:5",
      transparentBackground: true,
      placementHint: "use as the primary product/hero foreground image, object-contain, preserve clear margins and avoid covering text or navigation",
      priority,
    });
  }

  if (personIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-person-cutout`,
      screenName: screen.name,
      role: "hero_cutout",
      subject: "premium fitness or wellness person cutout matching the app concept",
      assetType: "transparent_png",
      sourcePreference: "internal_library",
      desiredAspectRatio: "4:5",
      transparentBackground: true,
      placementHint: "large human foreground cutout inside the hero area, object-contain, bottom aligned, never clipped through face or limbs",
      priority,
    });
  }

  if (foodIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-food-cutout`,
      screenName: screen.name,
      role: "product_cutout",
      subject: "premium food or packaged snack product cutout matching the app concept",
      assetType: "transparent_png",
      sourcePreference: "internal_library",
      desiredAspectRatio: "1:1",
      transparentBackground: true,
      placementHint: "foreground food/product image for card or hero composition, object-contain with generous breathing room",
      priority,
    });
  }

  if (educationIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-learning-illustration`,
      screenName: screen.name,
      role: "decorative_object",
      subject: "premium friendly learning and coding illustration object, no text",
      assetType: "illustration",
      sourcePreference: "internal_library",
      desiredAspectRatio: "1:1",
      transparentBackground: true,
      placementHint: "supporting onboarding or empty-state illustration, object-contain, keep it secondary to the headline and CTA",
      priority,
    });
  }

  if (mapIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-map-texture`,
      screenName: screen.name,
      role: "map_texture",
      subject: "abstract premium mobile map texture with roads and route context",
      assetType: "photo",
      sourcePreference: "stock",
      desiredAspectRatio: "5:4",
      transparentBackground: false,
      placementHint: "background map/media plane, object-cover, keep controls and bottom navigation above the image",
      priority: priority === "critical" ? "supporting" : priority,
    });
  }

  if (avatarIntentPattern.test(text)) {
    return createInferredRequirement({
      id: `${screenSlug}-avatar-photo`,
      screenName: screen.name,
      role: "avatar",
      subject: "generic premium user avatar portrait",
      assetType: "photo",
      sourcePreference: "stock",
      desiredAspectRatio: "1:1",
      transparentBackground: false,
      placementHint: "small circular avatar, object-cover, crop face safely",
      priority: "supporting",
    });
  }

  return null;
};

const mergeAssetRequirements = (requirements: AssetRequirement[]) => {
  const seen = new Set<string>();
  const merged: AssetRequirement[] = [];

  for (const requirement of requirements) {
    const key = normalizeMatchKey(`${requirement.screenName}-${requirement.role}-${requirement.assetType}-${stableReuseKey(requirement)}`);
    if (seen.has(key)) {
      continue;
    }

    merged.push(requirement);
    seen.add(key);
    if (merged.length >= MAX_REQUIREMENTS) {
      break;
    }
  }

  return merged;
};

const normalizePlannedAssetNeed = (screen: ScreenPlan, need: AssetRequirement): AssetRequirement | null => {
  const sourcePreference: VisualAssetSourcePreference =
    need.sourcePreference === "stock" && !need.transparentBackground && need.assetType === "photo"
      ? "stock"
      : need.sourcePreference === "user_upload"
        ? "user_upload"
        : "internal_library";
  const candidate = {
    ...need,
    screenName: screen.name,
    sourcePreference,
    reuseKey: need.reuseKey || `${need.role}-${need.subject}`,
  };
  const parsed = AssetRequirementSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }
  return {
    ...parsed.data,
    reuseKey: stableReuseKey(parsed.data),
  };
};

export async function planVisualAssets({
  prompt,
  screens,
  llmLog,
}: {
  prompt: string;
  screens: ScreenPlan[];
  charter?: ProjectCharter | null;
  designTokens?: DesignTokens | null;
  llmLog?: LlmLogFn;
}): Promise<AssetRequirement[]> {
  const plannedRequirements = screens.flatMap((screen) =>
    (screen.assetNeeds ?? [])
      .map((need) => normalizePlannedAssetNeed(screen, need))
      .filter((need): need is AssetRequirement => Boolean(need)),
  );
  const inferredRequirements = screens
    .map((screen) => inferAssetRequirementForScreen({ prompt, screen }))
    .filter((requirement): requirement is AssetRequirement => Boolean(requirement));
  const screensWithPlannedAssets = new Set(plannedRequirements.map((requirement) => requirement.screenName));
  const missingInferredRequirements = inferredRequirements.filter((requirement) => !screensWithPlannedAssets.has(requirement.screenName));
  const finalRequirements = mergeAssetRequirements([...plannedRequirements, ...missingInferredRequirements]);

  llmLog?.("[visual-assets] Asset requirements derived", {
    plannedRequirementCount: plannedRequirements.length,
    inferredRequirementCount: inferredRequirements.length,
    finalRequirementCount: finalRequirements.length,
    finalRequirements: finalRequirements.map((requirement) => ({
      id: requirement.id,
      screenName: requirement.screenName,
      role: requirement.role,
      assetType: requirement.assetType,
      sourcePreference: requirement.sourcePreference,
      priority: requirement.priority,
    })),
  });

  return finalRequirements;
}

const manifestFromAsset = (asset: VisualAssetRow, requirement: AssetRequirement, displayVariant?: VisualAssetVariantRow | null): ScreenAssetManifest => ({
  id: asset.id,
  requirementId: requirement.id,
  role: requirement.role,
  url: displayVariant?.public_url ?? asset.public_url,
  variantUrl: displayVariant?.public_url ?? asset.public_url,
  width: displayVariant?.width ?? asset.width,
  height: displayVariant?.height ?? asset.height,
  hasAlpha: asset.has_alpha,
  alt: compact(requirement.subject),
  placementHint: requirement.placementHint,
  objectFit: objectFitForRequirement(requirement),
  objectPosition: objectPositionForRequirement(requirement),
  source: asset.source as VisualAssetSource,
  provider: asset.provider as VisualAssetProvider,
  critical: isCriticalRequirement(requirement),
  visibility: (asset.visibility ?? "owner_private") as VisualAssetVisibility,
  verificationScore: asset.verification_score ?? null,
  license: asset.license,
});

const transientStockManifest = ({
  requirement,
  url,
  provider,
  width,
  height,
  alt,
  attribution,
  license,
  sourceUrl,
}: {
  requirement: AssetRequirement;
  url: string;
  provider: "pexels" | "pixabay";
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  attribution?: string | null;
  license: string;
  sourceUrl?: string | null;
}): ScreenAssetManifest => ({
  id: `stock:${provider}:${sha256Hex(url).slice(0, 16)}`,
  requirementId: requirement.id,
  role: requirement.role,
  url,
  variantUrl: url,
  width: width ?? 1024,
  height: height ?? 1024,
  hasAlpha: false,
  alt: compact(alt || requirement.subject),
  placementHint: requirement.placementHint,
  objectFit: "cover",
  objectPosition: objectPositionForRequirement(requirement),
  source: "stock",
  provider,
  critical: isCriticalRequirement(requirement),
  visibility: "public_reusable",
  verificationScore: null,
  license,
  attribution: attribution ?? null,
  sourceUrl: sourceUrl ?? null,
});

const placeholderManifest = (requirement: AssetRequirement, reason: string): ScreenAssetManifest => ({
  id: `placeholder:${requirement.id}`,
  requirementId: requirement.id,
  role: requirement.role,
  url: null,
  width: requirement.desiredAspectRatio === "16:9" || requirement.desiredAspectRatio === "5:4" ? 1536 : 1024,
  height: requirement.desiredAspectRatio === "4:5" ? 1536 : 1024,
  hasAlpha: requirement.transparentBackground,
  alt: compact(requirement.subject),
  placementHint: `${requirement.placementHint} Placeholder reason: ${reason}`,
  objectFit: objectFitForRequirement(requirement),
  objectPosition: objectPositionForRequirement(requirement),
  source: "placeholder",
  provider: "placeholder",
  critical: false,
  visibility: "public_reusable",
  verificationScore: null,
  placeholder: true,
  license: null,
  attribution: null,
  sourceUrl: null,
});

const getDisplayVariant = async (admin: AdminClient, assetId: string): Promise<VisualAssetVariantRow | null> => {
  const { data } = await admin
    .from("visual_asset_variants")
    .select("*")
    .eq("asset_id", assetId)
    .in("variant", ["display_1024", "preview_512", "original"])
    .order("variant", { ascending: true })
    .limit(10);

  const variants = (data ?? []) as VisualAssetVariantRow[];
  return variants.find((variant) => variant.variant === "display_1024")
    ?? variants.find((variant) => variant.variant === "preview_512")
    ?? variants.find((variant) => variant.variant === "original")
    ?? null;
};

const findReusableAsset = async (
  admin: AdminClient,
  ownerId: string,
  projectId: string,
  requirement: AssetRequirement,
): Promise<SavedAsset | null> => {
  const exact = await admin
    .from("visual_assets")
    .select("*")
    .eq("source", "internal_library")
    .eq("reuse_key", stableReuseKey(requirement))
    .eq("asset_type", requirement.assetType)
    .eq("has_alpha", requirement.transparentBackground)
    .in("verification_status", ["verified", "skipped"])
    .gte("quality_score", 0.68)
    .order("quality_score", { ascending: false })
    .limit(12);

  if (exact.error) {
    console.warn("[visual-assets] Exact lookup failed", exact.error);
  } else if (exact.data?.length) {
    const bestExact = visibleAssets(exact.data as VisualAssetRow[], ownerId, projectId)[0];
    if (bestExact) {
      return { asset: bestExact, displayVariant: await getDisplayVariant(admin, bestExact.id) };
    }
  }

  try {
    const embedding = await generateEmbedding(requirementText(requirement), "RETRIEVAL_QUERY");
    const { data, error } = await admin.rpc("match_visual_assets", {
      query_embedding: embedding,
      p_asset_type: requirement.assetType,
      p_role: null,
      p_has_alpha: requirement.transparentBackground,
      p_owner_id: ownerId,
      p_project_id: projectId,
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
      .eq("source", "internal_library")
      .maybeSingle();

    if (assetError || !asset || !isAssetVisibleToProject(asset as VisualAssetRow, ownerId, projectId)) {
      return null;
    }

    return {
      asset: asset as VisualAssetRow,
      displayVariant: await getDisplayVariant(admin, (asset as VisualAssetRow).id),
    };
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

const imageMetadata = async (bytes: Uint8Array) => {
  const metadata = await sharp(Buffer.from(bytes)).metadata();
  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    hasAlpha: Boolean(metadata.hasAlpha || metadata.channels === 4),
    format: metadata.format ?? null,
  };
};

const shouldVerifyAsset = (source: VisualAssetSource, requirement: AssetRequirement) =>
  source === "ai_generated" || isCriticalRequirement(requirement);

const verifierInstruction = `You are Drawgle's production visual asset verifier.
Return strict JSON only.
Approve the asset only when it is safe and useful inside a premium mobile UI.
Check subject match, crop, orientation, transparent-background expectation, no unwanted text/watermark, and suitability for the described placement.
If transparency was requested, reject obvious opaque/background-filled images.`;

const verifyAsset = async ({
  bytes,
  contentType,
  requirement,
  hasAlpha,
  source,
}: {
  bytes: Uint8Array;
  contentType: string;
  requirement: AssetRequirement;
  hasAlpha: boolean;
  source: VisualAssetSource;
}): Promise<AssetVerificationResult> => {
  if (!shouldVerifyAsset(source, requirement)) {
    return { status: "skipped", score: null, notes: "Verification skipped for non-critical reusable photo asset." };
  }

  if (requirement.transparentBackground && !hasAlpha) {
    return {
      status: "rejected",
      score: 0,
      notes: "Rejected before vision verification because a transparent asset was required but no alpha channel was detected.",
    };
  }

  const ai = createGeminiClient();
  const policy = geminiPolicyForTask("project_planning", {
    systemInstruction: verifierInstruction,
    responseMimeType: "application/json",
    temperature: 0,
    maxOutputTokens: 1024,
  });

  try {
    const response = await ai.models.generateContent({
      model: policy.model,
      contents: {
        parts: [
          {
            inlineData: {
              data: Buffer.from(bytes).toString("base64"),
              mimeType: contentType,
            },
          },
          {
            text: [
              `Required subject: ${requirement.subject}`,
              `Role: ${requirement.role}`,
              `Asset type: ${requirement.assetType}`,
              `Transparent background required: ${requirement.transparentBackground ? "yes" : "no"}`,
              `Placement hint: ${requirement.placementHint}`,
              `Priority: ${requirement.priority}`,
              "Return JSON: { \"approved\": boolean, \"score\": 0-1, \"notes\": [\"...\"] }",
            ].join("\n"),
          },
        ],
      },
      config: policy.config,
    });

    const parsed = AssetVerificationResponseSchema.safeParse(parseJsonResponse<unknown>(response.text || "{}"));
    if (!parsed.success) {
      return {
        status: "rejected",
        score: 0,
        notes: "Verifier returned invalid JSON.",
      };
    }

    return {
      status: parsed.data.approved && parsed.data.score >= (isCriticalRequirement(requirement) ? 0.68 : 0.6) ? "verified" : "rejected",
      score: clampQuality(parsed.data.score),
      notes: parsed.data.notes.join(" ").slice(0, 2000),
    };
  } catch (error) {
    return {
      status: "rejected",
      score: 0,
      notes: `Verifier failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000),
    };
  }
};

const createVariantBuffer = async ({
  bytes,
  maxSize,
  hasAlpha,
}: {
  bytes: Uint8Array;
  maxSize: number;
  hasAlpha: boolean;
}) => {
  const pipeline = sharp(Buffer.from(bytes))
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    });

  const output = hasAlpha
    ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
    : pipeline.webp({ quality: maxSize >= 1024 ? 84 : 78 });

  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(data),
    width: info.width,
    height: info.height,
    contentType: hasAlpha ? "image/png" : "image/webp",
    extension: hasAlpha ? "png" : "webp",
  };
};

const insertVariant = async ({
  admin,
  assetId,
  variant,
  key,
  publicUrl,
  width,
  height,
  contentType,
  byteSize,
}: {
  admin: AdminClient;
  assetId: string;
  variant: VisualAssetVariantName;
  key: string;
  publicUrl: string;
  width: number;
  height: number;
  contentType: string;
  byteSize: number;
}) => {
  const { data, error } = await admin
    .from("visual_asset_variants")
    .upsert({
      asset_id: assetId,
      variant,
      r2_key: key,
      public_url: publicUrl,
      width,
      height,
      mime_type: contentType,
      byte_size: byteSize,
    }, {
      onConflict: "asset_id,variant",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as VisualAssetVariantRow;
};

const createAndStoreVariants = async ({
  admin,
  assetId,
  originalBytes,
  originalKey,
  originalUrl,
  originalWidth,
  originalHeight,
  originalContentType,
  hasAlpha,
}: {
  admin: AdminClient;
  assetId: string;
  originalBytes: Uint8Array;
  originalKey: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalContentType: string;
  hasAlpha: boolean;
}) => {
  await insertVariant({
    admin,
    assetId,
    variant: "original",
    key: originalKey,
    publicUrl: originalUrl,
    width: originalWidth,
    height: originalHeight,
    contentType: originalContentType,
    byteSize: originalBytes.byteLength,
  });

  let displayVariant: VisualAssetVariantRow | null = null;
  const variants: Array<{ name: VisualAssetVariantName; size: number }> = [
    { name: "thumb_256", size: 256 },
    { name: "preview_512", size: 512 },
    { name: "display_1024", size: 1024 },
  ];

  for (const target of variants) {
    const variant = await createVariantBuffer({ bytes: originalBytes, maxSize: target.size, hasAlpha });
    const key = `visual-assets/${assetId}/${target.name}.${variant.extension}`;
    const publicUrl = await uploadToR2({ key, bytes: variant.bytes, contentType: variant.contentType });
    const row = await insertVariant({
      admin,
      assetId,
      variant: target.name,
      key,
      publicUrl,
      width: variant.width,
      height: variant.height,
      contentType: variant.contentType,
      byteSize: variant.bytes.byteLength,
    });

    if (target.name === "display_1024") {
      displayVariant = row;
    }
  }

  return displayVariant;
};

const findAssetByContentHash = async ({
  admin,
  ownerId,
  projectId,
  contentHash,
  visibility,
  requirement,
}: {
  admin: AdminClient;
  ownerId: string | null;
  projectId: string | null;
  contentHash: string;
  visibility: VisualAssetVisibility;
  requirement: AssetRequirement;
}): Promise<SavedAsset | null> => {
  const { data, error } = await admin
    .from("visual_assets")
    .select("*")
    .eq("content_hash", contentHash)
    .eq("visibility", visibility)
    .eq("asset_type", requirement.assetType)
    .eq("has_alpha", requirement.transparentBackground)
    .in("verification_status", ["verified", "skipped"])
    .order("quality_score", { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    return null;
  }

  const visible = visibleAssets(data as VisualAssetRow[], ownerId ?? "", projectId ?? "");
  const asset = visible[0];
  if (!asset) {
    return null;
  }

  return {
    asset,
    displayVariant: await getDisplayVariant(admin, asset.id),
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
  visibilityOverride,
  verificationOverride,
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
  visibilityOverride?: VisualAssetVisibility;
  verificationOverride?: AssetVerificationResult;
}): Promise<SavedAsset> => {
  const fetched = await fetchRemoteBytes(remoteUrl);
  if (!/^image\//i.test(fetched.contentType)) {
    throw new Error(`Remote asset did not return an image content type: ${fetched.contentType}`);
  }

  const contentHash = sha256Hex(fetched.bytes);
  const metadataFromBytes = await imageMetadata(fetched.bytes);
  const hasAlpha = metadataFromBytes.hasAlpha || detectPngAlpha(fetched.bytes);
  const visibility = visibilityOverride ?? determineVisibility(source, requirement);
  const deduped = await findAssetByContentHash({
    admin,
    ownerId,
    projectId,
    contentHash,
    visibility,
    requirement: {
      ...requirement,
      transparentBackground: requirement.transparentBackground || hasAlpha,
    },
  });
  if (deduped) {
    return deduped;
  }

  const extension = mimeExtension(fetched.contentType, requirement.transparentBackground ? "png" : "jpg");
  const assetId = randomUUID();
  const key = `visual-assets/${assetId}/original.${extension}`;
  const publicUrl = await uploadToR2({ key, bytes: fetched.bytes, contentType: fetched.contentType });
  const embedding = await generateEmbedding(requirementText(requirement), "RETRIEVAL_DOCUMENT").catch(() => null);
  const verification = verificationOverride ?? await verifyAsset({
    bytes: fetched.bytes,
    contentType: fetched.contentType,
    requirement,
    hasAlpha,
    source,
  });
  const widthValue = metadataFromBytes.width ?? width ?? 1024;
  const heightValue = metadataFromBytes.height ?? height ?? 1024;

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
      width: widthValue,
      height: heightValue,
      has_alpha: hasAlpha,
      visibility,
      verification_status: verification.status,
      verification_score: verification.score,
      verification_notes: verification.notes,
      content_hash: contentHash,
      mime_type: fetched.contentType,
      byte_size: fetched.bytes.byteLength,
      tags: [
        requirement.role,
        requirement.assetType,
        visibility,
        ...(Array.isArray(metadata?.tags)
          ? metadata.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim().toLowerCase()).slice(0, 20)
          : []),
        ...requirement.subject.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2).slice(0, 10),
      ],
      reuse_key: stableReuseKey(requirement),
      embedding: embedding as never,
      quality_score: clampQuality(verification.score ?? (requirement.priority === "critical" ? 0.78 : 0.68)),
      metadata: {
        ...metadata,
        placementHint: requirement.placementHint,
        originalRemoteUrl: remoteUrl,
      } as never,
    })
    .select("*")
    .single();

  if (error) {
    const dedupedAfterInsertRace = await findAssetByContentHash({
      admin,
      ownerId,
      projectId,
      contentHash,
      visibility,
      requirement: {
        ...requirement,
        transparentBackground: requirement.transparentBackground || hasAlpha,
      },
    });
    if (dedupedAfterInsertRace) {
      return dedupedAfterInsertRace;
    }

    throw error;
  }

  if (verification.status === "rejected") {
    throw new Error(`Asset verifier rejected "${requirement.id}": ${verification.notes || "quality threshold not met"}`);
  }

  const displayVariant = await createAndStoreVariants({
    admin,
    assetId,
    originalBytes: fetched.bytes,
    originalKey: key,
    originalUrl: publicUrl,
    originalWidth: widthValue,
    originalHeight: heightValue,
    originalContentType: fetched.contentType,
    hasAlpha,
  });

  return {
    asset: data as VisualAssetRow,
    displayVariant,
  };
};

const resolvePexelsStockAsset = async (
  requirement: AssetRequirement,
): Promise<ScreenAssetManifest | null> => {
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

  return transientStockManifest({
    requirement,
    provider: "pexels",
    url: remoteUrl,
    license: "Pexels API",
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    attribution: photo.photographer ? `Photo by ${photo.photographer} on Pexels` : "Pexels",
    sourceUrl: photo.url,
  });
};

const resolvePixabayStockAsset = async (
  requirement: AssetRequirement,
): Promise<ScreenAssetManifest | null> => {
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

  return transientStockManifest({
    requirement,
    provider: "pixabay",
    url: remoteUrl,
    license: "Pixabay Content License",
    width: image.imageWidth,
    height: image.imageHeight,
    alt: requirement.subject,
    attribution: image.user ? `Image by ${image.user} on Pixabay` : "Pixabay",
    sourceUrl: image.pageURL,
  });
};

const resolveStockAsset = async (requirement: AssetRequirement): Promise<ScreenAssetManifest | null> => {
  try {
    return await resolvePexelsStockAsset(requirement)
      ?? await resolvePixabayStockAsset(requirement);
  } catch (error) {
    console.warn("[visual-assets] Stock resolution failed", { requirementId: requirement.id, error });
    return null;
  }
};

export async function importCuratedVisualAsset({
  admin,
  imageUrl,
  subject,
  role,
  assetType = "transparent_png",
  hasAlpha = true,
  tags = [],
  reuseKey,
  license = "Drawgle curated internal library",
  width,
  height,
  metadata = {},
}: {
  admin: AdminClient;
  imageUrl: string;
  subject: string;
  role: VisualAssetRole;
  assetType?: VisualAssetType;
  hasAlpha?: boolean;
  tags?: string[];
  reuseKey?: string;
  license?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const requirement: AssetRequirement = {
    id: `curated-${slugify(subject)}`,
    screenName: "Curated Library",
    role,
    subject,
    assetType,
    sourcePreference: "internal_library",
    desiredAspectRatio: width && height
      ? width > height ? "5:4" : height > width ? "4:5" : "1:1"
      : "free",
    transparentBackground: hasAlpha,
    placementHint: "Reusable curated Drawgle asset for premium mobile UI compositions.",
    priority: "supporting",
    reuseKey: reuseKey ?? `${role}-${subject}`,
  };

  return saveAssetFromRemoteUrl({
    admin,
    ownerId: null,
    projectId: null,
    requirement,
    remoteUrl: imageUrl,
    source: "internal_library",
    provider: "drawgle_r2",
    license,
    width,
    height,
    metadata: {
      ...metadata,
      tags,
      curated: true,
    },
    visibilityOverride: "public_reusable",
    verificationOverride: {
      status: "verified",
      score: 0.92,
      notes: "Manually approved curated internal library asset.",
    },
  });
}

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
  const failures: NonNullable<ProjectAssetManifest["failures"]> = [];

  for (const requirement of requirements) {
    try {
      if (requirement.sourcePreference === "user_upload") {
        const reason = "User-upload project asset resolution is not available in generation V1.";
        failures.push({
          requirementId: requirement.id,
          screenName: requirement.screenName,
          subject: requirement.subject,
          priority: requirement.priority,
          reason,
          fatal: false,
        });
        assetsByScreen[requirement.screenName] = [
          ...(assetsByScreen[requirement.screenName] ?? []),
          placeholderManifest(requirement, reason),
        ];
        continue;
      }

      let manifest: ScreenAssetManifest | null = null;
      const shouldSearchCurated = requirement.sourcePreference === "internal_library" || requirement.transparentBackground;
      const shouldSearchStock = requirement.sourcePreference === "stock" || isStockEligible(requirement);

      if (shouldSearchCurated) {
        const saved = await findReusableAsset(admin, ownerId, projectId, requirement);
        if (saved) {
          await recordUsage({ admin, projectId, generationRunId, requirement, assetId: saved.asset.id });
          manifest = manifestFromAsset(saved.asset, requirement, saved.displayVariant);
        }
      }

      if (!manifest && shouldSearchStock && isStockEligible(requirement)) {
        manifest = await resolveStockAsset(requirement);
      }

      if (!manifest) {
        const reason = shouldSearchCurated
          ? "No matching curated visual asset found."
          : "No matching stock photo found.";
        failures.push({
          requirementId: requirement.id,
          screenName: requirement.screenName,
          subject: requirement.subject,
          priority: requirement.priority,
          reason,
          fatal: false,
        });
        manifest = placeholderManifest(requirement, reason);
      }

      assetsByScreen[requirement.screenName] = [
        ...(assetsByScreen[requirement.screenName] ?? []),
        manifest,
      ];
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({
        requirementId: requirement.id,
        screenName: requirement.screenName,
        subject: requirement.subject,
        priority: requirement.priority,
        reason,
        fatal: false,
      });
      assetsByScreen[requirement.screenName] = [
        ...(assetsByScreen[requirement.screenName] ?? []),
        placeholderManifest(requirement, reason),
      ];
      console.warn("[visual-assets] Requirement failed", {
        requirementId: requirement.id,
        subject: requirement.subject,
        error: reason,
      });
    }
  }

  return {
    requirements,
    assetsByScreen,
    failures,
  };
}
