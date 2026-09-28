import type { Metadata } from "next";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Challenge } from "@/components/marketing/home/Challenge";
import { CtaBanner } from "@/components/marketing/home/CtaBanner";
import { Faq } from "@/components/marketing/home/Faq";
import { Features } from "@/components/marketing/home/Features";
import { Hero } from "@/components/marketing/home/Hero";
import { HowItWorks } from "@/components/marketing/home/HowItWorks";
import { Pricing } from "@/components/marketing/home/Pricing";
import { Reviews } from "@/components/marketing/home/Reviews";
import { Showcase } from "@/components/marketing/home/Showcase";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeFaqs } from "@/lib/marketing/home-content";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, faqPageSchema, webApplicationSchema, webPageSchema } from "@/lib/seo/schema";

export const metadata: Metadata = buildMetadata({
  title: siteConfig.publicRoutes[0].title,
  description: siteConfig.publicRoutes[0].description,
  path: "/",
});

export default function Home() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          webPageSchema({
            path: "/",
            name: siteConfig.publicRoutes[0].title,
            description: siteConfig.publicRoutes[0].description,
          }),
          webApplicationSchema(),
          breadcrumbListSchema([{ name: "Home", path: "/" }]),
          faqPageSchema(homeFaqs),
        ]}
      />
      <main>
        <Hero />
        <Challenge />
        <HowItWorks />
        <Showcase />
        <Features />
        <Reviews />
        <Pricing />
        <Faq items={homeFaqs} />
        <CtaBanner />
      </main>
    </MarketingShell>
  );
}
