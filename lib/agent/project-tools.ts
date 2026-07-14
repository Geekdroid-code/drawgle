import "server-only";

import { Type, type FunctionCall, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { detectTargetBlocks, indexScreenCode, isScreenBlockIndexUsable } from "@/lib/generation/block-index";
import { buildScreenSummaryLocally, generateEmbedding } from "@/lib/generation/embeddings";
import { extractScreenStyleMemory } from "@/lib/generation/screen-style-memory";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ScreenBlockIndex } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ProjectAgentReadTool = "get_project_overview" | "search_project" | "inspect_screen";
export type ProjectSearchDomain = "screens" | "conversations" | "assets" | "plans";
export type ScreenRegionReference = { screenId: string; blockId?: string | null; purpose: string };
export type AgentToolTrace = {
  tool: ProjectAgentReadTool;
  durationMs: number;
  resultCount: number;
  retrievalStage: "database" | "lexical" | "semantic" | "mixed";
  queryEmbeddingCount: number;
  resultIds: string[];
};

export type ProjectReadToolResult = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  trace: AgentToolTrace;
};

const overviewSchema = z.object({
  sections: z.array(z.enum(["charter", "tokens", "navigation", "plans", "assets", "generation"])).max(6).optional(),
});
const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  domains: z.array(z.enum(["screens", "conversations", "assets", "plans"])).min(1).max(4).optional(),
  limit: z.number().int().min(1).max(5).optional(),
});
const inspectSchema = z.object({
  screenRef: z.string().trim().min(1).max(160),
  view: z.enum(["outline", "region"]).optional(),
  query: z.string().trim().max(500).optional(),
});

const compact = (value: string | null | undefined, limit = 500) => {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
};
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const normalizeScreenReference = (value: string) => value
  .toLowerCase()
  .replace(/\b(screen|page|view)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const tokens = (value: string) => new Set(normalizeScreenReference(value).split(" ").filter((token) => token.length > 1));

const lexicalScore = (query: string, fields: Array<string | null | undefined>) => {
  const normalizedQuery = normalizeScreenReference(query);
  const haystack = normalizeScreenReference(fields.filter(Boolean).join(" "));
  if (!normalizedQuery || !haystack) return 0;
  if (haystack === normalizedQuery) return 100;
  if (haystack.includes(normalizedQuery)) return 40;
  const queryTokens = tokens(query);
  const haystackTokens = tokens(haystack);
  let overlap = 0;
  for (const token of queryTokens) if (haystackTokens.has(token)) overlap += 1;
  return queryTokens.size ? Math.round((overlap / queryTokens.size) * 20) : 0;
};

type ScreenCatalogRow = {
  id: string;
  name: string;
  prompt: string;
  summary: string | null;
  status: string;
  block_index?: unknown;
  code?: string;
  updated_at?: string;
  embedding?: number[] | null;
};

export function resolveScreenReference(screenRef: string, screens: ScreenCatalogRow[]) {
  const direct = screens.find((screen) => screen.id === screenRef);
  if (direct) return { status: "resolved" as const, screen: direct, candidates: [direct] };

  const normalized = normalizeScreenReference(screenRef);
  const exact = screens.filter((screen) => normalizeScreenReference(screen.name) === normalized);
  if (exact.length === 1) return { status: "resolved" as const, screen: exact[0], candidates: exact };
  if (exact.length > 1) return { status: "ambiguous" as const, screen: null, candidates: exact };

  const ranked = screens
    .map((screen) => ({ screen, score: lexicalScore(screenRef, [screen.name, screen.summary, screen.prompt]) }))
    .filter((entry) => entry.score >= 12)
    .sort((left, right) => right.score - left.score || left.screen.name.localeCompare(right.screen.name));
  if (ranked.length === 1 || (ranked[0] && ranked[0].score >= (ranked[1]?.score ?? 0) + 8)) {
    return { status: "resolved" as const, screen: ranked[0].screen, candidates: ranked.map((entry) => entry.screen) };
  }
  return { status: ranked.length ? "ambiguous" as const : "missing" as const, screen: null, candidates: ranked.slice(0, 5).map((entry) => entry.screen) };
}

const stringProperty = (description: string) => ({ type: Type.STRING, description });

export const projectReadToolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_project_overview",
    description: "Read selected project design facts such as charter, tokens, navigation, plans, assets, and generation state. Never returns screen HTML.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sections: { type: Type.ARRAY, items: stringProperty("charter, tokens, navigation, plans, assets, or generation") },
      },
    },
  },
  {
    name: "search_project",
    description: "Search this project's screens, earlier conversation, assets, and plans. Use when a named or described project item is not already unambiguous in the lightweight catalog.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: stringProperty("Natural-language search query."),
        domains: { type: Type.ARRAY, items: stringProperty("screens, conversations, assets, or plans") },
        limit: { type: Type.NUMBER, description: "Maximum results from 1 to 5." },
      },
      required: ["query"],
    },
  },
  {
    name: "inspect_screen",
    description: "Inspect a project screen's semantic outline or locate a relevant UI region. Returns structured facts and block references, never complete HTML/CSS.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        screenRef: stringProperty("Screen UUID or natural screen name."),
        view: stringProperty("outline or region"),
        query: stringProperty("Region/component description when view is region."),
      },
      required: ["screenRef"],
    },
  },
];

