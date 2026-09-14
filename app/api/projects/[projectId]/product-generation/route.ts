import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumeProductGeneration } from "@/lib/product-planning/resume-generation";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { projectId } = await params;
    z.string().uuid().parse(projectId);
    const input = z.object({ approvalId: z.string().uuid(), requestId: z.string().uuid(), action: z.enum(["resume", "cancel"]) }).parse(await request.json());
    const admin = createAdminClient();
    if (input.action === "resume") return NextResponse.json(await resumeProductGeneration(admin, user.id, projectId, input.approvalId, input.requestId), { status: 202 });
    const { data, error } = await admin.rpc("cancel_product_generation", {
      input_approval_id: input.approvalId, input_project_id: projectId, input_owner_id: user.id,
    });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Active product generation not found." }, { status: 409 });
    return NextResponse.json({ message: "Stopped scheduling new batches. The current batch may finish and settle its credits." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update generation." }, { status: 409 });
  }
}
