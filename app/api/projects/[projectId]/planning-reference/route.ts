import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadProductPlanning } from "@/lib/product-planning/store";
import { loadPlanningReference } from "@/lib/product-planning/references";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const parsed = z.string().uuid().safeParse((await params).projectId);
  if (!parsed.success) return new Response("Invalid project", { status: 400 });
  try {
    const admin = createAdminClient();
    const state = await loadProductPlanning(admin, parsed.data, user.id);
    const image = await loadPlanningReference(admin, state?.experience?.referencePath ?? null, user.id);
    if (!image) return new Response("Reference unavailable", { status: 404 });
    return new Response(Buffer.from(image.data, "base64"), { headers: { "Content-Type": image.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Reference unavailable", { status: 404 });
  }
}
