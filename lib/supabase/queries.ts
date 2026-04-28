import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  MessageRole,
  ProjectMessageType,
  ProjectStatus,
  ProjectNavigationRow,
  ScreenRow,
  ScreenStatus,
} from "@/lib/supabase/database.types";
import {
  mapGenerationRunRow,
  mapProjectNavigationRow,
  mapProjectMessageRow,
  mapProjectRow,
  mapScreenMessageRow,
  mapScreenRow,
} from "@/lib/supabase/mappers";
import type { DesignTokens, GenerationRunData, Message, ProjectCharter, ProjectData, ProjectMessage, ProjectNavigationData, ScreenBlockIndex, ScreenData } from "@/lib/types";

type Client = SupabaseClient<Database>;

export const SCREEN_SELECT_COLUMNS = [
  "id",
  "project_id",
  "owner_id",
  "generation_run_id",
  "name",
  "prompt",
  "code",
  "summary",
  "block_index",
  "chrome_policy",
  "navigation_item_id",
  "status",
  "position_x",
  "position_y",
  "sort_index",
  "error",
  "trigger_run_id",
  "stream_public_token",
  "created_at",
  "updated_at",
].join(", ");

export const PROJECT_NAVIGATION_SELECT_COLUMNS = [
  "id",
  "project_id",
  "owner_id",
  "plan",
  "shell_code",
  "block_index",
  "status",
  "error",
  "created_at",
  "updated_at",
].join(", ");

export async function fetchProjects(client: Client): Promise<ProjectData[]> {
  const { data, error } = await client.from("projects").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProjectRow);
}

export async function fetchProject(client: Client, projectId: string): Promise<ProjectData | null> {
  const { data, error } = await client.from("projects").select("*").eq("id", projectId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProjectRow(data) : null;
}

export async function fetchScreens(client: Client, projectId: string): Promise<ScreenData[]> {
  const { data, error } = await client
    .from("screens")
    .select(SCREEN_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ScreenRow[]).map(mapScreenRow);
}

export async function fetchScreenMessages(client: Client, screenId: string): Promise<Message[]> {
  const { data, error } = await client
    .from("screen_messages")
    .select("*")
    .eq("screen_id", screenId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapScreenMessageRow);
}

export async function fetchGenerationRuns(client: Client, projectId: string, limit = 6): Promise<GenerationRunData[]> {
  const { data, error } = await client
    .from("generation_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapGenerationRunRow);
}

export async function createProject(
  client: Client,
  input: {
    ownerId: string;
    name: string;
    prompt?: string;
    status?: ProjectStatus;
    charter?: ProjectCharter | null;
  },
): Promise<ProjectData> {
  const { data, error } = await client
    .from("projects")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      prompt: input.prompt ?? "",
      status: input.status ?? "active",
      project_charter: (input.charter ?? null) as never,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data);
}

export async function updateProjectFields(
  client: Client,
  projectId: string,
  patch: {
    name?: string;
    prompt?: string;
    status?: ProjectStatus;
    charter?: ProjectCharter | null;
    designTokens?: DesignTokens | null;
  },
) {
  const update: Database["public"]["Tables"]["projects"]["Update"] = {};

  if (patch.name !== undefined) {
    update.name = patch.name;
  }
  if (patch.prompt !== undefined) {
    update.prompt = patch.prompt;
  }
  if (patch.status !== undefined) {
    update.status = patch.status;
  }
  if (patch.charter !== undefined) {
    update.project_charter = patch.charter as never;
  }
  if (patch.designTokens !== undefined) {
    update.design_tokens = patch.designTokens as never;
  }

  const { error } = await client.from("projects").update(update).eq("id", projectId);

  if (error) {
    throw error;
  }
}

export async function updateScreenPosition(client: Client, screenId: string, x: number, y: number) {
  const { error } = await client
    .from("screens")
    .update({
      position_x: Math.round(x),
      position_y: Math.round(y),
    })
    .eq("id", screenId);

  if (error) {
    throw error;
  }
}

export async function updateScreenCode(
  client: Client,
  screenId: string,
  code: string,
  status?: ScreenStatus,
  blockIndex?: ScreenBlockIndex | null,
) {
  const update: Database["public"]["Tables"]["screens"]["Update"] = {
    code,
  };

  if (status) {
    update.status = status;
  }

  if (blockIndex !== undefined) {
    update.block_index = blockIndex as never;
  }

  const { error } = await client.from("screens").update(update).eq("id", screenId);

  if (error) {
    throw error;
  }
}

export async function deleteScreen(client: Client, screenId: string) {
  const { error } = await client.from("screens").delete().eq("id", screenId);

  if (error) {
    throw error;
  }
}

export async function insertScreenMessage(
  client: Client,
  input: {
    ownerId: string;
    screenId: string;
    role: MessageRole;
    content: string;
  },
) {
  const { error } = await client.from("screen_messages").insert({
    owner_id: input.ownerId,
    screen_id: input.screenId,
    role: input.role,
    content: input.content,
  });

  if (error) {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Project Messages
// ---------------------------------------------------------------------------

export async function fetchProjectMessages(
  client: Client,
  projectId: string,
  limit = 50,
): Promise<ProjectMessage[]> {
  const { data, error } = await client
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProjectMessageRow).reverse();
}

export async function insertProjectMessage(
  client: Client,
  input: {
    projectId: string;
    ownerId: string;
    screenId?: string | null;
    role: MessageRole;
    content: string;
    messageType?: ProjectMessageType;
    metadata?: Record<string, unknown>;
  },
): Promise<ProjectMessage> {
  const { data, error } = await client
    .from("project_messages")
    .insert({
      project_id: input.projectId,
      owner_id: input.ownerId,
      screen_id: input.screenId ?? null,
      role: input.role,
      content: input.content,
      message_type: input.messageType ?? "chat",
      metadata: (input.metadata ?? {}) as never,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProjectMessageRow(data);
}

export async function updateProjectMessageMemoryEmbedding(
  client: Client,
  messageId: string,
  embedding: number[],
) {
  const { error } = await client
    .from("project_messages")
    .update({ embedding })
    .eq("id", messageId);

  if (error) {
    throw error;
  }
}

export async function fetchProjectNavigation(client: Client, projectId: string): Promise<ProjectNavigationData | null> {
  const { data, error } = await client
    .from("project_navigation")
    .select(PROJECT_NAVIGATION_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProjectNavigationRow(data as unknown as ProjectNavigationRow) : null;
}
