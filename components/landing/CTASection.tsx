import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.08] bg-[#080808] text-white">
    

      <div className="relative mx-auto max-w-[1320px] border-x border-white/[0.08]">
        <div className="relative px-5 py-20 text-center sm:px-8 sm:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1b7fcc] to-transparent opacity-90"
          />

          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
              <span className="h-1.5 w-1.5 bg-[#1b7fcc]" />
              Your idea already did the hard part
            </div>

            <h2 className="font-pixel-square text-[40px] font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl md:text-[64px]">
              Stop explaining the app.
              <span className="block text-[#1b7fcc]">Start showing it.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-white/50 sm:text-base sm:leading-7">
              Give Drawgle the rough idea. Get polished, editable mobile UI that is ready to refine,
              share, and build on.
            </p>

            <Link
              href="/project/new"
              className="group relative mt-9 inline-flex min-h-12 items-center justify-center overflow-hidden rounded-md border border-[#5ba8e2]/40 bg-[#1b7fcc] py-3 pl-6 pr-16 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_3px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#1975bd]"
            >
              Design your first screen
              <span className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm bg-white text-[#1b7fcc] shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1)]">
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            <p className="mt-5 text-[11px] font-medium tracking-wide text-white/30">
              No perfect prompt required. Keep refining after generation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
