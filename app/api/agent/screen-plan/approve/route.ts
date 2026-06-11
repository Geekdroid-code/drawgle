import { NextResponse } from "next/server";
import { z } from "zod";

import { approveScreenPlanProposal, ScreenPlanApprovalError } from "@/lib/agent/screen-plan-approval";
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const result = await approveScreenPlanProposal({
      admin,
      ownerId: user.id,
      projectId: payload.projectId,
      proposalMessageId: payload.proposalMessageId,
    });

    return NextResponse.json(
      {
        intent: "create_new_screen",
        ...result,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ScreenPlanApprovalError) {
      return NextResponse.json(
        {
          error: error.message,
          activeGenerationRunId: error.activeGenerationRunId,
        },
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid approval request.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Screen plan approval route error", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
