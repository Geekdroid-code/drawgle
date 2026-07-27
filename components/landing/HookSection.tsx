"use client";

import Link from "next/link";
import Image from "next/image";
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
    title: "Describe the app and screen flow",
    description:
      "Describe the product in plain English. Drawgle plans the screen structure, shared navigation, and product context before building the initial mobile views.",
    detail: "Product brief, screen plan, and navigation model",
  },
  {
    icon: ImageIcon,
    title: "Rebuild screenshots as editable UI",
    description:
      "Use an uploaded screenshot as structural evidence, or use a visual reference only for typography, surfaces, spacing, and material direction.",
    detail: "Prompt, screenshot, or reference",
  },
  {
    icon: Palette,
    title: "Build with one shared design system",
    description:
      "Keep colors, typography, spacing, radius, shadows, and navigation connected across every generated screen.",
    detail: "Shared token map and CSS variables",
  },
  {
    icon: MousePointer2,
    title: "Refine the Design and export",
    description:
      "Edit a selected element without regenerating the full screen, then export HTML and an Agent Pack for development.",
    detail: "Selected edits and developer export",
  },
];

export default function HookSection() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F3] px-4 py-20 sm:py-24 md:px-6 md:py-28">
      <div className="relative mx-auto max-w-[1060px]">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase  text-[#1b7fcc]">
            Idea to UI in seconds
          </div>
          <h2 className="font-pixel-square text-[34px] font-semibold leading-[1.0] tracking-tight text-black sm:text-5xl md:text-6xl">
            How Drawgle Mobile App
            <span className="block text-[#1b7fcc] mt-2">
              UI Designer Works
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg">
            Start from a prompt, screenshot, or style reference. Drawgle plans the screen flow, builds structured UI, keeps shared design tokens in sync, and lets you refine one element without regenerating the entire screen.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {possibilities.map(({ icon: Icon, title, description, detail }) => (
            <article
              key={title}
              className="flex h-full flex-col rounded-[26px] border border-gray-200/70 bg-[#F7F5F3] p-2 shadow-[0_12px_50px_-22px_rgba(0,0,0,0.14)] transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_22px_55px_-18px_rgba(27,127,204,0.16)] hover:border-[#1b7fcc]/30"
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
              <span className="sm:px-2">Design Your UI Now</span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm bg-white p-2 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.12)] sm:p-3">
                <Image
                  src="/arrow.svg"
                  alt=""
                  width={16}
                  height={16}
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
