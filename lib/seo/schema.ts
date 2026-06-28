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

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.baseUrl}/#organization`,
    name: siteConfig.name,
    url: siteConfig.baseUrl,
    email: siteConfig.supportEmail,
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
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteConfig.baseUrl}/#web-application`,
    name: siteConfig.name,
    url: siteConfig.baseUrl,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser.",
    description: siteConfig.defaultDescription,
    offers: {
      "@type": "Offer",
      price: siteConfig.pricing[0].price,
      priceCurrency: siteConfig.pricing[0].currency,
      url: absoluteUrl("/pricing"),
      availability: "https://schema.org/InStock",
    },
    publisher: {
      "@id": `${siteConfig.baseUrl}/#organization`,
    },
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
      name: plan.name,
      description: plan.description,
      price: plan.price,
      priceCurrency: plan.currency,
      url: absoluteUrl(plan.url),
      availability: "https://schema.org/InStock",
      itemOffered: {
        "@type": "Service",
        name: `${siteConfig.name} ${plan.name}`,
      },
    })),
  };
}
