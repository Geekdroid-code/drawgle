"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Code2, Layers3, Route } from "lucide-react";

type ShowcaseScreen = {
  label: string;
  role: string;
  src: string;
};

type ProductFlow = {
  id: string;
  index: string;
  name: string;
  description: string;
  prompt: string;
  palette: string[];
  screens: ShowcaseScreen[];
};

const productFlows: ProductFlow[] = [
  {
    id: "sculpted-finance",
    index: "01",
    name: "Sculpted Finance",
    description: "Soft financial clarity across overview, insight, and transaction states.",
    prompt:
      "Design a calm premium personal finance app with sculpted light surfaces, an overview dashboard, visual spending analytics, and a detailed transactions screen.",
    palette: ["#F8F8FF", "#FFFFFF", "#121212", "#FFD28D"],
    screens: [
      {
        label: "Dashboard",
        role: "Overview",
        src: "/screens/SculptedFluidity/Dashboard.html",
      },
      {
        label: "Analytics",
        role: "Insight",
        src: "/screens/SculptedFluidity/Analytics.html",
      },
      {
        label: "Transactions",
        role: "Activity",
        src: "/screens/SculptedFluidity/Transactions.html",
      },
    ],
  },
  {
    id: "onyx-performance",
    index: "02",
    name: "Onyx Performance",
    description: "A focused training system shaped for movement, progress, and control.",
    prompt:
      "Build a focused dark performance app with a high-contrast home dashboard, a guided workout routine, and precise account settings.",
    palette: ["#000000", "#121212", "#32D74B", "#F2F2F2"],
    screens: [
      {
        label: "Home",
        role: "Momentum",
        src: "/screens/OnyxPerformance/Home (5).html",
      },
      {
        label: "Routine",
        role: "Guidance",
        src: "/screens/OnyxPerformance/Routine.html",
      },
      {
        label: "Settings",
        role: "Control",
        src: "/screens/OnyxPerformance/Settings.html",
      },
    ],
  },
  {
    id: "soft-tech",
    index: "03",
    name: "Soft Tech",
    description: "A restrained social workspace with consistent rhythm and hierarchy.",
    prompt:
      "Create a premium soft-tech collaboration app with a clear home workspace, a structured activity feed, and a calm focused chat thread.",
    palette: ["#F5F5F5", "#FFFFFF", "#111111", "#D7E6DD"],
    screens: [
      {
        label: "Home",
        role: "Workspace",
        src: "/screens/SoftTechPremium/Home (5).html",
      },
      {
        label: "Activity",
        role: "Updates",
        src: "/screens/SoftTechPremium/ActivityFeed.html",
      },
      {
        label: "Chat",
        role: "Conversation",
        src: "/screens/SoftTechPremium/ChatThread.html",
      },
    ],
  },
  {
    id: "calm-security",
    index: "04",
    name: "Calm Security",
    description: "Trust-centered security screens that stay precise without feeling cold.",
    prompt:
      "Design a calm premium security app with a watchtower score dashboard, an organized private vault, and a focused add-new-item flow.",
    palette: ["#F9F9F7", "#FFFFFF", "#121212", "#B9D8C2"],
    screens: [
      {
        label: "Watchtower",
        role: "Status",
        src: "/screens/Security/WatchtowerDashboard.html",
      },
      {
        label: "Vault",
        role: "Library",
        src: "/screens/Security/ItemsVault.html",
      },
      {
        label: "Add item",
        role: "Action",
        src: "/screens/Security/AddNewItem.html",
      },
    ],
  },
];

const proofItems = [
  { icon: Route, value: "3 connected screens", detail: "One continuous product flow" },
  { icon: Layers3, value: "1 shared visual system", detail: "Tokens stay consistent" },
  { icon: Check, value: "Native navigation", detail: "Real mobile structure" },
  { icon: Code2, value: "Editable code", detail: "Ready to refine and ship" },
];

