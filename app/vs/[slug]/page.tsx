import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComparisonPage } from "@/components/compare/ComparisonPage";
import Footer from "@/components/landing/MainFooter";
import PublicHeader from "@/components/landing/Header";
import { JsonLd } from "@/components/seo/JsonLd";
import { getComparisonPage, publishedComparisonPages } from "@/lib/compare/pages";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  articleSchema,
  breadcrumbListSchema,
  faqPageSchema,
  itemListSchema,
  webPageSchema,
} from "@/lib/seo/schema";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return publishedComparisonPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparisonPage(slug);

  if (!page) {
    return {};
  }

  return buildMetadata({
    title: page.metadata.title,
    description: page.metadata.description,
    path: `/vs/${page.slug}`,
    image: {
      path: "/bg-image.webp",
      width: 1200,
      height: 630,
      alt: page.metadata.title,
    },
  });
}

export default async function CompetitorComparisonPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getComparisonPage(slug);

  if (!page) {
    notFound();
  }

  const path = `/vs/${page.slug}`;

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            path,
            name: page.metadata.title,
            description: page.metadata.description,
          }),
          articleSchema({
            path,
            headline: page.metadata.title,
            description: page.metadata.description,
            publishedDate: page.metadata.publishedDate,
            modifiedDate: page.metadata.modifiedDate,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Comparisons", path: "/vs" },
            { name: page.competitor.name, path },
          ]),
          faqPageSchema(page.faqs),
          itemListSchema({
            path,
            name: `${page.metadata.title} comparison criteria`,
            items: page.comparisonRows.map((row) => row.feature),
          }),
        ]}
      />
      <PublicHeader />
      <ComparisonPage page={page} />
      <Footer />
    </>
  );
}
