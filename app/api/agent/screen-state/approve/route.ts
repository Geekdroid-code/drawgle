import { NextResponse } from "next/server";
import { z } from "zod";

import { approveScreenStateProposal, ScreenStateApprovalError } from "@/lib/agent/screen-state-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  proposalMessageId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = requestSchema.parse(await request.json());
    const result = await approveScreenStateProposal({
      admin,
      ownerId: user.id,
      projectId: payload.projectId,
      proposalMessageId: payload.proposalMessageId,
    });
    return NextResponse.json({ intent: "create_screen_state", ...result }, { status: 202 });
  } catch (error) {
    if (error instanceof ScreenStateApprovalError) {
      return NextResponse.json({
        error: error.message,
        activeGenerationRunId: error.activeGenerationRunId,
      }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid state approval request.", details: error.flatten() }, { status: 400 });
    }
    console.error("Screen state approval route error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
