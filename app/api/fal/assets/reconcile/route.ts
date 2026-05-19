import { NextRequest, NextResponse } from "next/server";

import { getVisualAssetsWebhookSecret } from "@/lib/env/server";
import { reconcilePendingFalAssetJobs } from "@/lib/generation/visual-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-drawgle-secret");
  if (!secret || secret !== getVisualAssetsWebhookSecret()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await reconcilePendingFalAssetJobs({ admin });

  return NextResponse.json({ ok: true, ...result });
}
