"use client";

import Image from "next/image";
import Link from "next/link";
import { Quote, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  signal: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "bro i literally just screenshot a design i liked on twitter, uploaded it, and got clean tailwind code in like 40 seconds. usually i spend 3 hours crying over flexbox alignment. this is a cheat code.",
    name: "Sachin Singh",
    role: "Indie hacker, FitTrack",
    avatar: "/content/sachin.webp",
    signal: "screenshot to tailwind",
  },
  {
    quote:
      "so clean. normal ai code generators write absolute spaghetti code that breaks if you touch it. with this i just edited the primary color token and it synced across all pages. actually works.",
    name: "Mariah Edwards",
    role: "Lead iOS engineer",
    avatar: "/content/vishnu.webp",
    signal: "token syncing",
  },
  {
    quote:
      "did a client call yesterday, they wanted to change a button radius and background. usually that's a figma back and forth, but i just clicked the element on the canvas, tweaked the radius visually, and boom. approved.",
    name: "Sumesh",
    role: "Founder, AppCraft Studio",
    avatar: "/content/sumesh.webp",
    signal: "live canvas editing",
  },
  {
    quote:
      "i write good backend code but my designs always look like garbage from 2005. first time my project actually looks like a premium SaaS and i didn't have to hire a freelancer.",
    name: "Alex Rivera",
    role: "Full-stack bootstrapper",
    avatar: "/content/emma-thopmson.jpg",
    signal: "designs look premium",
  },
  {
    quote:
      "the fact that i can select a single button, type 'make this stand out more' and it only edits that button instead of regenerating the entire page and ruining my design is just huge.",
    name: "Manoj",
    role: "Indie app builder",
    avatar: "/content/manoj.jpg",
    signal: "point-and-click edits",
  },
  {
    quote:
      "shipped the nextjs code straight to production today. zero inline styling garbage or weird nested div soup. just plain, simple tailwind classes.",
    name: "Shrey Singh",
    role: "Product lead, EcoStep",
    avatar: "/content/sachin.webp",
    signal: "clean tailwind export",
  },
];

const scaleTicks = Array.from({ length: 9 }, (_, index) => index * 100);

function SignalRuler({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 top-0 hidden w-12 xl:block ${
        side === "left" ? "-left-16" : "-right-16"
      }`}
    >
      <div
        className={`absolute bottom-0 top-0 w-px ${
          side === "left" ? "right-0" : "left-0"
        } bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.11)_18%,rgba(255,255,255,0.11)_82%,transparent)]`}
      />
      {scaleTicks.map((tick, index) => (
        <div
          key={tick}
          className={`absolute flex -translate-y-1/2 items-center gap-2 ${
            side === "left" ? "right-0" : "left-0 flex-row-reverse"
          }`}
          style={{ top: `${10 + index * 10}%` }}
        >
          <span className={`h-px bg-white/15 ${index % 2 === 0 ? "w-2.5" : "w-1.5"}`} />
          {index % 2 === 0 && (
            <span className="[writing-mode:vertical-rl] font-mono text-[8px] text-white/20">
              {tick}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Builder({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
        <Image src={testimonial.avatar} alt="" fill sizes="36px" className="object-cover" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{testimonial.name}</div>
        <div className="truncate text-xs text-white/35">{testimonial.role}</div>
      </div>
    </div>
  );
}

export default function TestimonialSection() {
  const [featured, ...supporting] = testimonials;

  return (
    <section className="relative overflow-hidden bg-[#111111] px-4 pb-16 pt-24 md:px-6 md:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.045),transparent_66%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <SignalRuler side="left" />
        <SignalRuler side="right" />

        <div className="relative mb-12 flex items-center gap-4 md:mb-16">
          <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12))] md:block" />
          <div className="flex h-8 items-center gap-2 rounded-[9px] border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
            <Sparkles className="h-3.5 w-3.5 text-[#1b7fcc]" />
            Builder signals
          </div>
          <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.12),transparent)] md:block" />
        </div>

        <div className="mx-auto mb-14 max-w-3xl text-left sm:text-center md:mb-20">
          <h2 className="font-pixel-square text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            Built for people who care
            <span className="block text-[#1b7fcc]">how the product actually feels.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            Designers and builders use Drawgle to move faster without surrendering control of the
            system behind their interface.
          </p>
        </div>

        <div className="relative border-y border-white/[0.08]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-[38%] top-0 hidden w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.1)_12%,rgba(255,255,255,0.1)_88%,transparent)] lg:block"
          />

          <div className="grid lg:grid-cols-[0.62fr_1fr]">
            <article className="relative flex min-h-[360px] flex-col justify-between border-b border-white/[0.08] py-8 lg:min-h-[610px] lg:border-b-0 lg:py-12 lg:pr-12">
              <div>
                <Quote className="h-7 w-7 text-white/28" strokeWidth={1.5} />
                <blockquote className="mt-8 text-balance text-2xl font-medium leading-[1.35] tracking-tight text-white sm:text-3xl lg:text-[34px]">
                  “{featured.quote}”
                </blockquote>
              </div>
              <div className="mt-10 flex items-end justify-between gap-5">
                <Builder testimonial={featured} />
                <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-white/25 sm:block">
                  Signal / 01
                </span>
              </div>
            </article>

            <div className="lg:pl-12">
              {supporting.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`group grid gap-5 py-7 sm:grid-cols-[150px_1fr] sm:items-start ${
                    index < supporting.length - 1 ? "border-b border-white/[0.075]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 sm:block">
                    <Builder testimonial={testimonial} />
                    <div className="mt-4 hidden items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/24 sm:flex">
                      <span className="h-1 w-1 bg-white/35" />
                      {testimonial.signal}
                    </div>
                  </div>
                  <blockquote className="text-sm leading-6 text-white/48 transition-colors group-hover:text-white/65 sm:text-[15px]">
                    “{testimonial.quote}”
                  </blockquote>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 border-b border-white/[0.08] py-7 sm:flex-row sm:justify-between">
          <div className="grid w-full grid-cols-1 gap-2.5 text-[11px] text-white/32 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <span className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="h-1 w-1 bg-white/35" />
              Editable design output
            </span>
            <span className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="h-1 w-1 bg-white/35" />
              Native framework export
            </span>
            <span className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="h-1 w-1 bg-white/35" />
              System-level control
            </span>
          </div>
          <Link href="/project/new" className="mx-auto shrink-0 sm:mx-0">
            <Button className="group relative cursor-pointer overflow-hidden rounded-md border border-[#1b7fcc]/40 bg-[#1b7fcc] py-5 pr-12 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_3px_rgba(0,0,0,0.28)] hover:bg-[#1975bd] sm:py-6">
              <span className="sm:px-2">Design Your UI</span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm bg-white p-2 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.12)] sm:p-3">
                <img
                  src="/arrow.svg"
                  alt=""
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
