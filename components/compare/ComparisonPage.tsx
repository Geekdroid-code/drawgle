import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Target, Users, X, Zap } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { mkButtonClassName } from "@/components/marketing/MkButton";
import type { ComparisonPageData } from "@/lib/compare/pages";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  index: string;
  label: string;
};

function SectionHeader({ index, label }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-black/[0.06] pb-3">
      <span className="font-mono text-[11px] font-medium tracking-[0.1em] text-mk-accent">{index}</span>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</h2>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.06]", className)}>{children}</div>;
}

function DrawgleBadge({ label = "Drawgle" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mk-accent/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-mk-accent ring-1 ring-mk-accent/15">
      <DrawgleLogo className="size-2.5" />
      {label}
    </span>
  );
}

function CompetitorBadge({ name, label }: { name: string; label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-black/[0.06]">
      {label ?? name}
    </span>
  );
}

function TieBadge({ label = "Depends" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400 ring-1 ring-black/[0.05]">
      {label}
    </span>
  );
}

export function ComparisonPage({ page }: { page: ComparisonPageData }) {
  const allRows = page.comparisonRows;
  const competitor = page.competitor.name;

  return (
    <div className="relative w-full bg-white text-mk-ink">
      <main className="relative z-10 flex w-full flex-col items-center pb-24 pt-32 sm:pt-40">
        {/* Quick verdict */}
        <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <span className="mb-4 block text-xs font-semibold uppercase tracking-wider text-neutral-400 sm:text-sm">
              Drawgle vs. {competitor}
            </span>
            <h1 className="mb-4 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-mk-heading md:text-5xl">{page.heroTitle}</h1>
            <p className="mx-auto mb-4 max-w-2xl text-pretty text-base leading-relaxed text-mk-body md:text-lg">{page.sonicBoomSummary}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              <time dateTime={page.metadata.modifiedDate}>
                Updated{" "}
                {new Date(page.metadata.modifiedDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span className="text-neutral-300">•</span>
              <span>Reviewed by Drawgle Editorial Team</span>
            </div>
          </div>

          <div className="mk-surface rounded-[30px] p-2">
            <Panel>
              <div className="flex items-center gap-2 border-b border-black/[0.05] px-6 py-4">
                <Zap className="size-4 fill-mk-accent text-mk-accent" />
                <h2 className="text-sm font-semibold tracking-tight text-mk-ink">The 30-second verdict</h2>
              </div>
              <div className="grid gap-8 p-6 md:grid-cols-2 md:gap-12 md:p-8">
                <div>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-mk-ink">{page.quickVerdict.competitorTitle}</h3>
                  <p className="text-sm leading-relaxed text-mk-body">{page.quickVerdict.competitorDescription}</p>
                </div>
                <div>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-mk-accent">{page.quickVerdict.drawgleTitle}</h3>
                  <p className="text-sm font-medium leading-relaxed text-mk-ink">{page.quickVerdict.drawgleDescription}</p>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* At a glance */}
        {allRows.length > 0 && (
          <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
            <SectionHeader index="02" label={`Drawgle vs. ${competitor} at a glance`} />
            <Panel className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-neutral-50/80">
                    <th className="w-[26%] px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Decision factor</th>
                    <th className="w-[30%] px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{competitor}</th>
                    <th className="w-[30%] px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-mk-accent">Drawgle</th>
                    <th className="w-[14%] px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500">Best fit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {allRows.map((item) => (
                    <tr key={item.title} className="align-top">
                      <th scope="row" className="px-5 py-4 text-sm font-semibold leading-relaxed text-mk-ink">
                        {item.title}
                      </th>
                      <td className="px-5 py-4 text-sm leading-relaxed text-mk-body">{item.shortCompetitor}</td>
                      <td className="px-5 py-4 text-sm font-medium leading-relaxed text-mk-ink">{item.shortDrawgle}</td>
                      <td className="px-5 py-4 text-center">
                        {item.winner === "drawgle" ? (
                          <DrawgleBadge />
                        ) : item.winner === "competitor" ? (
                          <CompetitorBadge name={competitor} />
                        ) : (
                          <TieBadge />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}

        {/* Detailed feature comparison */}
        {page.premiumMoat && allRows.length > 0 && (
          <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
            <div className="mk-surface rounded-[30px] p-2">
              <div className="rounded-[24px] bg-mk-ink px-6 py-6 text-white">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8fb0ff]">{page.premiumMoat.eyebrow}</div>
                <h2 className="text-xl font-semibold leading-tight tracking-tight md:text-2xl">{page.premiumMoat.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">{page.premiumMoat.intro}</p>
              </div>
              <div className="mt-2 divide-y divide-black/[0.05] overflow-hidden rounded-[24px] bg-white">
                {allRows.map((item, idx) => (
                  <div key={idx} className="space-y-4 p-6 transition-colors hover:bg-neutral-50/60 md:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mk-accent/10 font-mono text-[10px] font-bold text-mk-accent">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-base font-semibold leading-snug tracking-tight text-mk-ink md:text-lg">{item.title}</h3>
                      </div>
                      {item.winner === "drawgle" ? (
                        <DrawgleBadge />
                      ) : item.winner === "competitor" ? (
                        <CompetitorBadge name={competitor} />
                      ) : (
                        <TieBadge label="Draw" />
                      )}
                    </div>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <CompetitorBadge name={competitor} />
                        <p className="text-sm leading-relaxed text-mk-body">{item.competitorBehavior}</p>
                      </div>
                      <div className="space-y-2">
                        <DrawgleBadge />
                        <p className="text-sm font-medium leading-relaxed text-mk-ink">{item.drawgleBehavior}</p>
                      </div>
                    </div>
                    <p className="border-t border-black/[0.05] pt-3 text-xs leading-relaxed text-neutral-500">
                      <span className="font-semibold text-neutral-700">What you get: </span>
                      {item.proofPoint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Methodology */}
        {page.methodology && (
          <section id="methodology" className="mx-auto mb-16 w-full max-w-5xl scroll-mt-28 px-4 sm:px-6">
            <Panel>
              <div className="border-b border-black/[0.05] bg-neutral-50/80 px-6 py-4">
                <h2 className="text-sm font-semibold tracking-tight text-mk-ink">How we evaluated {competitor}</h2>
              </div>
              <div className="space-y-5 p-6">
                <p className="text-sm leading-relaxed text-mk-body">{page.methodology.summary}</p>
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-500 ring-1 ring-black/[0.04]">
                  <span className="font-semibold text-neutral-700">Evidence basis: </span>
                  {page.researchDisclosure ??
                    "This editorial comparison uses publicly available product pages, pricing pages, documentation, and release material. It does not claim a paid-account benchmark unless the methodology explicitly says so."}{" "}
                  <Link href="/editorial-policy" className="font-semibold text-mk-accent hover:underline">
                    Read our comparison policy.
                  </Link>
                </div>
                <ul className="grid gap-3 md:grid-cols-2">
                  {page.methodology.checks.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-mk-body">
                      <Check className="mt-0.5 size-4 shrink-0 text-mk-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </section>
        )}

        {/* Best fit by niche */}
        {page.bestForNiche && page.bestForNiche.length > 0 && (
          <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
            <SectionHeader index="02b" label="Best fit by niche" />
            <Panel>
              <div className="hidden md:block">
                <div className="grid grid-cols-12 border-b border-black/[0.06] bg-neutral-50/80">
                  <div className="col-span-4 p-4 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Niche / use case</div>
                  <div className="col-span-2 p-4 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500">Best fit</div>
                  <div className="col-span-6 p-4 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Why</div>
                </div>
                <div className="divide-y divide-black/[0.05]">
                  {page.bestForNiche.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 transition-colors hover:bg-neutral-50/60">
                      <div className="col-span-4 flex items-center p-4 text-sm font-medium text-mk-ink">{item.niche}</div>
                      <div className="col-span-2 flex items-center justify-center p-4">
                        {item.bestTool === "drawgle" ? (
                          <DrawgleBadge />
                        ) : item.bestTool === "competitor" ? (
                          <CompetitorBadge name={competitor} />
                        ) : (
                          <TieBadge label="Draw" />
                        )}
                      </div>
                      <div className="col-span-6 flex items-center p-4 text-sm leading-relaxed text-mk-body">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-black/[0.05] md:hidden">
                {page.bestForNiche.map((item, idx) => (
                  <div key={idx} className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-mk-ink">{item.niche}</div>
                      {item.bestTool === "drawgle" ? (
                        <DrawgleBadge />
                      ) : item.bestTool === "competitor" ? (
                        <CompetitorBadge name={competitor} />
                      ) : (
                        <TieBadge label="Draw" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-mk-body">{item.reason}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {/* Pricing analysis */}
        <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
          <SectionHeader index="03" label="Pricing analysis" />
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel>
                <div className="flex items-center gap-3 border-b border-black/[0.05] px-6 py-5">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-neutral-100 text-lg font-bold text-neutral-500">
                    {competitor.charAt(0)}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-mk-ink">{competitor}</h3>
                </div>
                <div className="divide-y divide-black/[0.05]">
                  {page.pricing.competitorPlans.map((plan) => (
                    <div key={plan.name} className="flex items-start justify-between gap-6 px-6 py-5">
                      <div>
                        <div className="text-sm font-semibold text-mk-ink">{plan.name}</div>
                        <div className="mt-1 text-sm leading-relaxed text-neutral-500">{plan.subtitle}</div>
                      </div>
                      <div className="whitespace-nowrap text-sm font-bold text-mk-ink">{plan.price}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="ring-mk-accent/25">
                <div className="flex items-center gap-3 border-b border-mk-accent/10 bg-mk-accent/[0.04] px-6 py-5">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-mk-ink text-white">
                    <DrawgleLogo className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-mk-ink">Drawgle</h3>
                    <span className="text-sm font-medium text-mk-accent">Mobile UI generation and agent handoff</span>
                  </div>
                </div>
                <div className="divide-y divide-black/[0.05]">
                  {page.pricing.drawglePlans.map((plan) => (
                    <div key={plan.name} className="flex items-start justify-between gap-6 px-6 py-5">
                      <div>
                        <div className="text-sm font-semibold text-mk-ink">{plan.name}</div>
                        <div className="mt-1 text-sm leading-relaxed text-neutral-500">{plan.subtitle}</div>
                      </div>
                      <div className="whitespace-nowrap text-sm font-bold text-mk-accent">{plan.price}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="mk-surface rounded-[24px] p-6">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                <Zap className="size-4 text-mk-accent" />
                Pricing verdict
              </div>
              <p className="text-sm leading-relaxed text-mk-body">{page.pricing.verdict}</p>
            </div>
          </div>
        </section>

        {/* Ideal users */}
        {page.idealUsers && (
          <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
            <SectionHeader index="04b" label="Who is each tool actually for?" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <DrawgleBadge />
                  <span className="text-sm font-semibold text-mk-accent">Drawgle is built for</span>
                </div>
                {page.idealUsers.drawgle.map((user, idx) => (
                  <div key={idx} className="mk-surface rounded-[24px] p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Users className="size-4 text-mk-accent" />
                      <span className="text-sm font-semibold text-mk-ink">{user.role}</span>
                    </div>
                    <div className="mb-3 pl-6 text-xs font-medium text-mk-accent">Goal: {user.goal}</div>
                    <p className="pl-6 text-sm leading-relaxed text-mk-body">{user.whyFit}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <CompetitorBadge name={competitor} />
                  <span className="text-sm font-semibold text-neutral-600">{competitor} is built for</span>
                </div>
                {page.idealUsers.competitor.map((user, idx) => (
                  <Panel key={idx} className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Users className="size-4 text-neutral-400" />
                      <span className="text-sm font-semibold text-mk-ink">{user.role}</span>
                    </div>
                    <div className="mb-3 pl-6 text-xs font-medium text-neutral-500">Goal: {user.goal}</div>
                    <p className="pl-6 text-sm leading-relaxed text-neutral-500">{user.whyFit}</p>
                  </Panel>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Honest limitations */}
        {page.limitations && (
          <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
            <SectionHeader index="04c" label="Honest limitations" />
            <div className="grid gap-6 md:grid-cols-2">
              <Panel>
                <div className="flex items-center gap-2 border-b border-black/[0.05] bg-mk-accent/[0.04] px-5 py-4">
                  <AlertTriangle className="size-4 text-mk-accent" />
                  <h3 className="text-sm font-semibold text-mk-ink">Where Drawgle falls short</h3>
                </div>
                <ul className="divide-y divide-black/[0.05]">
                  {page.limitations.drawgle.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 px-5 py-4">
                      <X className="mt-0.5 size-4 shrink-0 text-neutral-300" />
                      <span className="text-sm leading-relaxed text-mk-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel>
                <div className="flex items-center gap-2 border-b border-black/[0.05] bg-neutral-50/80 px-5 py-4">
                  <AlertTriangle className="size-4 text-neutral-400" />
                  <h3 className="text-sm font-semibold text-mk-ink">Where {competitor} falls short</h3>
                </div>
                <ul className="divide-y divide-black/[0.05]">
                  {page.limitations.competitor.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 px-5 py-4">
                      <X className="mt-0.5 size-4 shrink-0 text-neutral-300" />
                      <span className="text-sm leading-relaxed text-mk-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </section>
        )}

        {/* Which should you choose */}
        <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
          <SectionHeader index="05" label="Which one should you choose?" />
          <div className="mk-surface grid gap-2 rounded-[30px] p-2 md:grid-cols-2">
            <div className="rounded-[24px] bg-white p-6">
              <h3 className="mb-6 font-semibold text-mk-accent">Choose Drawgle if…</h3>
              <ul className="space-y-4">
                {page.verdict.drawgleIf.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-mk-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-mk-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] p-6">
              <h3 className="mb-6 font-semibold text-mk-ink">Choose {competitor} if…</h3>
              <ul className="space-y-4">
                {page.verdict.competitorIf.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-mk-body">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-300">
                      <span className="size-1.5 rounded-full bg-neutral-300" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto mb-24 w-full max-w-5xl px-4 sm:px-6">
          <SectionHeader index="06" label="Frequently asked questions" />
          <div className="mk-surface divide-y divide-black/[0.05] rounded-[30px] px-2 py-1">
            {page.faqs.map((faq, idx) => (
              <div key={idx} className="px-5 py-5 sm:px-6">
                <h3 className="mb-2 flex items-start gap-2 text-[15px] font-semibold tracking-tight text-mk-ink">
                  <span className="text-mk-accent">Q.</span>
                  {faq.question}
                </h3>
                <p className="pl-6 text-sm leading-relaxed text-mk-body">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final verdict */}
        <section className="mx-auto mb-16 w-full max-w-5xl px-4 sm:px-6">
          <SectionHeader index="07" label="Final verdict" />
          <div className="mk-surface rounded-[30px] p-2">
            <Panel>
              <div className="flex items-center gap-2 border-b border-black/[0.05] px-6 py-4">
                <Target className="size-4 text-mk-accent" />
                <h3 className="text-sm font-semibold text-mk-ink">{page.finalVerdict.title}</h3>
              </div>
              <div className="space-y-4 p-6">
                {page.finalVerdict.body.map((paragraph, idx) => (
                  <p key={idx} className="text-sm leading-relaxed text-mk-body">
                    {paragraph}
                  </p>
                ))}
                <p className="text-sm font-medium leading-relaxed text-mk-ink">{page.finalVerdict.recommendation}</p>
                <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                  <Link href={page.finalVerdict.drawgleCta.href} className={mkButtonClassName({ variant: "primary", icon: false, className: "gap-2" })}>
                    {page.finalVerdict.drawgleCta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href={page.finalVerdict.competitorCta.href}
                    className={mkButtonClassName({ variant: "secondary", className: "gap-2" })}
                    target={page.finalVerdict.competitorCta.href.startsWith("http") ? "_blank" : undefined}
                    rel={page.finalVerdict.competitorCta.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {page.finalVerdict.competitorCta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* Sources */}
        {page.sources && page.sources.length > 0 && (
          <footer className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <div className="border-t border-black/[0.06] pt-6 text-xs text-neutral-500">
              <h2 className="mb-4 font-semibold uppercase tracking-widest text-neutral-400">First-party sources</h2>
              <ol className="space-y-3">
                {page.sources.map((source, idx) => (
                  <li key={source.href} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 leading-relaxed">
                    <span className="font-mono text-neutral-300">[{idx + 1}]</span>
                    <span>
                      <Link
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-mk-accent"
                      >
                        {source.label}
                      </Link>
                      {source.note ? <span className="text-neutral-500"> — {source.note}</span> : null}
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
