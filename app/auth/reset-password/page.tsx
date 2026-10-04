import type { Metadata } from "next";
import { redirect } from "next/navigation";

import ResetPasswordClient from "@/app/auth/reset-password/ResetPasswordClient";
import { noindexRobots } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: noindexRobots,
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The reset link signs the user in; without that session there is nothing to update.
  if (!user) {
    redirect("/login?error=password_reset_link_invalid");
  }

  return <ResetPasswordClient />;
}
