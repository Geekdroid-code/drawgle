import { NextResponse } from "next/server";
import { z } from "zod";
import { persistDesignChange } from "@/lib/design-history/persistence";
import { sanitizeScreenCodeForPersist } from "@/lib/generation/persist-safe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const input = z.object({ screenId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), requestId: z.string().uuid(),
  code: z.string().min(1), label: z.string().min(1).max(160) });
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await params;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(projectId).success || !parsed.success) return NextResponse.json({ error: "Invalid saved screen edit." }, { status: 400 });
  try {
    const result = await persistDesignChange(createAdminClient(), { projectId, ownerId: user.id,
      target: { context: "screen", screenId: parsed.data.screenId } }, {
      expectedRevision: parsed.data.expectedRevision, requestId: parsed.data.requestId,
      payload: { code: sanitizeScreenCodeForPersist(parsed.data.code).value }, label: parsed.data.label, origin: "legacy-editor",
    });
    if (result.status !== "success") return NextResponse.json({ error: "Screen changed. Your edit was not saved; refresh and retry.", status: result.status }, { status: 409 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not save the edit and its recovery record." }, { status: 503 });
  }
}
