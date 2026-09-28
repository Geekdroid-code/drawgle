"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, GitFork, Shuffle } from "lucide-react";

import { MkButton } from "@/components/marketing/MkButton";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { ShowcasePhone } from "@/components/marketing/motion/devices";
import { EASE, usePlayback } from "@/components/marketing/motion/hooks";
import {
  curatedShowcaseScreenCount,
  getStylePresetSlug,
  getTemplateSlug,
  showcaseCollections,
  type ShowcaseCollection,
} from "@/lib/showcase";
import { cn } from "@/lib/utils";

const featuredIds = ["neo-mint", "minimal-habit-premium", "food-delivery", "midnight-bakery", "running-tracker", "neobank"];
const featured = featuredIds
  .map((id) => showcaseCollections.find((collection) => collection.id === id))
  .filter((collection): collection is ShowcaseCollection => Boolean(collection));

const CYCLE_MS = 5200;
const USER_HOLD_MS = 14000;

const phonePose = [
  { x: "-78%", y: 34, rotate: -5, scale: 0.86, z: 1 },
  { x: "0%", y: 0, rotate: 0, scale: 1, z: 3 },
  { x: "78%", y: 34, rotate: 5, scale: 0.86, z: 2 },
];

/** Three screens of one collection: the first screen centered, the others tucked behind it. */
function Stage({ collection }: { collection: ShowcaseCollection }) {
  const slots = [collection.screens[1], collection.screens[0], collection.screens[2]];

  return (
    <div className="relative mx-auto aspect-[1.18] w-full max-w-[640px]">
      <AnimatePresence initial={false}>
        {phonePose.map((pose, slot) => {
          const screen = slots[slot];
          if (!screen) return null;
          return (
            <motion.div
              key={`${collection.id}-${slot}`}
              initial={{ opacity: 0, x: pose.x, y: pose.y + 60, rotate: pose.rotate, scale: pose.scale * 0.96 }}
              animate={{ opacity: 1, x: pose.x, y: pose.y, rotate: pose.rotate, scale: pose.scale }}
              exit={{ opacity: 0, x: pose.x, y: pose.y - 30, scale: pose.scale * 0.98, transition: { duration: 0.35, ease: EASE } }}
              transition={{ duration: 0.8, delay: slot === 1 ? 0.05 : 0.16, ease: EASE }}
              className="absolute left-[35%] top-[4%] w-[30%]"
              style={{ zIndex: pose.z }}
            >
              <ShowcasePhone>
                <div className="relative aspect-[390/844]">
                  <Image
                    src={screen.screenshot}
                    alt={`${collection.name} ${screen.label} screen designed with Drawgle`}
                    fill
                    sizes="(max-width: 768px) 32vw, 210px"
                    className="object-cover"
                  />
                </div>
              </ShowcasePhone>
              <div className="mt-3 text-center text-[11px] font-semibold text-neutral-500 sm:text-xs">{screen.label}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function MarqueeRow({ screens, reverse = false, duration }: { screens: string[]; reverse?: boolean; duration: number }) {
  return (
    <div className="mk-mask-x overflow-hidden">
      <div
        className={cn("mk-marquee-x flex w-max gap-3 sm:gap-4", reverse && "mk-marquee-reverse")}
        style={{ "--mk-marquee-duration": `${duration}s` } as CSSProperties}
      >
        {[...screens, ...screens].map((src, index) => (
          <div
            key={`${src}-${index}`}
            className="relative aspect-[390/844] w-[104px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.07] sm:w-[128px] sm:rounded-[20px]"
          >
            <Image src={src} alt="" fill sizes="128px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

const allScreens = showcaseCollections.flatMap((collection) => collection.screens.map((screen) => screen.screenshot));
const rowA = allScreens.filter((_, index) => index % 2 === 0);
const rowB = allScreens.filter((_, index) => index % 2 === 1);

export function Showcase() {
  const rootRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const { playing: marqueePlaying } = usePlayback(marqueeRef, 0);
  const [active, setActive] = useState(0);
  // A pick holds longer than an automatic turn; `turn` restarts the timer even on the same card.
  const [cycle, setCycle] = useState({ turn: 0, ms: CYCLE_MS });
  const { playing, reduced } = usePlayback(rootRef, 0.35);
  const collection = featured[active];
  const accent = collection.palette[2] ?? "#305dde";

  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => {
      setActive((current) => (current + 1) % featured.length);
      setCycle((current) => ({ turn: current.turn + 1, ms: CYCLE_MS }));
    }, cycle.ms);
    return () => window.clearTimeout(timeout);
  }, [cycle, playing]);

  const choose = useCallback((index: number) => {
    setActive(index);
    setCycle((current) => ({ turn: current.turn + 1, ms: USER_HOLD_MS }));
  }, []);

  return (
    <section id="showcase" className="relative scroll-mt-24 overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          kicker="Showcase"
          lead="Don't start from scratch."
          emphasis="Fork a flow or remix its style."
          breakBeforeEmphasis
          description="Fork a showcase project to reuse its screen layouts, or remix only its colors, typography, radii, and shadows as the starting design system for your own app."
        />

        <Reveal y={30}>
          <div ref={rootRef} className="mk-surface relative overflow-hidden rounded-[36px] p-5 sm:p-8 lg:p-10">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-[520px] rounded-full blur-3xl"
              animate={{ backgroundColor: accent, opacity: 0.16 }}
              transition={{ duration: 1.2, ease: EASE }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full blur-3xl"
              animate={{ backgroundColor: collection.palette[3] ?? accent, opacity: 0.1 }}
              transition={{ duration: 1.2, ease: EASE }}
            />

            <div className="relative grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="order-2 min-w-0 lg:order-1 lg:col-span-5">
                <div className="mk-hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-0">
                  {featured.map((item, index) => {
                    const isActive = index === active;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => choose(index)}
                        aria-pressed={isActive}
                        className={cn(
                          "group relative shrink-0 rounded-[20px] px-4 py-3 text-left transition-all duration-300 lg:w-full",
                          isActive ? "bg-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.45)]" : "hover:bg-white/60",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] text-neutral-400">{item.index}</span>
                          <span className={cn("text-[15px] font-semibold tracking-tight transition-colors", isActive ? "text-mk-ink" : "text-neutral-500")}>
                            {item.name}
                          </span>
                          <span className="ml-auto hidden items-center -space-x-1 sm:flex">
                            {item.palette.map((color) => (
                              <span key={color} className="size-3.5 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                        </div>
                        <AnimatePresence initial={false}>
                          {isActive ? (
                            <motion.div
                              key="details"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.35, ease: EASE }}
                              className="hidden overflow-hidden lg:block"
                            >
                              <p className="pl-[34px] pt-2 text-[13px] leading-relaxed text-neutral-500">{item.description}</p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                        {isActive && playing && !reduced ? (
                          <span aria-hidden="true" className="absolute inset-x-4 bottom-1 hidden h-[2px] overflow-hidden rounded-full bg-black/[0.05] lg:block">
                            <span
                              key={cycle.turn}
                              className="block h-full origin-left rounded-full bg-mk-accent"
                              style={{ animation: `mk-feature-progress ${cycle.ms}ms linear forwards` }}
                            />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2.5 lg:mt-8">
                  <MkButton
                    href={`/templates/${getTemplateSlug(collection)}/start`}
                    size="sm"
                    icon={false}
                    className="gap-1.5"
                    leading={<GitFork className="size-3.5" />}
                  >
                    Fork {collection.name}
                  </MkButton>
                  <MkButton
                    href={`/project/new?style=${getStylePresetSlug(collection)}`}
                    variant="secondary"
                    size="sm"
                    leading={<Shuffle className="size-3.5" />}
                  >
                    Remix its style
                  </MkButton>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  <strong className="font-semibold text-neutral-700">Fork</strong> copies the editable screens.{" "}
                  <strong className="font-semibold text-neutral-700">Remix</strong> starts your own brief with its design system.
                </p>
              </div>

              <div className="order-1 min-w-0 lg:order-2 lg:col-span-7">
                <Stage collection={collection} />
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <div
        ref={marqueeRef}
        aria-hidden="true"
        className={cn("mk-marquee-pause mt-12 space-y-3 sm:mt-16 sm:space-y-4", !marqueePlaying && "mk-marquee-paused")}
      >
        <MarqueeRow screens={rowA} duration={90} />
        <MarqueeRow screens={rowB} duration={100} reverse />
      </div>

      <div className="mt-10 flex justify-center px-4">
        <Link href="/showcase" className="group inline-flex items-center gap-2 text-sm font-semibold text-mk-ink transition-opacity hover:opacity-70">
          Explore all {showcaseCollections.length} collections · {curatedShowcaseScreenCount} live screens
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
