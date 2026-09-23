import { NextResponse } from "next/server";
import { z } from "zod";
import { hasApprovedDesignTokens, normalizeDesignTokens } from "@/lib/design-tokens";
import { persistDesignChange } from "@/lib/design-history/persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DesignTokens } from "@/lib/types";

export const runtime = "nodejs";
const bodySchema = z.object({ expectedRevision: z.number().int().nonnegative(), requestId: z.string().uuid(), tokens: z.unknown() });
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(projectId).success || !parsed.success || !hasApprovedDesignTokens(parsed.data.tokens as DesignTokens)) {
    return NextResponse.json({ error: "A valid saved token document, revision and request ID are required." }, { status: 400 });
  }
  try {
    const result = await persistDesignChange(createAdminClient(), { projectId, ownerId: user.id,
      target: { context: "tokens" } }, { expectedRevision: parsed.data.expectedRevision,
      requestId: parsed.data.requestId, payload: { tokens: normalizeDesignTokens(parsed.data.tokens as DesignTokens) },
      label: "Saved design tokens", origin: "design-panel" });
    if (result.status !== "success") return NextResponse.json({ error: "Design tokens changed. Refresh before saving your draft.", status: result.status }, { status: 409 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not save design tokens and recovery history. Your draft is retained." }, { status: 503 });
  }
}
