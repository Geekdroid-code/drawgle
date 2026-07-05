import type { MetadataRoute } from "next";

import { publishedComparisonPages } from "@/lib/compare/pages";
import { absoluteUrl, siteConfig } from "@/lib/seo/config";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const coreRoutes = siteConfig.publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
  }));

  const comparisonRoutes = [
    {
      url: absoluteUrl("/vs"),
    },
    ...publishedComparisonPages.map((page) => ({
      url: absoluteUrl(`/vs/${page.slug}`),
      lastModified: page.metadata.modifiedDate,
    })),
  ];

  return [...coreRoutes, ...comparisonRoutes];
}
