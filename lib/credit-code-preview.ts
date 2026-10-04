import "server-only";

import type { CreditCodePreview } from "@/lib/credit-codes";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Mirrors the order of redeem_credit_code's checks; the function stays the authority
 * when the code is claimed.
 */
export async function previewCreditCode(admin: AdminClient, userId: string, code: string): Promise<CreditCodePreview> {
  const { data: row, error } = await admin
    .from("credit_codes")
    .select("campaign, credits, max_redemptions, redemption_count, expires_at, disabled_at")
    .eq("code", code)
    .maybeSingle();

  if (error) console.error("Credit code preview failed", { code, error });
  if (error || !row || row.disabled_at) return { code, credits: 0, status: "not_found" };

  const credits = Number(row.credits) || 0;
  const { count } = await admin
    .from("credit_code_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("campaign", row.campaign)
    .eq("user_id", userId);

  if (count) return { code, credits, status: "already_redeemed" };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return { code, credits, status: "expired" };
  if (row.redemption_count >= row.max_redemptions) return { code, credits, status: "exhausted" };
  return { code, credits, status: "open" };
}
