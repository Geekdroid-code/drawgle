import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createProductPlanning } from "@/lib/product-planning/model";
import { storePlanningReference } from "@/lib/product-planning/references";

const schema = z.object({
  clientRequestId: z.string().uuid(),
  prompt: z.string().trim().max(10000).default(""),
  image: z.object({ data: z.string().min(1).max(25_000_000), mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]) }).nullish(),
  imageReferenceMode: z.enum(["style", "recreate"]).default("style"),
  stylePresetSlug: z.string().trim().max(120).nullish(),
}).refine((value) => value.prompt || value.image, "Provide a prompt or reference.");

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin.from("projects").select("id, owner_id").eq("id", input.clientRequestId).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json(existing.owner_id === user.id ? { projectId: existing.id } : { error: "Request already used." }, { status: existing.owner_id === user.id ? 200 : 409 });
    const imagePath = input.image ? await storePlanningReference(admin, user.id, input.image, input.imageReferenceMode) : null;
    const planning = createProductPlanning({ originalRequest: input.prompt, recreationRequest: input.image && input.imageReferenceMode === "recreate" ? input.prompt : undefined, imagePath, imageReferenceMode: input.imageReferenceMode, stylePresetSlug: input.stylePresetSlug ?? null });
    const { data: projectId, error } = await admin.rpc("create_planning_project", {
      input_project_id: input.clientRequestId, input_owner_id: user.id,
      input_name: input.prompt.split(/\s+/).slice(0, 7).join(" ").slice(0, 100) || "New project",
      input_prompt: input.prompt, input_product_planning: planning,
      input_message_metadata: { action: "product_initial_prompt", clientTurnId: `initial:${input.clientRequestId}`, image: input.image ?? null },
    });
    if (error) throw error;
    return NextResponse.json({ projectId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project." }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
