import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  FileText,
  Sparkles,
} from "lucide-react";

import type { ComparisonPageData } from "@/lib/compare/pages";

const winnerLabel = {
  drawgle: "Drawgle edge",
  competitor: "Competitor edge",
  tie: "Depends",
} as const;

export function ComparisonPage({ page }: { page: ComparisonPageData }) {
  const toc = [
    ["verdict", "Quick verdict"],
    ["facts", `${page.competitor.name} facts`],
    ["matrix", "Side-by-side"],
    ["workflow", "Workflow"],
    ["switching", "Which to choose"],
    ["sources", "Sources"],
    ["faq", "FAQ"],
  ] as const;

  return (
    <div className="min-h-screen bg-[#f7f5f3] text-black">
      <section className="relative overflow-hidden border-b border-black/[0.08] bg-[#080808] px-4 pb-20 pt-32 text-white sm:px-6 sm:pb-24 sm:pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(27,127,204,0.32),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#75b9ed]">
              <Sparkles className="h-3.5 w-3.5" />
              {page.hero.eyebrow}
            </div>
            <h1 className="max-w-4xl font-pixel-square text-[42px] font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              {page.hero.h1}
              <span className="block text-[#1b7fcc]">for mobile UI builders</span>
            </h1>
            <p className="mt-7 max-w-3xl text-base leading-7 text-white/62 sm:text-lg">
              {page.hero.summary}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/project/new"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#1b7fcc] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-[#1975bd]"
              >
                Try Drawgle
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/showcase"
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/14 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/86 transition hover:bg-white/[0.08]"
              >
                View examples
              </Link>
            </div>
          </div>

          <aside className="rounded-[22px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
              Best fit at a glance
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 font-pixel-square text-xl text-white">Choose Drawgle for</div>
                <ul className="space-y-2 text-sm leading-5 text-white/62">
                  {page.verdict.drawgleBestFor.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#75b9ed]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="mb-2 font-pixel-square text-xl text-white">Choose {page.competitor.name} for</div>
                <ul className="space-y-2 text-sm leading-5 text-white/62">
                  {page.verdict.competitorBestFor.slice(0, 3).map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/42" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-3 text-sm">
            <div className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">
              On this page
            </div>
            {toc.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block text-black/50 transition hover:text-[#1b7fcc]">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <section id="verdict" className="scroll-mt-28 border-b border-black/[0.08] pb-14">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
              <CheckCircle2 className="h-4 w-4" />
              Quick verdict
            </div>
            <p className="max-w-4xl text-2xl font-semibold leading-snug text-black sm:text-3xl">
              {page.verdict.short}
            </p>
          </section>

          <section id="facts" className="scroll-mt-28 border-b border-black/[0.08] py-14">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">
                  What {page.competitor.name} publicly says it does
                </h2>
                <p className="mt-4 text-sm leading-6 text-black/55">
                  These facts come from official Sleek pages or its public GitHub repository. They set the boundary for a fair comparison.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {page.competitorFacts.map((fact) => (
                  <article key={fact.label} className="rounded-[18px] border border-black/[0.08] bg-white p-5">
                    <div className="mb-2 text-sm font-bold text-black">{fact.label}</div>
                    <p className="text-sm leading-6 text-black/55">{fact.detail}</p>
                    <a
                      href={fact.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex text-xs font-semibold text-[#1b7fcc] hover:text-[#145f99]"
                    >
                      Source: {fact.source.label}
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-black/[0.08] py-14">
            <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">
              Where Drawgle is intentionally different
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {page.drawgleAdvantages.map((advantage) => (
                <div key={advantage} className="flex gap-3 rounded-[18px] border border-[#1b7fcc]/15 bg-[#1b7fcc]/[0.05] p-5">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#1b7fcc]" />
                  <p className="text-sm leading-6 text-black/68">{advantage}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="matrix" className="scroll-mt-28 border-b border-black/[0.08] py-14">
            <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">
              Drawgle vs {page.competitor.name}: side-by-side
            </h2>
            <div className="mt-8 overflow-x-auto rounded-[20px] border border-black/[0.08] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-black/[0.025]">
                  <tr>
                    <th className="w-[22%] border-b border-black/[0.08] p-5 text-xs font-bold uppercase tracking-[0.14em] text-black/45">
                      Criteria
                    </th>
                    <th className="w-[34%] border-b border-black/[0.08] p-5 text-xs font-bold uppercase tracking-[0.14em] text-black">
                      Drawgle
                    </th>
                    <th className="w-[34%] border-b border-black/[0.08] p-5 text-xs font-bold uppercase tracking-[0.14em] text-black">
                      {page.competitor.name}
                    </th>
                    <th className="w-[10%] border-b border-black/[0.08] p-5 text-xs font-bold uppercase tracking-[0.14em] text-black/45">
                      Fit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-b border-black/[0.06] last:border-b-0">
                      <td className="p-5 align-top text-sm font-semibold text-black">{row.feature}</td>
                      <td className="p-5 align-top text-sm leading-6 text-black/62">{row.drawgle}</td>
                      <td className="p-5 align-top text-sm leading-6 text-black/62">{row.competitor}</td>
                      <td className="p-5 align-top text-xs font-bold text-[#1b7fcc]">{winnerLabel[row.winner]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="workflow" className="scroll-mt-28 border-b border-black/[0.08] py-14">
            <div className="mb-8 max-w-3xl">
              <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">{page.workflow.title}</h2>
              <p className="mt-4 text-sm leading-6 text-black/55">{page.workflow.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {page.workflow.steps.map((step, index) => (
                <article key={step.title} className="rounded-[18px] border border-black/[0.08] bg-white p-5">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#1b7fcc] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="font-pixel-square text-xl font-semibold text-black">{step.title}</h3>
                  <div className="mt-5 space-y-4 text-sm leading-6">
                    <p className="text-black/62">
                      <span className="font-bold text-black">Drawgle:</span> {step.drawgle}
                    </p>
                    <p className="text-black/52">
                      <span className="font-bold text-black">{page.competitor.name}:</span> {step.competitor}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="switching" className="scroll-mt-28 border-b border-black/[0.08] py-14">
            <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">
              Which one should you choose?
            </h2>
            <div className="mt-7 grid gap-4">
              {page.switchGuide.map((item) => (
                <article key={item.title} className="rounded-[18px] border border-black/[0.08] bg-white p-6">
                  <h3 className="font-pixel-square text-2xl font-semibold text-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-black/58">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="my-14 overflow-hidden rounded-[24px] bg-[#080808] p-6 text-white sm:p-8">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#75b9ed]">
                  <Code2 className="h-4 w-4" />
                  Build from the handoff
                </div>
                <h2 className="font-pixel-square text-3xl font-semibold leading-tight sm:text-4xl">
                  Want mobile UI your coding workflow can actually use?
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
                  Start with a prompt, screenshot, or reference, then export implementation context instead of stopping at a static-looking design.
                </p>
              </div>
              <Link
                href="/project/new"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#1b7fcc] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1975bd]"
              >
                Design in Drawgle
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section id="sources" className="scroll-mt-28 border-b border-black/[0.08] pb-14">
            <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">Sources used</h2>
            <div className="mt-6 grid gap-3">
              {page.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white p-4 text-sm font-semibold text-black/70 transition hover:text-[#1b7fcc]"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {source.label}
                </a>
              ))}
            </div>
          </section>

          <section id="faq" className="scroll-mt-28 pt-14">
            <h2 className="font-pixel-square text-4xl font-semibold leading-tight text-black">FAQ</h2>
            <div className="mt-7 space-y-3">
              {page.faqs.map((faq) => (
                <details key={faq.question} className="group rounded-[18px] border border-black/[0.08] bg-white p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-black marker:content-none">
                    {faq.question}
                    <span className="text-[#1b7fcc] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-black/58">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
