"use client";

import {
  Check,
  Download,
  ImageIcon,
  LayoutTemplate,
  MessageSquareText,
  MousePointer2,
  Palette,
  Route,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const capabilities = [
  {
    title: "Change one color. Update the whole app",
    description:
      "Adjust a color, font, spacing value, corner radius, or shadow once. Every connected screen updates live without regenerating your work.",
    icon: SlidersHorizontal,
  },
  {
    title: "Click exactly what you want to change",
    description:
      "Select a card, button, section, or navigation item and describe the improvement. Drawgle edits that part while preserving everything around it.",
    icon: MousePointer2,
  },
  {
    title: "Recreate a screenshot into editable UI",
    description:
      "Upload a UI screenshot when you want its layout rebuilt as a real, editable screen instead of receiving a flattened image.",
    icon: ImageIcon,
  },
  {
    title: "Borrow the style, not the product",
    description:
      "Use any interface as visual inspiration. Drawgle carries over its mood, surfaces, typography, and rhythm while designing your own app and features.",
    icon: Palette,
  },
  {
    title: "Design a complete app, not disconnected pages",
    description:
      "Generate multiple screens with shared navigation and one consistent visual language, so dashboards, details, and flows feel like the same product.",
    icon: Route,
  },
  {
    title: "Your app remembers what it is becoming",
    description:
      "Drawgle keeps your audience, goals, features, visual direction, and earlier decisions in context when you add or refine screens later.",
    icon: MessageSquareText,
  },
  {
    title: "Replace images without rebuilding the screen",
    description:
      "Select an image or visual placeholder, upload the right asset, and replace it in place while keeping the surrounding layout intact.",
    icon: ImageIcon,
  },
  {
    title: "Keep the result editable after generation",
    description:
      "The first output is a starting point, not a dead export. Continue adding screens, changing the system, and refining details on the same canvas.",
    icon: Check,
  },
  {
    title: "Export clean, agent-ready code",
    description:
      "Get production-ready Tailwind HTML, CSS variables for design tokens, and implementation context ready to hand off directly to coding agents like Cursor or Copilot.",
    icon: Download,
  },
];

const rulerTicks = Array.from({ length: 15 }, (_, index) => index * 50);

function SideRuler({ side }: { side: "left" | "right" }) {
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
        } bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0.12)_82%,transparent_100%)]`}
      />
      <div
        className={`absolute top-[18%] h-56 w-px ${
          side === "left" ? "right-0" : "left-0"
        } bg-[linear-gradient(180deg,transparent,#1b7fcc,transparent)] opacity-75`}
      />
      {rulerTicks.map((tick, index) => (
        <div
          key={tick}
          className={`absolute flex -translate-y-1/2 items-center gap-2 ${
            side === "left" ? "right-0 flex-row" : "left-0 flex-row-reverse"
          }`}
          style={{ top: `${8 + index * 6}%` }}
        >
          <span className={`h-px bg-white/15 ${index % 2 === 0 ? "w-2.5" : "w-1.5"}`} />
          {index % 2 === 0 && (
            <span className="[writing-mode:vertical-rl] font-mono text-[8px] tracking-[0.08em] text-white/20">
              {tick}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MatrixRails() {
  const tabletRows = ["20%", "40%", "60%", "80%"];
  const desktopRows = ["33.333%", "66.666%"];
  const desktopNodes = [
    ["33.333%", "33.333%"],
    ["66.666%", "33.333%"],
    ["33.333%", "66.666%"],
    ["66.666%", "66.666%"],
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
      <div className="absolute bottom-0 left-1/2 top-0 w-px bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.09)_12%,rgba(255,255,255,0.09)_88%,transparent_100%)] lg:left-1/3" />
      <div className="absolute bottom-0 left-2/3 top-0 hidden w-px bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.09)_12%,rgba(255,255,255,0.09)_88%,transparent_100%)] lg:block" />

      {tabletRows.map((position) => (
        <div
          key={position}
          className="absolute left-0 h-px w-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.09)_12%,rgba(255,255,255,0.09)_88%,transparent_100%)] lg:hidden"
          style={{ top: position }}
        />
      ))}

      {desktopRows.map((position) => (
        <div
          key={position}
          className="absolute left-0 hidden h-px w-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.09)_12%,rgba(255,255,255,0.09)_88%,transparent_100%)] lg:block"
          style={{ top: position }}
        />
      ))}

      {desktopNodes.map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          className="absolute hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#252525] ring-[5px] ring-[#111111] lg:block"
          style={{ left, top }}
        />
      ))}
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-[#111111] px-4 py-24 md:px-6 md:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_68%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <SideRuler side="left" />
        <SideRuler side="right" />

        <div className="relative mb-12 flex items-center gap-4 md:mb-16">
          <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.12)_100%)] md:block" />
          <div className="flex h-8 items-center gap-2 rounded-[9px] border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07)]">
            <Sparkles className="h-3.5 w-3.5" />
            Core Features
          </div>
          <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.12)_0%,transparent_100%)] md:block" />
          <span className="absolute left-0 top-1/2 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#252525] ring-[5px] ring-[#111111] xl:block" />
          <span className="absolute right-0 top-1/2 hidden h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 bg-[#252525] ring-[5px] ring-[#111111] xl:block" />
        </div>

        <div className="mx-auto mb-12 max-w-3xl text-left sm:text-center md:mb-20">
          <h2 className="font-pixel-square text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            Total control.
            <span className="block text-[#1b7fcc] mt-2">Every design feature at your fingertips.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            We built the editor to feel like a real design engineering workspace. Tweak styles, edit
            code structures, sync tokens, and export templates without the bloat.
          </p>
        </div>

        <div className="relative border-y border-white/[0.075]">
          <MatrixRails />

          <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ title, description, icon: Icon }, index) => (
              <article
                key={title}
                className={`group relative flex min-h-[142px] gap-4 border-white/[0.075] px-1 py-6 transition-colors hover:bg-white/[0.016] sm:block sm:min-h-[190px] sm:px-8 sm:py-9 sm:text-center lg:min-h-[210px] ${
                  index < capabilities.length - 1 ? "border-b sm:border-b-0" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.035] text-[#1b7fcc] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.28)] transition-colors group-hover:border-[#1b7fcc]/25 group-hover:bg-[#1b7fcc]/[0.06] sm:mx-auto sm:mb-7">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-pixel-square text-[15px] font-semibold leading-[1.35] tracking-normal text-white sm:text-base">
                    {title}
                  </h3>
                  <p className="mt-2 max-w-[290px] text-sm leading-5 text-white/35 sm:mx-auto">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
