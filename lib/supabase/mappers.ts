import { parseStoredNavigationPlan } from "@/lib/project-navigation";
import { readProductPlanning } from "@/lib/product-planning/model";
import type { User } from "@supabase/supabase-js";
import type { FieldColumns } from "@/lib/supabase/realtime-patch";

import type {
  GenerationRunRow,
  ProjectNavigationRow,
  ProjectMessageRow,
  ProjectRow,
  ScreenMessageRow,
  ScreenRow,
} from "@/lib/supabase/database.types";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  Message,
  NavigationArchitecture,
  NavigationPlan,
  ProjectMessage,
  ProjectNavigationData,
  ScreenBlockIndex,
  ScreenChromePolicy,
  ProjectCharter,
  ProjectData,
  ScreenData,
} from "@/lib/types";

export function mapAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };
}

export function mapProjectRow(row: ProjectRow): ProjectData {
  return {
    tokenRevision: row.token_revision,
    id: row.id,
    ownerId: row.owner_id,
    userId: row.owner_id,
    name: row.name,
    prompt: row.prompt,
    status: row.status,
    charter: (row.project_charter as ProjectCharter | null) ?? null,
    productPlanning: readProductPlanning(row.product_planning),
    designTokens: (row.design_tokens as DesignTokens | null) ?? null,
    publicPreviewToken: row.public_preview_token,
    publicPreviewEnabled: row.public_preview_enabled,
    publicPreviewCreatedAt: row.public_preview_created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScreenRow(row: ScreenRow): ScreenData {
  return {
    designRevision: row.design_revision,
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    userId: row.owner_id,
    generationRunId: row.generation_run_id,
    name: row.name,
    code: row.code,
    sourceLoaded: true,
    prompt: row.prompt,
    summary: row.summary,
    blockIndex: (row.block_index as ScreenBlockIndex | null) ?? null,
    chromePolicy: (row.chrome_policy as ScreenChromePolicy | null) ?? null,
    navigationItemId: row.navigation_item_id,
    parentScreenId: row.parent_screen_id,
    stateKey: row.state_key,
    stateLabel: row.state_label,
    stateRole: row.state_role,
    roadmapItemId: row.roadmap_item_id,
    x: row.position_x,
    y: row.position_y,
    sortIndex: row.sort_index,
    status: row.status,
    error: row.error,
    triggerRunId: row.trigger_run_id,
    streamPublicToken: row.stream_public_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGenerationRunRow(row: GenerationRunRow): GenerationRunData {
  const metadata = typeof row.metadata === "object" && row.metadata && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : undefined;

  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    prompt: row.prompt,
    imagePath: row.image_path,
    requestedScreenCount: row.requested_screen_count,
    status: row.status,
    triggerRunId: row.trigger_run_id,
    requiresBottomNav: row.requires_bottom_nav,
    navigationArchitecture: (metadata?.navigationArchitecture as NavigationArchitecture | null) ?? null,
    error: row.error,
    metadata: metadata as GenerationRunData["metadata"] | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    clientRequestId: row.client_request_id,
  };
}

export function mapScreenCatalogRow(
  row: Omit<ScreenRow, "code" | "block_index"> & Partial<Pick<ScreenRow, "code" | "block_index">>,
): ScreenData {
  return {
    ...mapScreenRow({ ...row, code: row.code ?? "", block_index: row.block_index ?? null }),
    sourceLoaded: typeof row.code === "string",
  };
}

export function mapScreenMessageRow(row: ScreenMessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.created_at,
  };
}

export function mapProjectMessageRow(row: ProjectMessageRow): ProjectMessage {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    screenId: row.screen_id,
    role: row.role,
    content: row.content,
    messageType: row.message_type,
    metadata: typeof row.metadata === "object" && row.metadata && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {},
    timestamp: row.created_at,
  };
}

export function mapProjectNavigationRow(row: ProjectNavigationRow): ProjectNavigationData {
  return {
    designRevision: row.design_revision,
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    plan: parseStoredNavigationPlan(row.plan),
    shellCode: row.shell_code,
    blockIndex: (row.block_index as ScreenBlockIndex | null) ?? null,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Source column of every mapped field, for merging partial realtime records.
export const PROJECT_COLUMNS: FieldColumns<ProjectData, ProjectRow> = {
  tokenRevision: "token_revision", productPlanning: "product_planning", id: "id", ownerId: "owner_id",
  userId: "owner_id", name: "name", prompt: "prompt", status: "status", charter: "project_charter",
  designTokens: "design_tokens", publicPreviewToken: "public_preview_token",
  publicPreviewEnabled: "public_preview_enabled", publicPreviewCreatedAt: "public_preview_created_at",
  createdAt: "created_at", updatedAt: "updated_at",
};

export const SCREEN_COLUMNS: FieldColumns<ScreenData, ScreenRow> = {
  designRevision: "design_revision", id: "id", projectId: "project_id", ownerId: "owner_id", userId: "owner_id",
  generationRunId: "generation_run_id", name: "name", code: "code", sourceLoaded: "code", prompt: "prompt",
  summary: "summary", blockIndex: "block_index", chromePolicy: "chrome_policy", navigationItemId: "navigation_item_id",
  parentScreenId: "parent_screen_id", stateKey: "state_key", stateLabel: "state_label", stateRole: "state_role",
  roadmapItemId: "roadmap_item_id", x: "position_x", y: "position_y", sortIndex: "sort_index", status: "status",
  error: "error", triggerRunId: "trigger_run_id", streamPublicToken: "stream_public_token",
  createdAt: "created_at", updatedAt: "updated_at",
};

export const PROJECT_NAVIGATION_COLUMNS: FieldColumns<ProjectNavigationData, ProjectNavigationRow> = {
  designRevision: "design_revision", id: "id", projectId: "project_id", ownerId: "owner_id", plan: "plan",
  shellCode: "shell_code", blockIndex: "block_index", status: "status", error: "error",
  createdAt: "created_at", updatedAt: "updated_at",
};

export const PROJECT_MESSAGE_COLUMNS: FieldColumns<ProjectMessage, ProjectMessageRow> = {
  id: "id", projectId: "project_id", ownerId: "owner_id", screenId: "screen_id", role: "role", content: "content",
  messageType: "message_type", metadata: "metadata", timestamp: "created_at",
};

export const SCREEN_MESSAGE_COLUMNS: FieldColumns<Message, ScreenMessageRow> = {
  id: "id", role: "role", content: "content", timestamp: "created_at",
};
