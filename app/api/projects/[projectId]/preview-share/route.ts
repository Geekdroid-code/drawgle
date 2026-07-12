import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicAppUrl } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  enabled: z.boolean(),
});
const projectIdSchema = z.string().uuid();

const buildPreviewResponse = (token: string | null, enabled: boolean) => {
  const path = token ? `/preview/${token}` : null;
  const url = path ? new URL(path, getPublicAppUrl()).toString() : null;
  return {
    enabled,
    path,
    url,
  };
};

const isSameOriginMutation = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

const loadOwnedProject = async (projectId: string, userId: string) => {
  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, owner_id, public_preview_token, public_preview_enabled")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!project || project.owner_id !== userId) {
    return { admin, project: null };
  }

  return { admin, project };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawProjectId } = await params;
  const parsedProjectId = projectIdSchema.safeParse(rawProjectId);
  if (!parsedProjectId.success) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const projectId = parsedProjectId.data;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { project } = await loadOwnedProject(projectId, user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(
    buildPreviewResponse(project.public_preview_token, project.public_preview_enabled),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const { projectId: rawProjectId } = await params;
  const parsedProjectId = projectIdSchema.safeParse(rawProjectId);
  if (!parsedProjectId.success) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const projectId = parsedProjectId.data;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedPayload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid sharing request" }, { status: 400 });
  }
  const payload = parsedPayload.data;
  const { admin, project } = await loadOwnedProject(projectId, user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const nextToken = project.public_preview_token ?? crypto.randomUUID();
  const update = payload.enabled
    ? project.public_preview_token
      ? {
          public_preview_enabled: true,
        }
      : {
          public_preview_token: nextToken,
          public_preview_enabled: true,
          public_preview_created_at: new Date().toISOString(),
        }
    : {
        public_preview_enabled: false,
      };

  const { data: updatedProject, error: updateError } = await admin
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .select("public_preview_token, public_preview_enabled")
    .single();

  if (updateError) {
    throw updateError;
  }

  return NextResponse.json(
    buildPreviewResponse(updatedProject.public_preview_token, updatedProject.public_preview_enabled),
  );
}
