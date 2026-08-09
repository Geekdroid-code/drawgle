import "server-only";

import { createHash, randomUUID } from "crypto";

import sharp from "sharp";
import { z } from "zod";

import {
  expandSemanticTags,
  inferSemanticCategory,
  isSemanticallyCompatible,
  normalizeSemanticTags,
  semanticOverlap,
  semanticRequirementKey,
  semanticTokens,
  stableCandidateIndex,
  VISUAL_ASSET_SEMANTIC_CATEGORIES,
} from "@/lib/generation/asset-semantics";
import { getOptionalPexelsApiKey, getOptionalPixabayApiKey } from "@/lib/env/server";
import { uploadToR2 } from "@/lib/r2";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AssetRequirement,
  AssetResolutionDiagnostic,
  DesignTokens,
  LlmLogFn,
  ProjectAssetManifest,
  ProjectCharter,
  ScreenAssetManifest,
  ScreenPlan,
  VisualAssetProvider,
  VisualAssetRole,
  VisualAssetSemanticCategory,
  VisualAssetSource,
  VisualAssetType,
  VisualAssetVisibility,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type VisualAssetRow = Database["public"]["Tables"]["visual_assets"]["Row"];
type UserImageAssetRow = Database["public"]["Tables"]["user_image_assets"]["Row"];

type SavedAsset = {
  asset: VisualAssetRow;
  displayVariant: null;
};

type ResolvedRequirement = {
  manifests: ScreenAssetManifest[];
  assetIds: string[];
  diagnostic: AssetResolutionDiagnostic;
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

const AssetRequirementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  screenName: z.string().trim().min(1).max(100),
  role: VisualAssetRoleSchema,
  subject: z.string().trim().min(3).max(260),
  assetType: VisualAssetTypeSchema,
  sourcePreference: z.enum(["user_upload", "internal_library", "stock"]),
  desiredAspectRatio: z.enum(["1:1", "4:5", "5:4", "16:9", "free"]),
  transparentBackground: z.boolean(),
  placementHint: z.string().trim().min(1).max(500),
  priority: z.enum(["critical", "supporting", "optional"]),
  reuseKey: z.string().trim().min(1).max(160),
  semanticCategory: z.enum(VISUAL_ASSET_SEMANTIC_CATEGORIES),
  semanticTags: z.array(z.string().trim().min(1).max(80)).max(8),
  slotCount: z.number().int().min(1).max(12),
  reusePolicy: z.enum(["repeat", "distinct"]),
  userAssetId: z.string().uuid().optional(),
  origin: z.enum(["reference_visible", "user_explicit", "planner_inferred", "heuristic_inferred"]).optional(),
});

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

const slugify = (value: string, fallback = "asset") => {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return slug || fallback;
};

const sha256Hex = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");

const stableReuseKey = (requirement: AssetRequirement) =>
  slugify(requirement.reuseKey || semanticRequirementKey(requirement));

const normalizeMatchKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const resolveRequirementScreenName = (screens: ScreenPlan[], requestedScreenName: string) => {
  const exact = screens.find((screen) => screen.name === requestedScreenName);
  if (exact) return exact.name;
  const requestedKey = normalizeMatchKey(requestedScreenName);
  const normalized = screens.find((screen) => normalizeMatchKey(screen.name) === requestedKey);
  if (normalized) return normalized.name;
  return screens.length === 1 ? screens[0].name : null;
};

const isCriticalRequirement = (requirement: AssetRequirement) =>
  requirement.priority === "critical" &&
  (requirement.origin === "reference_visible" || requirement.origin === "user_explicit");

const isAssetVisibleToProject = (asset: VisualAssetRow, ownerId: string, projectId: string) => {
  const visibility = (asset.visibility ?? "owner_private") as VisualAssetVisibility;
  if (visibility === "public_reusable") return true;
  if (visibility === "owner_private") return asset.owner_id === ownerId;
  return visibility === "project_private" && asset.created_by_project_id === projectId;
};

const isActiveAsset = (asset: VisualAssetRow) => asset.status === "active";

const objectFitForRequirement = (requirement: AssetRequirement): ScreenAssetManifest["objectFit"] =>
  requirement.transparentBackground || requirement.assetType === "transparent_png" ? "contain" : "cover";

const objectPositionForRequirement = (requirement: AssetRequirement) => {
  if (/bottom/i.test(requirement.placementHint)) return "bottom center";
  if (/left/i.test(requirement.placementHint)) return "center left";
  if (/right/i.test(requirement.placementHint)) return "center right";
  return "center";
};

const createDiagnostic = (requirement: AssetRequirement, startedAt: number): AssetResolutionDiagnostic => ({
  requirementId: requirement.id,
  screenName: requirement.screenName,
  subject: requirement.subject,
  semanticCategory: requirement.semanticCategory,
  candidateCount: 0,
  selectedAssetId: null,
  selectedVia: null,
  selectedSource: null,
  rejectionCode: null,
  cacheHit: false,
  durationMs: Math.max(0, Date.now() - startedAt),
  sanitizedMisuseCount: 0,
  apiCallCount: 0,
  r2WriteCount: 0,
});

const shouldUseDistinctAssets = (
  screen: ScreenPlan,
  need: AssetRequirement,
  normalizedRole: VisualAssetRole,
) => {
  if ((need.slotCount ?? 1) <= 1) return false;
  const context = `${need.subject} ${need.placementHint} ${screen.name} ${screen.description}`;
  if (/\b(?:same|single)\b[^.;]{0,36}\b(?:repeat|repeated|reused|across)\b/i.test(context)) return false;
  if (normalizedRole === "avatar") return true;
  if (!["product_photo", "product_cutout", "section_photo"].includes(normalizedRole)) return false;
  return /\b(?:different|distinct|varied|individual|multiple|collection|catalog|inventory|shelf|products|bottles|items|people|members|providers|destinations)\b/i.test(
    context,
  );
};

