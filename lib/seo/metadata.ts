import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/lib/seo/config";

type BuildMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: {
    path: string;
    width?: number;
    height?: number;
    alt?: string;
  };
  keywords?: readonly string[];
  robots?: Metadata["robots"];
};

const defaultRobots: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

export const noindexRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const title = input.title ?? siteConfig.defaultTitle;
  const description = input.description ?? siteConfig.defaultDescription;
  const path = input.path ?? "/";
  const image = input.image ?? siteConfig.defaultOgImage;

  return {
    title,
    description,
    keywords: [...(input.keywords ?? siteConfig.keywords)],
    metadataBase: new URL(siteConfig.baseUrl),
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      images: [
        {
          url: image.path,
          width: image.width ?? siteConfig.defaultOgImage.width,
          height: image.height ?? siteConfig.defaultOgImage.height,
          alt: image.alt ?? title,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.path],
      creator: siteConfig.creatorHandle,
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    manifest: "/site.webmanifest",
    robots: input.robots ?? defaultRobots,
  };
}
