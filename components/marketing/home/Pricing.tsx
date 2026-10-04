import { Check, ShieldCheck } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { MkButton } from "@/components/marketing/MkButton";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { SCREEN_GENERATION_CREDIT_COST, STATE_GENERATION_CREDIT_COST } from "@/lib/generation/pricing";
import { plans } from "@/lib/marketing/home-content";
import { cn } from "@/lib/utils";

const BILLING_PATH = `/login?next=${encodeURIComponent("/billing")}`;

export function Pricing({ as = "h2", className }: { as?: "h1" | "h2"; className?: string }) {
  return (
    <section id="pricing" className={cn("scroll-mt-24 bg-white py-20 sm:py-28", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          as={as}
          kicker="Pricing"
          lead="Unthrottled creative power."
          emphasis="Zero feature gates."
          description="Every plan includes prompt-to-UI, screenshot reconstruction, design-token editing, Tailwind HTML, and Agent Pack exports. Plans differ by monthly credit capacity."
        />

        <div className="grid grid-cols-1 items-stretch gap-5 sm:gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.1} y={35} className="h-full">
              <article
                className={cn(
                  "mk-surface flex h-full flex-col rounded-[32px] p-2",
                  plan.popular && "ring-1 ring-mk-accent/30",
                )}
              >
                {/* The plan itself sits on an inset white panel, like the prompt composer. */}
                <div className="rounded-[26px] bg-white p-6 ring-1 ring-black/[0.05] sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-mk-ink">{plan.name}</h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        plan.popular ? "bg-mk-accent/10 text-mk-accent" : "bg-black/[0.04] text-neutral-500",
                      )}
                    >
                      {plan.popular ? <DrawgleLogo className="size-3" /> : null}
                      {plan.popular ? "Most popular" : plan.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-mk-body md:min-h-[3lh]">{plan.description}</p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-5xl font-semibold tracking-[-0.04em] text-mk-ink">${plan.price}</span>
                    <span className="text-sm font-medium text-neutral-400">/ month</span>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                    <span className="size-1.5 rounded-full bg-mk-accent" aria-hidden="true" />
                    {plan.capacity.replace("/mo", " a month")}
                  </p>

                  <MkButton href={BILLING_PATH} variant={plan.popular ? "primary" : "secondary"} className="mt-6 w-full" data-oa-event="cta_click" data-oa-prop-location="pricing_section" data-oa-prop-plan={plan.name}>
                    {plan.cta}
                  </MkButton>
                </div>

                <ul className="flex-1 space-y-3 px-5 pb-5 pt-6 sm:px-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-snug text-neutral-700">
                      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-accent/10 text-mk-accent">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 text-center text-xs leading-relaxed text-neutral-500">
          <p className="max-w-2xl">
            Planning is free. Screen estimates assume {SCREEN_GENERATION_CREDIT_COST} credits per new screen; each extra screen
            state uses {STATE_GENERATION_CREDIT_COST}, and selected-element edits use 3 to 15 credits depending on their size.
          </p>
          <p className="flex items-center gap-1.5 text-neutral-400">
            <ShieldCheck className="size-3.5" />
            Payments are processed securely with Dodo Payments
          </p>
        </div>
      </div>
    </section>
  );
}
