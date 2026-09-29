"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Feature = { icon: LucideIcon; label: string; title: string; description: string };

const features: Feature[] = [
  {
    icon: SlidersHorizontal,
    label: "Design tokens",
    title: "Update shared design tokens once",
    description: "Adjust a color, font, spacing value, corner radius, or shadow once. Every connected screen updates live without regenerating your work.",
  },
  {
    icon: MousePointer2,
    label: "Select & edit",
    title: "Edit a selected element in place",
    description: "Select a card, button, section, or navigation item and describe the improvement. Drawgle edits that part while preserving everything around it.",
  },
  {
    icon: ScanLine,
    label: "Screenshot to UI",
    title: "Rebuild a screenshot as editable UI",
    description: "Upload a UI screenshot when you want its layout rebuilt as a real, editable screen instead of receiving a flattened image.",
  },
  {
    icon: Blend,
    label: "Style reference",
    title: "Use an interface as a style reference",
    description: "Use any interface as visual inspiration. Drawgle carries over its mood, surfaces, typography, and rhythm while designing your own app and features.",
  },
  {
    icon: Network,
    label: "Screen flows",
    title: "Design connected mobile screen flows",
    description: "Generate multiple screens with shared navigation and one consistent visual language, so dashboards, details, and flows feel like the same product.",
  },
  {
    icon: MessageSquare,
    label: "Product context",
    title: "Keep product context across iterations",
    description: "Drawgle keeps your audience, goals, features, visual direction, and earlier decisions in context when you add or refine screens later.",
  },
  {
    icon: ImageUp,
    label: "Image swap",
    title: "Replace images without rebuilding the screen",
    description: "Select an image or visual placeholder, upload the right asset, and replace it in place while keeping the surrounding layout intact.",
  },
  {
    icon: PencilLine,
    label: "Always editable",
    title: "Keep generated screens editable",
    description: "The first output is a starting point, not a dead export. Keep adding screens, changing the system, and refining details on the same canvas.",
  },
];

function FeatureCard({
  feature,
  index,
  active,
  onSelect,
}: {
  feature: Feature;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
}) {
  const Icon = feature.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-pressed={active}
      className={cn(
        "mk-surface group relative flex w-full items-start gap-4 rounded-[26px] p-4 text-left transition-opacity duration-500 ease-mk sm:p-5",
        active ? "opacity-100" : "opacity-80 hover:opacity-100",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-500 ease-mk",
          active ? "bg-mk-accent text-white" : "bg-black/[0.05] text-neutral-500 group-hover:text-mk-ink",
        )}
      >
        <Icon className="size-[17px]" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[15px] font-semibold leading-snug tracking-tight transition-colors duration-500",
            active ? "text-mk-ink" : "text-neutral-600",
          )}
        >
          {feature.title}
        </span>
        <span
          className={cn(
            "mt-1 block text-[13px] leading-relaxed transition-colors duration-500",
            active ? "text-mk-body" : "text-neutral-400",
          )}
        >
          {feature.description}
        </span>
      </span>
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

  const { Demo } = featureDemos[active];
  const current = features[active];
  const columns = [features.slice(0, 4), features.slice(4)];

  const phone = (
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
  );

  return (
    <section id="features" className="relative scroll-mt-24 bg-white py-20 sm:py-28">
      <div ref={sectionRef} className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          kicker="Core features"
          lead="Keep every mobile screen"
          emphasis="visually consistent."
          description="Use one shared system for colors, type, spacing, radii, shadows, layout, and navigation. Update it once to keep connected mobile screens aligned."
        />

        {/* Large screens: feature lists either side of the live phone. Smaller: pills and a caption above it. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center lg:gap-8">
          {columns.map((column, side) => (
            <Reveal
              key={side}
              y={24}
              delay={side * 0.1}
              className={cn("hidden space-y-3.5 lg:col-span-4 lg:block", side === 0 ? "lg:order-1" : "lg:order-3")}
            >
              {column.map((feature, index) => {
                const featureIndex = side * 4 + index;
                return <FeatureCard key={feature.title} feature={feature} index={featureIndex} active={active === featureIndex} onSelect={select} />;
              })}
            </Reveal>
          ))}

          <div className="order-1 min-w-0 lg:hidden">
            <div
              ref={railRef}
              className="mk-hide-scrollbar -mx-4 flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 py-1 sm:flex-wrap sm:justify-center"
            >
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const on = active === index;
                return (
                  <button
                    key={feature.title}
                    type="button"
                    data-feature-card={index}
                    aria-pressed={on}
                    onClick={() => select(index)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300",
                      on ? "bg-mk-ink text-white" : "mk-surface text-neutral-600",
                    )}
                  >
                    <Icon className={cn("size-3.5", on ? "text-[#8fb0ff]" : "text-neutral-400")} />
                    {feature.label}
                  </button>
                );
              })}
            </div>

            <div className="mx-auto mt-5 min-h-[124px] max-w-md text-center sm:min-h-[100px]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <h3 className="text-lg font-semibold tracking-tight text-mk-ink">{current.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mk-body">{current.description}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <Reveal y={35} delay={0.15} className="order-2 flex min-w-0 justify-center lg:col-span-4">
            {phone}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
