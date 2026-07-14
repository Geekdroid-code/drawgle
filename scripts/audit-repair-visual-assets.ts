import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { glob } from "node:fs/promises";
import { load } from "cheerio";

import {
  inferSemanticCategory,
  isSemanticallyCompatible,
  normalizeSemanticTags,
  semanticTokens,
} from "../lib/generation/asset-semantics";
import { indexScreenCode } from "../lib/generation/block-index";
import { showcaseSourceData } from "../lib/showcase-source-data";
import type { AssetRequirement, ScreenAssetManifest, VisualAssetRole, VisualAssetType } from "../lib/types";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase environment variables are missing.");

const admin: any = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type JsonRecord = Record<string, any>;
type Usage = JsonRecord & { visual_assets?: JsonRecord | null };
type AuditIssue = {
  usage: Usage;
  requirement: AssetRequirement;
  asset: JsonRecord;
  reason: string;
};

const asRecord = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const asArray = (value: unknown) => Array.isArray(value) ? value : [];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const nowFile = () => new Date().toISOString().replace(/[:.]/g, "-");

const normalizeRequirement = (rawValue: unknown, usage: Usage, asset: JsonRecord): AssetRequirement => {
  const raw = asRecord(rawValue);
  const subject = String(raw.subject ?? `${usage.requirement_id ?? "visual"} ${usage.placement_hint ?? ""} ${usage.screen_name ?? ""}`).trim();
  const rawRole = String(raw.role ?? asset.role ?? "decorative_object") as VisualAssetRole;
  const roleContext = `${raw.id ?? usage.requirement_id ?? ""} ${subject} ${raw.placementHint ?? raw.placement_hint ?? usage.placement_hint ?? ""}`;
  const role = rawRole !== "hero_cutout" && /\b(avatar|headshot|profile portrait|profile photo|user portrait)\b/i.test(roleContext) ? "avatar" : rawRole;
  const category = String(raw.semanticCategory ?? raw.semantic_category ?? inferSemanticCategory(roleContext, role)) as AssetRequirement["semanticCategory"];
  const rawTags = asArray(raw.semanticTags ?? raw.semantic_tags).filter((tag): tag is string => typeof tag === "string");
  const semanticTags = rawTags.length
    ? normalizeSemanticTags(rawTags, category).slice(0, 8)
    : Array.from(semanticTokens([subject])).filter((tag) => tag !== category).slice(0, 8);
  return {
    id: String(raw.id ?? usage.requirement_id ?? `legacy-${usage.id}`),
    screenName: String(raw.screenName ?? raw.screen_name ?? usage.screen_name ?? "Screen"),
    role,
    subject: subject.length >= 3 ? subject : "legacy visual asset",
    assetType: String(raw.assetType ?? raw.asset_type ?? asset.asset_type ?? "photo") as VisualAssetType,
    sourcePreference: raw.sourcePreference === "stock" || raw.source_preference === "stock" ? "stock" : "internal_library",
    desiredAspectRatio: ["1:1", "4:5", "5:4", "16:9", "free"].includes(String(raw.desiredAspectRatio ?? raw.desired_aspect_ratio))
      ? String(raw.desiredAspectRatio ?? raw.desired_aspect_ratio) as AssetRequirement["desiredAspectRatio"]
      : "free",
    transparentBackground: Boolean(raw.transparentBackground ?? raw.transparent_background ?? asset.has_alpha),
    placementHint: String(raw.placementHint ?? raw.placement_hint ?? usage.placement_hint ?? "Use only in a semantically compatible slot."),
    priority: ["critical", "supporting", "optional"].includes(String(raw.priority)) ? raw.priority : "supporting",
    reuseKey: String(raw.reuseKey ?? raw.reuse_key ?? `${role}-${category}-${subject}`),
    semanticCategory: category,
    semanticTags,
    slotCount: Math.max(1, Math.min(12, Number(raw.slotCount ?? raw.slot_count ?? 1) || 1)),
    reusePolicy: raw.reusePolicy === "distinct" || raw.reuse_policy === "distinct" ? "distinct" : "repeat",
    origin: raw.origin,
  };
};

