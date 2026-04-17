import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const supportedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email", "email_change"]);

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/")) {
    return "/";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase email confirmation code exchange error", error);
      return NextResponse.redirect(new URL("/login?error=email_confirmation_failed", requestUrl.origin));
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (!tokenHash || !type || !supportedOtpTypes.has(type)) {
    return NextResponse.redirect(new URL("/login?error=missing_email_confirmation_token", requestUrl.origin));
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    console.error("Supabase email confirmation error", error);
    return NextResponse.redirect(new URL("/login?error=email_confirmation_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}