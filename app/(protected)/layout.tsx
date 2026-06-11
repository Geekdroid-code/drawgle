import { AppThemeProvider } from "@/contexts/app-theme-context";
import { ProtectedDashboardShell } from "@/components/dashboard/protected-dashboard-shell";
import { mapAuthenticatedUser, mapProjectRow } from "@/lib/supabase/mappers";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const requestedPath = getSafeAuthRedirect(requestHeaders.get("x-drawgle-request-path"));
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(requestedPath)}`);
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
