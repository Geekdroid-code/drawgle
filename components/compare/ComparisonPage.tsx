import Link from "next/link";
import { ArrowRight, Check, X, Zap, Target, Users, AlertTriangle, FileText } from "lucide-react";

import type { ComparisonPageData } from "@/lib/compare/pages";

type SectionHeaderProps = {
  index: string;
  label: string;
};

function SectionHeader({ index, label }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6 border-b border-stone-200 pb-2">
      <span className="text-xs font-bold text-[#1b7fcc] uppercase tracking-widest">[{index}]</span>
      <h2 className="font-pixel-square text-xs font-semibold text-stone-500 uppercase tracking-widest">{label}</h2>
    </div>
  );
}

export function ComparisonPage({ page }: { page: ComparisonPageData }) {
  const allRows = page.comparisonRows;

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-stone-50/20 text-stone-900">
      <main className="flex-grow flex flex-col items-center w-full relative pt-24 pb-24 z-10">
        {/* Section 1: Quick Verdict Header */}
        <section className="w-full max-w-5xl mx-auto px-6 mb-16">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h1 className="font-pixel-square text-3xl md:text-5xl text-stone-900 leading-[1.1] mb-4 tracking-tight font-semibold">
              {page.heroTitle}
            </h1>
            <p className="mx-auto mb-4 max-w-2xl text-sm leading-relaxed text-stone-600 md:text-base">
              {page.sonicBoomSummary}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-stone-400">
              <time dateTime={page.metadata.modifiedDate}>
                Updated{" "}
                {new Date(page.metadata.modifiedDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span className="text-stone-300">•</span>
              <span>Reviewed by Drawgle Editorial</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#1b7fcc]/20 overflow-hidden">
            <div className="bg-[#1b7fcc]/[0.04] px-6 py-4 border-b border-[#1b7fcc]/10 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#1b7fcc] fill-[#1b7fcc]" />
              <h2 className="font-pixel-square text-sm text-stone-900 uppercase tracking-wider font-semibold">The 30-Second Verdict</h2>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                <div>
                  <h3 className="font-pixel-square text-stone-900 text-lg mb-3 font-semibold flex items-center gap-2">
                    {page.quickVerdict.competitorTitle}
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    {page.quickVerdict.competitorDescription}
                  </p>
                </div>
                <div>
                  <h3 className="font-pixel-square text-[#1b7fcc] text-lg mb-3 font-semibold flex items-center gap-2">
                    {page.quickVerdict.drawgleTitle}
                  </h3>
                  <p className="text-stone-900 text-sm leading-relaxed font-medium">
                    {page.quickVerdict.drawgleDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Scannable comparison table */}
        {allRows.length > 0 && (
          <section className="w-full max-w-5xl mx-auto px-6 mb-16">
            <SectionHeader index="02" label="Drawgle vs. Competitor At a Glance" />
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="w-[26%] px-5 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">Decision factor</th>
                    <th className="w-[30%] px-5 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">{page.competitor.name}</th>
                    <th className="w-[30%] px-5 py-4 text-xs font-bold uppercase tracking-wider text-[#1b7fcc]">Drawgle</th>
                    <th className="w-[14%] px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-stone-500">Best fit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {allRows.map((item) => (
                    <tr key={item.title} className="align-top">
                      <th scope="row" className="px-5 py-4 text-sm font-semibold leading-relaxed text-stone-900">{item.title}</th>
                      <td className="px-5 py-4 text-sm leading-relaxed text-stone-600">{item.shortCompetitor}</td>
                      <td className="px-5 py-4 text-sm font-medium leading-relaxed text-stone-900">{item.shortDrawgle}</td>
                      <td className="px-5 py-4 text-center text-xs font-bold">
                        {item.winner === "drawgle" ? (
                          <span className="text-[#1b7fcc]">Drawgle</span>
                        ) : item.winner === "competitor" ? (
                          <span className="text-stone-700">{page.competitor.name}</span>
                        ) : (
                          <span className="text-stone-400">Depends</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section 1a: The Single Home for All Feature Comparisons */}
        {page.premiumMoat && allRows.length > 0 && (
          <section className="w-full max-w-5xl mx-auto px-6 mb-16">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="bg-stone-900 text-white px-6 py-5 border-b border-stone-800">
                <div className="text-[10px] font-bold text-[#1b7fcc] uppercase tracking-widest mb-1.5">
                  {page.premiumMoat.eyebrow}
                </div>
                <h2 className="font-pixel-square text-xl md:text-2xl font-semibold text-white leading-tight">
                  {page.premiumMoat.title}
                </h2>
                <p className="mt-2 text-sm text-white/55 leading-relaxed max-w-3xl">
                  {page.premiumMoat.intro}
                </p>
              </div>
              <div className="divide-y divide-stone-100">
                {allRows.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 md:p-7 space-y-4 hover:bg-stone-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b7fcc]/10 text-[10px] font-bold text-[#1b7fcc]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-pixel-square text-base md:text-lg font-semibold text-stone-900 leading-snug">
                          {item.title}
                        </h3>
                      </div>
                      {item.winner === "drawgle" && (
                        <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1b7fcc]/[0.06] text-[#1b7fcc] text-[10px] font-bold uppercase border border-[#1b7fcc]/15">
                          <Target className="w-3 h-3" />
                          Drawgle
                        </div>
                      )}
                      {item.winner === "competitor" && (
                        <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-stone-100 text-stone-600 text-[10px] font-bold uppercase border border-stone-200">
                          <span className="text-[8px]">{page.competitor.name.charAt(0)}</span>
                          {page.competitor.name}
                        </div>
                      )}
                      {item.winner === "tie" && (
                        <div className="shrink-0 inline-flex items-center px-2 py-1 rounded bg-stone-100 text-stone-400 text-[10px] font-bold uppercase border border-stone-200">
                          Draw
                        </div>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 border border-stone-200 rounded px-2 py-0.5">
                          <span className="w-4 h-4 rounded bg-white flex items-center justify-center text-[8px] text-stone-600 border border-stone-200">
                            {page.competitor.name.charAt(0)}
                          </span>
                          {page.competitor.name}
                        </div>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          {item.competitorBehavior}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1b7fcc] bg-[#1b7fcc]/[0.06] border border-[#1b7fcc]/20 rounded px-2 py-0.5">
                          <span className="w-4 h-4 rounded bg-white flex items-center justify-center text-[8px] text-[#1b7fcc] border border-[#1b7fcc]/20">
                            D
                          </span>
                          Drawgle
                        </div>
                        <p className="text-sm text-stone-900 leading-relaxed font-medium">
                          {item.drawgleBehavior}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed pt-3 border-t border-stone-100">
                      <span className="font-semibold text-stone-700">What you get: </span>
                      {item.proofPoint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section 1b: Methodology */}
        {page.methodology && (
          <section id="methodology" className="w-full max-w-5xl mx-auto px-6 mb-16 scroll-mt-28">
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                <h2 className="font-pixel-square text-sm font-semibold text-stone-900">
                  How We Evaluated {page.competitor.name}
                </h2>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-stone-600 leading-relaxed">{page.methodology.summary}</p>
                <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-500">
                  <span className="font-semibold text-stone-700">Evidence basis: </span>
                  {page.researchDisclosure ??
                    "This editorial comparison uses publicly available product pages, pricing pages, documentation, and release material. It does not claim a paid-account benchmark unless the methodology explicitly says so."}{" "}
                  <Link href="/editorial-policy" className="font-semibold text-[#1b7fcc] hover:underline">
                    Read our comparison policy.
                  </Link>
                </div>
                <ul className="grid md:grid-cols-2 gap-3">
                  {page.methodology.checks.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-stone-600">
                      <Check className="w-4 h-4 text-[#1b7fcc] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Section 2b: Best For By Niche */}
        {page.bestForNiche && page.bestForNiche.length > 0 && (
          <section className="w-full max-w-5xl mx-auto px-6 mb-16">
            <SectionHeader index="02b" label="Best Fit By Niche" />
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="hidden md:block">
                <div className="grid grid-cols-12 bg-stone-50 border-b border-stone-200 divide-x divide-stone-200">
                  <div className="col-span-4 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Niche / Use Case</div>
                  <div className="col-span-2 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-center">Best Fit</div>
                  <div className="col-span-6 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Why</div>
                </div>

                <div className="divide-y divide-stone-100">
                  {page.bestForNiche.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 divide-x divide-stone-100 hover:bg-stone-50/50 transition-colors"
                    >
                      <div className="col-span-4 p-4 text-sm font-medium text-stone-900 flex items-center">
                        {item.niche}
                      </div>
                      <div className="col-span-2 p-4 flex items-center justify-center">
                        {item.bestTool === "drawgle" && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1b7fcc] bg-[#1b7fcc]/[0.06] px-2 py-1 rounded border border-[#1b7fcc]/15">
                            <Target className="w-3 h-3" />
                            Drawgle
                          </div>
                        )}
                        {item.bestTool === "competitor" && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 bg-stone-100 px-2 py-1 rounded border border-stone-200">
                            <span className="text-[10px]">{page.competitor.name.charAt(0)}</span>
                            {page.competitor.name}
                          </div>
                        )}
                        {item.bestTool === "tie" && (
                          <div className="text-xs font-medium text-stone-400">Draw</div>
                        )}
                      </div>
                      <div className="col-span-6 p-4 text-sm text-stone-500 leading-relaxed flex items-center">
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:hidden divide-y divide-stone-100">
                {page.bestForNiche.map((item, idx) => (
                  <div key={idx} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-stone-900">{item.niche}</div>
                      <div>
                        {item.bestTool === "drawgle" && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-[#1b7fcc] bg-[#1b7fcc]/[0.06] px-2 py-0.5 rounded border border-[#1b7fcc]/15">
                            Best: Drawgle
                          </div>
                        )}
                        {item.bestTool === "competitor" && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                            Best: {page.competitor.name}
                          </div>
                        )}
                        {item.bestTool === "tie" && (
                          <div className="text-[10px] font-medium text-stone-400 px-2 py-0.5 bg-stone-50 rounded border border-stone-100">
                            Draw
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Pricing Analysis */}
        <section className="w-full max-w-5xl mx-auto px-6 mb-16">
          <SectionHeader index="03" label="Pricing Analysis" />
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-stone-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-lg border border-stone-200">
                    {page.competitor.name.charAt(0)}
                  </div>
                  <h3 className="font-pixel-square text-lg font-semibold text-stone-900">{page.competitor.name}</h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {page.pricing.competitorPlans.map((plan) => (
                    <div key={plan.name} className="px-6 py-5 flex items-start justify-between gap-6">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{plan.name}</div>
                        <div className="text-sm text-stone-500 mt-1 leading-relaxed">{plan.subtitle}</div>
                      </div>
                      <div className="text-sm font-bold text-stone-900 whitespace-nowrap">{plan.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-[#1b7fcc]/30 overflow-hidden">
                <div className="px-6 py-5 border-b border-[#1b7fcc]/15 bg-[#1b7fcc]/[0.04] flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#1b7fcc]/15 flex items-center justify-center text-[#1b7fcc] font-bold text-lg border border-[#1b7fcc]/20">
                    D
                  </div>
                  <div>
                    <h3 className="font-pixel-square text-lg font-semibold text-stone-900">Drawgle</h3>
                    <span className="text-sm font-medium text-[#1b7fcc]">Mobile UI generation and agent handoff</span>
                  </div>
                </div>
                <div className="divide-y divide-stone-100">
                  {page.pricing.drawglePlans.map((plan) => (
                    <div key={plan.name} className="px-6 py-5 flex items-start justify-between gap-6">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{plan.name}</div>
                        <div className="text-sm text-stone-500 mt-1 leading-relaxed">{plan.subtitle}</div>
                      </div>
                      <div className="text-sm font-bold text-[#1b7fcc] whitespace-nowrap">{plan.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">
                <Zap className="w-4 h-4 text-[#1b7fcc]" />
                Pricing Verdict
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">{page.pricing.verdict}</p>
            </div>
          </div>
        </section>

        {/* Section 4b: Ideal User Profiles */}
        {page.idealUsers && (
          <section className="w-full max-w-5xl mx-auto px-6 mb-16">
            <SectionHeader index="04b" label="Who Is Each Tool Actually For?" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-[#1b7fcc]/15 flex items-center justify-center text-[#1b7fcc] text-xs font-bold border border-[#1b7fcc]/20">D</div>
                  <span className="text-sm font-semibold text-[#1b7fcc]">Drawgle is built for</span>
                </div>
                {page.idealUsers.drawgle.map((user, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-[#1b7fcc]/15 p-5 hover:border-[#1b7fcc]/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-[#1b7fcc]" />
                      <span className="text-sm font-semibold text-stone-900">{user.role}</span>
                    </div>
                    <div className="text-xs text-[#1b7fcc] font-medium mb-3 pl-6">Goal: {user.goal}</div>
                    <p className="text-sm text-stone-600 leading-relaxed pl-6">{user.whyFit}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-stone-100 flex items-center justify-center text-stone-500 text-xs font-bold border border-stone-200">
                    {page.competitor.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-stone-700">{page.competitor.name} is built for</span>
                </div>
                {page.idealUsers.competitor.map((user, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-stone-200 p-5 hover:border-stone-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-stone-400" />
                      <span className="text-sm font-semibold text-stone-900">{user.role}</span>
                    </div>
                    <div className="text-xs text-stone-500 font-medium mb-3 pl-6">Goal: {user.goal}</div>
                    <p className="text-sm text-stone-500 leading-relaxed pl-6">{user.whyFit}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section 4c: Honest Limitations */}
        {page.limitations && (
          <section className="w-full max-w-5xl mx-auto px-6 mb-16">
            <SectionHeader index="04c" label="Honest Limitations" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 bg-[#1b7fcc]/[0.04] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#1b7fcc]" />
                  <h3 className="font-pixel-square text-sm font-semibold text-stone-900">Where Drawgle Falls Short</h3>
                </div>
                <ul className="divide-y divide-stone-100">
                  {page.limitations.drawgle.map((item, idx) => (
                    <li key={idx} className="px-5 py-4 flex items-start gap-3">
                      <X className="w-4 h-4 text-stone-300 shrink-0 mt-0.5" />
                      <span className="text-sm text-stone-600 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-stone-400" />
                  <h3 className="font-pixel-square text-sm font-semibold text-stone-900">Where {page.competitor.name} Falls Short</h3>
                </div>
                <ul className="divide-y divide-stone-100">
                  {page.limitations.competitor.map((item, idx) => (
                    <li key={idx} className="px-5 py-4 flex items-start gap-3">
                      <X className="w-4 h-4 text-stone-300 shrink-0 mt-0.5" />
                      <span className="text-sm text-stone-600 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Section 5: Which Should You Choose? */}
        <section className="w-full max-w-5xl mx-auto px-6 mb-16">
          <SectionHeader index="05" label="Which One Should You Choose?" />
          <div className="grid md:grid-cols-2 gap-6 bg-white rounded-lg border border-stone-200 overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-stone-200 bg-[#1b7fcc]/[0.04]">
              <h3 className="font-pixel-square text-[#1b7fcc] font-semibold mb-6">Choose Drawgle if...</h3>
              <ul className="space-y-4">
                {page.verdict.drawgleIf.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-700 text-sm">
                    <Check className="w-4 h-4 text-[#1b7fcc] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6">
              <h3 className="font-pixel-square text-stone-900 font-semibold mb-6">Choose {page.competitor.name} if...</h3>
              <ul className="space-y-4">
                {page.verdict.competitorIf.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-500 text-sm">
                    <div className="w-4 h-4 rounded-full border border-stone-300 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: FAQ */}
        <section className="w-full max-w-5xl mx-auto px-6 mb-24">
          <SectionHeader index="06" label="Frequently Asked Questions" />
          <div className="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
            {page.faqs.map((faq, idx) => (
              <div key={idx} className="p-6">
                <h3 className="font-pixel-square text-sm font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <span className="text-[#1b7fcc]">Q.</span>
                  {faq.question}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed pl-6">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Final Verdict */}
        <section className="w-full max-w-5xl mx-auto px-6 mb-16">
          <SectionHeader index="07" label="Final Verdict" />
          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#1b7fcc]" />
              <h3 className="font-pixel-square text-sm font-semibold text-stone-900">{page.finalVerdict.title}</h3>
            </div>
            <div className="p-6 space-y-4">
              {page.finalVerdict.body.map((paragraph, idx) => (
                <p key={idx} className="text-stone-600 text-sm leading-relaxed">
                  {paragraph}
                </p>
              ))}
              <p className="text-stone-900 text-sm leading-relaxed font-medium">
                {page.finalVerdict.recommendation}
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  href={page.finalVerdict.drawgleCta.href}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-[#1b7fcc] text-white text-sm font-semibold hover:bg-[#1975bd] transition-colors"
                >
                  {page.finalVerdict.drawgleCta.label}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={page.finalVerdict.competitorCta.href}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-white border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors"
                  target={page.finalVerdict.competitorCta.href.startsWith("http") ? "_blank" : undefined}
                  rel={page.finalVerdict.competitorCta.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {page.finalVerdict.competitorCta.label}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        {/* Sources (minimalist authority footer) */}
        {page.sources && page.sources.length > 0 && (
          <footer className="w-full max-w-5xl mx-auto px-6">
            <div className="border-t border-stone-200 pt-6 text-xs text-stone-500">
              <h2 className="mb-4 uppercase tracking-widest font-semibold text-stone-400">First-party sources</h2>
              <ol className="space-y-3">
                {page.sources.map((source, idx) => (
                  <li key={source.href} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 leading-relaxed">
                    <span className="font-mono text-stone-300">[{idx + 1}]</span>
                    <span>
                      <Link
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-[#1b7fcc]"
                      >
                        {source.label}
                      </Link>
                      {source.note ? <span className="text-stone-500"> — {source.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
