"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";

import { Kicker, Reveal } from "@/components/marketing/Reveal";

const lead = "Translating design ideas into production-ready mobile apps is slow and fragmented.";
const emphasis = "Drawgle turns natural prompts into editable mobile UI your coding agent can build from.";

type WordToken = { text: string; strong: boolean };

const words: WordToken[] = [
  ...lead.split(" ").map((text) => ({ text, strong: false })),
  ...emphasis.split(" ").map((text) => ({ text, strong: true })),
];

function Word({ word, index, total, progress }: { word: WordToken; index: number; total: number; progress: MotionValue<number> }) {
  const start = index / total;
  const opacity = useTransform(progress, [start, Math.min(1, start + 1.6 / total)], [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className={word.strong ? "font-semibold text-mk-ink" : undefined}>
      {word.text}{" "}
    </motion.span>
  );
}

/** The problem statement, lit word by word as it scrolls through the viewport. */
export function Challenge() {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.5"] });

  return (
    <section className="bg-white py-16 text-center sm:py-20 md:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal y={15}>
          <Kicker className="mb-5">The challenge</Kicker>
        </Reveal>
        <h2
          ref={ref}
          className="mx-auto max-w-3xl text-2xl font-normal leading-[1.3] tracking-[-0.02em] text-mk-body sm:text-3xl md:text-4xl lg:text-[40px]"
        >
          {reduced
            ? words.map((word, index) => (
                <span key={index} className={word.strong ? "font-semibold text-mk-ink" : undefined}>
                  {word.text}{" "}
                </span>
              ))
            : words.map((word, index) => <Word key={index} word={word} index={index} total={words.length} progress={scrollYProgress} />)}
        </h2>
      </div>
    </section>
  );
}
