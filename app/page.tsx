import PublicHeader from '@/components/landing/Header'
import { HeroSection } from '@/components/landing/HeroSection'
import NewHowItWorks from '@/components/landing/NewHowItWorks'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import MethodComparison from "@/components/landing/MethodComparison";
import AppShowcase from '@/components/landing/AppShowcase';
import PricingCards from '@/components/landing/pricing-cards'
import FAQSection from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'
import  Footer  from '@/components/landing/MainFooter'
import TestimonialSection from "@/components/landing/Testimonial";
import HookSection from "@/components/landing/HookSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
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
