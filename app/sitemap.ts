import type { MetadataRoute } from "next";

import { publishedComparisonPages } from "@/lib/compare/pages";
import { absoluteUrl, siteConfig } from "@/lib/seo/config";

const STATIC_LAST_MODIFIED = "2026-07-05";
const ALTERNATIVES_LAST_MODIFIED = "2026-07-17";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes: MetadataRoute.Sitemap = siteConfig.publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: STATIC_LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const editorialRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/alternatives"),
      lastModified: ALTERNATIVES_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/editorial-policy"),
      lastModified: ALTERNATIVES_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const comparisonRoutes: MetadataRoute.Sitemap = publishedComparisonPages.map((page) => ({
    url: absoluteUrl(`/alternatives/${page.slug}`),
    lastModified: page.metadata.modifiedDate,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...publicRoutes, ...editorialRoutes, ...comparisonRoutes];
}
