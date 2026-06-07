"use client";

import {
  Check,
  Code2,
  Compass,
  ImageIcon,
  Layers3,
  MousePointer2,
  Palette,
  Route,
  Send,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
} from "lucide-react";

const capabilities = [
  {
    title: "Live design tokens",
    description: "Tune color, type, spacing, radius, shadow, and opacity across the whole app.",
    icon: SlidersHorizontal,
  },
  {
    title: "Targeted regeneration",
    description: "Select one UI detail and refine it without rebuilding the rest of the screen.",
    icon: MousePointer2,
  },
  {
    title: "Visual references",
    description: "Turn screenshots and inspiration into a reusable visual direction.",
    icon: ImageIcon,
  },
  {
    title: "Persistent project context",
    description: "Keep audience, goals, features, and visual intent guiding every new screen.",
    icon: Compass,
  },
  {
    title: "Multi-screen architecture",
    description: "Create real navigation, persistent tabs, and connected mobile app structures.",
    icon: Route,
  },
  {
    title: "Curated design directions",
    description: "Start from a considered visual language, then reshape it into your own system.",
    icon: Palette,
  },
  {
    title: "Responsive by default",
    description: "Generate interfaces that adapt cleanly across mobile sizes and orientations.",
    icon: Smartphone,
  },
  {
    title: "Production-ready export",
    description: "Ship SwiftUI, Jetpack Compose, React Native, or Flutter with tokens preserved.",
    icon: Code2,
  },
  {
    title: "Editable output",
    description: "Keep refining the generated UI and code instead of accepting a static result.",
    icon: Sparkles,
  },
  {
    title: "System-wide consistency",
    description: "Reuse components and shared decisions without style drift between screens.",
    icon: Check,
  },
  {
    title: "Native interaction patterns",
    description: "Design with mobile navigation, states, gestures, and platform conventions in mind.",
    icon: Send,
  },
  {
    title: "Framework flexibility",
    description: "Move one design system into the production framework your team already uses.",
    icon: Layers3,
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
  const tabletRows = ["16.666%", "33.333%", "50%", "66.666%", "83.333%"];
  const desktopRows = ["25%", "50%", "75%"];
  const desktopNodes = [
    ["33.333%", "25%"],
    ["66.666%", "25%"],
    ["33.333%", "50%"],
    ["66.666%", "50%"],
    ["33.333%", "75%"],
    ["66.666%", "75%"],
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
            Drawgle capabilities
          </div>
          <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.12)_0%,transparent_100%)] md:block" />
          <span className="absolute left-0 top-1/2 hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#252525] ring-[5px] ring-[#111111] xl:block" />
          <span className="absolute right-0 top-1/2 hidden h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 bg-[#252525] ring-[5px] ring-[#111111] xl:block" />
        </div>

        <div className="mx-auto mb-12 max-w-3xl text-left sm:text-center md:mb-20">
          <h2 className="font-pixel-square text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
            Everything needed to turn
            <span className="block text-[#1b7fcc]">an idea into a real app UI.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            Drawgle combines design-system control, focused iteration, and production structure so
            every generated screen remains useful after the first prompt.
          </p>
        </div>

        <div className="relative border-y border-white/[0.075]">
          <MatrixRails />

          <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ title, description, icon: Icon }, index) => (
              <article
                key={title}
                className={`group relative flex min-h-[142px] gap-4 border-white/[0.075] px-1 py-6 transition-colors hover:bg-white/[0.012] sm:block sm:min-h-[190px] sm:px-8 sm:py-9 sm:text-center lg:min-h-[210px] ${
                  index < capabilities.length - 1 ? "border-b sm:border-b-0" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[#1b7fcc] sm:mx-auto sm:mb-7">
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-white sm:text-base">
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
