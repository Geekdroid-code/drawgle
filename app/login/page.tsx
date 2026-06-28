import type { Metadata } from "next";
import { noindexRobots } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";

import LoginPageClient from "@/app/login/LoginPageClient";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Drawgle workspace.",
  robots: noindexRobots,
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = getSafeAuthRedirect(requestedNext);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

  return <LoginPageClient />;
}
