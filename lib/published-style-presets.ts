import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DesignStylePack, DesignTokens, ProjectDesignStyleSummary } from "@/lib/types";

export type PublishedStylePreset = {
  slug: string;
  version: number;
  title: string;
  description: string;
  stylePack: DesignStylePack;
  tokenSeed: Partial<DesignTokens>;
  summary: ProjectDesignStyleSummary;
};

export async function resolvePublishedStylePreset(slug?: string | null): Promise<PublishedStylePreset | null> {
  if (!slug) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("published_style_presets")
    .select("slug, version, title, description, style_pack, token_seed")
    .eq("slug", slug)
    .eq("is_current", true)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const stylePack = data.style_pack as DesignStylePack;
  return {
    slug: data.slug,
    version: data.version,
    title: data.title,
    description: data.description,
    stylePack,
    tokenSeed: (data.token_seed ?? stylePack.tokenSeed ?? {}) as Partial<DesignTokens>,
    summary: { id: data.slug, label: data.title, version: data.version },
  };
}
