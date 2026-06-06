"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  ArrowRight,
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
} from "lucide-react";

const Annotation = ({
  children,
  className = "",
  light = false,
}: {
  children: ReactNode;
  className?: string;
  light?: boolean;
}) => (
  <span
    className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
      light
        ? "border-gray-200 bg-white text-gray-500"
        : "border-white/10 bg-[#181818]/95 text-gray-300"
    } ${className}`}
  >
    {children}
  </span>
);

const TechnicalGrid = ({ className = "" }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
    <div className="absolute left-[18%] top-[30%] h-6 w-6 border border-[#1b7fcc]/20 bg-[#1b7fcc]/5" />
    <div className="absolute right-[12%] top-[12%] h-6 w-6 border border-white/[0.06] bg-white/[0.025]" />
    <div className="absolute bottom-[14%] right-[34%] h-6 w-6 border border-orange-400/15 bg-orange-400/[0.035]" />
  </div>
);

const MockupGridPattern = () => {
  const patternId = useId();
  const highlightedSquares = useMemo(() => {
    const seed = [...patternId].reduce((total, character) => total + character.charCodeAt(0), 0);

    return Array.from({ length: 7 }, (_, index) => ({
      x: (((seed + index * 37) % 12) + 1) * 20,
      y: (((seed * 3 + index * 29) % 8) + 1) * 20,
      opacity: 0.025 + (index % 3) * 0.018,
    }));
  }, [patternId]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 -ml-20 -mt-2 h-full w-full [mask-image:linear-gradient(white,transparent)]">
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10 opacity-100 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full fill-white/5 stroke-white/25 mix-blend-overlay"
        >
          <defs>
            <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse" x="-12" y="4">
              <path d="M.5 20V.5H20" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" strokeWidth="0" fill={`url(#${patternId})`} />
          <g transform="translate(-12 4)">
            {highlightedSquares.map((square, index) => (
              <rect
                key={`${square.x}-${square.y}-${index}`}
                width="21"
                height="21"
                x={square.x}
                y={square.y}
                fill="white"
                fillOpacity={square.opacity}
                strokeWidth="0"
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};

const CardShell = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  className = "",
  visualClassName = "",
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Palette;
  children: ReactNode;
  className?: string;
  visualClassName?: string;
}) => (
  <article
    className={`group relative overflow-hidden border border-white/[0.09] bg-[#151515] transition-colors duration-300 hover:border-white/[0.16] ${className}`}
  >
    <div
      className={`relative min-h-[246px] overflow-hidden border-b border-white/[0.08] bg-[#101010] p-5 ${visualClassName}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <MockupGridPattern />
      <div className="relative z-10 flex min-h-[206px] items-center justify-center">{children}</div>
    </div>
    <div className="relative p-6">
      <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#5ba8e2]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[#1b7fcc]/20 bg-[#1b7fcc]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {eyebrow}
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  </article>
);

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden bg-[#111111] px-4 py-20 md:px-6 md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-12 grid gap-6 md:grid-cols-[1fr_0.7fr] md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">
              <Sparkles className="h-3.5 w-3.5" />
              More than a generator
            </div>
            <h2 className="font-pixel-square text-[34px] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              A design tool with
              <span className="block text-[#5ba8e2]">system-level control</span>
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-relaxed text-gray-400 md:text-base">
            Drawgle keeps your vision, tokens, screens, navigation, and production code connected from the first prompt to the final export.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-6">
          <CardShell
            eyebrow="Live design system"
            title="Change one token. Update the entire app."
            description="Tune colors, typography, spacing, radii, shadows, and opacity while every screen updates live. No regeneration required."
            icon={SlidersHorizontal}
            className="sm:col-span-2 lg:col-span-4"
            visualClassName="bg-[radial-gradient(circle_at_72%_35%,rgba(27,127,204,0.12),transparent_42%),#101010]"
          >
            <TokenVisual />
          </CardShell>

          <CardShell
            eyebrow="Targeted regeneration"
            title="Edit only what you selected."
            description="Click any component and prompt a surgical change without rebuilding or losing the rest of the screen."
            icon={MousePointer2}
            className="sm:col-span-2 lg:col-span-2"
            visualClassName="bg-[radial-gradient(circle_at_50%_55%,rgba(27,127,204,0.1),transparent_48%),#101010]"
          >
            <SelectiveEditVisual />
          </CardShell>

          <CardShell
            eyebrow="Visual references"
            title="Turn inspiration into a reusable system."
            description="Use a screenshot for layout or extract its visual direction to re-theme existing and future screens."
            icon={ImageIcon}
            className="sm:col-span-1 lg:col-span-2"
            visualClassName="bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.13),transparent_55%),#101010]"
          >
            <ReferenceVisual />
          </CardShell>

          <CardShell
            eyebrow="Project charter"
            title="Your product vision stays in context."
            description="Goals, audience, features, and visual direction remain editable and continue guiding every generated screen."
            icon={Compass}
            className="sm:col-span-1 lg:col-span-2"
          >
            <CharterVisual />
          </CardShell>

          <CardShell
            eyebrow="Real app architecture"
            title="Navigation stays connected."
            description="Design multi-screen apps with persistent tabs, bottom navigation, and flows that update together."
            icon={Route}
            className="sm:col-span-1 lg:col-span-2"
            visualClassName="bg-[radial-gradient(circle_at_50%_60%,rgba(249,115,22,0.09),transparent_55%),#101010]"
          >
            <NavigationVisual />
          </CardShell>

          <CardShell
            eyebrow="Production export"
            title="Ship to the framework you use."
            description="Export SwiftUI, Jetpack Compose, React Native, or Flutter with the original design system preserved."
            icon={Code2}
            className="sm:col-span-2 lg:col-span-6"
            visualClassName="bg-[#0e0e0e]"
          >
            <ExportVisual />
          </CardShell>
        </div>
      </div>
    </section>
  );
}

function TokenVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-[650px] items-center gap-4 sm:gap-6">
      <div className="w-[43%] rounded-[14px] border border-white/10 bg-[#171717] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] font-semibold text-gray-300">Design tokens</span>
          <span className="rounded-md border border-emerald-400/15 bg-emerald-400/[0.08] px-1.5 py-0.5 font-mono text-[7px] text-emerald-400">
            LIVE
          </span>
        </div>
        <TokenControl name="action.primary" value="#1B7FCC" color />
        <TokenControl name="radius.card" value="24px" />
        <TokenControl name="space.section" value="32px" />
      </div>

      <div className="relative flex flex-1 items-end justify-center gap-2.5">
        <MiniProductScreen compact />
        <MiniProductScreen />
        <Annotation className="-right-1 -top-7 text-[#75b9ed]">2 screens synced</Annotation>
      </div>
      <div className="absolute left-[40%] top-1/2 w-[9%] border-t border-dashed border-[#5ba8e2]/60" />
    </div>
  );
}

function TokenControl({ name, value, color = false }: { name: string; value: string; color?: boolean }) {
  return (
    <div className="border-t border-white/[0.06] px-1 py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] text-gray-500">{name}</span>
        <span className="font-mono text-[8px] text-gray-300">{value}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {color ? <span className="h-3.5 w-3.5 rounded-md bg-[#1b7fcc] ring-1 ring-white/10" /> : null}
        <div className="relative h-1 flex-1 rounded-full bg-white/10">
          <span className="absolute left-0 top-0 h-full w-[64%] rounded-full bg-[#1b7fcc]" />
          <span className="absolute left-[60%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/30 bg-[#5ba8e2]" />
        </div>
      </div>
    </div>
  );
}

function MiniProductScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-[18px] border border-white/15 bg-[#F7F7F7] p-1.5 ${compact ? "mb-2 w-[42%] opacity-70" : "w-[48%]"}`}>
      <div className="flex items-center justify-between px-1 py-1">
        <div className="h-1.5 w-8 rounded-full bg-gray-300" />
        <div className="h-3 w-3 rounded-full bg-[#1b7fcc]/20" />
      </div>
      <div className="rounded-[11px] bg-[#1b7fcc] p-2">
        <div className="h-1.5 w-10 rounded-full bg-white/90" />
        <div className="mt-1.5 h-1 w-14 rounded-full bg-white/30" />
        <div className="mt-2 h-3 w-8 rounded-full bg-white/90" />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <div className="h-8 rounded-[7px] border border-gray-100 bg-white" />
        <div className="h-8 rounded-[7px] border border-gray-100 bg-white" />
      </div>
      <div className="mx-auto mt-1.5 h-2 w-[70%] rounded-full bg-gray-900" />
    </div>
  );
}

