import Image from "next/image";
import { GitFork, Shuffle } from "lucide-react";

import { MkButton } from "@/components/marketing/MkButton";
import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import {
  curatedShowcaseScreenCount,
  getStylePresetSlug,
  getTemplateSlug,
  showcaseCollections,
  type ShowcaseCollection,
} from "@/lib/showcase";
import { cn } from "@/lib/utils";

const featuredIds = ["neo-mint", "minimal-habit-premium", "food-delivery", "midnight-bakery", "running-tracker", "neobank"];
const featured = featuredIds.flatMap((id) => showcaseCollections.find((collection) => collection.id === id) ?? []);

/** Three screens fanned out, emerging from the bottom edge of the card like the How it works devices. */
function ScreenFan({ collection }: { collection: ShowcaseCollection }) {
  const [first, second, third] = collection.screens;
  const phones = [
    {
      key: "left",
      screen: second,
      className: "left-[4%] top-8 z-10 w-[40%] -rotate-[7deg] group-hover:-translate-x-2 group-hover:-rotate-[9deg]",
    },
    {
      key: "right",
      screen: third ?? second,
      className: "right-[4%] top-8 z-10 w-[40%] rotate-[7deg] group-hover:translate-x-2 group-hover:rotate-[9deg]",
    },
    { key: "center", screen: first, className: "left-1/2 top-0 z-20 w-[46%] -translate-x-1/2 group-hover:-translate-y-2" },
  ];

  return (
    // mt-auto pins the fan to the card's bottom edge, so every card crops its phones at the same height.
    <div className="mt-auto pt-8">
      <div className="relative -mb-24 h-[300px] sm:-mb-28">
        {phones.map(({ key, screen, className }) => (
          <div
            key={key}
            className={cn(
              "absolute rounded-[26px] bg-[#e9e9eb] p-[3px] ring-1 ring-black/[0.08] transition-[translate,rotate] duration-500 ease-mk",
              className,
            )}
          >
            <div className="relative aspect-[390/844] overflow-hidden rounded-[23px] bg-white">
              <Image
                src={screen.screenshot}
                alt={`${collection.name} ${screen.label} screen designed with Drawgle`}
                fill
                sizes="(max-width: 768px) 40vw, 150px"
                className="object-cover object-top"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section id="showcase" className="relative scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          kicker="Showcase"
          lead="Don't start from scratch."
          emphasis="Fork a flow or remix its style."
          description="Fork a showcase project to reuse its editable screens, or remix only its colors, typography, radii, and shadows as the starting design system for your own app."
        />

        {/* Phones: a horizontal rail that never scrolls vertically. Larger screens: a grid. */}
        <Reveal y={35}>
          <div className="mk-hide-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-3 lg:gap-7">
            {featured.map((collection) => (
              <article
                key={collection.id}
                className="mk-surface group relative flex w-[84%] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-[30px] p-6 sm:p-7 md:w-auto md:max-w-none"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex -space-x-1" aria-hidden="true">
                    {collection.palette.map((color) => (
                      <span key={color} className="size-3.5 rounded-full ring-2 ring-[#f3f3f3]" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Collection {collection.index}</span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-mk-ink sm:text-[22px]">{collection.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mk-body">{collection.description}</p>

                <div className="relative z-30 mt-5 flex flex-wrap gap-2">
                  <MkButton
                    href={`/templates/${getTemplateSlug(collection)}/start`}
                    size="sm"
                    icon={false}
                    className="gap-1.5"
                    leading={<GitFork className="size-3.5" />}
                    aria-label={`Fork ${collection.name}`}
                  >
                    Fork
                  </MkButton>
                  <MkButton
                    href={`/project/new?style=${getStylePresetSlug(collection)}`}
                    variant="secondary"
                    size="sm"
                    leading={<Shuffle className="size-3.5" />}
                    aria-label={`Remix the ${collection.name} style`}
                  >
                    Remix style
                  </MkButton>
                </div>

                <ScreenFan collection={collection} />
              </article>
            ))}
          </div>
        </Reveal>

        <Reveal y={12} className="mt-10 flex justify-center sm:mt-12">
          <MkButton href="/showcase" variant="secondary">
            Explore all {showcaseCollections.length} collections · {curatedShowcaseScreenCount} live screens
          </MkButton>
        </Reveal>
      </div>
    </section>
  );
}
