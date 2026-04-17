import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";
import { mapAuthenticatedUser, mapProjectRow } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (projectError) {
    console.error("Failed to fetch dashboard projects", projectError);
  }

  return <DashboardShell user={mapAuthenticatedUser(user)} initialProjects={(projectRows ?? []).map(mapProjectRow)} />;
}
