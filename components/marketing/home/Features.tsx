"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Blend,
  ImageUp,
  MessageSquare,
  MousePointer2,
  Network,
  PencilLine,
  ScanLine,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { FeaturePhone } from "@/components/marketing/motion/devices";
import { EASE, usePlayback } from "@/components/marketing/motion/hooks";
import { ScaledStage } from "@/components/marketing/motion/Stage";
import { cn } from "@/lib/utils";
import { FEATURE_STAGE, featureDemos } from "./FeatureDemos";

type Feature = { icon: LucideIcon; title: string; description: string };

const features: Feature[] = [
  {
    icon: SlidersHorizontal,
    title: "Update shared design tokens once",
    description: "Adjust a color, font, spacing value, corner radius, or shadow once. Every connected screen updates live without regenerating your work.",
  },
  {
    icon: MousePointer2,
    title: "Edit a selected element in place",
    description: "Select a card, button, section, or navigation item and describe the improvement. Drawgle edits that part while preserving everything around it.",
  },
  {
    icon: ScanLine,
    title: "Rebuild a screenshot as editable UI",
    description: "Upload a UI screenshot when you want its layout rebuilt as a real, editable screen instead of receiving a flattened image.",
  },
  {
    icon: Blend,
    title: "Use an interface as a style reference",
    description: "Use any interface as visual inspiration. Drawgle carries over its mood, surfaces, typography, and rhythm while designing your own app and features.",
  },
  {
    icon: Network,
    title: "Design connected mobile screen flows",
    description: "Generate multiple screens with shared navigation and one consistent visual language, so dashboards, details, and flows feel like the same product.",
  },
  {
    icon: MessageSquare,
    title: "Keep product context across iterations",
    description: "Drawgle keeps your audience, goals, features, visual direction, and earlier decisions in context when you add or refine screens later.",
  },
  {
    icon: ImageUp,
    title: "Replace images without rebuilding the screen",
    description: "Select an image or visual placeholder, upload the right asset, and replace it in place while keeping the surrounding layout intact.",
  },
  {
    icon: PencilLine,
    title: "Keep generated screens editable",
    description: "The first output is a starting point, not a dead export. Keep adding screens, changing the system, and refining details on the same canvas.",
  },
];

function FeatureCard({
  feature,
  index,
  active,
  playing,
  duration,
  cycle,
  onSelect,
  compact = false,
}: {
  feature: Feature;
  index: number;
  active: boolean;
  playing: boolean;
  duration: number;
  cycle: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-pressed={active}
      data-feature-card={index}
      className={cn(
        "mk-surface group relative w-full overflow-hidden rounded-[26px] text-left transition-all duration-300",
        compact ? "p-4" : "p-4 sm:p-5",
        active ? "opacity-100 shadow-sm ring-2 ring-mk-ink/15" : "opacity-85 hover:opacity-100",
      )}
    >
      <div className="mb-2.5 flex size-8 items-center justify-center rounded-xl bg-white shadow-xs">
        <Icon className={cn("size-4 transition-colors", active ? "text-mk-accent" : "text-mk-accent/80")} />
      </div>
      <h3 className="mb-1 text-sm font-bold leading-snug tracking-tight text-neutral-900 sm:text-[15px]">{feature.title}</h3>
      <p className={cn("text-xs font-normal leading-relaxed text-neutral-500", compact && "line-clamp-3")}>{feature.description}</p>
      {active ? (
        <span aria-hidden="true" className="absolute inset-x-5 bottom-0 h-[2px] overflow-hidden rounded-full bg-black/[0.06]">
          <span
            key={cycle}
            className="block h-full origin-left rounded-full bg-mk-accent"
            style={
              {
                animation: `mk-feature-progress ${duration}ms linear forwards`,
                animationPlayState: playing ? "running" : "paused",
              } as CSSProperties
            }
          />
        </span>
      ) : null}
    </button>
  );
}

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const { playing, reduced } = usePlayback(sectionRef, 0.35);

  const select = useCallback((index: number) => {
    setActive(index);
    setCycle((current) => current + 1);
  }, []);

  const advance = useCallback(() => {
    setActive((current) => (current + 1) % features.length);
    setCycle((current) => current + 1);
  }, []);

  // Keep the active card visible in the mobile rail without scrolling the page.
  useEffect(() => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>(`[data-feature-card="${active}"]`);
    if (!rail || !card || rail.scrollWidth <= rail.clientWidth) return;
    const target = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);

  const { Demo, duration } = featureDemos[active];
  const leftFeatures = features.slice(0, 4);
  const rightFeatures = features.slice(4);

  return (
    <section id="features" className="relative scroll-mt-24 bg-white py-20 sm:py-28">
      <div ref={sectionRef} className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          kickerStyle="pill"
          kicker="Core features"
          lead="Keep every mobile screen"
          emphasis="visually consistent."
          emphasisTone="accent"
          breakBeforeEmphasis
          description="Use one shared system for colors, type, spacing, radii, shadows, layout, and navigation. Update it once to keep connected mobile screens aligned."
          className="mb-16 text-center sm:mb-20"
        />

        <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 lg:grid-cols-12">
          <div className="order-2 hidden space-y-3.5 sm:space-y-4 lg:order-1 lg:col-span-4 lg:block">
            {leftFeatures.map((feature, index) => (
              <Reveal key={feature.title} x={-30} y={0} delay={index * 0.1}>
                <FeatureCard feature={feature} index={index} active={active === index} playing={playing} duration={duration} cycle={cycle} onSelect={select} />
              </Reveal>
            ))}
          </div>

          <Reveal y={35} delay={0.15} className="order-1 flex min-w-0 justify-center lg:order-2 lg:col-span-4">
            <FeaturePhone>
              <div aria-hidden="true">
                <ScaledStage width={FEATURE_STAGE.width} height={FEATURE_STAGE.height} innerRef={stageRef} innerClassName="overflow-hidden bg-white">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={`${active}-${cycle}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="absolute inset-0"
                    >
                      <Demo stageRef={stageRef} playing={playing} reduced={reduced} onComplete={advance} />
                    </motion.div>
                  </AnimatePresence>
                </ScaledStage>
              </div>
            </FeaturePhone>
          </Reveal>

          <div className="order-3 hidden space-y-3.5 sm:space-y-4 lg:col-span-4 lg:block">
            {rightFeatures.map((feature, index) => (
              <Reveal key={feature.title} x={30} y={0} delay={index * 0.1}>
                <FeatureCard
                  feature={feature}
                  index={index + 4}
                  active={active === index + 4}
                  playing={playing}
                  duration={duration}
                  cycle={cycle}
                  onSelect={select}
                />
              </Reveal>
            ))}
          </div>

          {/* Below lg: one swipeable rail under the phone, synced with the demo */}
          <div className="order-2 -mx-4 min-w-0 lg:hidden">
            <div ref={railRef} className="mk-hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {features.map((feature, index) => (
                <div key={feature.title} className="w-[78%] max-w-[320px] shrink-0 snap-center">
                  <FeatureCard
                    feature={feature}
                    index={index}
                    active={active === index}
                    playing={playing}
                    duration={duration}
                    cycle={cycle}
                    onSelect={select}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