const normalizeRequirement = (
  screen: ScreenPlan,
  need: AssetRequirement,
  userExplicitImagery: boolean,
): AssetRequirement | null => {
  const screenName = resolveRequirementScreenName([screen], need.screenName || screen.name);
  if (!screenName) return null;
  const roleContext = `${need.id} ${need.subject} ${need.placementHint}`;
  const inferredCategory = inferSemanticCategory(roleContext, need.role);
  const normalizedRole: VisualAssetRole = need.role !== "hero_cutout" && /\b(avatar|headshot|profile portrait|profile photo|user portrait)\b/i.test(roleContext)
    ? "avatar"
    : need.role === "hero_cutout"
      && need.assetType === "photo"
      && !need.transparentBackground
      && /\b(?:full bleed|full-bleed|background|header|banner|object-cover)\b/i.test(roleContext)
        ? "background_photo"
        : need.role;
  const normalizedCategory = (
    !need.semanticCategory
    || need.semanticCategory === "other"
    || (
      need.semanticCategory === "generic_product"
      && inferredCategory !== "generic_product"
      && inferredCategory !== "other"
    )
  )
    ? inferredCategory
    : need.semanticCategory;
  const reusePolicy = shouldUseDistinctAssets(screen, need, normalizedRole)
    ? "distinct"
    : need.reusePolicy ?? "repeat";
  const candidate = {
    ...need,
    role: normalizedRole,
    screenName,
    semanticCategory: normalizedCategory,
    semanticTags: normalizeSemanticTags(
      [...(need.semanticTags ?? []), screen.name, need.subject],
      normalizedCategory,
    ).slice(0, 8),
    slotCount: need.slotCount ?? 1,
    reusePolicy,
    reuseKey: need.reuseKey || `${need.role}-${need.subject}`,
    priority: userExplicitImagery && need.assetType !== "icon_like"
      ? "critical"
      : need.priority,
    origin: userExplicitImagery && need.assetType !== "icon_like"
      ? "user_explicit"
      : need.origin ?? (need.sourcePreference === "user_upload" ? "user_explicit" : "planner_inferred"),
  } satisfies AssetRequirement;
  const parsed = AssetRequirementSchema.safeParse(candidate);
  return parsed.success ? { ...parsed.data, reuseKey: stableReuseKey(parsed.data) } : null;
};

const hasPositiveImageryRequest = (value: string) => {
  const input = compact(value).toLowerCase();
  const pattern = /\b(?:image|images|image grid|photo|photos|photography|photographic|product imagery|hero image|hero visual|progress image|portrait|illustration|illustrations)\b/g;
  for (const match of input.matchAll(pattern)) {
    const prefix = input.slice(Math.max(0, (match.index ?? 0) - 28), match.index ?? 0);
    if (!/\b(?:no|not|without|avoid|exclude|do not|dont)\b[^.;,]{0,24}$/.test(prefix)) return true;
  }
  return false;
};

const hasNegativeImageryRequest = (value: string) =>
  /\b(?:no|not|without|avoid|exclude|do not|dont)\b[^.;,]{0,24}\b(?:image|images|photo|photos|photography|photographic|product imagery|hero image|portrait|illustration|illustrations)\b/i.test(
    compact(value).toLowerCase(),
  );

const inferHeuristicAssetRole = (
  screen: ScreenPlan,
  description: string,
): VisualAssetRole => {
  if (/\b(?:avatar|portrait|profile photo|headshot)\b/i.test(description)) return "avatar";
  if (/\b(?:product image|product photo|product hero|product card|product thumbnail)\b/i.test(description)
    || /\bproduct\b/i.test(screen.name)) {
    return "product_photo";
  }
  if (/\b(?:full bleed|full-bleed|background photo|hero photography|hero image|banner)\b/i.test(description)) {
    return "background_photo";
  }
  return "section_photo";
};

const inferHeuristicAspectRatio = (
  description: string,
): AssetRequirement["desiredAspectRatio"] => {
  if (/\b(?:1\s*:\s*1|square)\b/i.test(description)) return "1:1";
  if (/\b(?:3\s*:\s*4|4\s*:\s*5|portrait)\b/i.test(description)) return "4:5";
  if (/\b(?:16\s*:\s*9|wide|landscape|banner)\b/i.test(description)) return "16:9";
  return "free";
};

const inferExplicitImageryRequirements = ({
  prompt,
  screens,
  charter,
  referenceMode,
  existingScreenNames,
}: {
  prompt: string;
  screens: ScreenPlan[];
  charter?: ProjectCharter | null;
  referenceMode?: string | null;
  existingScreenNames: Set<string>;
}) => {
  if (hasNegativeImageryRequest(prompt) && !hasPositiveImageryRequest(prompt)) {
    return [] as AssetRequirement[];
  }
  const userExplicitImagery = hasPositiveImageryRequest(prompt);
  const projectDirection = [
    prompt,
    charter?.creativeDirection?.styleEssence,
    charter?.creativeDirection?.signatureMoments?.join(" "),
    charter?.imageReferenceSummary,
  ].filter(Boolean).join(" ");
  if (!hasPositiveImageryRequest(projectDirection)) return [] as AssetRequirement[];

  const requirements: AssetRequirement[] = [];
  for (const screen of screens) {
    if (requirements.length >= 4 || existingScreenNames.has(screen.name)) continue;
    const plannerDescription = screen.description.split("Shared product family requirements:")[0];
    if (!hasPositiveImageryRequest(plannerDescription)) continue;

    const role = inferHeuristicAssetRole(screen, plannerDescription);
    const subject = compact(
      `${prompt.slice(0, 180)} ${screen.name} premium ${role.replace(/_/g, " ")}`,
    ).slice(0, 260);
    const semanticCategory = inferSemanticCategory(subject, role);
    const requirement: AssetRequirement = {
      id: slugify(`${screen.name}-${role}-explicit-imagery`),
      screenName: screen.name,
      role,
      subject,
      assetType: /illustration/i.test(`${prompt} ${plannerDescription}`) ? "illustration" : "photo",
      sourcePreference: "internal_library",
      desiredAspectRatio: inferHeuristicAspectRatio(plannerDescription),
      transparentBackground: false,
      placementHint: compact(
        `Use as the ${role.replace(/_/g, " ")} described by the approved screen brief: ${plannerDescription.slice(0, 220)}`,
      ).slice(0, 500),
      priority: /\b(?:hero|full bleed|full-bleed|must preserve|required)\b/i.test(plannerDescription)
        ? "critical"
        : "supporting",
      reuseKey: slugify(`${semanticCategory}-${screen.name}-${role}`),
      semanticCategory,
      semanticTags: normalizeSemanticTags(
        [semanticCategory, screen.name, charter?.appType ?? ""],
        semanticCategory,
      ).slice(0, 8),
      slotCount: 1,
      reusePolicy: "repeat",
      origin: userExplicitImagery
        ? "user_explicit"
        : referenceMode === "user_recreate" || referenceMode === "user_style" || referenceMode === "curated_style"
          ? "reference_visible"
          : "heuristic_inferred",
    };
    requirements.push(requirement);
  }
  return requirements;
};

