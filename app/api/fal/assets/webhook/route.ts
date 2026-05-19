import { NextRequest, NextResponse } from "next/server";

import { getVisualAssetsWebhookSecret } from "@/lib/env/server";
import { completeFalAssetWebhook } from "@/lib/generation/visual-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== getVisualAssetsWebhookSecret()) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const requestId = payload && typeof payload.request_id === "string" ? payload.request_id : null;
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "Missing request_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await completeFalAssetWebhook({
    admin,
    requestId,
    payload,
  });

  return NextResponse.json(result);
}