function SelectiveEditVisual() {
  return (
    <div className="relative mx-auto w-[205px]">
      <div className="rounded-[24px] border border-white/15 bg-[#F7F7F7] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-2 w-14 rounded-full bg-gray-300" />
          <div className="h-5 w-5 rounded-full bg-gray-200" />
        </div>
        <div className="relative rounded-[16px] border border-[#1b7fcc] bg-white p-2.5">
          <SelectionHandles />
          <div className="h-12 rounded-xl bg-[linear-gradient(135deg,rgba(27,127,204,0.15),rgba(124,58,237,0.08))]" />
          <div className="mt-2 h-2 w-20 rounded-full bg-gray-300" />
        </div>
        <div className="mt-3 h-8 rounded-xl bg-gray-200/80" />
      </div>
      <div className="absolute -bottom-5 left-4 right-[-18px] flex items-center gap-2 rounded-xl border border-white/10 bg-[#191919] p-1.5 shadow-xl">
        <span className="min-w-0 flex-1 truncate pl-1 text-[8px] text-gray-400">Make this card softer...</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1b7fcc]">
          <Send className="h-3 w-3 text-white" />
        </span>
      </div>
      <Annotation className="-right-10 top-12 text-[#75b9ed]">selected.card</Annotation>
      <MousePointer2 className="absolute -right-3 top-[92px] h-5 w-5 fill-white text-black" />
    </div>
  );
}

