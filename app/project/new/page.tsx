import { redirect } from "next/navigation";

import { ProjectLobby } from "@/components/ProjectLobby";
import { createClient } from "@/lib/supabase/server";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const initialPrompt = Array.isArray(params.prompt) ? params.prompt[0] : (params.prompt ?? "");

  return <ProjectLobby initialPrompt={initialPrompt} />;
}