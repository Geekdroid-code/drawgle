"use client";

import Link from "next/link";
import {
  ImageIcon,
  MessageSquareText,
  MousePointer2,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const possibilities = [
  {
    icon: MessageSquareText,
    title: "Describe it. Drawgle designs it.",
    description:
      "Start with a simple sentence about your app, audience, or idea. Drawgle turns it into a polished mobile UI with thoughtful hierarchy and visual direction.",
    detail: "From rough idea to premium screen",
  },
  {
    icon: ImageIcon,
    title: "Use any image as inspiration.",
    description:
      "Bring a screenshot, mood board, or interface you admire. Drawgle understands the visual qualities you like and transforms them into something original.",
    detail: "Reference in, original design out",
  },
  {
    icon: Palette,
    title: "Start from a curated design style.",
    description:
      "Choose a carefully considered visual direction when you need inspiration, then customize it until the result feels completely at home in your product.",
    detail: "Direction without template limitations",
  },
  {
    icon: MousePointer2,
    title: "Keep refining until it feels right.",
    description:
      "Select any part of the interface and describe the change. Improve the details without losing the screen, structure, or design language around it.",
    detail: "Focused edits without starting over",
  },
];

export default function PrivacySection() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F3] px-4 py-20 sm:py-24 md:px-6 md:py-28">
      <div className="relative mx-auto max-w-[1060px]">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
            <Sparkles className="h-3.5 w-3.5" />
            What you can do with Drawgle
          </div>
          <h2 className="font-pixel-square text-[34px] font-semibold leading-[1.08] tracking-tight text-black sm:text-5xl md:text-6xl">
            Bring whatever you have.
            <span className="block text-[#1b7fcc]">Leave with a UI worth shipping.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg">
            You do not need design expertise or a perfect brief. Drawgle helps you find the right
            visual direction, then gives you the control to make it yours.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {possibilities.map(({ icon: Icon, title, description, detail }) => (
            <article
              key={title}
              className="flex h-full flex-col rounded-[26px] border border-gray-200/70 bg-[#F7F5F3] p-2 shadow-[0_12px_50px_-22px_rgba(0,0,0,0.14)]"
            >
              <div className="flex flex-1 flex-col rounded-[20px] bg-white p-6 sm:p-8">
                <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#1b7fcc]/15 bg-[#1b7fcc]/[0.06] text-[#1b7fcc] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <h3 className="font-pixel-square max-w-md text-xl font-semibold leading-tight tracking-normal text-gray-900 sm:text-2xl">
                  {title}
                </h3>
                <p className="mt-4 max-w-md text-sm leading-6 text-gray-500 sm:text-[15px]">
                  {description}
                </p>
              </div>
              <div className="flex items-center gap-3 px-5 py-4 text-xs font-semibold text-gray-500 sm:px-6">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc]" />
                {detail}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center md:mt-16">
          <p className="mx-auto mb-6 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
            Start with a prompt, a reference, or simply an idea you cannot stop thinking about.
          </p>
          <Link href="/project/new" className="inline-block">
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
