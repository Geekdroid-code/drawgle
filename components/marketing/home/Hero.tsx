"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Play, Star } from "lucide-react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { DitherField, WIDE_FIELDS } from "@/components/marketing/motion/DitherField";
import { EASE } from "@/components/marketing/motion/hooks";
import { DemoFilm, PLAY_DEMO_EVENT } from "./DemoFilm";
import { HeroPrompt } from "./HeroPrompt";

const builders = [
  { src: "/content/sachin.webp", alt: "Sachin, indie hacker" },
  { src: "/content/sumesh.webp", alt: "Sumesh, product designer" },
  { src: "/content/manoj.jpg", alt: "Manoj, indie app builder" },
  { src: "/content/vishnu.webp", alt: "Vishnu, iOS engineer" },
];

// Keeps the whole content column clean on larger screens; the dither lives in the margins.
const WIDE_QUIET_ZONE = { y: 0.42, height: 0.34, width: 0.3, depth: 0.97 };

function rise(delay: number, y = 18) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, delay, ease: EASE },
  };
}

/** The film rises from a slight recline to flat as it scrolls into view. */
function FilmReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.25"] });
  // A gentle recline that settles flat; kept small so it reads as depth, not a flip.
  const rotateX = useTransform(scrollYProgress, [0, 1], [9, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  return (
    <div ref={ref} style={{ perspective: 1800 }}>
      <motion.div style={reduced ? undefined : { rotateX, scale, transformOrigin: "50% 100%" }}>{children}</motion.div>
    </div>
  );
}

export function Hero() {
  const watchDemo = () => {
    document.getElementById("demo-player")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new Event(PLAY_DEMO_EVENT));
  };

  return (
    <section className="relative overflow-hidden bg-white pb-16 pt-28 sm:pt-32 md:pb-24 md:pt-36">
      {/* A drifting dither field that keeps to the edges; on larger screens it also follows the cursor. */}
      <DitherField className="absolute inset-x-0 top-0 h-[1080px] opacity-[0.42] [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] md:hidden" />
      <DitherField
        fields={WIDE_FIELDS}
        quietZone={WIDE_QUIET_ZONE}
        density={0.6}
        className="absolute inset-x-0 top-0 hidden h-[1080px] opacity-[0.4] [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] md:block"
      />

      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <div className="mx-auto max-w-[860px]">
          <motion.a
            {...rise(0, 15)}
            href="#how-it-works"
            className="mk-glass group mb-6 inline-flex max-w-full select-none items-center gap-2 rounded-full border border-black/[0.06] py-1 pl-1 pr-3 text-xs font-semibold text-mk-ink sm:mb-7"
          >
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.05]">
              <DrawgleLogo className="size-3 text-mk-accent" />
              AI Mobile App UI Designer
            </span>
            <span className="hidden truncate text-neutral-600 sm:inline">Hands off to Claude Code, Cursor &amp; Codex</span>
            <ArrowRight className="size-3.5 shrink-0 text-mk-accent transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <motion.h1
            {...rise(0.1, 22)}
            className="mx-auto mb-5 max-w-4xl text-[28px] font-medium leading-[1.1] tracking-[-0.025em] text-mk-heading sm:text-[52px] md:text-[62px] md:leading-[66px]"
          >
            Design premium Mobile UIs <br />
            <span className="font-semibold text-mk-accent">at the speed of thought</span>
          </motion.h1>

          <motion.p
            {...rise(0.2)}
            className="mx-auto mb-9 max-w-3xl text-base font-normal leading-relaxed text-mk-body sm:mb-10 sm:text-[18px] md:leading-[28px]"
          >
            Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to
            the coding tools already inside your repository.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.25, ease: EASE }}
            className="relative mx-auto w-full max-w-[860px]"
          >
            <HeroPrompt />
          </motion.div>

          <motion.div
            {...rise(0.4, 12)}
            className="mt-9 inline-flex select-none flex-col items-center justify-center gap-4 sm:mt-10 sm:flex-row sm:gap-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2 p-0.5">
                {builders.map((builder) => (
                  <Image
                    key={builder.src}
                    src={builder.src}
                    alt={builder.alt}
                    width={28}
                    height={28}
                    className="size-7 rounded-full border-2 border-white object-cover"
                  />
                ))}
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-mk-ink text-[9px] font-bold text-white">
                  15+
                </div>
              </div>
              <div className="text-left">
                <div className="flex text-amber-400" aria-label="Rated five stars by early builders">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} className="size-3.5 fill-amber-400 stroke-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-semibold tracking-tight text-neutral-500">
                  Starting at <strong className="font-bold text-neutral-900">$9 ONLY</strong>
                </span>
              </div>
            </div>

            <span className="hidden h-8 w-px bg-black/10 sm:block" aria-hidden="true" />

            <button type="button" onClick={watchDemo} className="group inline-flex items-center gap-2.5 text-sm font-semibold text-mk-ink">
              <span className="flex size-8 items-center justify-center rounded-full bg-mk-ink text-white shadow-[0_8px_20px_-8px_rgba(20,20,20,0.6)] transition-transform group-hover:scale-105">
                <Play className="ml-0.5 size-3.5 fill-current" />
              </span>
              Watch the 58-second film
            </button>

          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          className="relative mx-auto mt-12 max-w-5xl sm:mt-14"
        >
          <FilmReveal>
            <DemoFilm />
          </FilmReveal>
        </motion.div>
      </div>
    </section>
  );
}
