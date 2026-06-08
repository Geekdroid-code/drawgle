"use client";

import Link from "next/link";
import { GitFork, Shuffle } from "lucide-react";
import { getStylePresetSlug, getTemplateSlug, showcaseCollections } from "@/lib/showcase";
import { VirtualizedScreen } from "./VirtualizedScreen";

export function ShowcaseGallery() {
  return (
    <>
      <nav aria-label="Showcase collections" className="mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-2">
        {showcaseCollections.map((collection) => (
          <a
            key={collection.id}
            href={`#${collection.id}`}
            className="rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-[11px] font-semibold text-black/55 transition-colors hover:border-black/15 hover:text-black"
          >
            {collection.name}
          </a>
        ))}
      </nav>

      <div className="mx-auto mt-14 grid max-w-[1320px] gap-5 sm:mt-20 lg:grid-cols-2 lg:gap-6">
        {showcaseCollections.map((collection) => (
          <section
            id={collection.id}
            key={collection.id}
            className="group scroll-mt-24 overflow-hidden rounded-[22px] border border-black/[0.09] bg-white transition-colors hover:border-black/[0.15] sm:rounded-[26px]"
          >
            <div className="flex min-h-[152px] flex-col justify-between gap-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#1b7fcc]">
                  Collection {collection.index}
                  </div>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-black sm:text-2xl">
                    {collection.name}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/templates/${getTemplateSlug(collection)}/start`}
                    title="Create an exact editable copy"
                    aria-label={`Fork ${collection.name}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.12] bg-white px-3 text-xs font-semibold text-black/70 transition-colors hover:border-black/25 hover:text-black"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    Fork
                  </Link>
                  <Link
                    href={`/project/new?style=${getStylePresetSlug(collection)}`}
                    title="Use this visual style for your own brief"
                    aria-label={`Remix the ${collection.name} visual style`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#1b7fcc]/25 bg-[#1b7fcc]/[0.06] px-3 text-xs font-semibold text-[#1b7fcc] transition-colors hover:border-[#1b7fcc]/45 hover:bg-[#1b7fcc]/[0.1]"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Remix
                  </Link>
                </div>
              </div>

              <p className="max-w-[520px] text-xs leading-5 text-black/45 sm:text-[13px]">
                {collection.description}
              </p>
            </div>

            <div
              data-nosnippet
              className={`grid items-start gap-2 border-t border-black/[0.07] bg-[radial-gradient(circle_at_50%_0%,rgba(27,127,204,0.045),transparent_52%)] px-3 pb-5 pt-4 sm:gap-3 sm:px-5 sm:pb-6 sm:pt-5 ${
                collection.screens.length === 2 ? "grid-cols-2 px-[17%] sm:px-[20%]" : "grid-cols-3"
              }`}
            >
              {collection.screens.map((screen) => (
                <VirtualizedScreen
                  key={screen.src}
                  collectionName={collection.name}
                  screen={screen}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
