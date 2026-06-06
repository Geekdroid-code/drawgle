"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

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
  {
    id: "midnight-precision",
    index: "05",
    name: "Midnight Precision",
    description: "A disciplined monochrome product journey from first impression to daily use.",
    prompt:
      "Create a precise monochrome productivity app with a premium welcome screen, focused account access, and a highly structured dark dashboard.",
    palette: ["#0A0A0A", "#1A1A1A", "#FFFFFF", "#444444"],
    screens: [
      {
        label: "Welcome",
        role: "Introduction",
        src: "/screens/MidnightPrecision/Welcome.html",
      },
      {
        label: "Sign in",
        role: "Access",
        src: "/screens/MidnightPrecision/Login.html",
      },
      {
        label: "Dashboard",
        role: "Workspace",
        src: "/screens/MidnightPrecision/Dashboard.html",
      },
    ],
  },
  {
    id: "neo-mint",
    index: "06",
    name: "Neo Mint",
    description: "A high-contrast finance system with sharp hierarchy and restrained mint energy.",
    prompt:
      "Design a high-contrast finance app with a black and mint visual system, a clear dashboard, calendar analytics, and a focused expense detail screen.",
    palette: ["#000000", "#FFFFFF", "#4ADE80", "#E55B5B"],
    screens: [
      {
        label: "Dashboard",
        role: "Overview",
        src: "/screens/NeoMintPremium/Dashboard.html",
      },
      {
        label: "Calendar",
        role: "Patterns",
        src: "/screens/NeoMintPremium/CalendarAnalytics.html",
      },
      {
        label: "Expense",
        role: "Detail",
        src: "/screens/NeoMintPremium/ExpenseDetail.html",
      },
    ],
  },
];

const ScreenPreview = ({
  screen,
  position,
}: {
  screen: ShowcaseScreen;
  position: number;
}) => (
  <article className="w-[76vw] max-w-[300px] shrink-0 snap-center sm:w-[270px] lg:w-full lg:max-w-[292px] lg:justify-self-center xl:max-w-[310px]">
    <div className="relative aspect-[390/844] overflow-hidden rounded-[34px] border border-black/[0.16] bg-[#d8d8d4] p-[5px] shadow-[0_24px_55px_-42px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-white">
        <iframe
          src={screen.src}
          title={`${screen.label} generated mobile screen`}
          loading="lazy"
          scrolling="no"
          tabIndex={-1}
          className="pointer-events-none h-full w-full border-0"
        />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.045]" />
      </div>
    </div>

    <div className="mt-4 flex items-center justify-center gap-2 text-center">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[9px] font-semibold text-black/45">
        {position + 1}
      </span>
      <div className="text-[12px] font-semibold tracking-tight text-black/75">
        {screen.label}
        <span className="ml-1.5 font-normal text-black/35">{screen.role}</span>
      </div>
    </div>
  </article>
);

export default function AppShowcase() {
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const activeFlow = productFlows[activeFlowIndex];
  const projectHref = `/project/new?prompt=${encodeURIComponent(activeFlow.prompt)}`;

  return (
    <section id="showcase" className="relative overflow-hidden bg-[#FAFAFA] pb-8 sm:pb-14">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_-20%,#222_0%,#080808_48%,#000_76%)] pb-36 pt-20 text-white sm:pb-44 sm:pt-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black/50" />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#75b9ed]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc] shadow-[0_0_12px_rgba(27,127,204,0.8)]" />
                Generated product flows
              </div>
              <h2 className="max-w-[880px] font-pixel-square text-[36px] font-semibold leading-[1.03] tracking-tight sm:text-5xl md:text-[54px] xl:text-[60px]">
                One screen can impress.
                <br />
                <span className="text-white/45">The whole product proves it.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/55 sm:text-base">
              Browse 18 screens across six complete mobile flows, each generated with one
              coherent visual language, consistent navigation, and production-ready structure.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              role="tablist"
              aria-label="Generated product flows"
              className="mx-auto flex w-max min-w-full items-center gap-1 rounded-[16px] border border-white/10 bg-white/[0.045] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur sm:min-w-0"
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
                    onClick={() => setActiveFlowIndex(index)}
                    className={`relative min-w-[180px] rounded-[11px] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#75b9ed] sm:min-w-0 sm:flex-1 ${
                      active ? "text-black" : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-flow-surface"
                        className="absolute inset-0 rounded-[11px] border border-white/70 bg-white shadow-[inset_0_-1px_2px_rgba(0,0,0,0.08)]"
                        transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <span className="relative flex items-center justify-between gap-3">
                      <span className="whitespace-nowrap text-[12px] font-semibold">{flow.name}</span>
                      <span className="flex -space-x-0.5">
                        {flow.palette.slice(1).map((color) => (
                          <span
                            key={color}
                            className="h-2 w-2 rounded-full border border-black/20"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-24 px-3 sm:-mt-28 sm:px-5">
        <div
          id="active-product-flow"
          role="tabpanel"
          className="relative mx-auto max-w-[1260px] overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#F2F2EF] p-1.5 shadow-[0_28px_75px_-60px_rgba(0,0,0,0.45)] sm:rounded-[32px] sm:p-2"
        >
          <div
            className="relative overflow-hidden rounded-[20px] border border-white/80 bg-[#F7F7F4] sm:rounded-[25px]"
            style={{
              backgroundImage: `radial-gradient(circle at 12% 12%, ${activeFlow.palette[3]}2b, transparent 30%), radial-gradient(circle at 88% 82%, ${activeFlow.palette[2]}0d, transparent 34%)`,
            }}
          >
            <div className="relative flex flex-col gap-3 px-5 pb-2 pt-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pt-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1b7fcc]">
                  Complete mobile flow
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-black sm:text-2xl">
                  {activeFlow.name}
                </h3>
              </div>
              <p className="max-w-md text-xs leading-5 text-black/45 sm:text-right sm:text-sm">
                {activeFlow.description}
              </p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeFlow.id}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-[11vw] pb-9 pt-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-10 sm:pb-12 sm:pt-9 lg:grid lg:grid-cols-3 lg:gap-9 lg:overflow-visible lg:px-12 xl:px-16">
                  {activeFlow.screens.map((screen, index) => (
                    <ScreenPreview key={screen.src} screen={screen} position={index} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative flex flex-col gap-5 border-t border-black/[0.07] bg-white/60 px-5 py-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-black/50 sm:text-xs">
                {["Three connected screens", "One consistent system", "Editable output"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </span>
                    {item}
                  </span>
                ))}
              </div>

              <Link
                href={projectHref}
                className="group flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-[9px] border border-[#5ba8e2]/35 bg-[#1b7fcc] px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-2px_3px_rgba(0,0,0,0.24)] transition-colors hover:bg-[#1975bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b7fcc]/30"
              >
                Build a flow like this
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
