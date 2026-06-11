import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { showcaseSourceData as showcaseSources } from "../lib/showcase-source-data";
import { uploadBytesToR2 } from "../lib/r2-upload-core";

loadEnvConfig(process.cwd());

type JsonRecord = Record<string, any>;
type Source = (typeof showcaseSources)[number];
const getShowcaseSource = (slug: string) => showcaseSources.find((source) => source.slug === slug) ?? null;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const slugIndex = args.indexOf("--slug");
const requestedSlug = slugIndex >= 0 ? args[slugIndex + 1] : null;

if (!all && !requestedSlug) {
  throw new Error("Use --all or --slug <slug>.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase environment variables are missing.");

const admin: any = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const asStrings = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.every((item) => typeof item === "string") && value.length ? value : fallback;

function makeStylePack(source: Source, project: JsonRecord, navigation: JsonRecord | null) {
  const charter = (project.project_charter ?? {}) as JsonRecord;
  const direction = (charter.creativeDirection ?? {}) as JsonRecord;
  const signals = (charter.designSystemSignals ?? {}) as JsonRecord;
  const visualBrief = navigation?.plan?.visualBrief || "Use a coherent navigation treatment derived from the selected visual system.";
  const creativeDirectionSeed = {
    conceptName: direction.conceptName || source.title,
    styleEssence: direction.styleEssence || source.description,
    colorStory: direction.colorStory || signals.palette || "Preserve the source system's restrained palette hierarchy.",
    typographyMood: direction.typographyMood || signals.typography || "Use a clear, deliberate typographic hierarchy.",
    surfaceLanguage: direction.surfaceLanguage || signals.surfaces || "Preserve the source system's surface depth and border language.",
    iconographyStyle: direction.iconographyStyle || signals.iconography || "Use consistent, restrained iconography.",
    compositionPrinciples: asStrings(direction.compositionPrinciples, [
      "Preserve the source system's spacing rhythm and hierarchy.",
      "Adapt compositions to the user's product rather than copying source layouts.",
    ]),
    signatureMoments: asStrings(direction.signatureMoments, [
      "Use one focused visual moment per screen.",
      "Keep repeated components visibly related across the product.",
    ]),
    motionTone: direction.motionTone || signals.motionTone || "Restrained and purposeful.",
    avoid: asStrings(direction.avoid, [
      "Do not copy the source product's features, copy, or information architecture.",
      "Do not reduce the visual system to its accent colors alone.",
    ]),
  };

  return {
    id: source.slug,
    label: source.title,
    version: 1,
    premiumIntent: source.description,
    bestFor: ["mobile products that need a distinctive, coherent visual system"],
    tokenSeed: project.design_tokens ?? {},
    creativeDirectionSeed,
    layoutGrammar: [
      "Adapt the spacing, hierarchy, and composition rhythm to the user's own product.",
      "Use the source as a visual grammar, never as a product-layout template.",
    ],
    componentRecipes: [
      "Apply the source surface, radius, border, and typography treatment consistently.",
      "Create product-appropriate components while preserving the selected visual language.",
    ],
    navigationRecipes: [visualBrief],
    assetAndImageryRules: [
      "Choose imagery appropriate to the user's brief; never inherit source-product imagery.",
      "Preserve image treatment and visual weight rather than image subject matter.",
    ],
    densityRules: [
      signals.density || "Preserve the source system's relative density and breathing room.",
    ],
    antiPatterns: [
      "Never reproduce the source project's features, audience, copy, or screen structure.",
      "Never inject the source project's original prompt into generation.",
    ],
  };
}

async function promoteUrl(source: Source, version: number, urlToPromote: string, fallbackMime = "image/png") {
  const response = await fetch(urlToPromote);
  if (!response.ok) throw new Error(`Unable to fetch template asset ${urlToPromote}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || fallbackMime;
  const extension = contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") || "bin";
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const key = `published-template-assets/${source.slug}/v${version}/${contentHash}.${extension}`;
  const config = {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!,
  };
  if (Object.values(config).some((value) => !value)) throw new Error("R2 environment variables are missing.");
  return uploadBytesToR2({ config, key, bytes, contentType });
}

async function publish(source: Source) {
  const { data: project, error: projectError } = await admin
    .from("projects").select("*").eq("id", source.projectId).maybeSingle();
  if (projectError || !project) throw projectError ?? new Error(`${source.slug}: source project not found.`);
  if (project.status !== "completed" || !project.design_tokens) {
    throw new Error(`${source.slug}: source must be completed and contain design tokens.`);
  }

  const [{ data: screens, error: screensError }, { data: navigation }, { data: usages }, { data: userAssets }] =
    await Promise.all([
      admin.from("screens").select("*").eq("project_id", source.projectId).eq("status", "ready").order("sort_index"),
      admin.from("project_navigation").select("*").eq("project_id", source.projectId).maybeSingle(),
      admin.from("project_asset_usages").select("*, visual_assets(*)").eq("project_id", source.projectId).order("id"),
      admin.from("user_image_assets").select("*").eq("project_id", source.projectId).order("id"),
    ]);
  if (screensError) throw screensError;
  if (!screens?.length) throw new Error(`${source.slug}: source has no ready screens.`);

  const contentHash = hash({ project, screens, navigation, usages, userAssets });
  const { data: current } = await admin
    .from("published_templates").select("id, version, content_hash")
    .eq("slug", source.slug).eq("is_current", true).maybeSingle();
  if (current?.content_hash === contentHash) {
    console.log(`unchanged ${source.slug} v${current.version} (${screens.length} screens)`);
    return screens.length;
  }

  const version = (current?.version ?? 0) + 1;
  console.log(`${dryRun ? "validate" : "publish"} ${source.slug} v${version} (${screens.length} screens)`);
  if (dryRun) return screens.length;

  let rewrittenScreens = screens.map((item: JsonRecord) => ({ ...item }));
  for (const asset of userAssets ?? []) {
    const durableUrl = await promoteUrl(source, version, asset.public_url, asset.mime_type);
    rewrittenScreens = rewrittenScreens.map((item: JsonRecord) => ({
      ...item,
      code: item.code.split(asset.public_url).join(durableUrl),
    }));
  }

  const promotedAssetIds = new Map<string, string>();
  for (const usage of usages ?? []) {
    const asset = usage.visual_assets;
    if (!asset || (!asset.owner_id && asset.visibility === "public_reusable")) continue;
    if (promotedAssetIds.has(asset.id)) continue;
    const durableUrl = await promoteUrl(source, version, asset.public_url, asset.mime_type || "image/png");
    const r2Key = new URL(durableUrl).pathname.replace(/^\/+/, "");
    const { data: promoted, error } = await admin.from("visual_assets").insert({
      owner_id: null,
      created_by_project_id: null,
      subject: asset.subject,
      role: asset.role,
      asset_type: asset.asset_type,
      source: "internal_library",
      provider: "drawgle_r2",
      license: asset.license,
      r2_key: r2Key,
      public_url: durableUrl,
      width: asset.width,
      height: asset.height,
      has_alpha: asset.has_alpha,
      dominant_colors: asset.dominant_colors,
      safe_area: asset.safe_area,
      tags: asset.tags,
      reuse_key: `published:${source.slug}:v${version}:${asset.reuse_key}`,
      quality_score: asset.quality_score,
      metadata: { ...(asset.metadata ?? {}), publishedTemplate: source.slug, publishedVersion: version },
      visibility: "public_reusable",
      verification_status: "verified",
      content_hash: asset.content_hash,
      mime_type: asset.mime_type,
      byte_size: asset.byte_size,
    }).select("id").single();
    if (error) throw error;
    promotedAssetIds.set(asset.id, promoted.id);
    rewrittenScreens = rewrittenScreens.map((item: JsonRecord) => ({
      ...item,
      code: item.code.split(asset.public_url).join(durableUrl),
    }));
  }

  const stylePack = makeStylePack(source, project, navigation);
  const { data: template, error: templateError } = await admin.from("published_templates").insert({
    slug: source.slug,
    version,
    source_project_id: source.projectId,
    title: source.title,
    description: source.description,
    prompt: project.prompt,
    status: "draft",
    is_current: false,
    design_tokens: project.design_tokens,
    project_charter: project.project_charter,
    next_screen_x: project.next_screen_x,
    screen_origin_y: project.screen_origin_y,
    source_created_at: project.created_at,
    source_updated_at: project.updated_at,
    content_hash: contentHash,
  }).select("id").single();
  if (templateError) throw templateError;

  const { data: insertedScreens, error: insertedScreensError } = await admin.from("published_template_screens")
    .insert(rewrittenScreens.map((screen: JsonRecord) => ({
      template_id: template.id,
      source_screen_id: screen.id,
      name: screen.name,
      prompt: screen.prompt,
      code: screen.code,
      position_x: screen.position_x,
      position_y: screen.position_y,
      sort_index: screen.sort_index,
      summary: screen.summary,
      block_index: screen.block_index,
      chrome_policy: screen.chrome_policy,
      navigation_item_id: screen.navigation_item_id,
    }))).select("id, source_screen_id");
  if (insertedScreensError) throw insertedScreensError;

  if (navigation) {
    const { error } = await admin.from("published_template_navigation").insert({
      template_id: template.id,
      plan: navigation.plan,
      shell_code: navigation.shell_code,
      block_index: navigation.block_index,
      status: navigation.status,
    });
    if (error) throw error;
  }

  const screenIds = new Map(insertedScreens.map((item: JsonRecord) => [item.source_screen_id, item.id]));
  if (usages?.length) {
    const { error } = await admin.from("published_template_asset_usages").insert(usages.map((usage: JsonRecord) => ({
      template_id: template.id,
      template_screen_id: usage.screen_id ? screenIds.get(usage.screen_id) ?? null : null,
      asset_id: promotedAssetIds.get(usage.asset_id) ?? usage.asset_id,
      requirement_id: usage.requirement_id,
      screen_name: usage.screen_name,
      placement_hint: usage.placement_hint,
    })));
    if (error) throw error;
  }

  const { error: presetError } = await admin.from("published_style_presets").insert({
    template_id: template.id,
    slug: source.slug,
    version,
    title: source.title,
    description: source.description,
    status: "published",
    is_current: false,
    style_pack: { ...stylePack, version },
    token_seed: project.design_tokens,
    creative_direction_seed: stylePack.creativeDirectionSeed,
    design_system_signals: project.project_charter?.designSystemSignals ?? {},
    reference_analysis: { source: "published_project", navigationVisualBrief: navigation?.plan?.visualBrief ?? null },
    content_hash: hash(stylePack),
  });
  if (presetError) throw presetError;

  await admin.from("published_style_presets").update({ is_current: false }).eq("slug", source.slug);
  await admin.from("published_templates").update({ is_current: false }).eq("slug", source.slug);
  const { error: publishError } = await admin.from("published_templates")
    .update({ status: "published", is_current: true, published_at: new Date().toISOString() }).eq("id", template.id);
  if (publishError) throw publishError;
  const { error: currentPresetError } = await admin.from("published_style_presets")
    .update({ is_current: true }).eq("template_id", template.id);
  if (currentPresetError) throw currentPresetError;

  return screens.length;
}

async function main() {
  const sources = all ? showcaseSources : [getShowcaseSource(requestedSlug!)].filter(Boolean) as Source[];
  if (!sources.length) throw new Error(`Unknown showcase slug: ${requestedSlug}`);

  let total = 0;
  for (const source of sources) total += await publish(source);
  console.log(`${dryRun ? "Validated" : "Published"} ${sources.length} templates with ${total} ready source screens.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
