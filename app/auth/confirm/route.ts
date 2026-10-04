import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getSafeAuthRedirect, PASSWORD_RESET_PATH } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const supportedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email", "email_change"]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  // A recovery link always ends at the page that sets a new password, whatever `next` says.
  const next = type === "recovery"
    ? PASSWORD_RESET_PATH
    : getSafeAuthRedirect(requestUrl.searchParams.get("next"));
  const isRecovery = next === PASSWORD_RESET_PATH;

  const failTo = (error: string) => {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", isRecovery ? "password_reset_link_invalid" : error);
    if (!isRecovery) loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  };

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase email confirmation code exchange error", error);
      return failTo("email_confirmation_failed");
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (!tokenHash || !type || !supportedOtpTypes.has(type)) {
    return failTo("missing_email_confirmation_token");
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    console.error("Supabase email confirmation error", error);
    return failTo("email_confirmation_failed");
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