const requirementsFromRun = (run: JsonRecord | undefined) => {
  const metadata = asRecord(run?.metadata);
  const manifest = asRecord(metadata.assetManifest);
  return asArray(metadata.assetRequirements ?? manifest.requirements);
};

const assetCategory = (asset: JsonRecord) => {
  const stored = String(asset.semantic_category ?? "");
  return stored && stored !== "other"
    ? stored
    : inferSemanticCategory([asset.subject, ...asArray(asset.tags)].join(" "), asset.role as VisualAssetRole);
};

const urlMapForAssets = (assets: JsonRecord[], variants: JsonRecord[]) => {
  const map = new Map<string, string[]>();
  for (const asset of assets) map.set(asset.id, [asset.public_url].filter(Boolean));
  for (const variant of variants) {
    const urls = map.get(variant.asset_id) ?? [];
    if (variant.public_url) urls.push(variant.public_url);
    map.set(variant.asset_id, Array.from(new Set(urls)));
  }
  return map;
};

const patchLegacyCode = ({
  code,
  oldUrls,
  requirement,
  replacement,
}: {
  code: string;
  oldUrls: string[];
  requirement: AssetRequirement;
  replacement: ScreenAssetManifest | null;
}) => {
  const $ = load(code, {}, false);
  let changed = false;
  $("img").each((_, element) => {
    const $image = $(element);
    if (!oldUrls.includes(($image.attr("src") ?? "").trim())) return;
    changed = true;
    if (replacement?.url) {
      $image
        .attr("src", replacement.url)
        .attr("alt", replacement.alt)
        .attr("data-asset-requirement-id", requirement.id)
        .attr("data-asset-role", requirement.role);
      return;
    }
    const placeholder = $("<div></div>");
    for (const attribute of ["class", "style", "width", "height", "data-drawgle-id"]) {
      const value = $image.attr(attribute);
      if (value) placeholder.attr(attribute, value);
    }
    placeholder
      .attr("role", "img")
      .attr("aria-label", requirement.subject)
      .attr("data-asset-sanitized", "legacy-semantic-mismatch")
      .attr("data-asset-role", requirement.role)
      .addClass("bg-slate-100 border border-slate-200");
    if (requirement.role === "avatar" && requirement.semanticCategory === "person") {
      placeholder.text(requirement.subject.charAt(0).toUpperCase());
    }
    $image.replaceWith(placeholder);
  });
  $("[style]").each((_, element) => {
    const $element = $(element);
    const style = $element.attr("style") ?? "";
    let next = style;
    for (const oldUrl of oldUrls) {
      if (!next.includes(oldUrl)) continue;
      changed = true;
      const allowedBackground = replacement?.url && (requirement.role === "background_photo" || requirement.role === "map_texture");
      next = next.split(oldUrl).join(allowedBackground ? replacement.url! : "");
    }
    if (next !== style) $element.attr("style", next);
  });
  return { code: $.html(), changed };
};

const avatarContextMisuses = (code: string, assets: JsonRecord[], urlsByAsset: Map<string, string[]>) => {
  const $ = load(code, {}, false);
  const issues: Array<{ asset: JsonRecord; urls: string[] }> = [];
  for (const asset of assets) {
    if (asset.role === "avatar") continue;
    const urls = urlsByAsset.get(asset.id) ?? [];
    let found = false;
    $("img").each((_, element) => {
      const $image = $(element);
      if (!urls.includes(($image.attr("src") ?? "").trim())) return;
      const context = [$image.attr("class"), $image.attr("id"), $image.attr("alt")]
        .concat($image.parents().slice(0, 3).map((__, parent) => `${$(parent).attr("class") ?? ""} ${$(parent).attr("id") ?? ""}`).get())
        .filter(Boolean)
        .join(" ");
      if (/\b(avatar|author|headshot|member|profile|user)\b/i.test(context)) found = true;
    });
    if (found) issues.push({ asset, urls });
  }
  return issues;
};