export async function planVisualAssets({
  prompt,
  screens,
  charter,
  referenceMode,
  llmLog,
}: {
  prompt: string;
  screens: ScreenPlan[];
  charter?: ProjectCharter | null;
  designTokens?: DesignTokens | null;
  referenceMode?: string | null;
  intentContract?: { kind?: string | null } | null;
  llmLog?: LlmLogFn;
}): Promise<AssetRequirement[]> {
  const requirements: AssetRequirement[] = [];
  const seen = new Set<string>();
  const userExplicitImagery = hasPositiveImageryRequest(prompt);

  for (const screen of screens) {
    for (const need of (screen.assetNeeds ?? []).slice(0, 4)) {
      const normalized = normalizeRequirement(screen, need, userExplicitImagery);
      if (!normalized) continue;
      const key = `${normalized.screenName}:${normalized.role}:${semanticRequirementKey(normalized)}:${normalized.reusePolicy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push(normalized);
    }
  }

  const heuristicRequirements = inferExplicitImageryRequirements({
    prompt,
    screens,
    charter,
    referenceMode,
    existingScreenNames: new Set(requirements.map((requirement) => requirement.screenName)),
  });
  for (const requirement of heuristicRequirements) {
    const key = `${requirement.screenName}:${requirement.role}:${semanticRequirementKey(requirement)}:${requirement.reusePolicy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push(requirement);
  }

  llmLog?.("[visual-assets] Planner asset groups normalized", {
    requirementCount: requirements.length,
    heuristicRequirementCount: heuristicRequirements.length,
    screenCount: screens.length,
    totalExpectedUses: requirements.reduce((sum, requirement) => sum + requirement.slotCount, 0),
  });
  return requirements;
}

const manifestFromAsset = (
  asset: VisualAssetRow,
  requirement: AssetRequirement,
  slotIndex?: number,
): ScreenAssetManifest => ({
  id: asset.id,
  requirementId: requirement.id,
  role: requirement.role,
  url: asset.public_url,
  width: asset.width,
  height: asset.height,
  hasAlpha: asset.has_alpha,
  alt: compact(asset.subject || requirement.subject),
  placementHint: requirement.placementHint,
  objectFit: asset.has_alpha ? "contain" : objectFitForRequirement({ ...requirement, transparentBackground: false, assetType: "photo" }),
  objectPosition: objectPositionForRequirement(requirement),
  source: asset.source as VisualAssetSource,
  provider: asset.provider as VisualAssetProvider,
  critical: isCriticalRequirement(requirement),
  visibility: asset.visibility as VisualAssetVisibility,
  verificationScore: null,
  placeholder: false,
  license: asset.license,
  attribution: asset.attribution,
  sourceUrl: asset.source_url,
  requirementOrigin: requirement.origin,
  semanticCategory: requirement.semanticCategory,
  semanticTags: requirement.semanticTags,
  reusePolicy: requirement.reusePolicy,
  expectedUses: requirement.reusePolicy === "repeat" ? requirement.slotCount : 1,
  ...(slotIndex == null ? {} : { slotIndex }),
});

const manifestFromUserAsset = (asset: UserImageAssetRow, requirement: AssetRequirement): ScreenAssetManifest => ({
  id: asset.id,
  requirementId: requirement.id,
  role: requirement.role,
  url: asset.public_url,
  width: asset.width ?? 1024,
  height: asset.height ?? 1024,
  hasAlpha: /png|webp/i.test(asset.mime_type),
  alt: compact(requirement.subject),
  placementHint: requirement.placementHint,
  objectFit: objectFitForRequirement(requirement),
  objectPosition: objectPositionForRequirement(requirement),
  source: "user_upload",
  provider: "user",
  critical: isCriticalRequirement(requirement),
  visibility: "project_private",
  placeholder: false,
  license: null,
  attribution: null,
  sourceUrl: null,
  requirementOrigin: requirement.origin,
  semanticCategory: requirement.semanticCategory,
  semanticTags: requirement.semanticTags,
  reusePolicy: requirement.reusePolicy,
  expectedUses: requirement.reusePolicy === "repeat" ? requirement.slotCount : 1,
});

const placeholderManifest = (
  requirement: AssetRequirement,
  reason: string,
  slotIndex?: number,
): ScreenAssetManifest => ({
  id: `placeholder:${requirement.id}${slotIndex == null ? "" : `:${slotIndex}`}`,
  requirementId: requirement.id,
  role: requirement.role,
  url: null,
  width: 1024,
  height: 1024,
  hasAlpha: false,
  alt: compact(requirement.subject),
  placementHint: `${requirement.placementHint} Placeholder reason: ${reason}${requirement.role === "avatar" ? " Use initials or a person icon." : ""}`,
  objectFit: objectFitForRequirement(requirement),
  objectPosition: objectPositionForRequirement(requirement),
  source: "placeholder",
  provider: "placeholder",
  critical: isCriticalRequirement(requirement),
  visibility: "public_reusable",
  placeholder: true,
  license: null,
  attribution: null,
  sourceUrl: null,
  requirementOrigin: requirement.origin,
  semanticCategory: requirement.semanticCategory,
  semanticTags: requirement.semanticTags,
  reusePolicy: requirement.reusePolicy,
  expectedUses: requirement.reusePolicy === "repeat" ? requirement.slotCount : 1,
  ...(slotIndex == null ? {} : { slotIndex }),
});

const assetTags = (asset: VisualAssetRow) => Array.isArray(asset.tags) ? asset.tags : [];

const rankCompatibleAssets = ({
  assets,
  requirement,
  seed,
}: {
  assets: VisualAssetRow[];
  requirement: AssetRequirement;
  seed: string;
}) => {
  const reuseKey = stableReuseKey(requirement);
  const compatible = assets
    .filter(isActiveAsset)
    .map((asset) => {
      const exactReuseKey = asset.reuse_key === reuseKey;
      const compatibleAsset = isSemanticallyCompatible({
        requirement,
        assetRole: asset.role,
        assetCategory: asset.semantic_category,
        assetSubject: asset.subject,
        assetTags: assetTags(asset),
        exactReuseKey,
      });
      const score = exactReuseKey
        ? 100
        : semanticOverlap(
          semanticTokens([requirement.subject, ...requirement.semanticTags]),
          semanticTokens([asset.subject, ...assetTags(asset)]),
        );
      return { asset, compatible: compatibleAsset, score };
    })
    .filter((candidate) => candidate.compatible)
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id));

  if (compatible.length <= 1) return compatible.map((candidate) => candidate.asset);
  const topScore = compatible[0].score;
  const top = compatible.filter((candidate) => candidate.score === topScore);
  const rest = compatible.filter((candidate) => candidate.score !== topScore);
  const offset = stableCandidateIndex(seed, top.length);
  return [...top.slice(offset), ...top.slice(0, offset), ...rest].map((candidate) => candidate.asset);
};