const result = (
  tool: ProjectAgentReadTool,
  startedAt: number,
  data: Record<string, unknown>,
  stage: AgentToolTrace["retrievalStage"],
  queryEmbeddingCount = 0,
  ids: string[] = [],
): ProjectReadToolResult => ({
  ok: true,
  data,
  trace: { tool, durationMs: Date.now() - startedAt, resultCount: ids.length, retrievalStage: stage, queryEmbeddingCount, resultIds: ids },
});

export function createProjectReadToolExecutor({
  admin,
  projectId,
  ownerId,
  onStaleScreen,
}: {
  admin: AdminClient;
  projectId: string;
  ownerId: string;
  onStaleScreen?: (screenId: string) => Promise<void>;
}) {
  const assertProject = async () => {
    const { data, error } = await admin
      .from("projects")
      .select("id, name, prompt, project_charter, design_tokens")
      .eq("id", projectId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Project not found.");
    return data;
  };

  const screenCatalog = async (includeSource = false): Promise<ScreenCatalogRow[]> => {
    const columns = includeSource
      ? "id, name, prompt, summary, status, block_index, code, updated_at, embedding"
      : "id, name, prompt, summary, status";
    const { data, error } = await admin
      .from("screens")
      .select(columns)
      .eq("project_id", projectId)
      .eq("owner_id", ownerId)
      .order("sort_index", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as ScreenCatalogRow[];
  };

  return async (call: FunctionCall): Promise<ProjectReadToolResult> => {
    const tool = call.name as ProjectAgentReadTool;
    const startedAt = Date.now();
    try {
      if (tool === "get_project_overview") {
        const args = overviewSchema.parse(call.args ?? {});
        const sections = new Set(args.sections?.length ? args.sections : ["charter", "navigation", "plans", "generation"]);
        const project = await assertProject();
        const output: Record<string, unknown> = { project: { id: project.id, name: project.name, prompt: compact(project.prompt, 600) } };
        const jobs: Promise<void>[] = [];
        if (sections.has("charter")) output.charter = project.project_charter;
        if (sections.has("tokens")) output.designTokens = project.design_tokens;
        if (sections.has("navigation")) jobs.push((async () => {
          const { data } = await admin.from("project_navigation").select("plan, status, error").eq("project_id", projectId).maybeSingle();
          output.navigation = data ?? null;
        })());
        if (sections.has("generation")) jobs.push((async () => {
          const { data } = await admin.from("generation_runs").select("id, status, requested_screen_count, error, created_at, completed_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(3);
          output.generations = data ?? [];
        })());
        if (sections.has("plans")) jobs.push((async () => {
          const { data } = await admin.from("project_messages").select("id, content, message_type, metadata, created_at").eq("project_id", projectId).eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(30);
          output.plans = (data ?? [])
            .filter((message) => JSON.stringify(message.metadata).includes("screen_plan"))
            .slice(0, 5)
            .map((message) => ({ id: message.id, content: compact(message.content, 800), messageType: message.message_type, createdAt: message.created_at }));
        })());
        if (sections.has("assets")) jobs.push((async () => {
          const [{ data: usages }, { data: userAssets }] = await Promise.all([
            admin.from("project_asset_usages").select("asset_id, screen_id, screen_name, requirement_id, placement_hint").eq("project_id", projectId).limit(50),
            admin.from("user_image_assets").select("id, screen_id, original_filename, target_drawgle_id, target_kind, width, height, created_at").eq("project_id", projectId).eq("owner_id", ownerId).limit(20),
          ]);
          const assetIds = Array.from(new Set((usages ?? []).map((usage) => usage.asset_id)));
          const { data: assets } = assetIds.length
            ? await admin.from("visual_assets").select("id, subject, semantic_category, role, asset_type, provider, source_url, attribution, tags, status").in("id", assetIds)
            : { data: [] };
          output.assets = { usages: (usages ?? []).slice(0, 20), catalog: (assets ?? []).slice(0, 20), userUploads: userAssets ?? [] };
        })());
        await Promise.all(jobs);
        return result(tool, startedAt, output, "database", 0, [project.id]);
      }

      if (tool === "search_project") {
        const args = searchSchema.parse(call.args ?? {});
        await assertProject();
        const domains = new Set<ProjectSearchDomain>(args.domains?.length ? args.domains : ["screens"]);
        const limit = args.limit ?? 5;
        const screens = domains.has("screens") ? await screenCatalog() : [];
        const lexicalScreens = screens
          .map((screen) => ({ domain: "screens", id: screen.id, label: screen.name, summary: compact(screen.summary ?? screen.prompt, 700), confidence: lexicalScore(args.query, [screen.name, screen.summary, screen.prompt]) }))
          .filter((entry) => entry.confidence >= 8)
          .sort((left, right) => right.confidence - left.confidence)
          .slice(0, limit);
        const results: Array<Record<string, unknown>> = [...lexicalScreens];
        let queryEmbeddingCount = 0;
        let stage: AgentToolTrace["retrievalStage"] = lexicalScreens.length ? "lexical" : "database";

        if (domains.has("assets")) {
          const { data: usages } = await admin.from("project_asset_usages").select("asset_id, screen_id, screen_name, placement_hint").eq("project_id", projectId).limit(100);
          const assetIds = Array.from(new Set((usages ?? []).map((usage) => usage.asset_id)));
          if (assetIds.length) {
            const { data: assets } = await admin.from("visual_assets").select("id, subject, semantic_category, role, asset_type, provider, tags").in("id", assetIds);
            results.push(...(assets ?? []).map((asset) => ({
              domain: "assets", id: asset.id, label: asset.subject, summary: `${asset.semantic_category}; ${asset.role}; ${asset.asset_type}; ${(asset.tags ?? []).join(", ")}`,
              confidence: lexicalScore(args.query, [asset.subject, asset.semantic_category, asset.role, asset.asset_type, ...(asset.tags ?? [])]),
            })).filter((entry) => entry.confidence >= 8));
          }
        }

        if (domains.has("plans")) {
          const { data: messages } = await admin.from("project_messages").select("id, content, metadata, created_at").eq("project_id", projectId).eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(100);
          results.push(...(messages ?? []).filter((message) => JSON.stringify(message.metadata).includes("screen_plan")).map((message) => ({
            domain: "plans", id: message.id, label: "Screen plan", summary: compact(message.content, 700), confidence: lexicalScore(args.query, [message.content, JSON.stringify(message.metadata)]), createdAt: message.created_at,
          })).filter((entry) => entry.confidence >= 8));
        }

        const needsSemantic = domains.has("conversations") || (
          domains.has("screens") && lexicalScreens.filter((entry) => entry.confidence >= 20).length < 2
        );
        if (needsSemantic) {
          const embedding = await generateEmbedding(args.query, "RETRIEVAL_QUERY");
          queryEmbeddingCount = 1;
          const semanticJobs: Promise<void>[] = [];
          if (domains.has("screens")) semanticJobs.push((async () => {
            const { data } = await admin.rpc("match_screens", { query_embedding: embedding, p_project_id: projectId, match_threshold: 0.5, match_count: limit });
            for (const match of data ?? []) results.push({ domain: "screens", id: match.screen_id, label: match.name, summary: compact(match.summary, 700), confidence: Math.round(match.similarity * 100) });
          })());
          if (domains.has("conversations")) semanticJobs.push((async () => {
            const { data } = await admin.rpc("match_project_messages", { query_embedding: embedding, p_project_id: projectId, match_threshold: 0.48, match_count: limit });
            const matches = data ?? [];
            const messageIds = matches.map((match) => match.message_id);
            const { data: matchedRows } = messageIds.length
              ? await admin.from("project_messages").select("id, metadata").eq("project_id", projectId).eq("owner_id", ownerId).in("id", messageIds)
              : { data: [] };
            const userIds = Array.from(new Set((matchedRows ?? []).map((row) => {
              const value = asRecord(row.metadata).userMessageId;
              return typeof value === "string" ? value : null;
            }).filter((value): value is string => Boolean(value))));
            const { data: userRows } = userIds.length
              ? await admin.from("project_messages").select("id, content").eq("project_id", projectId).eq("owner_id", ownerId).in("id", userIds)
              : { data: [] };
            const metadataById = new Map<string, Record<string, unknown>>((matchedRows ?? []).map((row) => [row.id, asRecord(row.metadata)]));
            const userById = new Map<string, string>((userRows ?? []).map((row) => [row.id, row.content]));
            for (const match of matches) {
              const userMessageId = metadataById.get(match.message_id)?.userMessageId;
              const userContent = typeof userMessageId === "string" ? userById.get(userMessageId) : null;
              results.push({
                domain: "conversations",
                id: match.message_id,
                label: match.message_type,
                summary: compact(userContent ? `User: ${userContent}\nAssistant: ${match.content}` : match.content, 900),
                screenId: match.screen_id,
                createdAt: match.created_at,
                confidence: Math.round(match.similarity * 100),
              });
            }
          })());
          await Promise.all(semanticJobs);
          stage = results.length ? "mixed" : "semantic";
        }

        const deduped = Array.from(new Map(results.map((entry) => [`${entry.domain}:${entry.id}`, entry])).values())
          .sort((left, right) => Number(right.confidence) - Number(left.confidence))
          .slice(0, limit);
        return result(tool, startedAt, { query: args.query, results: deduped }, stage, queryEmbeddingCount, deduped.map((entry) => String(entry.id)));
      }

      if (tool === "inspect_screen") {
        const args = inspectSchema.parse(call.args ?? {});
        await assertProject();
        const screens = await screenCatalog(true);
        const resolution = resolveScreenReference(args.screenRef, screens);
        if (resolution.status !== "resolved" || !resolution.screen?.code) {
          return result(tool, startedAt, {
            resolution: resolution.status,
            candidates: resolution.candidates.map((screen) => ({ id: screen.id, name: screen.name, summary: compact(screen.summary, 240) })),
          }, "lexical", 0, resolution.candidates.map((screen) => screen.id));
        }

        const screen = resolution.screen;
        const screenCode = screen.code;
        if (!screenCode) throw new Error("Screen source is unavailable.");
        const storedIndex = screen.block_index as ScreenBlockIndex | null;
        const blockIndex = isScreenBlockIndexUsable(screenCode, storedIndex) ? storedIndex! : indexScreenCode(screenCode);
        const currentSummary = buildScreenSummaryLocally(screen.name, screenCode, screen.prompt ?? "", blockIndex);
        if (screen.summary !== currentSummary || !Array.isArray(screen.embedding) || screen.embedding.length === 0 || storedIndex !== blockIndex) {
          await onStaleScreen?.(screen.id);
        }
        const view = args.view ?? "outline";
        const blocks = blockIndex.blocks.filter((block) => block.id !== blockIndex.rootId);
        const selectedIds = view === "region" && args.query
          ? detectTargetBlocks(args.query, blockIndex).targetBlockIds
          : [];
        const selectedBlocks = selectedIds.length ? blocks.filter((block) => selectedIds.includes(block.id)) : blocks;
        const outline = selectedBlocks.slice(0, view === "region" ? 5 : 24).map((block) => ({
          blockId: block.id,
          name: block.name,
          kind: block.kind,
          preview: compact(block.preview, 180),
          keywords: block.keywords.slice(0, 12),
          parentId: block.parentId,
        }));
        return result(tool, startedAt, {
          screen: { id: screen.id, name: screen.name, summary: currentSummary, status: screen.status },
          view,
          query: args.query ?? null,
          regions: outline,
          styleEvidence: compact(extractScreenStyleMemory({ name: screen.name, summary: currentSummary, code: screenCode }), 900),
          sourceAvailableToEditor: true,
        }, "lexical", 0, [screen.id, ...outline.map((block) => block.blockId)]);
      }

      throw new Error(`Unsupported project read tool: ${call.name ?? "unnamed"}`);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        trace: { tool, durationMs: Date.now() - startedAt, resultCount: 0, retrievalStage: "database", queryEmbeddingCount: 0, resultIds: [] },
      };
    }
  };
}
