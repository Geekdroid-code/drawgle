import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SectionHeader } from "@/components/marketing/Reveal";
import { ShowcaseGallery } from "@/components/showcase/ShowcaseGallery";
import { curatedShowcaseScreenCount, showcaseCollections } from "@/lib/showcase";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, webPageSchema } from "@/lib/seo/schema";

const showcaseRoute = siteConfig.publicRoutes[2];

export const metadata: Metadata = buildMetadata({
  title: showcaseRoute.title,
  description: showcaseRoute.description,
  path: showcaseRoute.path,
});

export default function ShowcasePage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          webPageSchema({
            path: showcaseRoute.path,
            name: showcaseRoute.title,
            description: showcaseRoute.description,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Showcase", path: showcaseRoute.path },
          ]),
        ]}
      />
      <main className="px-3 pb-24 pt-32 sm:px-6 sm:pb-32 sm:pt-40">
        <SectionHeader
          as="h1"
          kicker="Drawgle screen showcase"
          lead="Premium mobile screens,"
          emphasis="rendered live for you to explore."
          emphasisTone="accent"
          breakBeforeEmphasis
          description={`Browse ${curatedShowcaseScreenCount} interactive screens across ${showcaseCollections.length} original visual directions. Fork an exact editable project, or remix its visual style into your own brief.`}
          className="mx-auto max-w-4xl text-center"
        />

        <ShowcaseGallery />
      </main>
    </MarketingShell>
  );
}
