import { redirect } from "next/navigation";

import { ProjectShell } from "@/components/ProjectShell";
import type { ProjectNavigationRow, ScreenRow } from "@/lib/supabase/database.types";
import { mapAuthenticatedUser, mapGenerationRunRow, mapProjectNavigationRow, mapProjectRow, mapScreenRow } from "@/lib/supabase/mappers";
import { PROJECT_NAVIGATION_SELECT_COLUMNS, SCREEN_SELECT_COLUMNS } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const [
    { data: projectRow, error: projectError },
    { data: screenRows, error: screensError },
    { data: generationRunRows, error: generationRunsError },
    { data: projectNavigationRow, error: projectNavigationError },
  ] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("screens").select(SCREEN_SELECT_COLUMNS).eq("project_id", projectId).order("sort_index", { ascending: true }),
      supabase
        .from("generation_runs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("project_navigation")
        .select(PROJECT_NAVIGATION_SELECT_COLUMNS)
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

  if (projectError || !projectRow) {
    redirect("/project/new");
  }

  if (screensError) {
    console.error("Failed to fetch project screens", screensError);
  }

  if (generationRunsError) {
    console.error("Failed to fetch generation runs", generationRunsError);
  }

  if (projectNavigationError) {
    console.error("Failed to fetch project navigation", projectNavigationError);
  }

  return (
    <ProjectShell
      user={mapAuthenticatedUser(user)}
      initialProject={mapProjectRow(projectRow)}
      initialScreens={((screenRows ?? []) as unknown as ScreenRow[]).map(mapScreenRow)}
      initialGenerationRuns={(generationRunRows ?? []).map(mapGenerationRunRow)}
      initialProjectNavigation={projectNavigationRow ? mapProjectNavigationRow(projectNavigationRow as unknown as ProjectNavigationRow) : null}
    />
  );
}
