"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
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
    id: "neo-mint",
    index: "01",
    name: "Neo Mint",
    description: "High-contrast finance screens with sharp hierarchy and restrained mint energy.",
    prompt: "Design a high-contrast black and mint finance app with a dashboard, calendar analytics, and expense detail.",
    palette: ["#000000", "#FFFFFF", "#4ADE80", "#E55B5B"],
    screens: [
      { label: "Dashboard", role: "Overview", src: "/screens/NeoMintPremium/Dashboard.html" },
      { label: "Calendar", role: "Analytics", src: "/screens/NeoMintPremium/CalendarAnalytics.html" },
      { label: "Expense", role: "Detail", src: "/screens/NeoMintPremium/ExpenseDetail.html" },
    ],
  },
  {
    id: "minimal-habit-premium",
    index: "02",
    name: "Quiet Habit",
    description: "A serene habit system with disciplined spacing and calm progress views.",
    prompt: "Create a premium minimalist habit tracker with a habit dashboard, history, and focused analytics.",
    palette: ["#F5F1E8", "#FFFFFF", "#23211D", "#A9B59B"],
    screens: [
      { label: "Habits", role: "Dashboard", src: "/screens/PremiumMinimalistHabit/HabitDashboard.html" },
      { label: "History", role: "Progress", src: "/screens/PremiumMinimalistHabit/History.html" },
      { label: "Analytics", role: "Insight", src: "/screens/PremiumMinimalistHabit/Analytics.html" },
    ],
  },
  {
    id: "fintech",
    index: "03",
    name: "Fintech",
    description: "Expressive financial analytics shaped for fast reading and confident decisions.",
    prompt: "Create a premium fintech app with profit analytics, sales overview, and wallet transactions.",
    palette: ["#070707", "#FFFFFF", "#F0D49A", "#A9DBC0"],
    screens: [
      { label: "Profit", role: "Analytics", src: "/screens/Fintech/ProfitAnalytics.html" },
      { label: "Sales", role: "Overview", src: "/screens/Fintech/SalesOverview.html" },
      { label: "Wallet", role: "Transactions", src: "/screens/Fintech/WalletTransactions.html" },
    ],
  },
  {
    id: "onyx-performance",
    index: "04",
    name: "Onyx Performance",
    description: "Focused performance screens shaped by contrast, energy, and control.",
    prompt: "Build a focused dark performance app with a home dashboard, guided routine, and precise settings.",
    palette: ["#000000", "#121212", "#32D74B", "#F2F2F2"],
    screens: [
      { label: "Home", role: "Momentum", src: "/screens/OnyxPerformance/Home.html" },
      { label: "Routine", role: "Guidance", src: "/screens/OnyxPerformance/Routine.html" },
      { label: "Settings", role: "Control", src: "/screens/OnyxPerformance/Settings.html" },
    ],
  },
  {
    id: "food-delivery",
    index: "05",
    name: "Food Delivery",
    description: "Warm commerce screens that make discovery, selection, and ordering feel effortless.",
    prompt: "Design a premium food delivery app with a discovery home, food detail, and order tracking.",
    palette: ["#FFF9F1", "#FFFFFF", "#191713", "#E8753D"],
    screens: [
      { label: "Home", role: "Discovery", src: "/screens/FoodDelivery/Home.html" },
      { label: "Food", role: "Detail", src: "/screens/FoodDelivery/FoodDetail.html" },
      { label: "Orders", role: "Tracking", src: "/screens/FoodDelivery/Orders.html" },
    ],
  },
  {
    id: "premium-ecom",
    index: "06",
    name: "Premium Commerce",
    description: "Editorial product presentation with a polished, conversion-focused purchase journey.",
    prompt: "Create a premium ecommerce app with an editorial storefront and detailed product experience.",
    palette: ["#F5F0E8", "#FFFFFF", "#181714", "#C8A96A"],
    screens: [
      { label: "Store", role: "Home", src: "/screens/PremiumEcom/Home.html" },
      { label: "Product", role: "Detail", src: "/screens/PremiumEcom/ProductDetail.html" },
    ],
  },
  {
    id: "gamification",
    index: "07",
    name: "Gamification",
    description: "Energetic progression screens with clear goals, rewards, and social momentum.",
    prompt: "Design a polished gamification app with a home dashboard, challenges, and leaderboard.",
    palette: ["#131313", "#FFFFFF", "#F3C84B", "#E86B52"],
    screens: [
      { label: "Home", role: "Progress", src: "/screens/Gamification/Home.html" },
      { label: "Challenges", role: "Goals", src: "/screens/Gamification/Challenges.html" },
      { label: "Leaderboard", role: "Social", src: "/screens/Gamification/Leaderboard.html" },
    ],
  },
  {
    id: "midnight-bakery",
    index: "08",
    name: "Midnight Bakery",
    description: "A characterful dark storefront with warm product storytelling and tactile depth.",
    prompt: "Create a premium dark bakery app with a storefront and richly presented product screens.",
    palette: ["#11100F", "#F3E8D7", "#C98B51", "#7A4B2C"],
    screens: [
      { label: "Home", role: "Storefront", src: "/screens/MidnightBakery/Home.html" },
      { label: "Collection", role: "Browse", src: "/screens/MidnightBakery/NewScreen1.html" },
      { label: "Product", role: "Detail", src: "/screens/MidnightBakery/NewScreen2.html" },
    ],
  },
  {
    id: "smart-home",
    index: "09",
    name: "Smart Home",
    description: "A calm control environment balancing household context with precise device actions.",
    prompt: "Design a modern smart home controller with overview, room detail, and device control screens.",
    palette: ["#F1F0EB", "#FFFFFF", "#20221F", "#B8C8B1"],
    screens: [
      { label: "Home", role: "Overview", src: "/screens/SmartHome/HomeOverview.html" },
      { label: "Room", role: "Detail", src: "/screens/SmartHome/RoomDetail.html" },
      { label: "Device", role: "Control", src: "/screens/SmartHome/DeviceControl.html" },
    ],
  },
  {
    id: "running-tracker",
    index: "10",
    name: "Running Tracker",
    description: "High-energy fitness screens built around motion, metrics, and personal momentum.",
    prompt: "Create a premium running tracker with welcome, live run tracking, and health dashboard.",
    palette: ["#10110F", "#FFFFFF", "#C7FF35", "#6D7B57"],
    screens: [
      { label: "Welcome", role: "Start", src: "/screens/RunningTracker/WelcomeScreen.html" },
      { label: "Run", role: "Tracking", src: "/screens/RunningTracker/RunningTracker.html" },
      { label: "Health", role: "Dashboard", src: "/screens/RunningTracker/HealthDashboard.html" },
    ],
  },
  {
    id: "midnight-precision",
    index: "11",
    name: "Midnight Precision",
    description: "Disciplined monochrome screens with a sharp, editorial visual language.",
    prompt: "Create a precise monochrome productivity app with welcome, login, and structured dashboard.",
    palette: ["#0A0A0A", "#1A1A1A", "#FFFFFF", "#444444"],
    screens: [
      { label: "Welcome", role: "Introduction", src: "/screens/MidnightPrecision/Welcome.html" },
      { label: "Sign in", role: "Access", src: "/screens/MidnightPrecision/Login.html" },
      { label: "Dashboard", role: "Workspace", src: "/screens/MidnightPrecision/Dashboard.html" },
    ],
  },
  {
    id: "minimalist-habit",
    index: "12",
    name: "Minimal Habit",
    description: "Clean habit-building screens with a focused path from intent to measurable progress.",
    prompt: "Design a minimalist habit tracker with welcome, dashboard, and habit progress detail.",
    palette: ["#FAFAF7", "#FFFFFF", "#171715", "#D1D8C7"],
    screens: [
      { label: "Welcome", role: "Start", src: "/screens/MinimalistHabit/Welcome.html" },
      { label: "Dashboard", role: "Habits", src: "/screens/MinimalistHabit/Dashboard.html" },
      { label: "Progress", role: "Detail", src: "/screens/MinimalistHabit/HabitDetailsProgress.html" },
    ],
  },
  {
    id: "security",
    index: "13",
    name: "Calm Security",
    description: "Trust-centered security screens that feel precise without becoming cold.",
    prompt: "Design a calm security app with watchtower dashboard, private vault, and add-item flow.",
    palette: ["#F9F9F7", "#FFFFFF", "#121212", "#B9D8C2"],
    screens: [
      { label: "Watchtower", role: "Status", src: "/screens/Security/WatchtowerDashboard.html" },
      { label: "Vault", role: "Library", src: "/screens/Security/ItemsVault.html" },
      { label: "Add item", role: "Action", src: "/screens/Security/AddNewItem.html" },
    ],
  },
  {
    id: "modern-dark-fintech",
    index: "14",
    name: "Dark Fintech",
    description: "A deep financial interface with layered surfaces and focused account intelligence.",
    prompt: "Create a modern dark fintech app with dashboard, insights, and card management.",
    palette: ["#090A0C", "#17191D", "#F4F5F7", "#78BFA5"],
    screens: [
      { label: "Dashboard", role: "Overview", src: "/screens/ModernDarkFintech/Dashboard.html" },
      { label: "Insights", role: "Analytics", src: "/screens/ModernDarkFintech/Insights.html" },
      { label: "Card", role: "Management", src: "/screens/ModernDarkFintech/MyCard.html" },
    ],
  },
  {
    id: "neobank",
    index: "15",
    name: "Neobank",
    description: "A refined digital banking experience with clear control and intelligent insights.",
    prompt: "Design a premium neobank app with dashboard, card management, and financial insights.",
    palette: ["#F2F3EE", "#FFFFFF", "#171817", "#B9CE9B"],
    screens: [
      { label: "Dashboard", role: "Overview", src: "/screens/Neobank/Dashboard.html" },
      { label: "Cards", role: "Management", src: "/screens/Neobank/CardManagement.html" },
      { label: "Insights", role: "Analytics", src: "/screens/Neobank/Insights.html" },
    ],
  },
  {
    id: "petcare",
    index: "16",
    name: "Petcare",
    description: "Friendly care screens balancing warmth, daily tasks, and useful health records.",
    prompt: "Create a premium pet care app with pet dashboard, daily checklist, and health log.",
    palette: ["#F1F8F6", "#FFFFFF", "#24302D", "#E7B896"],
    screens: [
      { label: "Dashboard", role: "Pet", src: "/screens/Petcare/PetDashboard.html" },
      { label: "Daily care", role: "Checklist", src: "/screens/Petcare/DailyCareChecklist.html" },
      { label: "Health", role: "Vet log", src: "/screens/Petcare/HealthVetLog.html" },
    ],
  },
  {
    id: "soft-financial",
    index: "17",
    name: "Soft Financial",
    description: "Gentle financial surfaces that make cards, spending, and insights approachable.",
    prompt: "Design a soft premium finance tracker with home, card detail, and spending insights.",
    palette: ["#F6F4F0", "#FFFFFF", "#262522", "#D4BCA2"],
    screens: [
      { label: "Home", role: "Overview", src: "/screens/SoftFinancialTracker/Home.html" },
      { label: "Card", role: "Wallet", src: "/screens/SoftFinancialTracker/MyCard.html" },
      { label: "Insights", role: "Analytics", src: "/screens/SoftFinancialTracker/Insights.html" },
    ],
  },
  {
    id: "soft-tech",
    index: "18",
    name: "Soft Tech",
    description: "A restrained social workspace with considered rhythm and hierarchy.",
    prompt: "Create a premium soft-tech collaboration app with home, activity feed, and chat thread.",
    palette: ["#F5F5F5", "#FFFFFF", "#111111", "#D7E6DD"],
    screens: [
      { label: "Home", role: "Workspace", src: "/screens/SoftTechPremium/Home.html" },
      { label: "Activity", role: "Updates", src: "/screens/SoftTechPremium/ActivityFeed.html" },
      { label: "Chat", role: "Conversation", src: "/screens/SoftTechPremium/ChatThread.html" },
    ],
  },
];

