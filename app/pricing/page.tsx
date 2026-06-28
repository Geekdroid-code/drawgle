import React from "react";
import type { Metadata } from "next";
import PublicHeader from "@/components/landing/Header";
import PricingCards from "@/components/landing/pricing-cards";
import Footer from "@/components/landing/MainFooter";
import { Check, Shield, X, Plus, ArrowUpRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, faqPageSchema, offerCatalogSchema, webPageSchema } from "@/lib/seo/schema";

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  return (
    <details className="faq-disclosure group border-b border-black/[0.09]">
      <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left marker:content-none sm:py-6">
        <span className="w-6 shrink-0 font-mono text-[9px] tracking-[0.12em] text-black/30">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.015em] text-black sm:text-base">
          {question}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/[0.1] bg-white text-black/45 transition-all duration-300 group-open:rotate-45 group-open:border-[#1b7fcc]/30 group-open:text-[#1b7fcc]">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
      </summary>
      <div className="overflow-hidden">
        <p className="max-w-2xl pb-6 pl-10 pr-10 text-sm leading-6 text-black/55 sm:pb-7 sm:text-[15px]">
          {answer}
        </p>
      </div>
    </details>
  );
}

const pricingRoute = siteConfig.publicRoutes[1];

export const metadata: Metadata = buildMetadata({
  title: pricingRoute.title,
  description: pricingRoute.description,
  path: pricingRoute.path,
  image: {
    ...siteConfig.defaultOgImage,
    alt: "Drawgle Pricing Plans",
  },
});
const comparisonFeatures = [
  {
    category: "AI Generation & Volume",
    items: [
      { name: "Monthly AI Credits", starter: "600 credits", pro: "2,400 credits", studio: "8,000 credits" },
      { name: "Approximate Screens", starter: "~30 screens", pro: "~120 screens", studio: "~400 screens" },
      { name: "Generation Speed", starter: "Standard", pro: "Priority", studio: "Ultra-Priority" },
      { name: "Screenshot Re-creation (Image to UI)", starter: true, pro: true, studio: true },
      { name: "Style Reference Mode (Mood / Style Ref)", starter: true, pro: true, studio: true },
    ],
  },
  {
    category: "Visual Canvas Editor",
    items: [
      { name: "Point-and-Click Visual Overrides", starter: true, pro: true, studio: true },
      { name: "Global Token Sync (Colors, Spacing, Radius)", starter: true, pro: true, studio: true },
      { name: "Pre-designed Style Presets", starter: "10 Curated", pro: "10 Curated", studio: "Custom + 10 Curated" },
      { name: "User Image Asset Uploads", starter: true, pro: true, studio: true },
    ],
  },
  {
    category: "Developer Exports",
    items: [
      { name: "Clean Tailwind HTML/CSS Export", starter: true, pro: true, studio: true },
      { name: "Design System CSS Variables", starter: true, pro: true, studio: true },
      { name: "Agent Handoff Pack (Cursor/Copilot Context)", starter: true, pro: true, studio: true },
      { name: "Native App Scaffolds (SwiftUI, React Native, Flutter, Compose)", starter: false, pro: true, studio: true },
      { name: "Full Commercial Code License", starter: true, pro: true, studio: true },
    ],
  },
];

