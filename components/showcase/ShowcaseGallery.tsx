"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { showcaseCollections } from "@/lib/showcase";
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

      <div className="mx-auto mt-16 max-w-[1240px] space-y-24 sm:mt-24 sm:space-y-32">
        {showcaseCollections.map((collection) => (
          <section
            id={collection.id}
            key={collection.id}
            className="scroll-mt-24 border-t border-black/[0.09] pt-8"
          >
            <div className="mb-8 grid gap-5 sm:mb-12 lg:grid-cols-[1fr_420px] lg:items-end">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1b7fcc]">
                  Collection {collection.index}
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                  {collection.name}
                </h2>
              </div>
              <div>
                <p className="text-sm leading-6 text-black/45 sm:text-base">{collection.description}</p>
                <Link
                  href={`/project/new?prompt=${encodeURIComponent(collection.prompt)}`}
                  className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1b7fcc]"
                >
                  Start with this direction
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            <div
              data-nosnippet
              className={`grid gap-4 sm:gap-6 ${
                collection.screens.length === 2
                  ? "mx-auto max-w-[760px] grid-cols-2"
                  : "grid-cols-3"
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
