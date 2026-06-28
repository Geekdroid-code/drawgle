import type { Metadata } from 'next'
import PublicHeader from '@/components/landing/Header'
import { HeroSection } from '@/components/landing/HeroSection'
import NewHowItWorks from '@/components/landing/NewHowItWorks'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import MethodComparison from "@/components/landing/MethodComparison";
import AppShowcase from '@/components/landing/AppShowcase';
import PricingCards from '@/components/landing/pricing-cards'
import FAQSection, { homeFaqs } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'
import  Footer  from '@/components/landing/MainFooter'
import TestimonialSection from "@/components/landing/Testimonial";
import HookSection from "@/components/landing/HookSection";
import { JsonLd } from '@/components/seo/JsonLd'
import { siteConfig } from '@/lib/seo/config'
import { buildMetadata } from '@/lib/seo/metadata'
import { breadcrumbListSchema, faqPageSchema, webPageSchema } from '@/lib/seo/schema'

export const metadata: Metadata = buildMetadata({
  title: siteConfig.publicRoutes[0].title,
  description: siteConfig.publicRoutes[0].description,
  path: '/',
})

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          webPageSchema({
            path: '/',
            name: siteConfig.publicRoutes[0].title,
            description: siteConfig.publicRoutes[0].description,
          }),
          breadcrumbListSchema([{ name: 'Home', path: '/' }]),
          faqPageSchema(homeFaqs),
        ]}
      />
      <PublicHeader />
      <main>
        <HeroSection />
        <HookSection />
        <AppShowcase />
        <NewHowItWorks />
        <MethodComparison />
        <TestimonialSection />
        <PricingCards />
        <FeaturesSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}