import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ClaimCreditsCard } from "@/components/credits/ClaimCreditsCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Redeem a code" };

export default async function ClaimPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=%2Fclaim");
  }

  return <ClaimCreditsCard userId={user.id} preview={null} />;
}
