import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { enrichScreenMemoryTask } from "@/trigger/enrich-screen-memory";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ screenId: string }> }) {
  const { screenId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: screen, error } = await admin
    .from("screens")
    .select("id")
    .eq("id", screenId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !screen) return NextResponse.json({ error: "Screen not found" }, { status: 404 });

  await tasks.trigger<typeof enrichScreenMemoryTask>(
    "enrich-screen-memory",
    { screenId },
    { concurrencyKey: `screen-memory-${screenId}` },
  );
  return NextResponse.json({ queued: true }, { status: 202 });
}
