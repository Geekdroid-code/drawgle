import { publishedComparisonPages } from "@/lib/compare/pages";
import { absoluteUrl } from "@/lib/seo/config";

export const revalidate = 86400;

type SitemapEntry = {
  url: string;
  lastModified: string;
  priority: number;
};

function formatSitemapDate(value: Date | string): string {
  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00Z`)
        : new Date(value);

  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSitemapEntries(): SitemapEntry[] {
  const generatedAt = formatSitemapDate(new Date());

  const coreRoutes: SitemapEntry[] = [
    { url: absoluteUrl("/"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/showcase"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/pricing"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/vs"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/terms"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/privacy-policy"), lastModified: generatedAt, priority: 1.0 },
    { url: absoluteUrl("/refunds-policy"), lastModified: generatedAt, priority: 1.0 },
  ];

  const comparisonRoutes: SitemapEntry[] = publishedComparisonPages.map((page) => ({
    url: absoluteUrl(`/vs/${page.slug}`),
    lastModified: formatSitemapDate(page.metadata.modifiedDate),
    priority: 0.8,
  }));

  return [
    coreRoutes[0],
    coreRoutes[1],
    coreRoutes[2],
    coreRoutes[3],
    ...comparisonRoutes,
    coreRoutes[4],
    coreRoutes[5],
    coreRoutes[6],
  ];
}

function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function GET(): Promise<Response> {
  const body = renderSitemapXml(buildSitemapEntries());

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
