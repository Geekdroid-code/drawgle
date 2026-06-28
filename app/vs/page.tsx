import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";

import Footer from "@/components/landing/MainFooter";
import PublicHeader from "@/components/landing/Header";
import { JsonLd } from "@/components/seo/JsonLd";
import { publishedComparisonPages } from "@/lib/compare/pages";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, webPageSchema } from "@/lib/seo/schema";

const title = "AI Mobile UI Design Tool Comparisons";
const description =
  "Compare Drawgle with other AI mobile UI design tools using source-backed feature notes, workflow differences, export options, and practical buying guidance.";

export const metadata: Metadata = buildMetadata({
  title,
  description,
  path: "/vs",
});

export default function ComparisonIndexPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f3]">
      <JsonLd
        data={[
          webPageSchema({
            path: "/vs",
            name: title,
            description,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Comparisons", path: "/vs" },
          ]),
        ]}
      />
      <PublicHeader />
      <main className="px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <section className="mx-auto max-w-5xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
            <GitCompareArrows className="h-4 w-4" />
            Drawgle comparisons
          </div>
          <h1 className="font-pixel-square text-[42px] font-semibold leading-[1.04] tracking-tight text-black sm:text-6xl">
            Source-backed comparisons for AI mobile UI builders.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-black/55 sm:text-base">
            Each comparison separates researched competitor facts from Drawgle positioning, so you can decide based on workflow fit instead of vague feature claims.
          </p>
        </section>

        <section className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
          {publishedComparisonPages.map((page) => (
            <Link
              key={page.slug}
              href={`/vs/${page.slug}`}
              className="group rounded-[22px] border border-black/[0.08] bg-white p-6 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-[#1b7fcc]/30"
            >
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
                {page.competitor.name} alternative
              </div>
              <h2 className="font-pixel-square text-3xl font-semibold leading-tight text-black">
                {page.metadata.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-black/55">{page.metadata.description}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1b7fcc]">
                Read comparison
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