function SelectionHandles() {
  return (
    <>
      <span className="absolute -left-1 -top-1 h-2 w-2 border border-[#1b7fcc] bg-white" />
      <span className="absolute -right-1 -top-1 h-2 w-2 border border-[#1b7fcc] bg-white" />
      <span className="absolute -bottom-1 -left-1 h-2 w-2 border border-[#1b7fcc] bg-white" />
      <span className="absolute -bottom-1 -right-1 h-2 w-2 border border-[#1b7fcc] bg-white" />
    </>
  );
}

function ReferenceVisual() {
  return (
    <div className="relative mx-auto h-[190px] w-[240px]">
      <div className="absolute left-0 top-8 -rotate-6 rounded-[15px] border border-white/15 bg-white p-2 shadow-xl">
        <div className="relative h-[104px] w-[86px] overflow-hidden rounded-[10px] bg-[linear-gradient(145deg,#09090b_5%,#312e81_52%,#f97316_130%)] p-2">
          <div className="absolute -right-5 -top-4 h-16 w-16 rounded-full bg-purple-400/35 blur-xl" />
          <div className="relative h-3 w-9 rounded-full bg-white/90" />
          <div className="relative mt-8 h-7 rounded-lg border border-white/15 bg-white/10" />
          <div className="relative mt-2 h-2 w-12 rounded-full bg-orange-300" />
        </div>
      </div>

      <div className="absolute right-0 top-3 rotate-3 rounded-[17px] border border-purple-400/25 bg-[#17131f] p-2 shadow-xl">
        <div className="h-[122px] w-[96px] rounded-[11px] border border-white/10 bg-[#21192f] p-2">
          <div className="flex items-center justify-between">
            <div className="h-2 w-9 rounded-full bg-white/80" />
            <div className="h-4 w-4 rounded-full bg-orange-400" />
          </div>
          <div className="mt-3 h-12 rounded-[9px] bg-[linear-gradient(135deg,#7c3aed,#f97316)]" />
          <div className="mt-2 grid grid-cols-2 gap-1">
            <div className="h-6 rounded-md bg-white/10" />
            <div className="h-6 rounded-md bg-white/10" />
          </div>
        </div>
      </div>
      <div className="absolute left-[43%] top-[46%] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#181818]">
        <ArrowRight className="h-3.5 w-3.5 text-purple-300" />
      </div>
      <Annotation className="bottom-1 left-1/2 -translate-x-1/2">style.reference applied</Annotation>
    </div>
  );
}

