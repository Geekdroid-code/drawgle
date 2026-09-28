import { Check, ShieldCheck } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { MkButton } from "@/components/marketing/MkButton";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
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

        <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.12} y={35} className="h-full">
              <div className="mk-surface relative flex h-full flex-col justify-between rounded-[30px] p-6 text-neutral-900 sm:p-8">
                {plan.popular ? (
                  <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-mk-ink px-3.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                    <DrawgleLogo className="size-3 text-[#8fb0ff]" />
                    <span>Best Value</span>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-mk-ink">{plan.name}</h3>
                    {!plan.popular ? (
                      <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-neutral-600">{plan.badge}</span>
                    ) : null}
                  </div>
                  <p className="mb-6 text-xs leading-relaxed text-neutral-500 md:min-h-[3lh]">{plan.description}</p>

                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-mk-ink sm:text-5xl">${plan.price}</span>
                    <span className="text-xs font-medium text-neutral-500">/ month</span>
                  </div>

                  <MkButton href={BILLING_PATH} variant={plan.popular ? "primary" : "secondary"} className="mb-8 w-full">
                    {plan.cta}
                  </MkButton>

                  <div className="space-y-3 pt-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">What&apos;s included</span>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-xs">
                          <Check className="mt-0.5 size-4 shrink-0 text-mk-ink" />
                          <span className="leading-snug text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-black/[0.05] pt-4 text-[11px] text-neutral-500">
                  <span>Estimated capacity</span>
                  <span className="font-mono font-bold text-mk-ink">{plan.capacity}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-neutral-500">
          Planning is free. Screen estimates assume 20 credits per new screen; selected-element edits use 3 to 15 credits
          depending on their size.
        </p>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-neutral-400">
          <ShieldCheck className="size-4 text-neutral-400" />
          <span>Payments are processed securely with Dodo Payments</span>
        </div>
      </div>
    </section>
  );
}
