"use client";

import { Check } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { MkButton } from "@/components/marketing/MkButton";
import { Reveal } from "@/components/marketing/Reveal";
import { PLAY_DEMO_EVENT } from "./DemoFilm";

const assurances = ["Tailwind HTML export", "Agent Pack handoff", "Plans from $9/month"];

/** Closing call to action. Pages without the launch film pass a secondary link instead of "Watch Demo". */
export function CtaBanner({ secondary }: { secondary?: { label: string; href: string } }) {
  const watchDemo = () => {
    const player = document.getElementById("demo-player");
    if (player) {
      player.scrollIntoView({ behavior: "smooth", block: "center" });
      window.dispatchEvent(new Event(PLAY_DEMO_EVENT));
    }
  };

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal y={24} className="mk-surface relative overflow-hidden rounded-[36px] p-8 text-center sm:p-14 md:p-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[640px] max-w-full -translate-x-1/2 bg-gradient-to-b from-mk-accent/10 to-transparent blur-3xl"
          />
          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-5 inline-flex select-none items-center gap-1.5 rounded-full border border-black/[0.04] bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-500">
              <DrawgleLogo className="size-3 text-mk-accent" />
              <span className="text-[10px] uppercase tracking-wider">Start designing in seconds</span>
            </div>

            <h2 className="mb-4 text-3xl font-medium leading-[1.12] tracking-tight text-mk-body sm:mb-5 sm:text-4xl md:text-5xl lg:text-[54px]">
              Design your next mobile app <br className="hidden sm:inline" />
              <span className="font-semibold text-mk-ink">at the speed of thought.</span>
            </h2>

            <p className="mx-auto mb-8 max-w-xl text-sm font-normal leading-relaxed text-mk-body sm:mb-10 sm:text-base md:text-lg">
              Describe your idea, generate connected mobile screens, and hand your coding agent Tailwind HTML, synchronized design
              tokens, and the full implementation context.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <MkButton href="/project/new" size="lg">
                Start Building Now
              </MkButton>
              {secondary ? (
                <MkButton href={secondary.href} variant="secondary" size="lg">
                  {secondary.label}
                </MkButton>
              ) : (
                <MkButton variant="secondary" size="lg" onClick={watchDemo}>
                  Watch Demo
                </MkButton>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-black/[0.04] pt-6 text-xs text-neutral-500 sm:gap-6">
              {assurances.map((item, index) => (
                <span key={item} className="flex items-center gap-4 sm:gap-6">
                  {index > 0 ? <span className="hidden text-neutral-300 sm:inline">·</span> : null}
                  <span className="flex items-center gap-1.5 font-medium">
                    <Check className="size-3.5 text-mk-accent" /> {item}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