function CharterVisual() {
  return (
    <div className="relative mx-auto w-[238px] rounded-[15px] border border-white/10 bg-[#181818] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-[8px] text-gray-500">PROJECT / 01</div>
          <span className="text-[11px] font-semibold text-white">Project Charter</span>
        </div>
        <span className="rounded-md border border-emerald-400/15 bg-emerald-400/[0.08] px-1.5 py-1 font-mono text-[7px] text-emerald-400">
          LIVING
        </span>
      </div>
      {[
        ["Audience", "Indie app builders", "100%"],
        ["Direction", "Calm / precise / native", "78%"],
        ["Primary flow", "Create / refine / export", "88%"],
      ].map(([label, value, width]) => (
        <div key={label} className="border-t border-white/[0.07] py-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[7px] uppercase tracking-wide text-gray-500">{label}</div>
            <Check className="h-2.5 w-2.5 text-emerald-400" strokeWidth={3} />
          </div>
          <div className="mt-0.5 text-[9px] font-medium text-gray-200">{value}</div>
          <div className="mt-1.5 h-px bg-white/[0.06]">
            <div className="h-px bg-[#1b7fcc]" style={{ width }} />
          </div>
        </div>
      ))}
      <Annotation className="-right-5 top-[86px] text-orange-300">context retained</Annotation>
    </div>
  );
}

function NavigationVisual() {
  const screens = [
    { label: "Home", accent: "bg-[#1b7fcc]" },
    { label: "Build", accent: "bg-orange-400" },
    { label: "Review", accent: "bg-purple-500" },
  ];

  return (
    <div className="relative mx-auto flex w-[246px] items-center justify-center gap-2">
      {screens.map((screen, index) => (
        <div
          key={screen.label}
          className={`relative flex h-[142px] w-[70px] flex-col rounded-[17px] border border-white/15 bg-[#F7F7F7] p-1.5 shadow-lg ${
            index === 1 ? "-translate-y-2" : "translate-y-1"
          }`}
        >
          <div className={`h-10 rounded-[9px] ${screen.accent} ${index === 1 ? "opacity-100" : "opacity-20"}`} />
          <div className="mt-1.5 grid flex-1 grid-cols-2 gap-1">
            <div className="rounded-md bg-gray-200" />
            <div className="rounded-md bg-gray-200" />
          </div>
          <div className="mt-1.5 flex h-5 items-center justify-around rounded-full bg-gray-900 px-1">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className={`h-1.5 w-1.5 rounded-full ${dot === index ? screen.accent : "bg-white/30"}`} />
            ))}
          </div>
          {index < 2 && <span className="absolute left-full top-[62%] w-2 border-t border-dashed border-[#5ba8e2]/60" />}
        </div>
      ))}
      <Annotation className="-bottom-6 left-1/2 -translate-x-1/2 text-[#75b9ed]">persistent.navigation</Annotation>
    </div>
  );
}

