import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api",
          "/auth",
          "/dev",
          "/login",
          "/project",
          "/account",
          "/billing",
          "/admin",
          "/templates/*/start",
          "/screens",
        ],
      },
    ],
    sitemap: `${siteConfig.baseUrl}/sitemap.xml`,
    host: siteConfig.baseUrl,
  };
}
