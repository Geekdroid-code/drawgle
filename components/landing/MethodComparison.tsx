"use client";

import { motion } from "motion/react";
import {
  Check,
  Code2,
  Figma,
  Layers3,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

const stages = [
  { label: "Prompt", icon: Sparkles },
  { label: "Refine", icon: RefreshCw },
  { label: "Systemize", icon: Layers3 },
  { label: "Ship", icon: Code2 },
];

const drawgleJourney = [
  { title: "Clear direction", detail: "Your intent stays intact", mood: "happy" },
  { title: "Polished UI", detail: "Refine any selected section", mood: "calm" },
  { title: "One system", detail: "Tokens keep every screen aligned", mood: "spark" },
  { title: "Ready to ship", detail: "Clean React, built for production", mood: "done" },
];

const genericJourney = [
  { title: "Vague output", detail: "A generic first draft", mood: "blank" },
  { title: "Design drift", detail: "Every revision changes the style", mood: "sad" },
  { title: "Manual cleanup", detail: "Patch components and messy CSS", mood: "lost" },
  { title: "Rewrite again", detail: "Developers rebuild it anyway", mood: "flat" },
];

function Face({ mood, active }: { mood: string; active: boolean }) {
  const eyeClass = active ? "bg-current" : "bg-gray-500";
  const mouthClass =
    mood === "sad" || mood === "lost"
      ? "top-[27px] rounded-t-full border-t-2"
      : mood === "flat" || mood === "blank"
        ? "top-[29px] border-t-2"
        : "top-[25px] rounded-b-full border-b-2";

  return (
    <div className="relative h-full w-full">
      {mood === "spark" && (
        <>
          <span className="absolute left-[12px] top-[16px] h-2 w-2 rotate-45 rounded-[2px] border border-current" />
          <span className="absolute right-[12px] top-[16px] h-2 w-2 rotate-45 rounded-[2px] border border-current" />
        </>
      )}
      {mood === "done" && (
        <>
          <span className="absolute left-[12px] top-[18px] h-[2px] w-2 rotate-[20deg] rounded-full bg-current" />
          <span className="absolute right-[12px] top-[18px] h-[2px] w-2 -rotate-[20deg] rounded-full bg-current" />
        </>
      )}
      {mood !== "spark" && mood !== "done" && (
        <>
          <span className={`absolute left-[13px] top-[17px] h-1.5 w-1.5 rounded-full ${eyeClass}`} />
          <span className={`absolute right-[13px] top-[17px] h-1.5 w-1.5 rounded-full ${eyeClass}`} />
        </>
      )}
      <span className={`absolute left-1/2 h-2.5 w-4 -translate-x-1/2 border-current ${mouthClass}`} />
    </div>
  );
}

function JourneyRow({
  variant,
}: {
  variant: "drawgle" | "generic";
}) {
  const isDrawgle = variant === "drawgle";
  const journey = isDrawgle ? drawgleJourney : genericJourney;

  return (
    <div
      className={`relative grid grid-cols-4 overflow-hidden rounded-[22px] border ${
        isDrawgle
          ? "border-[#1b7fcc]/45 bg-[linear-gradient(135deg,rgba(27,127,204,0.08),rgba(255,255,255,0.85),rgba(249,115,22,0.06))] shadow-[0_18px_50px_rgba(27,127,204,0.08)]"
          : "border-gray-200 bg-gray-100/65"
      }`}
    >
      <svg
        className="pointer-events-none absolute inset-x-[9%] top-[35px] z-0 h-12 w-[82%] overflow-visible md:top-[43px]"
        viewBox="0 0 800 48"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={isDrawgle ? "M0 38 C180 38 250 25 400 24 C565 23 630 8 800 8" : "M0 12 C180 12 250 32 400 24 C565 15 630 40 800 38"}
          fill="none"
          stroke={isDrawgle ? "#93C5FD" : "#B7BBC3"}
          strokeDasharray="2 7"
          strokeLinecap="round"
          strokeWidth="2"
        />
        {isDrawgle && (
          <motion.path
            d="M0 38 C180 38 250 25 400 24 C565 23 630 8 800 8"
            fill="none"
            stroke="url(#drawgle-flow)"
            strokeLinecap="round"
            strokeWidth="2.5"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        )}
        <defs>
          <linearGradient id="drawgle-flow" x1="0" x2="800">
            <stop stopColor="#1B7FCC" />
            <stop offset="1" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>

      {journey.map((item, index) => (
        <div
          key={item.title}
          className={`relative flex min-w-0 flex-col items-center px-2 py-5 text-center md:px-5 md:py-7 ${
            index > 0 ? "border-l border-gray-200/70" : ""
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.12, duration: 0.35 }}
            className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-sm md:h-14 md:w-14 ${
              isDrawgle
                ? index === journey.length - 1
                  ? "border-orange-300 text-orange-500"
                  : "border-blue-300 text-[#1b7fcc]"
                : "border-gray-300 text-gray-500"
            }`}
          >
            <Face mood={item.mood} active={isDrawgle} />
          </motion.div>
          <p className={`relative z-10 mt-5 px-1 text-[11px] font-bold leading-tight md:text-sm ${isDrawgle ? "text-gray-900" : "text-gray-600"}`}>
            {item.title}
          </p>
          <p className="mt-1 hidden max-w-[150px] text-[11px] leading-snug text-gray-500 sm:block md:text-xs">
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function MethodComparison() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1060px]">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
            <Figma className="h-3.5 w-3.5" />
            The Drawgle difference
          </div>
          <h2 className="font-pixel-square text-[34px] font-semibold leading-[1.08] tracking-tight text-black sm:text-5xl md:text-6xl">
            Keep the design momentum
            <span className="block text-[#1b7fcc]">all the way to production</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg">
            Generic AI gets less useful with every revision. Drawgle turns each refinement into a stronger, more consistent product.
          </p>
        </div>

        <div className="mx-auto">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1b7fcc] md:text-base">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1b7fcc] text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              Building with Drawgle
            </div>
            <span className="hidden text-xs font-bold text-orange-500 sm:block">More refined at every step</span>
          </div>

          <JourneyRow variant="drawgle" />

          <div className="grid grid-cols-4 px-1 py-3">
            {stages.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-gray-500 sm:text-xs md:text-sm">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>

          <JourneyRow variant="generic" />

          <div className="mt-3 flex items-center gap-2 px-1 text-sm font-bold text-gray-500 md:text-base">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-white">
              <X className="h-3 w-3" strokeWidth={3} />
            </span>
            Building with generic AI
          </div>
        </div>
      </div>
    </section>
  );
}