function ExportVisual() {
  const frameworks = [
    { name: "SwiftUI", type: "swift" as const },
    { name: "Jetpack Compose", type: "compose" as const },
    { name: "React Native", type: "react" as const },
    { name: "Flutter", type: "flutter" as const },
  ];

  return (
    <div className="relative -m-5 flex min-h-[246px] w-[calc(100%_+_2.5rem)] items-center justify-center overflow-hidden p-5">
      <TechnicalGrid />
      <div className="relative z-10 mx-auto grid w-full max-w-[900px] items-center gap-8 sm:grid-cols-[220px_1fr]">
        <div className="relative rounded-[20px] border border-white/[0.12] bg-[#141414]/95 p-3 backdrop-blur">
          <div className="rounded-[16px] border border-white/[0.08] bg-[#f5f5f5] p-2">
            <div className="flex items-center justify-between px-1 py-1">
              <div className="h-1.5 w-10 rounded-full bg-gray-300" />
              <div className="h-4 w-4 rounded-full bg-[#1b7fcc]/15" />
            </div>
            <div className="mt-1.5 rounded-[11px] bg-[#1b7fcc] p-2.5">
              <div className="h-1.5 w-12 rounded-full bg-white/90" />
              <div className="mt-2 h-1 w-16 rounded-full bg-white/30" />
              <div className="mt-3 h-4 w-10 rounded-full bg-white/90" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="h-9 rounded-[8px] border border-gray-100 bg-white" />
              <div className="h-9 rounded-[8px] border border-gray-100 bg-white" />
            </div>
            <div className="mx-auto mt-2 h-3 w-[75%] rounded-full bg-gray-900" />
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Layers3 className="h-3 w-3 text-gray-500" />
              <span className="font-mono text-[7px] text-gray-500">system attached</span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="absolute left-full top-1/2 hidden h-px w-8 bg-white/15 sm:block" />
        </div>

        <div className="relative grid grid-cols-2 gap-3">
          <ExportBranches />
          {frameworks.map((framework) => (
            <div
              key={framework.name}
              className="relative z-10 flex min-h-[78px] items-center gap-3 rounded-[16px] border border-white/[0.11] bg-[#151515]/95 px-4 py-3 backdrop-blur transition-colors hover:border-white/[0.2]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <FrameworkMark type={framework.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-white">{framework.name}</div>
                <div className="mt-1 h-px w-8 bg-white/10" />
              </div>
              <span className="h-1.5 w-1.5 rounded-full border border-emerald-400/50 bg-emerald-400/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportBranches() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 180"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -left-8 top-0 hidden h-full w-[calc(100%+2rem)] overflow-visible sm:block"
    >
      <path d="M0 90H34C50 90 50 44 68 44H112" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <path d="M34 90C50 90 50 136 68 136H112" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <path d="M34 90H270C288 90 288 44 306 44H350" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <path d="M270 90C288 90 288 136 306 136H350" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <circle cx="34" cy="90" r="2.5" fill="#1B7FCC" />
      <circle cx="270" cy="90" r="2" fill="rgba(255,255,255,0.25)" />
    </svg>
  );
}

function FrameworkMark({ type }: { type: "swift" | "compose" | "react" | "flutter" }) {
  if (type === "react") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-6 w-6 fill-none stroke-[#80d8e8]" aria-hidden="true">
          <circle cx="20" cy="20" r="2.8" fill="currentColor" stroke="none" />
          <ellipse cx="20" cy="20" rx="16" ry="6.5" fill="none" strokeWidth="1.5" />
          <ellipse cx="20" cy="20" rx="16" ry="6.5" fill="none" strokeWidth="1.5" transform="rotate(60 20 20)" />
          <ellipse cx="20" cy="20" rx="16" ry="6.5" fill="none" strokeWidth="1.5" transform="rotate(120 20 20)" />
        </svg>
      </span>
    );
  }

  if (type === "flutter") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
          <path d="M7 21 23 5h10L17 21l-5 5-5-5Z" fill="#54C5F8" />
          <path d="m17 21 6 6h10L22 16l-5 5Z" fill="#29B6F6" />
          <path d="m23 27-6 6h10l6-6H23Z" fill="#01579B" />
        </svg>
      </span>
    );
  }

  if (type === "compose") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
          <path d="m20 4 14 8-14 8L6 12l14-8Z" fill="#48D597" />
          <path d="m6 17 14 8 14-8v7l-14 8-14-8v-7Z" fill="#25A96C" />
          <path d="m20 20 14-8v5l-14 8-14-8v-5l14 8Z" fill="#79E8B5" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
        <path d="M33 29c-6 5-15 4-21-1-4-3-6-7-7-10 5 4 9 6 13 7C13 21 9 16 7 11c5 4 10 7 15 9-4-5-7-10-9-15 8 6 14 11 18 17 2 3 3 5 2 7Z" fill="#F97316" />
        <path d="M28 27c2-1 4-1 6 1-1-4-2-7-5-10 1 3 1 6-1 9Z" fill="#FDBA74" />
      </svg>
    </span>
  );
}