const syncRunMetadata = (metadataValue: unknown, requirement: AssetRequirement, manifests: ScreenAssetManifest[]) => {
  const metadata = structuredClone(asRecord(metadataValue));
  const requirements = asArray(metadata.assetRequirements).filter((item) => asRecord(item).id !== requirement.id);
  metadata.assetRequirements = [...requirements, requirement];
  const manifest = asRecord(metadata.assetManifest);
  const byScreen = asRecord(manifest.assetsByScreen);
  const screenAssets = asArray(byScreen[requirement.screenName]).filter((item) => asRecord(item).requirementId !== requirement.id);
  byScreen[requirement.screenName] = [...screenAssets, ...manifests];
  manifest.assetsByScreen = byScreen;
  manifest.requirements = [...asArray(manifest.requirements).filter((item) => asRecord(item).id !== requirement.id), requirement];
  metadata.assetManifest = manifest;
  return metadata;
};

const normalizedFolderKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const isAmbiguousLegacyRequirement = (requirement: AssetRequirement) =>
  requirement.semanticCategory === "other" ||
  /\b(premium product object(?: cutout)? for the app concept|legacy visual asset|generic visual|app concept product)\b/i.test(requirement.subject);

const legacyPlaceholderManifest = (requirement: AssetRequirement): ScreenAssetManifest => ({
  id: `placeholder:${requirement.id}`,
  requirementId: requirement.id,
  role: requirement.role,
  url: null,
  width: 1024,
  height: 1024,
  hasAlpha: false,
  alt: requirement.subject,
  placementHint: `${requirement.placementHint} Legacy placement was ambiguous and was sanitized.`,
  objectFit: requirement.transparentBackground ? "contain" : "cover",
  objectPosition: "center",
  source: "placeholder",
  provider: "placeholder",
  critical: false,
  visibility: "public_reusable",
  placeholder: true,
  semanticCategory: requirement.semanticCategory,
  semanticTags: requirement.semanticTags,
  reusePolicy: requirement.reusePolicy,
  expectedUses: requirement.reusePolicy === "repeat" ? requirement.slotCount : 1,
});

