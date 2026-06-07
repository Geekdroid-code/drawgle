import { redirect } from "next/navigation";

import { ProjectLobby } from "@/components/ProjectLobby";
import { mapAuthenticatedUser, mapProjectRow } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";
import { resolvePublishedStylePreset } from "@/lib/published-style-presets";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[]; style?: string | string[] }>;
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

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (projectError) {
    console.error("Failed to fetch workspace projects", projectError);
  }

  const initialPrompt = Array.isArray(params.prompt) ? params.prompt[0] : (params.prompt ?? "");
  const styleSlug = Array.isArray(params.style) ? params.style[0] : params.style;
  const stylePreset = await resolvePublishedStylePreset(styleSlug);

  return (
    <ProjectLobby
      initialPrompt={initialPrompt}
      initialStylePreset={stylePreset ? {
        slug: stylePreset.slug,
        version: stylePreset.version,
        title: stylePreset.title,
        description: stylePreset.description,
      } : null}
      user={mapAuthenticatedUser(user)}
      initialProjects={(projectRows ?? []).map(mapProjectRow)}
    />
  );
}
