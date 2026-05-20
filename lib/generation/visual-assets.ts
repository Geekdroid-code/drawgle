import "server-only";

import { createHash, createHmac, randomUUID } from "crypto";

import sharp from "sharp";
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
type AssetGenerationJobRow = Database["public"]["Tables"]["asset_generation_jobs"]["Row"];

const FAL_MODEL = "fal-ai/gpt-image-1.5";
const FAL_QUEUE_BASE = "https://queue.fal.run";
const MAX_REQUIREMENTS = 8;
const MAX_CRITICAL_GENERATED_ASSETS = 3;
const FAL_POLL_INTERVAL_MS = 2500;
const FAL_MAX_POLLS = 36;

export class CriticalAssetResolutionError extends Error {
  failures: ProjectAssetManifest["failures"];

  constructor(failures: NonNullable<ProjectAssetManifest["failures"]>) {
    super(`Critical visual asset resolution failed: ${failures.map((failure) => `${failure.screenName}/${failure.requirementId}: ${failure.reason}`).join("; ")}`);
    this.name = "CriticalAssetResolutionError";
    this.failures = failures;
  }
}

class FalAssetTimeoutError extends Error {
  requestId: string;

  constructor(requestId: string) {
    super(`fal request did not complete before timeout: ${requestId}`);
    this.name = "FalAssetTimeoutError";
    this.requestId = requestId;
  }
}

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
      sourcePreference: "ai_generated",
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
      sourcePreference: "ai_generated",
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
      sourcePreference: "ai_generated",
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
      sourcePreference: "ai_generated",
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
  let generatedCriticalCount = 0;
  const merged: AssetRequirement[] = [];

  for (const requirement of requirements) {
    const key = normalizeMatchKey(`${requirement.screenName}-${requirement.role}-${requirement.assetType}-${stableReuseKey(requirement)}`);
    if (seen.has(key)) {
      continue;
    }

    if (requirement.priority === "critical" && isAiEligible(requirement)) {
      generatedCriticalCount += 1;
      if (generatedCriticalCount > MAX_CRITICAL_GENERATED_ASSETS) {
        merged.push({ ...requirement, priority: "supporting" });
        seen.add(key);
        continue;
      }
    }

    merged.push(requirement);
    seen.add(key);
    if (merged.length >= MAX_REQUIREMENTS) {
      break;
    }
  }

  return merged;
};

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
    const inferredRequirements = screens
      .map((screen) => inferAssetRequirementForScreen({ prompt, screen }))
      .filter((requirement): requirement is AssetRequirement => Boolean(requirement));

    if (!parsed.success) {
      llmLog?.("[visual-assets] Asset plan schema failed; using deterministic inferred requirements", {
        zodIssues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
        inferredRequirementCount: inferredRequirements.length,
        inferredRequirements: inferredRequirements.map((requirement) => ({
          id: requirement.id,
          screenName: requirement.screenName,
          role: requirement.role,
          assetType: requirement.assetType,
          priority: requirement.priority,
        })),
      });
      return mergeAssetRequirements(inferredRequirements);
    }

    const modelRequirements = parsed.data.assetRequirements
      .map((requirement) => {
        const screenName = resolveRequirementScreenName(screens, requirement.screenName);
        if (!screenName) {
          return null;
        }

        return {
          ...requirement,
          screenName,
        };
      })
      .filter((requirement): requirement is AssetRequirement => Boolean(requirement))
      .map((requirement) => ({
        ...requirement,
        reuseKey: stableReuseKey(requirement),
      });

    const screensWithModelAssets = new Set(modelRequirements.map((requirement) => requirement.screenName));
    const missingInferredRequirements = inferredRequirements.filter((requirement) => !screensWithModelAssets.has(requirement.screenName));
    const finalRequirements = mergeAssetRequirements([...modelRequirements, ...missingInferredRequirements]);
    llmLog?.("[visual-assets] Asset plan resolved", {
      modelRequirementCount: parsed.data.assetRequirements.length,
      keptModelRequirementCount: modelRequirements.length,
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
  } catch (error) {
    console.warn("[visual-assets] Asset planning failed; continuing without external assets", error);
    const inferredRequirements = mergeAssetRequirements(
      screens
        .map((screen) => inferAssetRequirementForScreen({ prompt, screen }))
        .filter((requirement): requirement is AssetRequirement => Boolean(requirement)),
    );
    if (inferredRequirements.length > 0) {
      llmLog?.("[visual-assets] Asset planning failed; using deterministic inferred requirements", {
        error: error instanceof Error ? error.message : String(error),
        inferredRequirementCount: inferredRequirements.length,
      });
    }
    return inferredRequirements;
  }
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
}): Promise<SavedAsset> => {
  const fetched = await fetchRemoteBytes(remoteUrl);
  if (!/^image\//i.test(fetched.contentType)) {
    throw new Error(`Remote asset did not return an image content type: ${fetched.contentType}`);
  }

  const contentHash = sha256Hex(fetched.bytes);
  const metadataFromBytes = await imageMetadata(fetched.bytes);
  const hasAlpha = metadataFromBytes.hasAlpha || detectPngAlpha(fetched.bytes);
  const visibility = determineVisibility(source, requirement);
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
  const verification = await verifyAsset({
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
  admin: AdminClient,
  ownerId: string,
  projectId: string,
  requirement: AssetRequirement,
): Promise<SavedAsset | null> => {
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
): Promise<SavedAsset | null> => {
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

  throw new FalAssetTimeoutError(submitResult.request_id);
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
  const { data: latestJob } = await admin
    .from("asset_generation_jobs")
    .select("*")
    .eq("id", job.id)
    .maybeSingle();
  const currentJob = (latestJob as AssetGenerationJobRow | null) ?? job;

  if (currentJob.asset_id) {
    const { data } = await admin.from("visual_assets").select("*").eq("id", currentJob.asset_id).maybeSingle();
    if (data) {
      return {
        asset: data as VisualAssetRow,
        displayVariant: await getDisplayVariant(admin, (data as VisualAssetRow).id),
      };
    }
  }

  const image = imageFromFalPayload(payload);
  if (!image) {
    throw new Error("fal payload did not contain an image URL.");
  }

  const saved = await saveAssetFromRemoteUrl({
    admin,
    ownerId: currentJob.owner_id,
    projectId: currentJob.project_id,
    requirement,
    remoteUrl: image.url,
    source: "ai_generated",
    provider: FAL_MODEL,
    license: "AI generated",
    width: image.width,
    height: image.height,
    metadata: {
      falRequestId: currentJob.fal_request_id,
      falPayload: payload,
      model: FAL_MODEL,
    },
  });

  await updateFalJob(admin, currentJob.id, {
    status: "completed",
    response_payload: payload as never,
    asset_id: saved.asset.id,
    completed_at: new Date().toISOString(),
    error: null,
  });

  return saved;
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
    priority: requirement.priority,
    reuseKey: stableReuseKey(requirement),
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
    if (error instanceof FalAssetTimeoutError) {
      await updateFalJob(admin, job.id, {
        status: "processing",
        error: error.message,
      });
      throw error;
    }

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
  const failures: NonNullable<ProjectAssetManifest["failures"]> = [];

  for (const requirement of requirements) {
    try {
      if (requirement.sourcePreference === "user_upload") {
        throw new Error("User-upload asset resolution is not available yet for this requirement.");
      }

      let saved = await findReusableAsset(admin, ownerId, projectId, requirement);

      if (!saved && requirement.sourcePreference === "stock" && isStockEligible(requirement)) {
        saved = await resolveStockAsset(admin, ownerId, projectId, requirement);
      }

      if (!saved && isStockEligible(requirement)) {
        saved = await resolveStockAsset(admin, ownerId, projectId, requirement);
      }

      if (!saved && isAiEligible(requirement) && requirement.priority !== "optional") {
        saved = await generateFalAsset({ admin, ownerId, projectId, requirement });
      }

      if (!saved) {
        failures.push({
          requirementId: requirement.id,
          screenName: requirement.screenName,
          subject: requirement.subject,
          priority: requirement.priority,
          reason: "No reusable, stock, or generated asset could satisfy this requirement.",
          fatal: isCriticalRequirement(requirement),
        });
        continue;
      }

      await recordUsage({ admin, projectId, generationRunId, requirement, assetId: saved.asset.id });

      const manifest = manifestFromAsset(saved.asset, requirement, saved.displayVariant);
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
        fatal: isCriticalRequirement(requirement),
      });
      console.warn("[visual-assets] Requirement failed", {
        requirementId: requirement.id,
        subject: requirement.subject,
        error: reason,
      });
    }
  }

  const fatalFailures = failures.filter((failure) => failure.fatal);
  if (fatalFailures.length > 0) {
    throw new CriticalAssetResolutionError(fatalFailures);
  }

  return {
    requirements,
    assetsByScreen,
    failures,
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

  if (job.status === "completed" && job.asset_id) {
    return { ok: true, assetId: job.asset_id, alreadyCompleted: true };
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
    priority: typeof requestPayload.priority === "string" ? requestPayload.priority : "supporting",
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

  if (isRecord(payload) && (payload.status === "ERROR" || payload.error)) {
    await updateFalJob(admin, job.id, {
      status: "failed",
      error: JSON.stringify(payload).slice(0, 2000),
      response_payload: payload as never,
    });
    return { ok: false, reason: "fal_error" };
  }

  try {
    const saved = await completeFalJobWithPayload({
      admin,
      job: job as AssetGenerationJobRow,
      requirement: requirement.data,
      payload,
    });

    return { ok: true, assetId: saved.asset.id };
  } catch (error) {
    await updateFalJob(admin, job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      response_payload: payload as never,
    });
    return { ok: false, reason: "completion_failed" };
  }
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

      if (status.status === "ERROR" || status.error) {
        await updateFalJob(admin, job.id, {
          status: "failed",
          error: status.error ?? "fal request returned ERROR status",
          response_payload: status as never,
        });
        continue;
      }

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
