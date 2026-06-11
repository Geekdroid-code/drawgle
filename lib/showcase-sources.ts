import "server-only";

import { showcaseSourceData, type ShowcaseSource } from "@/lib/showcase-source-data";

export const showcaseSources: ShowcaseSource[] = showcaseSourceData;

export const getShowcaseSource = (slug: string) =>
  showcaseSources.find((source) => source.slug === slug) ?? null;
