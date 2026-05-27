"use client"

import { CheckCircle2, Code2, Download, ImagePlus, LayoutTemplate, Palette, Play, Smartphone, Sparkles } from "lucide-react"

const requirementCards = [
  { title: "Fintech dashboard", detail: "Balance, insights, cards", tone: "bg-white text-slate-950", offset: "lg:-translate-y-4" },
  { title: "Dark mode", detail: "Midnight surfaces", tone: "bg-slate-950 text-white", offset: "lg:translate-x-6" },
  { title: "Charts", detail: "Monthly spend trends", tone: "bg-emerald-50 text-emerald-950", offset: "lg:-translate-x-3" },
  { title: "Onboarding flow", detail: "3-screen first run", tone: "bg-amber-50 text-amber-950", offset: "lg:translate-y-3 lg:translate-x-8" },
]

const styleTokens = [
  { label: "Primary", value: "#1b7fcc", swatch: "bg-[#1b7fcc]" },
  { label: "Accent", value: "#f59e0b", swatch: "bg-amber-400" },
  { label: "Surface", value: "#0f172a", swatch: "bg-slate-950" },
  { label: "Radius", value: "24px", swatch: "bg-pink-200" },
]

const screenPlan = ["Home", "Insights", "Cards", "Settings"]
const frameworkBadges = ["HTML", "SwiftUI", "Compose", "React Native", "Flutter"]

type ScreenMockup = {
  id: string
  title: string
  kind: "analytics" | "checkout" | "profile" | "onboarding" | "finance" | "booking"
  bg: string
  accent: string
}

const mockupScreens: ScreenMockup[] = [
  { id: "analytics", title: "Analytics", kind: "analytics", bg: "bg-[#101623]", accent: "bg-[#1b7fcc]" },
  { id: "checkout", title: "Checkout", kind: "checkout", bg: "bg-white", accent: "bg-emerald-400" },
  { id: "profile", title: "Profile", kind: "profile", bg: "bg-[#f8fafc]", accent: "bg-pink-300" },
  { id: "onboarding", title: "Onboarding", kind: "onboarding", bg: "bg-[#111111]", accent: "bg-amber-300" },
  { id: "finance", title: "Finance", kind: "finance", bg: "bg-[#f1f5f9]", accent: "bg-[#1b7fcc]" },
  { id: "booking", title: "Booking", kind: "booking", bg: "bg-white", accent: "bg-violet-300" },
]

