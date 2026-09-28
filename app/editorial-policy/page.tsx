import type { Metadata } from "next";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MkButton } from "@/components/marketing/MkButton";
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
    <MarketingShell>
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
      <main className="px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <section className="mx-auto max-w-3xl">
          <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 sm:text-sm">Research standards</span>
          <h1 className="mt-4 text-4xl font-medium leading-[1.08] tracking-tight text-mk-body sm:text-5xl md:text-6xl">
            Drawgle comparison <span className="font-semibold text-mk-ink">editorial policy</span>
          </h1>
          <p className="mt-6 text-base leading-7 text-mk-body sm:text-lg">
            Our comparison pages exist to help a buyer choose the right workflow, including when Drawgle is not
            the right tool. This policy explains how we research claims, label evidence, and keep fast-changing
            product information accountable.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">Last reviewed July 17, 2026</p>
        </section>

        <section className="mx-auto mt-12 grid max-w-3xl gap-4">
          {principles.map((principle, index) => (
            <article key={principle.title} className="mk-surface rounded-[26px] p-6 sm:p-7">
              <div className="font-mono text-[11px] tracking-[0.1em] text-mk-accent">{String(index + 1).padStart(2, "0")}</div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-mk-ink sm:text-2xl">{principle.title}</h2>
              <p className="mt-3 text-[15px] leading-7 text-mk-body">{principle.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-10 flex max-w-3xl flex-col items-start justify-between gap-5 rounded-[26px] border border-black/[0.06] bg-white p-6 sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-mk-ink">Read the comparisons</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              The alternatives hub links every published comparison and shows the current set of products covered.
            </p>
          </div>
          <MkButton href="/alternatives" size="sm">
            Browse alternatives
          </MkButton>
        </section>
      </main>
    </MarketingShell>
  );
}
