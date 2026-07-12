import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPreviewShell } from "@/components/PublicPreviewShell";
import { noindexRobots } from "@/lib/seo/metadata";
import type { ProjectNavigationRow, ScreenRow } from "@/lib/supabase/database.types";
import { mapProjectNavigationRow, mapProjectRow, mapScreenRow } from "@/lib/supabase/mappers";
import { PROJECT_NAVIGATION_SELECT_COLUMNS, SCREEN_SELECT_COLUMNS } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectData, ProjectNavigationData, ScreenData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project Preview | Drawgle",
  robots: noindexRobots,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sanitizeProject = (project: ProjectData): ProjectData => ({
  ...project,
  ownerId: undefined,
  userId: "public",
  prompt: "",
  charter: null,
  publicPreviewToken: null,
});

const sanitizeScreen = (screen: ScreenData): ScreenData => ({
  ...screen,
  ownerId: undefined,
  userId: "public",
  generationRunId: null,
  prompt: "",
  blockIndex: null,
  error: null,
  triggerRunId: null,
  streamPublicToken: null,
});

const sanitizeNavigation = (navigation: ProjectNavigationData | null): ProjectNavigationData | null => (
  navigation
    ? {
        ...navigation,
        ownerId: "public",
        blockIndex: null,
        error: null,
      }
    : null
);

export default async function PublicPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: projectRow, error: projectError } = await admin
    .from("projects")
    .select("*")
    .eq("public_preview_token", token)
    .eq("public_preview_enabled", true)
    .maybeSingle();

  if (projectError || !projectRow) {
    notFound();
  }

  const [
    { data: screenRows, error: screensError },
    { data: projectNavigationRow, error: navigationError },
  ] = await Promise.all([
    admin
      .from("screens")
      .select(SCREEN_SELECT_COLUMNS)
      .eq("project_id", projectRow.id)
      .eq("status", "ready")
      .order("sort_index", { ascending: true }),
    admin
      .from("project_navigation")
      .select(PROJECT_NAVIGATION_SELECT_COLUMNS)
      .eq("project_id", projectRow.id)
      .maybeSingle(),
  ]);

  if (screensError || navigationError) {
    notFound();
  }

  const project = sanitizeProject(mapProjectRow(projectRow));
  const screens = ((screenRows ?? []) as unknown as ScreenRow[])
    .map(mapScreenRow)
    .map(sanitizeScreen);
  const projectNavigation = sanitizeNavigation(
    projectNavigationRow
      ? mapProjectNavigationRow(projectNavigationRow as unknown as ProjectNavigationRow)
      : null,
  );

  return (
    <PublicPreviewShell
      project={project}
      screens={screens}
      projectNavigation={projectNavigation}
    />
  );
}
