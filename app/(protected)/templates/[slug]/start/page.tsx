import { notFound } from "next/navigation";

import { TemplateStarter } from "@/components/templates/TemplateStarter";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function StartTemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("published_templates")
    .select("slug, title")
    .eq("slug", slug)
    .eq("is_current", true)
    .eq("status", "published")
    .maybeSingle();

  if (!data) notFound();
  return <TemplateStarter slug={data.slug} title={data.title} />;
}
