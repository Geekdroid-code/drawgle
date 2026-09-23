import { NextResponse } from "next/server";
import { z } from "zod";
import { historyTargetSchema } from "@/lib/design-history/types";
import { previewHistory } from "@/lib/design-history/server";
import { recoveryEnabled } from "@/lib/design-history/persistence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; entryId: string }> }) {
  if (!recoveryEnabled()) return NextResponse.json({ error: "Recovery is not enabled." }, { status: 503 });
  const { projectId, entryId } = await params;
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const target = historyTargetSchema.safeParse(url.searchParams.get("context") === "screen"
    ? { context: "screen", screenId: url.searchParams.get("screenId") }
    : { context: url.searchParams.get("context") });
  if (!target.success || !z.string().uuid().safeParse(projectId).success || !z.string().uuid().safeParse(entryId).success) {
    return NextResponse.json({ error: "Invalid history entry." }, { status: 400 });
  }
  try {
    const preview = await previewHistory(projectId,user.id,target.data,entryId);
    return preview ? NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "History entry unavailable." }, { status: 404 });
  } catch { return NextResponse.json({ error: "History entry unavailable." }, { status: 404 }); }
}