const TechnicalField = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.055)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,black_82%,transparent)]" />
    <div className="absolute inset-x-0 top-[42px] border-t border-black/[0.08]" />
    <div className="absolute bottom-[14%] left-0 right-0 border-t border-dashed border-black/[0.08]" />
    <div className="absolute bottom-0 left-[8%] top-0 border-l border-black/[0.07]" />
    <div className="absolute bottom-0 right-[8%] top-0 border-l border-black/[0.07]" />
  </div>
);

const DarkGrid = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_72%)]" />
    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
  </div>
);

const ScreenPreview = ({
  screen,
  position,
  selected,
  onSelect,
}: {
  screen: ShowcaseScreen;
  position: number;
  selected: boolean;
  onSelect: () => void;
}) => (
  <article className="relative z-10 w-[76vw] max-w-[300px] shrink-0 snap-center sm:w-[270px] lg:w-full lg:max-w-[300px] lg:justify-self-center xl:max-w-[320px]">
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="group block w-full text-left focus-visible:outline-none"
    >
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-black/45">
            {String(position + 1).padStart(2, "0")} / {screen.role}
          </div>
          <h3 className="mt-1 text-[13px] font-semibold tracking-tight text-black">
            {screen.label}
          </h3>
        </div>
        <span
          className={`mb-1 h-1.5 w-1.5 rounded-full transition-colors ${
            selected ? "bg-[#1b7fcc]" : "bg-black/20 group-hover:bg-black/40"
          }`}
        />
      </div>

      <div
        className={`relative aspect-[390/844] overflow-hidden rounded-[26px] border bg-white p-[4px] transition-colors duration-300 ${
          selected
            ? "border-[#1b7fcc] ring-1 ring-[#1b7fcc]/25"
            : "border-black/20 group-hover:border-black/40"
        }`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[21px] bg-white">
          <iframe
            src={screen.src}
            title={`${screen.label} generated mobile screen`}
            loading="lazy"
            scrolling="no"
            tabIndex={-1}
            className="pointer-events-none h-full w-full border-0"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04]" />
        </div>

        {selected && (
          <>
            <span className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 bg-white ring-1 ring-[#1b7fcc]" />
            <span className="absolute -right-[3px] -top-[3px] h-1.5 w-1.5 bg-white ring-1 ring-[#1b7fcc]" />
            <span className="absolute -bottom-[3px] -left-[3px] h-1.5 w-1.5 bg-white ring-1 ring-[#1b7fcc]" />
            <span className="absolute -bottom-[3px] -right-[3px] h-1.5 w-1.5 bg-white ring-1 ring-[#1b7fcc]" />
          </>
        )}
      </div>
    </button>
  </article>
);

export default function AppShowcase() {
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const activeFlow = productFlows[activeFlowIndex];
  const selectedScreen = activeFlow.screens[selectedScreenIndex] ?? activeFlow.screens[0];
  const projectHref = `/project/new?prompt=${encodeURIComponent(activeFlow.prompt)}`;

  const selectFlow = (index: number) => {
    setActiveFlowIndex(index);
    setSelectedScreenIndex(0);
  };

  return (
    <section id="showcase" className="relative overflow-hidden bg-[#f3f3f0] pb-20 sm:pb-28">
      <div className="relative bg-black pb-32 pt-20 text-white sm:pb-40 sm:pt-28">
        <DarkGrid />

        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#75b9ed]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc]" />
                Generated product flows
              </div>
              <h2 className="max-w-[880px] font-pixel-square text-[36px] font-semibold leading-[1.03] tracking-tight sm:text-5xl md:text-[54px] xl:text-[60px]">
                One screen can impress.
                <br />
                <span className="text-white/45">The whole product proves it.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/55 sm:text-base">
              Explore complete mobile flows generated with one coherent visual language,
              consistent navigation, and production-ready structure.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Generated product flows"
            className="mt-12 flex snap-x gap-0 overflow-x-auto border-y border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4"
          >
            {productFlows.map((flow, index) => {
              const active = index === activeFlowIndex;

              return (
                <button
                  key={flow.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="active-product-flow"
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectFlow(index)}
                  className={`relative min-w-[230px] snap-start border-r border-white/10 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#1b7fcc] lg:min-w-0 ${
                    active ? "bg-white/[0.06]" : "hover:bg-white/[0.035]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className={`font-mono text-[8px] tracking-[0.18em] ${active ? "text-[#75b9ed]" : "text-white/30"}`}>
                      {flow.index}
                    </span>
                    <div className="flex -space-x-0.5">
                      {flow.palette.map((color) => (
                        <span
                          key={color}
                          className="h-2 w-2 rounded-full border border-black/40"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={`mt-3 text-[13px] font-semibold ${active ? "text-white" : "text-white/45"}`}>
                    {flow.name}
                  </div>
                  {active && (
                    <motion.span
                      layoutId="active-flow-line"
                      className="absolute inset-x-0 bottom-0 h-px bg-[#1b7fcc]"
                      transition={{ duration: reducedMotion ? 0 : 0.3 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-24 sm:-mt-28">
        <div
          id="active-product-flow"
          role="tabpanel"
          className="relative mx-auto max-w-[1360px] border-y border-black/15 bg-[#e9e9e5] sm:border-x"
        >
          <TechnicalField />

          <div className="relative flex h-[43px] items-center justify-between border-b border-black/10 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-black/35 sm:inline">
                Drawgle / flow board
              </span>
              <span className="hidden h-3 border-l border-black/15 sm:inline" />
              <span className="truncate text-[11px] font-semibold text-black/70">
                {activeFlow.name}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-black/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              3 screens connected
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeFlow.id}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="pointer-events-none absolute left-[13%] right-[13%] top-[48%] hidden border-t border-dashed border-black/20 lg:block" />
              <div className="pointer-events-none absolute left-[33.1%] top-[48%] hidden h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-black/25 bg-[#e9e9e5] lg:block" />
              <div className="pointer-events-none absolute left-[66.6%] top-[48%] hidden h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-black/25 bg-[#e9e9e5] lg:block" />

              <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-[12vw] py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-10 sm:py-10 lg:grid lg:grid-cols-3 lg:gap-9 lg:overflow-visible lg:px-14 lg:py-12 xl:px-20">
                {activeFlow.screens.map((screen, index) => (
                  <ScreenPreview
                    key={screen.src}
                    screen={screen}
                    position={index}
                    selected={index === selectedScreenIndex}
                    onSelect={() => setSelectedScreenIndex(index)}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="relative grid border-t border-black/10 bg-[#f1f1ee]/90 md:grid-cols-[1fr_auto]">
            <div className="px-4 py-5 sm:px-6">
              <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-black/35">
                Selected screen / {selectedScreen.role}
              </div>
              <p className="mt-1 max-w-2xl text-sm font-medium text-black/75">
                {activeFlow.description} Selected: {selectedScreen.label}.
              </p>
            </div>

            <Link
              href={projectHref}
              className="group flex min-h-16 items-center justify-between gap-8 border-t border-black/10 px-4 text-sm font-semibold text-black transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#1b7fcc] sm:px-6 md:min-w-[270px] md:border-l md:border-t-0"
            >
              Build a flow like this
              <span className="relative flex h-5 w-9 items-center">
                <span className="absolute left-0 right-1 top-1/2 border-t border-black/45 transition-[right] duration-300 group-hover:right-0" />
                <span className="absolute right-0 h-2 w-2 rotate-45 border-r border-t border-black/65" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] grid-cols-2 border-b border-black/10 px-4 sm:px-6 md:grid-cols-4">
        {proofItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={item.value}
              className={`flex min-h-[92px] items-start gap-3 border-black/10 py-5 ${
                index % 2 === 0 ? "pr-3" : "border-l pl-3"
              } ${index > 1 ? "border-t md:border-t-0" : ""} ${
                index > 0 ? "md:border-l md:pl-5 md:pr-5" : "md:pr-5"
              }`}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1b7fcc]" strokeWidth={1.7} />
              <div>
                <div className="text-[11px] font-semibold text-black/75">{item.value}</div>
                <div className="mt-1 text-[10px] leading-4 text-black/40">{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
