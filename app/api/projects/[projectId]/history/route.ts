import { NextResponse } from "next/server";
import { z } from "zod";
import { historyTargetSchema } from "@/lib/design-history/types";
import { listHistory, recoverDesign } from "@/lib/design-history/server";
import { recoveryEnabled } from "@/lib/design-history/persistence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const input = z.object({ target: historyTargetSchema, action: z.enum(["undo","redo","restore"]),
  expectedRevision: z.number().int().nonnegative(), requestId: z.string().uuid(), entryId: z.string().uuid().optional() })
  .refine(value => value.action !== "restore" || !!value.entryId);
async function identity(projectId: string) {
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  return error || !user || !z.string().uuid().safeParse(projectId).success ? null : user.id;
}
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!recoveryEnabled()) return NextResponse.json({ error: "Recovery is not enabled." }, { status: 503 });
  const { projectId } = await params;
  const ownerId = await identity(projectId);
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = historyTargetSchema.safeParse(url.searchParams.get("context") === "screen"
    ? { context: "screen", screenId: url.searchParams.get("screenId") }
    : { context: url.searchParams.get("context") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid history target." }, { status: 400 });
  try { return NextResponse.json(await listHistory(projectId,ownerId,parsed.data), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "History target is unavailable." }, { status: 404 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!recoveryEnabled()) return NextResponse.json({ error: "Recovery is not enabled." }, { status: 503 });
  const { projectId } = await params;
  const ownerId = await identity(projectId);
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recovery request." }, { status: 400 });
  try {
    const result = await recoverDesign(projectId,ownerId,parsed.data);
    return NextResponse.json(result, { status: result.status === "success" ? 200 : result.status === "unavailable_entry" ? 404 : 409 });
  } catch { return NextResponse.json({ error: "Recovery could not be saved. Refresh and retry." }, { status: 503 }); }
}
