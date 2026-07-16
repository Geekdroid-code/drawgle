import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/components/landing/MainFooter";
import PublicHeader from "@/components/landing/Header";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListSchema, webPageSchema } from "@/lib/seo/schema";

const title = "Drawgle Comparison Editorial Policy";
const description =
  "How Drawgle researches, sources, updates, and corrects product comparison and alternative pages.";

export const metadata: Metadata = buildMetadata({
  title,
  description,
  path: "/editorial-policy",
});

const principles = [
  {
    title: "First-party evidence first",
    body: "We prioritize a product's current pricing page, documentation, help center, feature pages, and release notes. Secondary commentary is not used to override a current first-party claim.",
  },
  {
    title: "Different artifacts are named precisely",
    body: "We distinguish editable design files, code snippets, offline prototype HTML, app-store binaries, source code, generated scaffolds, and agent handoff context. They are not treated as interchangeable forms of code export.",
  },
  {
    title: "Competitor strengths stay visible",
    body: "A useful comparison must explain when the competing product is the better choice. We do not assign Drawgle a default win for pricing, collaboration, prototyping, Figma workflows, publishing, self-hosting, or source-code output.",
  },
  {
    title: "Evidence limits are disclosed",
    body: "When a page is based on public documentation rather than a paid-account benchmark, the page says so. We do not describe a public-source review as hands-on testing.",
  },
  {
    title: "Pricing and AI claims expire quickly",
    body: "Every comparison carries an updated date. Pricing, usage limits, export formats, and beta AI capabilities are rechecked when a page is materially revised.",
  },
  {
    title: "Corrections are welcome",
    body: "If a claim is outdated or incomplete, send the source and affected URL to support@drawgle.com. We will verify the current first-party evidence and update the page when a correction is warranted.",
  },
];

export default function EditorialPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f3]">
      <JsonLd
        data={[
          webPageSchema({
            path: "/editorial-policy",
            name: title,
            description,
          }),
          breadcrumbListSchema([
            { name: "Home", path: "/" },
            { name: "Alternatives", path: "/alternatives" },
            { name: "Editorial Policy", path: "/editorial-policy" },
          ]),
        ]}
      />
      <PublicHeader />
      <main className="px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <section className="mx-auto max-w-3xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
            Research standards
          </div>
          <h1 className="mt-4 font-pixel-square text-4xl font-semibold leading-tight tracking-tight text-black sm:text-6xl">
            Drawgle comparison editorial policy
          </h1>
          <p className="mt-6 text-base leading-7 text-black/60">
            Our comparison pages exist to help a buyer choose the right workflow, including when Drawgle is not
            the right tool. This policy explains how we research claims, label evidence, and keep fast-changing
            product information accountable.
          </p>
          <p className="mt-4 text-sm leading-6 text-black/50">Last reviewed July 17, 2026.</p>
        </section>

        <section className="mx-auto mt-12 grid max-w-3xl gap-4">
          {principles.map((principle, index) => (
            <article key={principle.title} className="rounded-2xl border border-black/[0.08] bg-white p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-3 font-pixel-square text-2xl font-semibold text-black">{principle.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/55">{principle.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-[#1b7fcc]/20 bg-[#1b7fcc]/[0.05] p-6">
          <h2 className="font-pixel-square text-xl font-semibold text-black">Read the comparisons</h2>
          <p className="mt-3 text-sm leading-6 text-black/55">
            The alternatives hub links every published comparison and shows the current set of products covered.
          </p>
          <Link href="/alternatives" className="mt-4 inline-flex text-sm font-semibold text-[#1b7fcc] hover:underline">
            Browse Drawgle alternatives
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
