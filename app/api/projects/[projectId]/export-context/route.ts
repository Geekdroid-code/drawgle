import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareExportSnapshot, type ExportDatabaseSnapshot } from "@/lib/export/snapshot";

export const runtime = "nodejs";
const input = z.object({ screenIds: z.array(z.string().uuid()).min(1).max(500).refine(ids => new Set(ids).size === ids.length) });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await params;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(projectId).success || !parsed.success) return NextResponse.json({ error: "Select valid screen IDs." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("read_export_context", {
    input_project_id: projectId, input_owner_id: user.id, input_screen_ids: parsed.data.screenIds,
  });
  if (error) return NextResponse.json({ error: "Could not prepare export. Retry without closing this dialog." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  try {
    const context = prepareExportSnapshot(data as unknown as ExportDatabaseSnapshot, parsed.data.screenIds, process.env.DRAWGLE_PRODUCT_HANDOFF_ENABLED === "true");
    return NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Selected screens or their saved context are unavailable. Refresh and reselect ready screens, then retry." }, { status: 409 });
  }
}