export default function HowItWorksShowcase() {
  return (
    <section id="how-it-works" className="relative mx-auto overflow-hidden bg-[#F7F5F3] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-16 text-center sm:mb-20">
          <h2 className="mx-auto mb-4 max-w-4xl font-[var(--font-inter-tight)] text-4xl font-bold leading-none text-gray-900 sm:text-5xl md:text-6xl">
            Design polished app screens in <span className="text-[#1b7fcccc]">3 simple steps.</span>
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-gray-600 md:text-xl">
            Drawgle turns a rough product idea into planned screens, editable UI, and export-ready code.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center">
          <StepMarker number={1} variant="start" />

          <h3 className="mb-4 mt-2 text-center text-4xl font-bold text-gray-950 sm:text-5xl md:text-6xl">
            Shape the app blueprint
          </h3>
          <p className="mx-auto max-w-3xl text-center text-lg text-gray-600 md:text-xl">
            Give Drawgle the product context: what the app does, who it is for, the style direction, and any reference image.
            Drawgle turns that into a build-ready brief before pixels appear.
          </p>

          <BlueprintVisual />

          <StepMarker number={2} variant="middle" className="mt-10" />

          <h3 className="mb-4 mt-2 text-center text-4xl font-bold text-gray-950 sm:text-5xl md:text-6xl">
            Watch Drawgle build the system
          </h3>
          <p className="mx-auto max-w-3xl text-center text-lg text-gray-600 md:text-xl">
            Drawgle plans the flow, creates a coherent design system, and generates screens that belong together instead of isolated AI drafts.
          </p>

          <div className="mt-8 flex items-center justify-center">
            <div
              className="group relative h-[200px] w-[95%] cursor-pointer overflow-hidden rounded-2xl border-4 border-[#1b7fcccc] shadow-2xl sm:h-[350px] md:h-[400px] lg:h-[500px] xl:h-[600px] xl:w-[1050px]"
              onClick={() => {
                const iframe = document.getElementById("video-iframe") as HTMLIFrameElement
                const thumbnail = document.getElementById("video-thumbnail") as HTMLElement
                if (iframe && thumbnail) {
                  iframe.classList.remove("opacity-0", "pointer-events-none")
                  iframe.classList.add("opacity-100")
                  thumbnail.classList.add("opacity-0", "pointer-events-none")
                }
              }}
            >
              <div id="video-thumbnail" className="absolute inset-0 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1b7fcccc]/20 via-orange-100/50 to-[#1b7fcccc]/30">
                  <div className="h-full w-full bg-[url('/images/howtothumbnail.webp')] bg-cover bg-center opacity-80" />
                </div>
                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute inset-0 flex scale-[0.9] items-center justify-center rounded-2xl transition-all duration-200 ease-out group-hover:scale-100">
                  <div className="flex size-28 items-center justify-center rounded-full bg-[#1b7fcccc]/10 backdrop-blur-md">
                    <div className="relative flex size-20 scale-100 items-center justify-center rounded-full bg-gradient-to-b from-primary/30 to-primary shadow-md transition-all duration-200 ease-out group-hover:scale-[1.2]">
                      <Play
                        className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105"
                        style={{
                          filter:
                            "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <iframe
                className="h-full w-full opacity-0 pointer-events-none transition-opacity duration-300"
                src="https://www.youtube.com/embed/UL357H91Gc0?rel=0"
                title="Drawgle build video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                id="video-iframe"
              />
            </div>
          </div>

          <StepMarker number={3} variant="end" className="mt-16" />

          <h3 className="mb-4 mt-10 text-center text-4xl font-bold text-gray-950 sm:text-5xl md:text-6xl">
            Edit, preview, export
          </h3>
          <p className="mx-auto max-w-3xl text-center text-lg text-gray-600 md:text-xl">
            Refine screens on the canvas, ask for changes in chat, then export clean code for the stack you actually ship with.
          </p>

          <ScreenMockupCarousel />
        </div>
      </div>
    </section>
  )
}

function StepMarker({
  number,
  variant,
  className = "",
}: {
  number: number
  variant: "start" | "middle" | "end"
  className?: string
}) {
  const circle =
    variant === "start"
      ? "from-[#1b7fcccc] to-orange-400"
      : variant === "middle"
        ? "from-slate-700 to-[#1b7fcccc]"
        : "from-black to-slate-100"
  const line =
    variant === "start"
      ? "mt-[-2px] h-10 bg-gradient-to-b from-[#1b7fcccc] to-transparent"
      : variant === "middle"
        ? "mt-[-75px] h-28 bg-gradient-to-b from-transparent via-[#1b7fcccc] to-transparent"
        : "mt-[-90px] h-14 bg-gradient-to-b from-transparent to-black"

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className={`z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-l ${circle} font-bold text-white`}>
        {number}
      </div>
      <div className={`w-1 rounded-lg ${line}`} />
    </div>
  )
}

function BlueprintVisual() {
  return (
    <div className="mt-10 flex w-full max-w-7xl items-center justify-center px-2">
      <div className="grid w-full items-center gap-5 lg:grid-cols-[1fr_1.35fr_1fr] lg:gap-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-5">
          {requirementCards.map((card, index) => (
            <MiniRequirementCard key={card.title} {...card} className={index > 1 ? "hidden sm:flex lg:flex" : ""} />
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-br from-[#1b7fcc]/25 via-white/40 to-amber-200/45 blur-2xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-slate-950/[0.08] bg-white shadow-2xl shadow-slate-900/10">
            <div className="border-b border-slate-950/[0.08] bg-slate-950 px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7ec7ff]">Product Blueprint</div>
                  <h4 className="mt-1 text-2xl font-bold tracking-tight">Nimbus Pay</h4>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <LayoutTemplate className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <BlueprintMetric label="App type" value="Mobile fintech" />
                <BlueprintMetric label="Audience" value="Young earners" />
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Visual direction
                </div>
                <div className="rounded-2xl border border-slate-950/[0.08] bg-[#f8fafc] p-3">
                  <p className="text-sm font-semibold leading-5 text-slate-900">
                    Premium banking UI with calm charts, soft contrast, confident blue actions, and crisp card hierarchy.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Palette className="h-3.5 w-3.5" />
                  Design tokens
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {styleTokens.map((token) => (
                    <StyleTokenChip key={token.label} {...token} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Smartphone className="h-3.5 w-3.5" />
                  Screen map
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {screenPlan.map((screen, index) => (
                    <div key={screen} className="rounded-2xl border border-slate-950/[0.08] bg-white p-3 shadow-sm">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <div className="mt-3 truncate text-sm font-bold text-slate-900">{screen}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-5">
          <div className="rounded-3xl border border-slate-950/[0.08] bg-white p-4 shadow-xl shadow-slate-900/5 lg:-translate-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <ImagePlus className="h-3.5 w-3.5" />
              Ref
            </div>
            <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#1b7fcc_48%,#fde68a_100%)]">
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),transparent_24%),radial-gradient(circle_at_72%_70%,rgba(255,255,255,0.34),transparent_28%)]" />
            </div>
          </div>
          <div className="rounded-3xl border border-slate-950/[0.08] bg-slate-950 p-4 text-white shadow-xl shadow-slate-900/10">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#7ec7ff]">Taste</div>
            <div className="mt-4 flex gap-2">
              <span className="h-10 flex-1 rounded-full bg-[#1b7fcc]" />
              <span className="h-10 flex-1 rounded-full bg-amber-300" />
              <span className="h-10 flex-1 rounded-full bg-emerald-300" />
            </div>
            <div className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold">Inter Tight / Bold</div>
          </div>
          <div className="col-span-2 rounded-3xl border border-slate-950/[0.08] bg-white p-4 shadow-xl shadow-slate-900/5 sm:col-span-2 lg:translate-x-6">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Plan cards</div>
            <div className="mt-4 space-y-2">
              {["Create home overview", "Add card detail view", "Prepare export targets"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="truncate text-sm font-semibold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniRequirementCard({
  title,
  detail,
  tone,
  offset,
  className = "",
}: {
  title: string
  detail: string
  tone: string
  offset: string
  className?: string
}) {
  return (
    <div className={`flex min-h-[112px] flex-col justify-between rounded-3xl border border-slate-950/[0.08] p-4 shadow-xl shadow-slate-900/5 ${tone} ${offset} ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-current/10">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <div className="text-base font-bold leading-tight">{title}</div>
        <div className="mt-1 text-xs font-semibold opacity-60">{detail}</div>
      </div>
    </div>
  )
}

function BlueprintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-white">{value}</div>
    </div>
  )
}

function StyleTokenChip({ label, value, swatch }: { label: string; value: string; swatch: string }) {
  return (
    <div className="rounded-2xl border border-slate-950/[0.08] bg-white p-3">
      <div className={`h-7 w-full rounded-xl ${swatch}`} />
      <div className="mt-2 truncate text-xs font-bold text-slate-900">{label}</div>
      <div className="truncate text-[11px] font-semibold text-slate-400">{value}</div>
    </div>
  )
}

function ScreenMockupCarousel() {
  return (
    <div className="w-full pt-10">
      <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-center gap-2 px-2">
        {frameworkBadges.map((badge) => (
          <span key={badge} className="inline-flex items-center gap-1.5 rounded-full border border-slate-950/[0.08] bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
            {badge === "HTML" ? <Code2 className="h-3.5 w-3.5 text-[#1b7fcc]" /> : <Download className="h-3.5 w-3.5 text-slate-400" />}
            {badge}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden pb-3">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-[#F7F5F3] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-[#F7F5F3] to-transparent" />
        <div className="flex gap-5 will-change-transform animate-scroll-right">
          {[...mockupScreens, ...mockupScreens].map((screen, index) => (
            <MobileScreenMockup key={`${screen.id}-${index}`} screen={screen} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileScreenMockup({ screen }: { screen: ScreenMockup }) {
  const isDark = screen.bg.includes("101623") || screen.bg.includes("111111")
  const textColor = isDark ? "text-white" : "text-slate-950"
  const mutedText = isDark ? "text-white/50" : "text-slate-400"

  return (
    <div className="relative h-[378px] min-w-[210px] overflow-hidden rounded-[32px] bg-slate-950 p-2 shadow-2xl shadow-slate-900/15">
      <div className={`relative h-full overflow-hidden rounded-[26px] ${screen.bg} ${textColor}`}>
        <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-black/20" />
        <div className="flex h-full flex-col px-4 pb-4 pt-9">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${mutedText}`}>Drawgle screen</div>
              <div className="text-xl font-extrabold tracking-tight">{screen.title}</div>
            </div>
            <span className={`h-10 w-10 rounded-2xl ${screen.accent} shadow-lg`} />
          </div>
          <MockupBody screen={screen} />
        </div>
      </div>
    </div>
  )
}

function MockupBody({ screen }: { screen: ScreenMockup }) {
  if (screen.kind === "analytics") {
    return (
      <div className="mt-5 flex flex-1 flex-col gap-3">
        <div className="rounded-3xl bg-white/10 p-4">
          <div className="text-3xl font-black">$84.2k</div>
          <div className="mt-1 text-xs font-semibold text-white/50">Revenue this month</div>
        </div>
        <div className="flex flex-1 items-end gap-2 rounded-3xl bg-white/10 p-4">
          {[52, 78, 44, 92, 66, 100].map((height, index) => (
            <span key={index} className="flex-1 rounded-full bg-[#1b7fcc]" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (screen.kind === "checkout") {
    return (
      <div className="mt-5 flex flex-1 flex-col gap-3">
        <div className="rounded-3xl bg-slate-950 p-4 text-white">
          <div className="text-xs font-bold text-white/45">Premium plan</div>
          <div className="mt-2 text-3xl font-black">$29</div>
        </div>
        {["Apple Pay", "Visa ending 4242", "Invoice details"].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-950/[0.08] bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800">
            {item}
          </div>
        ))}
        <div className="mt-auto rounded-2xl bg-emerald-400 py-3 text-center text-sm font-black text-emerald-950">Pay now</div>
      </div>
    )
  }

  if (screen.kind === "profile") {
    return (
      <div className="mt-5 flex flex-1 flex-col items-center gap-3">
        <div className="h-20 w-20 rounded-[28px] bg-gradient-to-tr from-pink-300 via-[#1b7fcc] to-amber-200" />
        <div className="text-center">
          <div className="text-lg font-black text-slate-950">Maya Chen</div>
          <div className="text-xs font-semibold text-slate-400">Product lead</div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2">
          {["12", "48", "91"].map((stat) => (
            <div key={stat} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <div className="font-black text-slate-950">{stat}</div>
              <div className="text-[10px] font-bold text-slate-400">items</div>
            </div>
          ))}
        </div>
        <div className="mt-auto w-full space-y-2">
          <div className="h-10 rounded-2xl bg-white" />
          <div className="h-10 rounded-2xl bg-white" />
        </div>
      </div>
    )
  }

  if (screen.kind === "onboarding") {
    return (
      <div className="mt-5 flex flex-1 flex-col">
        <div className="grid flex-1 place-items-center rounded-[28px] bg-white/10">
          <div className="relative h-28 w-28">
            <span className="absolute inset-0 rounded-[36px] bg-amber-300" />
            <span className="absolute -right-3 top-8 h-12 w-12 rounded-3xl bg-[#1b7fcc]" />
            <span className="absolute -bottom-2 left-6 h-10 w-16 rounded-full bg-pink-300" />
          </div>
        </div>
        <div className="mt-4 text-2xl font-black leading-none">Money habits, designed.</div>
        <div className="mt-2 text-sm font-semibold text-white/50">A clean first-run flow with three focused screens.</div>
        <div className="mt-auto flex gap-2">
          <span className="h-2 flex-1 rounded-full bg-amber-300" />
          <span className="h-2 flex-1 rounded-full bg-white/20" />
          <span className="h-2 flex-1 rounded-full bg-white/20" />
        </div>
      </div>
    )
  }

  if (screen.kind === "finance") {
    return (
      <div className="mt-5 flex flex-1 flex-col gap-3">
        <div className="rounded-[28px] bg-slate-950 p-4 text-white">
          <div className="text-xs font-bold text-white/45">Available balance</div>
          <div className="mt-2 text-3xl font-black">$12,480</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {["Send", "Save", "Invest", "Cards"].map((item) => (
            <div key={item} className="rounded-2xl bg-white p-3 text-center text-sm font-black text-slate-800 shadow-sm">{item}</div>
          ))}
        </div>
        <div className="mt-auto rounded-3xl bg-white p-3">
          <div className="h-2 w-20 rounded-full bg-slate-200" />
          <div className="mt-3 h-2 w-full rounded-full bg-[#1b7fcc]" />
          <div className="mt-2 h-2 w-2/3 rounded-full bg-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-1 flex-col gap-3">
      <div className="aspect-[4/3] rounded-[28px] bg-gradient-to-br from-violet-300 via-[#1b7fcc] to-amber-200" />
      <div className="text-2xl font-black text-slate-950">Ocean View Loft</div>
      <div className="grid grid-cols-3 gap-2">
        {["4.9", "2 bed", "WiFi"].map((item) => (
          <div key={item} className="rounded-2xl bg-slate-50 px-2 py-3 text-center text-xs font-black text-slate-700">{item}</div>
        ))}
      </div>
      <div className="mt-auto rounded-2xl bg-slate-950 py-3 text-center text-sm font-black text-white">Book stay</div>
    </div>
  )
}