const faqs = [
  {
    question: "How does the Screenshot to UI translation work?",
    answer: "You upload any screenshot of a mobile app. Drawgle runs a visual analysis model to detect the positions of text, buttons, inputs, cards, and image blocks. It then translates that layout structure into clean Tailwind CSS classes, rather than generating a flat image or single uneditable block.",
  },
  {
    question: "What is the 'Agent Handoff Pack' and how do I use it with Cursor or Copilot?",
    answer: "When you export a screen, you can download a zip file containing the clean HTML/Tailwind code, a JSON design token manifest, and a `.drawgle/handoff.md` file. You drop this folder directly into your codebase. Downstream AI editors like Cursor, Copilot, or Claude can read the markdown instruction guide and implement the design tokens and pages perfectly into your actual repository.",
  },
  {
    question: "What frameworks are supported in the Native Scaffolds?",
    answer: "Drawgle exports native code scaffolds for React Native (TSX), SwiftUI (Swift), Jetpack Compose (Kotlin), and Flutter (Dart). It structures the views into standard native components so you aren't starting your mobile projects from blank files.",
  },
  {
    question: "Can I edit the generated code in my browser before exporting?",
    answer: "Yes! Our canvas editor is fully interactive. You don't need to write prompts for everything. You can click on any text block to rewrite it, swap images, select elements to visually override their spacing or color, and tweak global theme tokens that sync across all pages instantly.",
  },
  {
    question: "What are AI credits and how are they charged?",
    answer: "Generating a brand new full page from a prompt or screenshot uses roughly 15-20 credits. Making a surgical, visual adjustment on a selected button or card uses only 2-4 credits. Starter includes 600 credits (~30 screens), Pro includes 2,400 credits (~120 screens), and Studio includes 8,000 credits (~400 screens).",
  },
  {
    question: "Can I upgrade, downgrade, or cancel anytime?",
    answer: "Yes, billing is monthly and processed securely via Dodo Payments. You can cancel or change your plan with a single click under your Account settings. Cancelled accounts retain their credits and features until the end of your current billing cycle.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F3]">
      <JsonLd
        data={[
          webPageSchema({
            path: pricingRoute.path,
            name: pricingRoute.title,
            description: pricingRoute.description,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: pricingRoute.path },
          ]),
          faqPageSchema(faqs),
          offerCatalogSchema(),
        ]}
      />
      <PublicHeader />

      <main className="pt-24">
        {/* Main pricing cards section */}
        <PricingCards />

        {/* Comparison Grid Section */}
        <section className="py-16 sm:py-24 border-t border-gray-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight font-pixel-square text-gray-900 mb-4">
                Compare Plan Features
              </h2>
              <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Choose the right level of output and capabilities for your design and development workflow.
              </p>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden border border-gray-200/70 rounded-3xl shadow-xs">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-5 px-6 text-sm font-bold text-gray-400 uppercase tracking-wider w-[40%]">Features</th>
                    <th className="py-5 px-6 text-sm font-bold text-gray-900 uppercase tracking-wider text-center w-[20%]">Starter</th>
                    <th className="py-5 px-6 text-sm font-bold text-gray-900 uppercase tracking-wider text-center w-[20%]">Pro</th>
                    <th className="py-5 px-6 text-sm font-bold text-gray-900 uppercase tracking-wider text-center w-[20%]">Studio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparisonFeatures.map((group) => (
                    <React.Fragment key={group.category}>
                      <tr className="bg-white">
                        <td colSpan={4} className="py-4 px-6 text-xs font-extrabold uppercase tracking-widest text-[#1b7fcc] bg-gray-50/50">
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((item) => (
                        <tr key={item.name} className="hover:bg-gray-50/30 transition-colors">
                          <td className="py-4 px-6 text-sm font-semibold text-gray-700">{item.name}</td>
                          <td className="py-4 px-6 text-sm text-center text-gray-600">
                            {typeof item.starter === "boolean" ? (
                              item.starter ? (
                                <Check className="h-5 w-5 mx-auto text-emerald-500 stroke-[2.5]" />
                              ) : (
                                <X className="h-5 w-5 mx-auto text-gray-300 stroke-[2]" />
                              )
                            ) : (
                              <span className="font-medium">{item.starter}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-center text-gray-600 font-medium">
                            {typeof item.pro === "boolean" ? (
                              item.pro ? (
                                <Check className="h-5 w-5 mx-auto text-emerald-500 stroke-[2.5]" />
                              ) : (
                                <X className="h-5 w-5 mx-auto text-gray-300 stroke-[2]" />
                              )
                            ) : (
                              <span>{item.pro}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-center text-gray-600 font-medium">
                            {typeof item.studio === "boolean" ? (
                              item.studio ? (
                                <Check className="h-5 w-5 mx-auto text-emerald-500 stroke-[2.5]" />
                              ) : (
                                <X className="h-5 w-5 mx-auto text-gray-300 stroke-[2]" />
                              )
                            ) : (
                              <span>{item.studio}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-6 md:hidden">
              {comparisonFeatures.map((group) => (
                <div key={group.category} className="border border-gray-200/70 bg-white rounded-2xl overflow-hidden p-5 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1b7fcc] mb-4 border-b border-gray-100 pb-2">
                    {group.category}
                  </h3>
                  <div className="space-y-4 divide-y divide-gray-50">
                    {group.items.map((item, idx) => (
                      <div key={item.name} className={`flex flex-col gap-2 ${idx > 0 ? "pt-3" : ""}`}>
                        <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-gray-500">
                          <div className="bg-gray-50 py-1.5 rounded-md">
                            <span className="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Starter</span>
                            {typeof item.starter === "boolean" ? (
                              item.starter ? "Yes" : "No"
                            ) : (
                              item.starter
                            )}
                          </div>
                          <div className="bg-gray-50 py-1.5 rounded-md border border-[#1b7fcc]/20">
                            <span className="block text-[9px] text-[#1b7fcc] uppercase font-bold mb-0.5">Pro</span>
                            {typeof item.pro === "boolean" ? (
                              item.pro ? "Yes" : "No"
                            ) : (
                              item.pro
                            )}
                          </div>
                          <div className="bg-gray-50 py-1.5 rounded-md">
                            <span className="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Studio</span>
                            {typeof item.studio === "boolean" ? (
                              item.studio ? "Yes" : "No"
                            ) : (
                              item.studio
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing FAQs Accordion */}
        <section className="relative overflow-hidden border-y border-black/[0.07] bg-[#f8f8f6] px-4 py-20 sm:px-6 sm:py-28">
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-10 border-b border-black/[0.09] pb-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-end lg:gap-16 lg:pb-14">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#1b7fcc]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc]" />
                  Pricing Questions
                </div>
                <h2 className="max-w-xl font-pixel-square text-[34px] font-semibold leading-[1.05] tracking-tight text-black sm:text-5xl">
                  Billing & Credits
                  <span className="block text-[#1b7fcc]">FAQ</span>
                </h2>
              </div>

              <div className="max-w-xl lg:justify-self-end">
                <p className="text-sm leading-6 text-black/55 sm:text-base sm:leading-7">
                  Honest answers to help you choose the right billing tier and understand credit limits, framework exports, and commercial licensing.
                </p>
                <a
                  href="mailto:support@drawgle.com"
                  className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-black transition-colors hover:text-[#1b7fcc]"
                >
                  Still have a question?
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 lg:gap-x-14">
              <div>
                {faqs.slice(0, 3).map((faq, index) => (
                  <FAQItem key={faq.question} {...faq} index={index} />
                ))}
              </div>
              <div>
                {faqs.slice(3).map((faq, index) => (
                  <FAQItem key={faq.question} {...faq} index={index + 3} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Secure Checkout Banner */}
        <section className="py-12 border-t border-gray-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-4 border border-emerald-100">
              <Shield className="h-4 w-4 shrink-0 text-emerald-600" />
              100% Safe & Secure Checkout
            </div>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              All payment transactions are secured and securely processed. You can cancel or upgrade your plan instantly from your account.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
