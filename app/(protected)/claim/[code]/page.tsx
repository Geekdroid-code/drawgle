import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClaimCreditsCard } from "@/components/credits/ClaimCreditsCard";
import { previewCreditCode } from "@/lib/credit-code-preview";
import { normalizeCreditCode } from "@/lib/credit-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Claim credits" };

export default async function ClaimCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(`/claim/${rawCode}`)}`);
  }

  let decoded = rawCode;
  try {
    decoded = decodeURIComponent(rawCode);
  } catch {
    // A malformed escape is just an unknown code.
  }
  const code = normalizeCreditCode(decoded);
  const preview = code
    ? await previewCreditCode(createAdminClient(), user.id, code)
    : { code: decoded, credits: 0, status: "not_found" as const };

  return <ClaimCreditsCard userId={user.id} preview={preview} />;
}
