import type { ReactNode } from "react";

import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { DeviceSlice } from "@/components/marketing/motion/devices";
import { DescribeGraphic, GenerateGraphic, RefineGraphic } from "./HowItWorksGraphics";

function StepText({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-mk-accent/10 text-xs font-bold text-mk-accent">{step}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Step 0{step}</span>
      </div>
      <h3 className="mb-2.5 text-xl font-semibold tracking-tight text-mk-ink sm:text-[22px]">{title}</h3>
      <p className="text-sm leading-relaxed text-mk-body">{children}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          kicker="How it works"
          lead="From app idea to editable UI"
          emphasis="in three simple steps"
          description="No design tools, complex layers, or blank-canvas paralysis. Describe what you need, get connected screens, and refine them without starting over."
        />

        <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-7 md:grid-cols-3">
          <Reveal delay={0.1} y={35} className="mk-surface relative flex flex-col justify-between overflow-hidden rounded-[30px] p-6 sm:p-7">
            <div className="mb-6">
              <StepText step={1} title="Describe your app">
                Tell Drawgle what you&apos;re building and how it should feel. Add a screenshot or style reference, answer a few quick
                questions, and approve the screen plan.
              </StepText>
            </div>
            <div className="-mb-8 mt-auto flex justify-center pt-4 sm:-mb-9">
              <DeviceSlice edge="bottom">
                <DescribeGraphic />
              </DeviceSlice>
            </div>
          </Reveal>

          <Reveal delay={0.2} y={35} className="mk-surface relative flex flex-col justify-between overflow-hidden rounded-[30px] p-6 sm:p-7">
            <div className="-mt-9 mb-6 flex justify-center sm:-mt-10">
              <DeviceSlice edge="top">
                <GenerateGraphic />
              </DeviceSlice>
            </div>
            <StepText step={2} title="Generate your UI">
              Drawgle turns your plan into polished, connected mobile screens with consistent layouts, components, navigation, and
              visual direction.
            </StepText>
          </Reveal>

          <Reveal delay={0.3} y={35} className="mk-surface relative flex flex-col justify-between overflow-hidden rounded-[30px] p-6 sm:p-7">
            <div className="mb-6">
              <StepText step={3} title="Refine and keep building">
                Point at any element and ask for a change, or add new screens. Drawgle edits only what you selected and keeps the
                existing design consistent.
              </StepText>
            </div>
            <div className="-mb-8 mt-auto flex justify-center pt-4 sm:-mb-9">
              <DeviceSlice edge="bottom">
                <RefineGraphic />
              </DeviceSlice>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
