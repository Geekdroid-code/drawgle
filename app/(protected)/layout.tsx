import { AppThemeProvider } from "@/contexts/app-theme-context";
import { ProtectedDashboardShell } from "@/components/dashboard/protected-dashboard-shell";
import { mapAuthenticatedUser, mapProjectRow } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
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
    .order("updated_at", { ascending: false })
    .limit(20);

  if (projectError) {
    console.error("Failed to fetch dashboard projects", projectError);
  }

  return (
    <AppThemeProvider>
      <ProtectedDashboardShell
        user={mapAuthenticatedUser(user)}
        initialProjects={(projectRows ?? []).map(mapProjectRow)}
      >
        {children}
      </ProtectedDashboardShell>
    </AppThemeProvider>
  );
}
