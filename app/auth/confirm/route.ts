import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const supportedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email", "email_change"]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = getSafeAuthRedirect(requestUrl.searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase email confirmation code exchange error", error);
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", "email_confirmation_failed");
      loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (!tokenHash || !type || !supportedOtpTypes.has(type)) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "missing_email_confirmation_token");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    console.error("Supabase email confirmation error", error);
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "email_confirmation_failed");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