const findCuratedAssets = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  limit,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  requirement: AssetRequirement;
  limit: number;
}) => {
  const { data, error } = await admin
    .from("visual_assets")
    .select("*")
    .eq("source", "internal_library")
    .eq("role", requirement.role)
    .eq("semantic_category", requirement.semanticCategory)
    .eq("asset_type", requirement.assetType)
    .eq("has_alpha", requirement.transparentBackground)
    .eq("status", "active")
    .limit(100);
  if (error) throw error;
  const visible = ((data as VisualAssetRow[] | null) ?? []).filter((asset) => isAssetVisibleToProject(asset, ownerId, projectId));
  const ranked = rankCompatibleAssets({ assets: visible, requirement, seed: `${projectId}:${requirement.id}` });
  return { assets: ranked.slice(0, limit), candidateCount: visible.length };
};

const findCachedStockAssets = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  limit,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  requirement: AssetRequirement;
  limit: number;
}) => {
  const { data, error } = await admin
    .from("visual_assets")
    .select("*")
    .eq("source", "stock")
    .eq("role", requirement.role)
    .eq("semantic_category", requirement.semanticCategory)
    .eq("reuse_key", stableReuseKey(requirement))
    .eq("status", "active")
    .limit(Math.max(limit, 12));
  if (error) throw error;
  const assets = ((data as VisualAssetRow[] | null) ?? [])
    .filter((asset) => isAssetVisibleToProject(asset, ownerId, projectId))
    .slice(0, limit);
  return { assets, candidateCount: data?.length ?? 0 };
};

const fetchRemoteBytes = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch stock image (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

const normalizeAssetBytes = async (bytes: Uint8Array, preserveAlpha: boolean) => {
  const pipeline = sharp(Buffer.from(bytes)).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true });
  const output = preserveAlpha
    ? await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
    : await pipeline.webp({ quality: 84, effort: 5 }).toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(output.data),
    width: output.info.width,
    height: output.info.height,
    contentType: preserveAlpha ? "image/png" : "image/webp",
    extension: preserveAlpha ? "png" : "webp",
    hasAlpha: preserveAlpha,
  };
};