const ScreenPreview = ({
  screen,
  position,
}: {
  screen: ShowcaseScreen;
  position: number;
}) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const updateScale = () => setScale(preview.clientWidth / 390);
    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(preview);

    return () => observer.disconnect();
  }, []);

  return (
  <article className="w-full min-w-0 max-w-[300px] [@media(max-height:760px)_and_(min-width:1024px)]:max-w-[220px]">
    <div ref={previewRef} className="relative w-full" style={{ aspectRatio: "390 / 844" }}>
      <div
        className="absolute left-0 top-0 h-[844px] w-[390px] origin-top-left overflow-hidden rounded-[34px] border border-black/[0.16] bg-[#d8d8d4] p-[5px] shadow-[0_24px_55px_-42px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.8)]"
        style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
      >
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
    </div>

    <div className="mt-2 flex min-w-0 items-center justify-center gap-1 text-center sm:mt-3 sm:gap-2">
      <span className="hidden h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[9px] font-semibold text-black/45 sm:flex">
        {position + 1}
      </span>
      <div className="truncate text-[9px] font-semibold tracking-tight text-black/75 sm:text-[11px] lg:text-[12px]">
        {screen.label}
        <span className="ml-1.5 hidden font-normal text-black/35 md:inline">{screen.role}</span>
      </div>
    </div>
  </article>
  );
};

