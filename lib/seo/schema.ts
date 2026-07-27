import { absoluteUrl, siteConfig } from "@/lib/seo/config";

export type JsonLd = Record<string, unknown>;

type BreadcrumbItem = {
  name: string;
  path: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type WebPageInput = {
  path: string;
  name: string;
  description: string;
};

type ArticleInput = {
  path: string;
  headline: string;
  description: string;
  publishedDate: string;
  modifiedDate: string;
};

type ItemListInput = {
  name: string;
  path: string;
  items: readonly string[];
};

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.baseUrl}/#organization`,
    name: siteConfig.name,
    url: siteConfig.baseUrl,
    email: siteConfig.supportEmail,
    logo: absoluteUrl("/android-chrome-512x512.png"),
    sameAs: siteConfig.sameAs,
  };
}

export function websiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.baseUrl}/#website`,
    name: siteConfig.name,
    url: siteConfig.baseUrl,
    publisher: {
      "@id": `${siteConfig.baseUrl}/#organization`,
    },
  };
}

export function webApplicationSchema(): JsonLd {
  const organizationId = `${siteConfig.baseUrl}/#organization`;

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteConfig.baseUrl}/#web-application`,
    name: siteConfig.name,
    url: siteConfig.baseUrl,
    image: absoluteUrl("/og-image.webp"),
    applicationCategory: "DesignApplication",
    applicationSubCategory: "AI mobile app UI designer",
    operatingSystem: "Cloud/Web",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    description: siteConfig.defaultDescription,
    featureList: [
      "Prompt-to-screen mobile UI generation",
      "Screenshot-to-editable-UI reconstruction",
      "Visual style reference generation",
      "Shared design tokens across screens",
      "Shared navigation and multi-screen project context",
      "Targeted element and region editing",
      "Standalone Tailwind HTML export",
      "Agent Pack export with design tokens, assets, screens, and implementation context",
    ],
    offers: {
      "@type": "Offer",
      name: `${siteConfig.name} ${siteConfig.pricing[0].name} monthly subscription`,
      price: siteConfig.pricing[0].price,
      priceCurrency: siteConfig.pricing[0].currency,
      url: absoluteUrl("/pricing"),
      itemOffered: {
        "@id": `${siteConfig.baseUrl}/#web-application`,
      },
    },
    author: {
      "@id": organizationId,
    },
    publisher: {
      "@id": organizationId,
    },
    about: [
      {
        "@type": "DefinedTerm",
        name: "User interface",
        sameAs: "https://www.wikidata.org/wiki/Q47146",
      },
      {
        "@type": "DefinedTerm",
        name: "User interface design",
        sameAs: "https://www.wikidata.org/wiki/Q135707",
      },
      {
        "@type": "DefinedTerm",
        name: "Artificial intelligence",
        sameAs: "https://www.wikidata.org/wiki/Q11660",
      },
      {
        "@type": "DefinedTerm",
        name: "Product design",
        sameAs: "https://www.wikidata.org/wiki/Q1043226",
      },
    ],
  };
}

export function webPageSchema({ path, name, description }: WebPageInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: {
      "@id": `${siteConfig.baseUrl}/#website`,
    },
    about: {
      "@id": `${siteConfig.baseUrl}/#web-application`,
    },
  };
}

export function faqPageSchema(items: readonly FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbListSchema(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function offerCatalogSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Drawgle pricing plans",
    url: absoluteUrl("/pricing"),
    itemListElement: siteConfig.pricing.map((plan) => ({
      "@type": "Offer",
      name: `${siteConfig.name} ${plan.name} monthly subscription`,
      description: plan.description,
      price: plan.price,
      priceCurrency: plan.currency,
      url: absoluteUrl(plan.url),
      itemOffered: {
        "@type": "Service",
        name: `${siteConfig.name} ${plan.name}`,
      },
    })),
  };
}

export function articleSchema({
  path,
  headline,
  description,
  publishedDate,
  modifiedDate,
}: ArticleInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${absoluteUrl(path)}#article`,
    headline,
    description,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    mainEntityOfPage: {
      "@id": `${absoluteUrl(path)}#webpage`,
    },
    author: {
      "@id": `${siteConfig.baseUrl}/#organization`,
    },
    publisher: {
      "@id": `${siteConfig.baseUrl}/#organization`,
    },
  };
}

export function itemListSchema({ name, path, items }: ItemListInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(path)}#comparison-criteria`,
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item,
    })),
  };
}
