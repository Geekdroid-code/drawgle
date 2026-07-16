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
    title: "Plan connected mobile screen flows",
    description:
      "Describe the product in plain English. Drawgle plans the screen structure, shared navigation, and product context before building the initial mobile views.",
    detail: "Product brief, screen plan, and navigation model",
  },
  {
    icon: ImageIcon,
    title: "Rebuild screenshots as editable UI",
    description:
      "Use an uploaded screenshot as structural evidence, or use a visual reference only for typography, surfaces, spacing, and material direction.",
    detail: "Screenshot reconstruction and style references",
  },
  {
    icon: Palette,
    title: "Map design tokens across every screen",
    description:
      "Adjust shared colors, typography, spacing, radii, shadows, and mobile layout tokens from one design-system source of truth.",
    detail: "Shared token map and CSS variables",
  },
  {
    icon: MousePointer2,
    title: "Refine selected component styling",
    description:
      "Select a card, button, section, image, or navigation element and make a scoped change without replacing the surrounding screen.",
    detail: "Targeted canvas edits and image replacement",
  },
];

export default function HookSection() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F3] px-4 py-20 sm:py-24 md:px-6 md:py-28">
      <div className="relative mx-auto max-w-[1060px]">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1b7fcc]">
            <Sparkles className="h-3.5 w-3.5" />
            How Drawgle works
          </div>
          <h2 className="font-pixel-square text-[34px] font-semibold leading-[1.0] tracking-tight text-black sm:text-5xl md:text-6xl">
            How an AI mobile app UI designer
            <span className="block text-[#1b7fcc] mt-2">
               creates a coherent product.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg">
            Drawgle combines product planning, structured component construction, design-token
            mapping, mobile layout spacing, and targeted editing so generated screens remain
            consistent and editable after the first result.
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
              <span className="sm:px-2">Design Your UI</span>
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
