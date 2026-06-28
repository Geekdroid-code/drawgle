import type { MetadataRoute } from "next";

import { publishedComparisonPages } from "@/lib/compare/pages";
import { absoluteUrl, siteConfig } from "@/lib/seo/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const coreRoutes = siteConfig.publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const comparisonRoutes = [
    {
      url: absoluteUrl("/vs"),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...publishedComparisonPages.map((page) => ({
      url: absoluteUrl(`/vs/${page.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  return [...coreRoutes, ...comparisonRoutes];
}