export default function AppShowcase() {
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const activeFlow = productFlows[activeFlowIndex];
  const totalScreens = productFlows.reduce((total, flow) => total + flow.screens.length, 0);
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
                Generated by Drawgle
              </div>
              <h2 className="max-w-[880px] font-pixel-square text-[36px] font-semibold leading-[1.03] tracking-tight sm:text-5xl md:text-[54px] xl:text-[60px]">
                Premium screens,
                <br />
                <span className="text-white/45">designed beyond the prompt.</span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/55 sm:text-base">
              Explore {totalScreens} original mobile screens generated by Drawgle across{" "}
              {productFlows.length} carefully curated visual directions.
            </p>
          </div>

          <div className="mt-10 sm:mt-12">
            <div
              role="tablist"
              aria-label="Generated screen collections"
              className="mx-auto flex max-w-[1080px] flex-wrap justify-center gap-1.5"
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
                    onClick={() => setActiveFlowIndex(index)}
                    className={`relative rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b9ed]/70 sm:px-3.5 sm:py-2 sm:text-[11px] ${
                      active
                        ? "border-white/80 text-black"
                        : "border-white/10 bg-white/[0.035] text-white/50 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-flow-surface"
                        className="absolute inset-0 rounded-full bg-white shadow-[inset_0_-1px_2px_rgba(0,0,0,0.12)]"
                        transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <span className="relative flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className={`h-1.5 w-1.5 rounded-full border ${
                          active ? "border-black/15" : "border-white/15"
                        }`}
                        style={{ backgroundColor: flow.palette[3] }}
                      />
                      {flow.name}
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
          className="relative mx-auto max-w-[1260px] overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#F2F2EF] p-1.5 sm:rounded-[32px] sm:p-2"
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
                  Curated screen collection
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
                <div
                  className={`mx-auto grid items-start justify-items-center gap-[clamp(3px,1.5vw,40px)] px-[clamp(4px,2vw,48px)] pb-7 pt-5 sm:pb-10 sm:pt-8 ${
                    activeFlow.screens.length === 2 ? "max-w-[760px] grid-cols-2" : "grid-cols-3"
                  }`}
                >
                  {activeFlow.screens.map((screen, index) => (
                    <ScreenPreview key={screen.src} screen={screen} position={index} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative flex flex-col gap-5 border-t border-black/[0.07] bg-white/60 px-5 py-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-black/50 sm:text-xs">
                {["Original screen design", "Distinct visual directions", "Editable output"].map((item) => (
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
                Design a screen like this
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
