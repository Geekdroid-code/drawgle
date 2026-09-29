import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { publishedComparisonPages } from "@/lib/compare/pages";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, itemListSchema, webPageSchema } from "@/lib/seo/schema";

const title = "Best Mobile UI Design and Prototyping Tool Alternatives";
const description =
  "Compare Drawgle with AI UI generators, design platforms, wireframing tools, app builders, and prototyping software using source-backed workflow, pricing, and handoff analysis.";

export const metadata: Metadata = buildMetadata({
  title,
  description,
  path: "/alternatives",
});

export default function AlternativesIndexPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          webPageSchema({
            path: "/alternatives",
            name: title,
            description,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Alternatives", path: "/alternatives" },
          ]),
          itemListSchema({
            name: "Drawgle product comparisons",
            path: "/alternatives",
            items: publishedComparisonPages.map((page) => `${page.competitor.name} alternative`),
          }),
        ]}
      />
      <main className="px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <SectionHeader
          as="h1"
          kicker="Drawgle alternatives"
          lead="Mobile UI design alternatives,"
          emphasis="compared honestly."
          description="Compare AI UI generators, design platforms, wireframing tools, app builders, and prototyping software by the job each product actually does best."
          className="max-w-4xl"
        />

        <section className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {publishedComparisonPages.map((page, index) => (
            <Reveal key={page.slug} delay={(index % 2) * 0.08} y={24} className="h-full">
              <Link
                href={`/alternatives/${page.slug}`}
                className="mk-surface group flex h-full flex-col rounded-[30px] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgb(233_233_233/0.8)] sm:p-7"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Best {page.competitor.name} alternative
                </span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-mk-ink">{page.competitor.name} alternative</h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-mk-body">{page.sonicBoomSummary}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mk-accent">
                  View comparison
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </section>
      </main>
    </MarketingShell>
  );
}
