"use client";

import { GitFork, Shuffle } from "lucide-react";

import { MkButton } from "@/components/marketing/MkButton";
import { getStylePresetSlug, getTemplateSlug, showcaseCollections } from "@/lib/showcase";
import { cn } from "@/lib/utils";
import { VirtualizedScreen } from "./VirtualizedScreen";

export function ShowcaseGallery() {
  return (
    <>
      <nav aria-label="Showcase collections" className="mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-2">
        {showcaseCollections.map((collection) => (
          <a
            key={collection.id}
            href={`#${collection.id}`}
            className="mk-surface inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-white hover:text-mk-ink hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.4)]"
          >
            <span className="flex -space-x-1" aria-hidden="true">
              {collection.palette.slice(0, 3).map((color) => (
                <span key={color} className="size-2.5 rounded-full ring-2 ring-[#f3f3f3]" style={{ backgroundColor: color }} />
              ))}
            </span>
            {collection.name}
          </a>
        ))}
      </nav>

      <div className="mx-auto mt-14 grid max-w-[1320px] gap-5 sm:mt-20 lg:grid-cols-2 lg:gap-6">
        {showcaseCollections.map((collection) => (
          <section
            id={collection.id}
            key={collection.id}
            className="mk-surface group relative scroll-mt-28 overflow-hidden rounded-[30px] sm:rounded-[36px]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-[0.14] blur-3xl transition-opacity duration-500 group-hover:opacity-25"
              style={{ backgroundColor: collection.palette[2] ?? collection.palette[0] }}
            />
            <div className="relative flex min-h-[152px] flex-col justify-between gap-5 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] tracking-[0.1em] text-neutral-400">Collection {collection.index}</div>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-mk-ink sm:text-2xl">{collection.name}</h2>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <MkButton
                    href={`/templates/${getTemplateSlug(collection)}/start`}
                    size="sm"
                    icon={false}
                    className="gap-1.5"
                    leading={<GitFork className="size-3.5" />}
                    title="Create an exact editable copy"
                    aria-label={`Fork ${collection.name}`}
                  >
                    Fork
                  </MkButton>
                  <MkButton
                    href={`/project/new?style=${getStylePresetSlug(collection)}`}
                    variant="secondary"
                    size="sm"
                    leading={<Shuffle className="size-3.5" />}
                    title="Use this visual style for your own brief"
                    aria-label={`Remix the ${collection.name} visual style`}
                  >
                    Remix
                  </MkButton>
                </div>
              </div>

              <p className="max-w-[520px] text-[13px] leading-relaxed text-neutral-500">{collection.description}</p>
            </div>

            <div
              data-nosnippet
              className={cn(
                "relative grid items-start gap-2.5 px-4 pb-6 pt-1 sm:gap-4 sm:px-6 sm:pb-7",
                collection.screens.length === 2 ? "grid-cols-2 px-[17%] sm:px-[20%]" : "grid-cols-3",
              )}
            >
              {collection.screens.map((screen) => (
                <VirtualizedScreen key={screen.src} collectionName={collection.name} screen={screen} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
