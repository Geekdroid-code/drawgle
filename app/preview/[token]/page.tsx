import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPreviewShell } from "@/components/PublicPreviewShell";
import { parseStoredNavigationPlan } from "@/lib/project-navigation";
import { noindexRobots } from "@/lib/seo/metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DesignTokens, ProjectData, ProjectNavigationData, ScreenChromePolicy, ScreenData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project Preview | Drawgle",
  robots: noindexRobots,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_PROJECT_SELECT_COLUMNS = [
  "id",
  "name",
  "status",
  "design_tokens",
  "created_at",
  "updated_at",
].join(", ");

const PUBLIC_SCREEN_SELECT_COLUMNS = [
  "id",
  "project_id",
  "name",
  "code",
  "chrome_policy",
  "navigation_item_id",
  "parent_screen_id",
  "state_key",
  "state_label",
  "state_role",
  "position_x",
  "position_y",
  "sort_index",
  "status",
  "created_at",
  "updated_at",
].join(", ");

const PUBLIC_NAVIGATION_SELECT_COLUMNS = [
  "id",
  "project_id",
  "plan",
  "shell_code",
  "status",
  "created_at",
  "updated_at",
].join(", ");

const mapPublicProject = (row: Record<string, any>): ProjectData => ({
  id: row.id,
  userId: "public",
  name: row.name,
  prompt: "",
  status: row.status,
  charter: null,
  designTokens: (row.design_tokens as DesignTokens | null) ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPublicScreen = (row: Record<string, any>): ScreenData => ({
  id: row.id,
  projectId: row.project_id,
  userId: "public",
  name: row.name,
  code: row.code,
  prompt: "",
  summary: null,
  generationRunId: null,
  blockIndex: null,
  chromePolicy: (row.chrome_policy as ScreenChromePolicy | null) ?? null,
  navigationItemId: row.navigation_item_id,
  parentScreenId: row.parent_screen_id,
  stateKey: row.state_key,
  stateLabel: row.state_label,
  stateRole: row.state_role,
  x: row.position_x,
  y: row.position_y,
  sortIndex: row.sort_index,
  status: row.status,
  error: null,
  triggerRunId: null,
  streamPublicToken: null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPublicNavigation = (row: Record<string, any> | null): ProjectNavigationData | null => (
  row
    ? {
        id: row.id,
        projectId: row.project_id,
        ownerId: "public",
        plan: parseStoredNavigationPlan(row.plan),
        shellCode: row.shell_code,
        blockIndex: null,
        status: row.status,
        error: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
    .select(PUBLIC_PROJECT_SELECT_COLUMNS)
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
      .select(PUBLIC_SCREEN_SELECT_COLUMNS)
      .eq("project_id", projectRow.id)
      .eq("status", "ready")
      .order("sort_index", { ascending: true }),
    admin
      .from("project_navigation")
      .select(PUBLIC_NAVIGATION_SELECT_COLUMNS)
      .eq("project_id", projectRow.id)
      .maybeSingle(),
  ]);

  if (screensError || navigationError) {
    notFound();
  }

  const project = mapPublicProject(projectRow);
  const screens = (screenRows ?? []).map(mapPublicScreen);
  const projectNavigation = mapPublicNavigation(projectNavigationRow);

  return (
    <PublicPreviewShell
      project={project}
      screens={screens}
      projectNavigation={projectNavigation}
    />
  );
}