const saveNormalizedAsset = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  bytes,
  source,
  provider,
  providerAssetId,
  sourceUrl,
  attribution,
  license,
  tags,
  visibility,
  diagnostic,
}: {
  admin: AdminClient;
  ownerId: string | null;
  projectId: string | null;
  requirement: AssetRequirement;
  bytes: Uint8Array;
  source: "internal_library" | "stock";
  provider: "drawgle_r2" | "pexels" | "pixabay";
  providerAssetId?: string | null;
  sourceUrl?: string | null;
  attribution?: string | null;
  license?: string | null;
  tags?: string[];
  visibility: VisualAssetVisibility;
  diagnostic?: AssetResolutionDiagnostic;
}): Promise<SavedAsset> => {
  if (providerAssetId) {
    const { data } = await admin
      .from("visual_assets")
      .select("*")
      .eq("provider", provider)
      .eq("provider_asset_id", providerAssetId)
      .eq("reuse_key", stableReuseKey(requirement))
      .eq("status", "active")
      .maybeSingle();
    if (data) return { asset: data as VisualAssetRow, displayVariant: null };
  }

  const normalized = await normalizeAssetBytes(bytes, requirement.transparentBackground);
  const contentHash = sha256Hex(normalized.bytes);
  const { data: duplicate } = await admin
    .from("visual_assets")
    .select("*")
    .eq("content_hash", contentHash)
    .eq("role", requirement.role)
    .eq("semantic_category", requirement.semanticCategory)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (duplicate) return { asset: duplicate as VisualAssetRow, displayVariant: null };

  const assetId = randomUUID();
  const key = `visual-assets/${assetId}/asset.${normalized.extension}`;
  const publicUrl = await uploadToR2({ key, bytes: normalized.bytes, contentType: normalized.contentType });
  if (diagnostic) diagnostic.r2WriteCount += 1;
  const canonicalTags = normalizeSemanticTags(
    [...(tags ?? []), ...requirement.semanticTags, requirement.subject],
    requirement.semanticCategory,
  );
  const { data, error } = await admin
    .from("visual_assets")
    .insert({
      id: assetId,
      owner_id: ownerId,
      created_by_project_id: projectId,
      subject: requirement.subject,
      semantic_category: requirement.semanticCategory,
      role: requirement.role,
      asset_type: requirement.transparentBackground ? requirement.assetType : "photo",
      source,
      provider,
      provider_asset_id: providerAssetId ?? null,
      source_url: sourceUrl ?? null,
      attribution: attribution ?? null,
      license: license ?? null,
      r2_key: key,
      public_url: publicUrl,
      width: normalized.width,
      height: normalized.height,
      has_alpha: normalized.hasAlpha,
      tags: canonicalTags,
      reuse_key: stableReuseKey(requirement),
      visibility,
      status: "active",
      content_hash: contentHash,
      mime_type: normalized.contentType,
      byte_size: normalized.bytes.byteLength,
      metadata: {
        semanticKey: semanticRequirementKey(requirement),
        placementHint: requirement.placementHint,
      } as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { asset: data as VisualAssetRow, displayVariant: null };
};

type StockCandidate = {
  provider: "pexels" | "pixabay";
  providerAssetId: string;
  imageUrl: string;
  sourceUrl: string | null;
  description: string;
  tags: string[];
  attribution: string | null;
  license: string;
  width: number | null;
  height: number | null;
};

const STOCK_CATEGORY_TERMS: Partial<Record<VisualAssetSemanticCategory, readonly string[]>> = {
  person: ["person", "portrait", "face", "headshot"],
  animal: ["animal", "pet", "dog", "cat"],
  food: ["food", "meal", "restaurant", "bakery", "dessert"],
  fashion: ["fashion", "clothing", "shoe", "bag", "watch"],
  electronics: ["technology", "device", "phone", "laptop", "audio"],
  vehicle: ["vehicle", "car", "bike", "scooter"],
  fitness: ["fitness", "workout", "athlete", "gym"],
  beauty: ["skincare", "skin", "cosmetic", "beauty", "serum", "cream", "lotion"],
  home: ["interior", "furniture", "home", "room"],
  place: ["travel", "destination", "city", "hotel"],
  nature: ["nature", "landscape", "forest", "ocean", "mountain"],
  generic_product: ["retail", "product", "merchandise"],
};

const STOCK_ROLE_TERMS: Partial<Record<VisualAssetRole, readonly string[]>> = {
  avatar: ["portrait"],
  product_photo: ["product photography"],
  product_cutout: ["isolated product"],
  section_photo: ["editorial photography"],
  background_photo: ["editorial background"],
};

const STOCK_PRODUCT_TERMS: Partial<Record<VisualAssetSemanticCategory, readonly string[]>> = {
  beauty: ["product", "bottle", "serum", "cream", "lotion", "cosmetic", "skincare", "packaging"],
  food: ["food", "meal", "dish", "pastry", "cake", "cookie", "dessert", "drink"],
  fashion: ["fashion", "clothing", "shoe", "bag", "watch", "apparel"],
  electronics: ["device", "phone", "laptop", "headphone", "speaker", "camera"],
  fitness: ["equipment", "dumbbell", "shoe", "gear"],
  generic_product: ["product", "item", "merchandise", "packaging"],
};

export const stockSearchQuery = (requirement: AssetRequirement) => {
  const subjectTokens = Array.from(semanticTokens([requirement.subject])).slice(0, 7);
  const categoryTerms = STOCK_CATEGORY_TERMS[requirement.semanticCategory] ?? [];
  const categoryTerm = categoryTerms.find((term) =>
    semanticTokens([requirement.subject, ...requirement.semanticTags]).has(normalizeSemanticTags([term], requirement.semanticCategory)[0]))
    ?? categoryTerms[0];
  const roleTerm = STOCK_ROLE_TERMS[requirement.role]?.[0];
  return compact(
    [categoryTerm, ...subjectTokens, roleTerm]
      .filter(Boolean)
      .join(" "),
  ).slice(0, 100);
};

const pexelsCandidates = async (
  requirement: AssetRequirement,
  count: number,
  diagnostic: AssetResolutionDiagnostic,
): Promise<StockCandidate[]> => {
  const apiKey = getOptionalPexelsApiKey();
  if (!apiKey) return [];
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", stockSearchQuery(requirement));
  url.searchParams.set("per_page", String(Math.max(8, Math.min(24, count * 3))));
  url.searchParams.set("orientation", requirement.desiredAspectRatio === "4:5" ? "portrait" : requirement.desiredAspectRatio === "16:9" || requirement.desiredAspectRatio === "5:4" ? "landscape" : "square");
  diagnostic.apiCallCount += 1;
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) return [];
  const payload = await response.json() as {
    photos?: Array<{ id: number; width?: number; height?: number; alt?: string; photographer?: string; photographer_url?: string; url?: string; src?: Record<string, string> }>;
  };
  return (payload.photos ?? []).flatMap((photo) => {
    const imageUrl = photo.src?.large2x ?? photo.src?.large ?? photo.src?.original;
    if (!imageUrl) return [];
    return [{
      provider: "pexels" as const,
      providerAssetId: String(photo.id),
      imageUrl,
      sourceUrl: photo.url ?? null,
      description: photo.alt ?? "",
      tags: Array.from(semanticTokens([photo.alt ?? ""])),
      attribution: photo.photographer ? `Photo by ${photo.photographer} on Pexels` : "Pexels",
      license: "Pexels License",
      width: photo.width ?? null,
      height: photo.height ?? null,
    }];
  });
};

const pixabayCandidates = async (
  requirement: AssetRequirement,
  count: number,
  diagnostic: AssetResolutionDiagnostic,
): Promise<StockCandidate[]> => {
  const apiKey = getOptionalPixabayApiKey();
  if (!apiKey) return [];
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", stockSearchQuery(requirement));
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", requirement.desiredAspectRatio === "4:5" ? "vertical" : requirement.desiredAspectRatio === "16:9" || requirement.desiredAspectRatio === "5:4" ? "horizontal" : "all");
  url.searchParams.set("per_page", String(Math.max(8, Math.min(24, count * 3))));
  url.searchParams.set("safesearch", "true");
  diagnostic.apiCallCount += 1;
  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = await response.json() as {
    hits?: Array<{ id: number; imageWidth?: number; imageHeight?: number; largeImageURL?: string; webformatURL?: string; tags?: string; user?: string; pageURL?: string }>;
  };
  return (payload.hits ?? []).flatMap((image) => {
    const imageUrl = image.largeImageURL ?? image.webformatURL;
    if (!imageUrl) return [];
    const tags = (image.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    return [{
      provider: "pixabay" as const,
      providerAssetId: String(image.id),
      imageUrl,
      sourceUrl: image.pageURL ?? null,
      description: tags.join(" ") || requirement.subject,
      tags,
      attribution: image.user ? `Image by ${image.user} on Pixabay` : "Pixabay",
      license: "Pixabay Content License",
      width: image.imageWidth ?? null,
      height: image.imageHeight ?? null,
    }];
  });
};

export const rankStockCandidates = (requirement: AssetRequirement, candidates: StockCandidate[]) => {
  const required = expandSemanticTags(semanticTokens([requirement.subject, ...requirement.semanticTags]));
  const categoryTerms = STOCK_CATEGORY_TERMS[requirement.semanticCategory] ?? [];
  const categoryAnchors = semanticTokens([
    ...categoryTerms,
    requirement.semanticCategory,
  ]);
  const hasCategoryProductVocabulary = Boolean(STOCK_PRODUCT_TERMS[requirement.semanticCategory]);
  const productRole = hasCategoryProductVocabulary && (
    ["product_photo", "product_cutout"].includes(requirement.role)
    || requirement.role === "section_photo"
  );
  const productAnchors = semanticTokens([
    ...(STOCK_PRODUCT_TERMS[requirement.semanticCategory] ?? ["product", "item"]),
  ]);
  const targetRatio = requirement.desiredAspectRatio === "1:1" ? 1
    : requirement.desiredAspectRatio === "4:5" ? 4 / 5
      : requirement.desiredAspectRatio === "5:4" ? 5 / 4
        : requirement.desiredAspectRatio === "16:9" ? 16 / 9
          : null;
  return candidates
    .map((candidate) => {
      const candidateTokens = semanticTokens([candidate.description, ...candidate.tags]);
      const subjectScore = semanticOverlap(required, candidateTokens);
      const categoryScore = categoryAnchors.size > 0
        ? semanticOverlap(categoryAnchors, candidateTokens)
        : subjectScore;
      const productScore = productRole
        ? semanticOverlap(productAnchors, candidateTokens)
        : 1;
      const ratio = candidate.width && candidate.height ? candidate.width / candidate.height : null;
      const aspectScore = targetRatio && ratio ? Math.max(0, 3 - Math.abs(Math.log(ratio / targetRatio)) * 3) : 0;
      const resolutionScore = candidate.width && candidate.height
        ? Math.min(2, Math.min(candidate.width, candidate.height) / 800)
        : 0;
      return {
        candidate,
        subjectScore,
        categoryScore,
        productScore,
        score: subjectScore * 10 + categoryScore * 12 + productScore * 4 + aspectScore + resolutionScore,
      };
    })
    .filter((entry) =>
      entry.subjectScore > 0
      && entry.categoryScore > 0
      && entry.productScore > 0
      && (!entry.candidate.width || !entry.candidate.height || Math.min(entry.candidate.width, entry.candidate.height) >= 640))
    .sort((left, right) => right.score - left.score || left.candidate.providerAssetId.localeCompare(right.candidate.providerAssetId))
    .map((entry) => entry.candidate);
};

export const shouldQueryPixabayFallback = (qualifiedPexelsCount: number, desiredCount: number) =>
  qualifiedPexelsCount < desiredCount;

const resolveStockAssets = async ({
  admin,
  requirement,
  count,
  diagnostic,
}: {
  admin: AdminClient;
  requirement: AssetRequirement;
  count: number;
  diagnostic: AssetResolutionDiagnostic;
}) => {
  if (requirement.semanticCategory === "logo") return { assets: [] as VisualAssetRow[], candidateCount: 0 };
  const stockRequirement: AssetRequirement = {
    ...requirement,
    assetType: "photo",
    transparentBackground: false,
    reuseKey: stableReuseKey(requirement),
  };
  const pexels = rankStockCandidates(stockRequirement, await pexelsCandidates(stockRequirement, count, diagnostic));
  const pixabay = shouldQueryPixabayFallback(pexels.length, count)
    ? rankStockCandidates(stockRequirement, await pixabayCandidates(stockRequirement, count - pexels.length, diagnostic))
    : [];
  const candidates = [...pexels, ...pixabay].filter((candidate, index, all) =>
    all.findIndex((other) =>
      other.provider === candidate.provider
      && other.providerAssetId === candidate.providerAssetId) === index);
  const assets: VisualAssetRow[] = [];
  for (const candidate of candidates) {
    if (assets.length >= count) break;
    try {
      const bytes = await fetchRemoteBytes(candidate.imageUrl);
      const saved = await saveNormalizedAsset({
        admin,
        ownerId: null,
        projectId: null,
        requirement: stockRequirement,
        bytes,
        source: "stock",
        provider: candidate.provider,
        providerAssetId: candidate.providerAssetId,
        sourceUrl: candidate.sourceUrl,
        attribution: candidate.attribution,
        license: candidate.license,
        tags: candidate.tags,
        visibility: "public_reusable",
        diagnostic,
      });
      if (!assets.some((asset) => asset.id === saved.asset.id || (
        asset.content_hash && saved.asset.content_hash && asset.content_hash === saved.asset.content_hash
      ))) {
        assets.push(saved.asset);
      }
    } catch (error) {
      console.warn("[visual-assets] Stock candidate persistence failed", {
        provider: candidate.provider,
        providerAssetId: candidate.providerAssetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { assets, candidateCount: candidates.length };
};

const resolveUserUpload = async ({
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
  if (!requirement.userAssetId) return null;
  const { data, error } = await admin
    .from("user_image_assets")
    .select("*")
    .eq("id", requirement.userAssetId)
    .eq("owner_id", ownerId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data as UserImageAssetRow | null;
};

const dedupeResolvedAssets = (assets: VisualAssetRow[]) => {
  const ids = new Set<string>();
  const contentHashes = new Set<string>();
  const providerIds = new Set<string>();
  return assets.filter((asset) => {
    const providerKey = asset.provider_asset_id
      ? `${asset.provider}:${asset.provider_asset_id}`
      : null;
    if (
      ids.has(asset.id)
      || (asset.content_hash ? contentHashes.has(asset.content_hash) : false)
      || (providerKey ? providerIds.has(providerKey) : false)
    ) {
      return false;
    }
    ids.add(asset.id);
    if (asset.content_hash) contentHashes.add(asset.content_hash);
    if (providerKey) providerIds.add(providerKey);
    return true;
  });
};

const resolveRequirement = async ({
  admin,
  ownerId,
  projectId,
  requirement,
  memoryCache,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  requirement: AssetRequirement;
  memoryCache: Map<string, VisualAssetRow[]>;
}): Promise<ResolvedRequirement> => {
  const startedAt = Date.now();
  const diagnostic = createDiagnostic(requirement, startedAt);
  const desiredCount = requirement.reusePolicy === "distinct" ? requirement.slotCount : 1;

  if (requirement.userAssetId || requirement.sourcePreference === "user_upload") {
    const upload = await resolveUserUpload({ admin, ownerId, projectId, requirement });
    diagnostic.selectedVia = upload ? "user_upload" : "placeholder";
    diagnostic.selectedSource = upload ? "user_upload" : "placeholder";
    diagnostic.rejectionCode = upload ? null : requirement.userAssetId ? "user_asset_not_accessible" : "user_asset_id_required";
    diagnostic.durationMs = Date.now() - startedAt;
    return {
      manifests: upload ? [manifestFromUserAsset(upload, requirement)] : [placeholderManifest(requirement, diagnostic.rejectionCode ?? "user_asset_unavailable")],
      assetIds: [],
      diagnostic,
    };
  }

  const cacheKey = `${requirement.sourcePreference}:${semanticRequirementKey(requirement)}:${requirement.reusePolicy}:${desiredCount}`;
  const memoryAssets = memoryCache.get(cacheKey);
  if (memoryAssets?.length) {
    const uniqueMemoryAssets = dedupeResolvedAssets(memoryAssets).slice(0, desiredCount);
    diagnostic.cacheHit = true;
    diagnostic.selectedVia = "cache";
    diagnostic.selectedSource = uniqueMemoryAssets[0].source as VisualAssetSource;
    diagnostic.selectedAssetId = uniqueMemoryAssets[0].id;
    diagnostic.candidateCount = uniqueMemoryAssets.length;
    diagnostic.durationMs = Date.now() - startedAt;
    const manifests = uniqueMemoryAssets.map((asset, index) =>
      manifestFromAsset(asset, requirement, requirement.reusePolicy === "distinct" ? index : undefined));
    if (requirement.reusePolicy === "distinct") {
      for (let index = manifests.length; index < desiredCount; index++) {
        manifests.push(placeholderManifest(requirement, "No additional distinct semantic match found.", index));
      }
    }
    return {
      manifests,
      assetIds: uniqueMemoryAssets.map((asset) => asset.id),
      diagnostic,
    };
  }

  const cached = await findCachedStockAssets({ admin, ownerId, projectId, requirement, limit: desiredCount });
  diagnostic.candidateCount += cached.candidateCount;
  let assets: VisualAssetRow[] = dedupeResolvedAssets(cached.assets);
  if (assets.length) {
    diagnostic.selectedVia = "cache";
    diagnostic.cacheHit = true;
  }

  if (assets.length < desiredCount) {
    const curated = await findCuratedAssets({ admin, ownerId, projectId, requirement, limit: desiredCount - assets.length });
    diagnostic.candidateCount += curated.candidateCount;
    assets = dedupeResolvedAssets([...assets, ...curated.assets]);
    if (curated.assets.length && !diagnostic.selectedVia) diagnostic.selectedVia = "curated";
  }

  if (assets.length < desiredCount) {
    const stock = await resolveStockAssets({ admin, requirement, count: desiredCount - assets.length, diagnostic });
    diagnostic.candidateCount += stock.candidateCount;
    assets = dedupeResolvedAssets([...assets, ...stock.assets]);
    if (stock.assets.length && !diagnostic.selectedVia) diagnostic.selectedVia = "stock";
  }

  assets = dedupeResolvedAssets(assets).slice(0, desiredCount);
  if (assets.length) memoryCache.set(cacheKey, assets);
  diagnostic.selectedAssetId = assets[0]?.id ?? null;
  diagnostic.selectedSource = (assets[0]?.source as VisualAssetSource | undefined) ?? "placeholder";
  diagnostic.selectedVia = diagnostic.selectedVia ?? (assets.length ? "curated" : "placeholder");
  diagnostic.rejectionCode = assets.length ? null : "no_semantic_match";
  diagnostic.durationMs = Date.now() - startedAt;

  const manifests = assets.map((asset, index) =>
    manifestFromAsset(asset, requirement, requirement.reusePolicy === "distinct" ? index : undefined));
  if (requirement.reusePolicy === "distinct") {
    for (let index = assets.length; index < desiredCount; index++) {
      manifests.push(placeholderManifest(requirement, "No additional distinct semantic match found.", index));
    }
  } else if (manifests.length === 0) {
    manifests.push(placeholderManifest(requirement, "No semantically compatible curated or stock image found."));
  }

  return { manifests, assetIds: assets.map((asset) => asset.id), diagnostic };
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
  const { error } = await admin.from("project_asset_usages").upsert({
    project_id: projectId,
    generation_run_id: generationRunId,
    asset_id: assetId,
    requirement_id: requirement.id,
    screen_name: requirement.screenName,
    placement_hint: requirement.placementHint,
  }, { onConflict: "project_id,generation_run_id,requirement_id,asset_id" });
  if (error) console.warn("[visual-assets] Failed to record usage", { requirementId: requirement.id, assetId, error });
};

export type ProjectAssetResolutionProgress = {
  completed: number;
  total: number;
  resolved: number;
  placeholders: number;
  failures: number;
};

export async function resolveProjectAssets({
  admin,
  ownerId,
  projectId,
  generationRunId,
  requirements,
  onProgress,
}: {
  admin: AdminClient;
  ownerId: string;
  projectId: string;
  generationRunId: string;
  requirements: AssetRequirement[];
  onProgress?: (progress: ProjectAssetResolutionProgress) => void | Promise<void>;
}): Promise<ProjectAssetManifest> {
  const assetsByScreen: ProjectAssetManifest["assetsByScreen"] = {};
  const failures: NonNullable<ProjectAssetManifest["failures"]> = [];
  const diagnostics: NonNullable<ProjectAssetManifest["diagnostics"]> = [];
  const memoryCache = new Map<string, VisualAssetRow[]>();
  let completed = 0;

  for (const requirement of requirements) {
    try {
      const resolved = await resolveRequirement({ admin, ownerId, projectId, requirement, memoryCache });
      diagnostics.push(resolved.diagnostic);
      assetsByScreen[requirement.screenName] = [
        ...(assetsByScreen[requirement.screenName] ?? []),
        ...resolved.manifests,
      ];
      for (const assetId of new Set(resolved.assetIds)) {
        await recordUsage({ admin, projectId, generationRunId, requirement, assetId });
      }
      if (resolved.manifests.every((manifest) => manifest.placeholder)) {
        failures.push({
          requirementId: requirement.id,
          screenName: requirement.screenName,
          subject: requirement.subject,
          priority: requirement.priority,
          reason: resolved.diagnostic.rejectionCode ?? "No visual asset resolved.",
          fatal: false,
        });
      }
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
      diagnostics.push({
        ...createDiagnostic(requirement, Date.now()),
        selectedVia: "placeholder",
        selectedSource: "placeholder",
        rejectionCode: "resolver_error",
      });
      assetsByScreen[requirement.screenName] = [
        ...(assetsByScreen[requirement.screenName] ?? []),
        placeholderManifest(requirement, reason),
      ];
      console.warn("[visual-assets] Requirement failed", { requirementId: requirement.id, error: reason });
    }
    completed += 1;
    if (onProgress) {
      const manifests = Object.values(assetsByScreen).flat();
      try {
        await onProgress({
          completed,
          total: requirements.length,
          resolved: manifests.filter((asset) => !asset.placeholder && asset.url).length,
          placeholders: manifests.filter((asset) => asset.placeholder).length,
          failures: failures.length,
        });
      } catch (error) {
        console.warn("[visual-assets] Progress callback failed", {
          completed,
          total: requirements.length,
          error,
        });
      }
    }
  }

  return { requirements, assetsByScreen, failures, diagnostics };
}

const curatedRequirement = ({
  subject,
  role,
  assetType,
  hasAlpha,
  semanticCategory,
  tags,
  reuseKey,
  width,
  height,
}: {
  subject: string;
  role: VisualAssetRole;
  assetType: VisualAssetType;
  hasAlpha: boolean;
  semanticCategory?: VisualAssetSemanticCategory;
  tags: string[];
  reuseKey?: string;
  width?: number | null;
  height?: number | null;
}): AssetRequirement => {
  const category = semanticCategory ?? inferSemanticCategory([subject, ...tags].join(" "), role);
  return {
    id: `curated-${slugify(subject)}`,
    screenName: "Curated Library",
    role,
    subject,
    assetType,
    sourcePreference: "internal_library",
    desiredAspectRatio: width && height ? width > height ? "5:4" : height > width ? "4:5" : "1:1" : "free",
    transparentBackground: hasAlpha,
    placementHint: "Reusable curated asset; the builder may place it in any compatible visual slot.",
    priority: "supporting",
    reuseKey: reuseKey ?? `${role}-${category}-${subject}`,
    semanticCategory: category,
    semanticTags: normalizeSemanticTags(tags, category).slice(0, 8),
    slotCount: 1,
    reusePolicy: "repeat",
  };
};

export async function importCuratedVisualAssetFromBytes({
  admin,
  bytes,
  subject,
  role,
  assetType = "transparent_png",
  hasAlpha = true,
  semanticCategory,
  tags = [],
  reuseKey,
  license = "Drawgle curated internal library",
  width,
  height,
}: {
  admin: AdminClient;
  bytes: Uint8Array;
  contentType: string;
  subject: string;
  role: VisualAssetRole;
  assetType?: VisualAssetType;
  hasAlpha?: boolean;
  semanticCategory?: VisualAssetSemanticCategory;
  tags?: string[];
  reuseKey?: string;
  license?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const requirement = curatedRequirement({ subject, role, assetType, hasAlpha, semanticCategory, tags, reuseKey, width, height });
  return saveNormalizedAsset({
    admin,
    ownerId: null,
    projectId: null,
    requirement,
    bytes,
    source: "internal_library",
    provider: "drawgle_r2",
    license,
    tags,
    visibility: "public_reusable",
  });
}

export async function importCuratedVisualAsset({
  admin,
  imageUrl,
  ...input
}: {
  admin: AdminClient;
  imageUrl: string;
  subject: string;
  role: VisualAssetRole;
  assetType?: VisualAssetType;
  hasAlpha?: boolean;
  semanticCategory?: VisualAssetSemanticCategory;
  tags?: string[];
  reuseKey?: string;
  license?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const bytes = await fetchRemoteBytes(imageUrl);
  return importCuratedVisualAssetFromBytes({ admin, bytes, contentType: "application/octet-stream", ...input });
}
