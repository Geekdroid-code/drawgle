import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createManualScreenState, manualStateRequestSchema } from "@/lib/agent/manual-screen-state";
import { ScreenStateApprovalError } from "@/lib/agent/screen-state-approval";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await createManualScreenState(createAdminClient(), user.id, manualStateRequestSchema.parse(await request.json()));
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof ScreenStateApprovalError) return NextResponse.json({ error: error.message, activeGenerationRunId: error.activeGenerationRunId }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Describe the state you want (3–3000 characters)." }, { status: 400 });
    console.error("Manual state creation failed", error);
    return NextResponse.json({ error: "The state could not be queued. Your description is preserved; please retry." }, { status: 500 });
  }
}
