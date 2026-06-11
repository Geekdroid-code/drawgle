import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const payload = requestSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("template_instantiations")
      .select("project_id, published_templates!inner(slug, version)")
      .eq("owner_id", authData.user.id)
      .eq("idempotency_key", payload.idempotencyKey)
      .eq("published_templates.slug", slug)
      .maybeSingle();
    if (existing?.project_id) {
      const template = Array.isArray(existing.published_templates)
        ? existing.published_templates[0]
        : existing.published_templates;
      return NextResponse.json({
        projectId: existing.project_id,
        templateSlug: template?.slug ?? slug,
        templateVersion: template?.version ?? null,
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateLimitError } = await admin
      .from("template_instantiations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", authData.user.id)
      .gte("created_at", oneHourAgo);
    if (rateLimitError) throw rateLimitError;
    if ((count ?? 0) >= 20) {
      return NextResponse.json({ error: "Template start limit reached. Try again shortly." }, { status: 429 });
    }

    const { data, error } = await supabase.rpc("instantiate_published_template", {
      p_slug: slug,
      p_idempotency_key: payload.idempotencyKey,
    });

    if (error) throw error;
    const result = data?.[0];
    if (!result?.project_id) throw new Error("Template instantiation did not return a project.");

    return NextResponse.json({
      projectId: result.project_id,
      templateSlug: result.template_slug,
      templateVersion: result.template_version,
    });
  } catch (error) {
    console.error("Template instantiation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start from this design." },
      { status: 400 },
    );
  }
}
