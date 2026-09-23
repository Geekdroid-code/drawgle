import { NextResponse } from "next/server";
import { z } from "zod";
import { indexScreenCode } from "@/lib/generation/block-index";
import { historyResultSchema } from "@/lib/design-history/types";
import { recoveryEnabled } from "@/lib/design-history/persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const body = z.object({ screenId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), requestId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!recoveryEnabled()) return NextResponse.json({ error: "Recovery is not enabled." }, { status: 503 });
  const { projectId } = await params;
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(projectId).success || !parsed.success) return NextResponse.json({ error: "Invalid recovery request." }, { status: 400 });
  const admin = createAdminClient();
  const { data: screen, error: screenError } = await admin.from("screens").select("id,owner_id,project_id,last_accepted_code")
    .eq("id", parsed.data.screenId).eq("project_id",projectId).eq("owner_id",user.id).maybeSingle();
  if (screenError || !screen) return NextResponse.json({ error: "Last good design unavailable." }, { status: 404 });
  const { data, error: restoreError } = await admin.rpc("restore_last_good_screen", {
    input_project_id: projectId, input_owner_id: user.id, input_screen_id: parsed.data.screenId,
    input_expected_revision: parsed.data.expectedRevision, input_request_id: parsed.data.requestId,
    input_block_index: screen.last_accepted_code ? indexScreenCode(screen.last_accepted_code) as never : null,
  });
  if (restoreError) return NextResponse.json({ error: "Could not restore the saved design." }, { status: 503 });
  const result = historyResultSchema.parse(data);
  return NextResponse.json(result, { status: result.status === "success" ? 200 : result.status === "unavailable_entry" ? 404 : 409 });
}
