import { NextResponse } from "next/server";
import { z } from "zod";

import {
  creditCodeHttpStatus,
  describeCreditCodeResult,
  normalizeCreditCode,
  readCreditCodeResult,
} from "@/lib/credit-codes";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({ code: z.string().max(100) });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to claim credits." }, { status: 401 });
  }

  const admin = createAdminClient();
  // Counted before the lookup, so a wrong guess costs an attempt like a right one.
  const limited = await enforceRateLimit(admin, user.id, RATE_LIMITS.redeem);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  const code = parsed.success ? normalizeCreditCode(parsed.data.code) : null;
  if (!code) {
    const result = { status: "not_found" as const };
    return NextResponse.json(
      { ...result, message: describeCreditCodeResult(result) },
      { status: creditCodeHttpStatus.not_found },
    );
  }

  const { data, error } = await admin.rpc("redeem_credit_code", {
    input_user_id: user.id,
    input_code: code,
  });
  const result = error ? null : readCreditCodeResult(data);

  if (!result) {
    console.error("Credit code redemption failed", { code, error, data });
    return NextResponse.json(
      { error: "We couldn't claim this code right now. Try again in a minute." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ...result, message: describeCreditCodeResult(result) },
    { status: creditCodeHttpStatus[result.status] },
  );
}
