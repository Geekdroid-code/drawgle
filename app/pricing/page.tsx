import React from "react";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { CtaBanner } from "@/components/marketing/home/CtaBanner";
import { Faq } from "@/components/marketing/home/Faq";
import { Pricing } from "@/components/marketing/home/Pricing";
import { JsonLd } from "@/components/seo/JsonLd";
import { SCREEN_GENERATION_CREDIT_COST, STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import { siteConfig } from "@/lib/seo/config";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, faqPageSchema, offerCatalogSchema, webPageSchema } from "@/lib/seo/schema";

type PlanValue = string | boolean;

function PlanCell({ value, highlight = false }: { value: PlanValue; highlight?: boolean }) {
  if (typeof value === "string") {
    return <span className={highlight ? "font-semibold text-mk-ink" : "font-medium text-mk-body"}>{value}</span>;
  }
  return value ? (
    <Check className="mx-auto size-5 text-mk-accent" strokeWidth={2.5} aria-label="Included" />
  ) : (
    <X className="mx-auto size-5 text-neutral-300" strokeWidth={2} aria-label="Not included" />
  );
}

function MobileValue({ value }: { value: PlanValue }) {
  if (typeof value === "string") return <>{value}</>;
  return value ? <>Yes</> : <>No</>;
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
      { name: "Screenshot Re-creation (Image to UI)", starter: true, pro: true, studio: true },
      { name: "Style Reference Mode (Mood / Style Ref)", starter: true, pro: true, studio: true },
    ],
  },
  {
    category: "Visual Canvas Editor",
    items: [
      { name: "Point-and-Click Visual Overrides", starter: true, pro: true, studio: true },
      { name: "Global Token Sync (Colors, Spacing, Radius)", starter: true, pro: true, studio: true },
      { name: "Curated Style References", starter: true, pro: true, studio: true },
      { name: "User Image Asset Uploads", starter: true, pro: true, studio: true },
    ],
  },
  {
    category: "Developer Exports",
    items: [
      { name: "Clean Tailwind HTML/CSS Export", starter: true, pro: true, studio: true },
      { name: "Design System CSS Variables", starter: true, pro: true, studio: true },
      { name: "Agent Pack (Screens + Implementation Context for Cursor/Copilot)", starter: true, pro: true, studio: true },
      { name: "Commercial Use Permitted Under Terms", starter: true, pro: true, studio: true },
    ],
  },
];

const faqs = [
  {
    question: "How does the Screenshot to UI translation work?",
    answer: "You upload any screenshot of a mobile app. Drawgle runs a visual analysis model to detect the positions of text, buttons, inputs, cards, and image blocks. It then translates that layout structure into clean Tailwind CSS classes, rather than generating a flat image or single uneditable block.",
  },
  {
    question: "What is the Agent Pack and how do I use it with Cursor or Copilot?",
    answer: "The Agent Pack is a zip containing screen HTML, design tokens, assets, a project manifest, Design.md, `.drawgle/handoff.md`, and agent skill instructions. Add it to your repository so coding agents such as Cursor, Copilot, Claude Code, or Codex can use the approved mobile UI as implementation context.",
  },
  {
    question: "Can I edit the generated code in my browser before exporting?",
    answer: "Yes! Our canvas editor is fully interactive. You don't need to write prompts for everything. You can click on any text block to rewrite it, swap images, select elements to visually override their spacing or color, and tweak global theme tokens that sync across all pages instantly.",
  },
  {
    question: "What are AI credits and how are they charged?",
    answer: `Planning is free. A new parent screen costs ${SCREEN_GENERATION_CREDIT_COST} credits, and each additional state of a screen costs ${STATE_GENERATION_CREDIT_COST}. Selected edits cost 3 credits for a small component, 10 for a medium container, or 15 for a large section; full-screen and navigation edits cost 20 credits. Starter includes 600 credits (~30 screens), Pro includes 2,400 credits (~120 screens), and Studio includes 8,000 credits (~400 screens).`,
  },
  {
    question: "Can I upgrade, downgrade, or cancel anytime?",
    answer: "Yes, billing is monthly and processed securely via Dodo Payments. You can cancel or change your plan with a single click on your Billing page. Cancelled accounts retain their credits and features until the end of your current billing cycle.",
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
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

      <main>
        <Pricing as="h1" className="pt-32 sm:pt-40" />

        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              kicker="Compare plans"
              lead="The same workflow on every plan."
              emphasis="Only the capacity changes."
              description="Choose the monthly credit capacity that fits your design and development workflow."
            />

            <Reveal y={24} className="mk-surface hidden rounded-[30px] p-2 md:block">
              <div className="overflow-hidden rounded-[24px] bg-white">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/[0.06]">
                      <th className="w-[40%] px-6 py-5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Features</th>
                      {["Starter", "Pro", "Studio"].map((plan) => (
                        <th
                          key={plan}
                          className={`w-[20%] px-6 py-5 text-center text-[13px] font-bold tracking-tight ${plan === "Pro" ? "text-mk-accent" : "text-mk-ink"}`}
                        >
                          {plan}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((group) => (
                      <React.Fragment key={group.category}>
                        <tr>
                          <td colSpan={4} className="bg-neutral-50/80 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                            {group.category}
                          </td>
                        </tr>
                        {group.items.map((item) => (
                          <tr key={item.name} className="border-t border-black/[0.04] transition-colors hover:bg-neutral-50/50">
                            <td className="px-6 py-4 text-sm font-medium text-mk-ink">{item.name}</td>
                            <td className="px-6 py-4 text-center text-sm">
                              <PlanCell value={item.starter} />
                            </td>
                            <td className="bg-mk-accent/[0.025] px-6 py-4 text-center text-sm">
                              <PlanCell value={item.pro} highlight />
                            </td>
                            <td className="px-6 py-4 text-center text-sm">
                              <PlanCell value={item.studio} />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 gap-4 md:hidden">
              {comparisonFeatures.map((group) => (
                <div key={group.category} className="mk-surface rounded-[26px] p-5">
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-neutral-500">{group.category}</h3>
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <div key={item.name} className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-mk-ink">{item.name}</span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-mk-body">
                          {(["starter", "pro", "studio"] as const).map((plan) => (
                            <div key={plan} className={`rounded-xl bg-white py-1.5 ${plan === "pro" ? "ring-1 ring-mk-accent/25" : ""}`}>
                              <span className={`mb-0.5 block text-[9px] font-bold uppercase ${plan === "pro" ? "text-mk-accent" : "text-neutral-400"}`}>
                                {plan}
                              </span>
                              <MobileValue value={item[plan]} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Faq items={faqs} kicker="Pricing questions" lead="Billing and credits," emphasis="answered." id="pricing-faqs" />

        <CtaBanner secondary={{ label: "Explore the showcase", href: "/showcase" }} />
      </main>
    </MarketingShell>
  );
}