async function main() {
  const [assetResult, variantResult, usageResult, screenResult, runResult, publishedTemplateResult, publishedScreenResult, publishedUsageResult] = await Promise.all([
    admin.from("visual_assets").select("*"),
    admin.from("visual_asset_variants").select("*"),
    admin.from("project_asset_usages").select("*, visual_assets(*)"),
    admin.from("screens").select("*"),
    admin.from("generation_runs").select("id, metadata"),
    admin.from("published_templates").select("*").eq("is_current", true),
    admin.from("published_template_screens").select("*"),
    admin.from("published_template_asset_usages").select("*, visual_assets(*)"),
  ]);
  for (const result of [assetResult, variantResult, usageResult, screenResult, runResult, publishedTemplateResult, publishedScreenResult, publishedUsageResult]) {
    if (result.error) throw result.error;
  }

  const assets = assetResult.data as JsonRecord[];
  const variants = variantResult.data as JsonRecord[];
  const usages = usageResult.data as Usage[];
  const screens = screenResult.data as JsonRecord[];
  const runs = new Map((runResult.data as JsonRecord[]).map((run) => [run.id, run]));
  const urlsByAsset = urlMapForAssets(assets, variants);
  const issues: AuditIssue[] = [];

  for (const usage of usages) {
    const asset = usage.visual_assets ?? assets.find((candidate) => candidate.id === usage.asset_id);
    if (!asset) continue;
    const rawRequirement = requirementsFromRun(runs.get(usage.generation_run_id)).find((candidate) => asRecord(candidate).id === usage.requirement_id);
    const requirement = normalizeRequirement(rawRequirement, usage, asset);
    const exactReuseKey = slugify(requirement.reuseKey) === String(asset.reuse_key ?? "");
    const compatible = isSemanticallyCompatible({
      requirement,
      assetRole: String(asset.role),
      assetCategory: assetCategory(asset),
      assetSubject: String(asset.subject),
      assetTags: asArray(asset.tags).filter((tag): tag is string => typeof tag === "string"),
      exactReuseKey,
    });
    if (!compatible) {
      issues.push({
        usage,
        requirement,
        asset,
        reason: `asset=${asset.subject}(${asset.role}/${assetCategory(asset)}) requirement=${requirement.subject}(${requirement.role}/${requirement.semanticCategory})`,
      });
    }
  }

  const manifestIssueKeys = new Set<string>();
  for (const run of runs.values()) {
    const metadata = asRecord(run.metadata);
    const manifest = asRecord(metadata.assetManifest);
    const requirements = asArray(metadata.assetRequirements ?? manifest.requirements);
    for (const [screenName, screenAssetsValue] of Object.entries(asRecord(manifest.assetsByScreen))) {
      for (const manifestAssetValue of asArray(screenAssetsValue)) {
        const manifestAsset = asRecord(manifestAssetValue);
        if (manifestAsset.placeholder || !manifestAsset.url) continue;
        const asset = assets.find((candidate) => candidate.id === manifestAsset.id) ?? assets.find((candidate) =>
          (urlsByAsset.get(candidate.id) ?? []).includes(String(manifestAsset.url)));
        if (!asset) continue;
        const rawRequirement = requirements.find((candidate) => asRecord(candidate).id === manifestAsset.requirementId);
        const usage = {
          id: `manifest:${run.id}:${manifestAsset.requirementId}`,
          generation_run_id: run.id,
          requirement_id: manifestAsset.requirementId,
          screen_name: screenName,
          placement_hint: manifestAsset.placementHint,
        };
        const requirement = normalizeRequirement(rawRequirement, usage, asset);
        const compatible = isSemanticallyCompatible({
          requirement,
          assetRole: String(asset.role),
          assetCategory: assetCategory(asset),
          assetSubject: String(asset.subject),
          assetTags: asArray(asset.tags).filter((tag): tag is string => typeof tag === "string"),
          exactReuseKey: slugify(requirement.reuseKey) === String(asset.reuse_key ?? ""),
        });
        if (!compatible) manifestIssueKeys.add(`${run.id}:${requirement.id}:${asset.id}`);
      }
    }
  }

  const contextIssues = screens.flatMap((screen) =>
    avatarContextMisuses(String(screen.code ?? ""), assets, urlsByAsset).map((issue) => ({ screen, ...issue })));
  const localFiles: string[] = [];
  for await (const file of glob("public/screens/**/*.html")) localFiles.push(path.resolve(file));
  const localIssueCount = (await Promise.all(localFiles.map(async (file) => {
    const code = await readFile(file, "utf8");
    const incompatibleAssetIds = new Set(
      issues
        .filter((issue) => (urlsByAsset.get(issue.asset.id) ?? []).some((assetUrl) => code.includes(assetUrl)))
        .map((issue) => issue.asset.id),
    );
    for (const issue of avatarContextMisuses(code, assets, urlsByAsset)) {
      incompatibleAssetIds.add(String(issue.asset.id));
    }
    return incompatibleAssetIds.size;
  }))).reduce((sum, count) => sum + count, 0);

  const publishedIssues = (publishedUsageResult.data as Usage[]).filter((usage) => {
    const asset = usage.visual_assets;
    if (!asset) return false;
    const fallbackRequirement = normalizeRequirement(null, usage, asset);
    return !isSemanticallyCompatible({
      requirement: fallbackRequirement,
      assetRole: String(asset.role),
      assetCategory: assetCategory(asset),
      assetSubject: String(asset.subject),
      assetTags: asArray(asset.tags).filter((tag): tag is string => typeof tag === "string"),
    });
  });

  const report = {
    mode: apply ? "apply" : "dry-run",
    assetCount: assets.length,
    usageCount: usages.length,
    semanticIssueCount: issues.length,
    manifestIssueCount: manifestIssueKeys.size,
    avatarContextIssueCount: contextIssues.length,
    publishedIssueCount: publishedIssues.length,
    checkedInShowcaseIssueCount: localIssueCount,
    issues: issues.map((issue) => ({
      usageId: issue.usage.id,
      projectId: issue.usage.project_id,
      generationRunId: issue.usage.generation_run_id,
      screenName: issue.usage.screen_name,
      requirementId: issue.requirement.id,
      assetId: issue.asset.id,
      reason: issue.reason,
    })).slice(0, process.argv.includes("--verbose") ? issues.length : 50),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;
  if (!assets.every((asset) => "semantic_category" in asset && "status" in asset)) {
    throw new Error("Stage-one semantic asset migration must be applied before --apply.");
  }

  await mkdir("repair-backups", { recursive: true });
  const backupPath = path.resolve("repair-backups", `visual-assets-${nowFile()}.json`);
  await writeFile(backupPath, JSON.stringify({ report, screens, runs: Array.from(runs.values()), usages, publishedScreens: publishedScreenResult.data, publishedUsages: publishedUsageResult.data }, null, 2));
  console.log(`Backup: ${backupPath}`);

  const { resolveProjectAssets } = await import("../lib/generation/visual-assets");
  const changedScreens = new Map<string, JsonRecord>();
  const changedRunIds = new Set<string>();
  const issueMultiplicity = new Map<string, number>();
  for (const issue of issues) {
    const key = `${issue.usage.screen_id ?? `${issue.usage.project_id}:${issue.usage.generation_run_id}:${issue.usage.screen_name}`}:${issue.asset.id}`;
    issueMultiplicity.set(key, (issueMultiplicity.get(key) ?? 0) + 1);
  }
  for (const issue of issues) {
    const screen = screens.find((candidate) => candidate.id === issue.usage.screen_id) ?? screens.find((candidate) =>
      candidate.project_id === issue.usage.project_id &&
      candidate.generation_run_id === issue.usage.generation_run_id &&
      candidate.name === issue.usage.screen_name);
    if (!screen) continue;
    const multiplicityKey = `${issue.usage.screen_id ?? `${issue.usage.project_id}:${issue.usage.generation_run_id}:${issue.usage.screen_name}`}:${issue.asset.id}`;
    const ambiguous = isAmbiguousLegacyRequirement(issue.requirement) || (issueMultiplicity.get(multiplicityKey) ?? 0) > 1;
    const manifests = ambiguous
      ? [legacyPlaceholderManifest(issue.requirement)]
      : (await resolveProjectAssets({
        admin,
        ownerId: screen.owner_id,
        projectId: screen.project_id,
        generationRunId: issue.usage.generation_run_id,
        requirements: [issue.requirement],
      })).assetsByScreen[issue.requirement.screenName] ?? [];
    const replacement = ambiguous ? null : manifests.find((manifest) => !manifest.placeholder && manifest.url) ?? null;
    const current = changedScreens.get(screen.id) ?? screen;
    const patched = patchLegacyCode({
      code: String(current.code ?? ""),
      oldUrls: urlsByAsset.get(issue.asset.id) ?? [issue.asset.public_url].filter(Boolean),
      requirement: issue.requirement,
      replacement,
    });
    if (patched.changed) {
      current.code = patched.code;
      current.block_index = indexScreenCode(patched.code);
      changedScreens.set(screen.id, current);
    }
    await admin.from("project_asset_usages").delete().eq("id", issue.usage.id);
    await admin.from("project_asset_usages")
      .update({ screen_id: screen.id })
      .eq("project_id", screen.project_id)
      .eq("generation_run_id", issue.usage.generation_run_id)
      .eq("requirement_id", issue.requirement.id);
    const run = runs.get(issue.usage.generation_run_id);
    if (run) {
      run.metadata = syncRunMetadata(run.metadata, issue.requirement, manifests);
      runs.set(run.id, run);
      changedRunIds.add(run.id);
    }
  }

  for (const contextIssue of contextIssues) {
    const screen = changedScreens.get(contextIssue.screen.id) ?? contextIssue.screen;
    const requirement = normalizeRequirement({
      id: `legacy-avatar-${contextIssue.asset.id}`,
      role: "avatar",
      subject: "profile avatar",
      semanticCategory: "person",
      semanticTags: ["avatar", "portrait"],
    }, { id: contextIssue.asset.id, screen_name: screen.name }, contextIssue.asset);
    const patched = patchLegacyCode({ code: screen.code, oldUrls: contextIssue.urls, requirement, replacement: null });
    if (patched.changed) {
      screen.code = patched.code;
      screen.block_index = indexScreenCode(patched.code);
      changedScreens.set(screen.id, screen);
    }
  }

  for (const screen of changedScreens.values()) {
    const { error } = await admin.from("screens").update({ code: screen.code, block_index: screen.block_index, updated_at: new Date().toISOString() }).eq("id", screen.id);
    if (error) throw error;
  }
  for (const runId of changedRunIds) {
    const run = runs.get(runId);
    if (!run) continue;
    const { error } = await admin.from("generation_runs").update({ metadata: run.metadata }).eq("id", run.id);
    if (error) throw error;
  }

  const publishedScreens = publishedScreenResult.data as JsonRecord[];
  for (const source of changedScreens.values()) {
    for (const published of publishedScreens.filter((candidate) => candidate.source_screen_id === source.id)) {
      const { error } = await admin.from("published_template_screens").update({ code: source.code, block_index: source.block_index }).eq("id", published.id);
      if (error) throw error;
      await admin.from("published_template_asset_usages").delete().eq("template_id", published.template_id).eq("screen_name", published.name);
      const sourceUsages = await admin.from("project_asset_usages").select("*").eq("screen_id", source.id);
      if (sourceUsages.error) throw sourceUsages.error;
      if (sourceUsages.data?.length) {
        const rows = sourceUsages.data.map((usage: JsonRecord) => ({
          template_id: published.template_id,
          template_screen_id: published.id,
          asset_id: usage.asset_id,
          requirement_id: usage.requirement_id,
          screen_name: published.name,
          placement_hint: usage.placement_hint,
        }));
        const inserted = await admin.from("published_template_asset_usages").insert(rows);
        if (inserted.error) throw inserted.error;
      }
    }
  }

  const showcaseByProject = new Map(showcaseSourceData.map((source) => [source.projectId, source]));
  const folders = Array.from(new Set(localFiles.map((file) => path.dirname(file))));
  for (const screen of changedScreens.values()) {
    const showcase = showcaseByProject.get(screen.project_id);
    if (!showcase) continue;
    const folder = folders.find((candidate) => {
      const key = normalizedFolderKey(path.basename(candidate));
      return key === normalizedFolderKey(showcase.slug) || key === normalizedFolderKey(showcase.title);
    });
    if (!folder) continue;
    const file = localFiles.find((candidate) =>
      path.dirname(candidate) === folder && normalizedFolderKey(path.basename(candidate, path.extname(candidate))) === normalizedFolderKey(screen.name));
    if (file) await writeFile(file, screen.code, "utf8");
  }

  console.log(`Applied repairs to ${changedScreens.size} source screen(s). Re-run without --apply and require zero issues.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
