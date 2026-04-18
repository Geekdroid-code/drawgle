import type { User } from "@supabase/supabase-js";

import type {
  GenerationRunRow,
  ProjectRow,
  ScreenMessageRow,
  ScreenRow,
} from "@/lib/supabase/database.types";
import type {
  AuthenticatedUser,
  DesignTokens,
  GenerationRunData,
  Message,
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
    id: row.id,
    ownerId: row.owner_id,
    userId: row.owner_id,
    name: row.name,
    prompt: row.prompt,
    status: row.status,
    charter: (row.project_charter as ProjectCharter | null) ?? null,
    designTokens: (row.design_tokens as DesignTokens | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScreenRow(row: ScreenRow): ScreenData {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    userId: row.owner_id,
    generationRunId: row.generation_run_id,
    name: row.name,
    code: row.code,
    prompt: row.prompt,
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
    error: row.error,
    metadata: typeof row.metadata === "object" && row.metadata ? (row.metadata as Record<string, unknown>) as GenerationRunData["metadata"] : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
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