import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Car,
  ChevronLeft,
  CreditCard,
  Ellipsis,
  Globe,
  House,
  Landmark,
  Link2,
  Lock,
  Nfc,
  PieChart,
  Plus,
  Send,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Snowflake,
  User,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A small, fully themable banking app rendered at iPhone size (390×844).
 * Every surface reads from CSS variables, so a token change restyles every screen at once.
 */

export const APP_WIDTH = 390;
export const APP_HEIGHT = 844;

export type AppTheme = {
  bg: string;
  surface: string;
  raised: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  positive: string;
  positiveSoft: string;
  border: string;
  nav: string;
  radius: number;
};

export const calmTheme: AppTheme = {
  bg: "#ffffff",
  surface: "#f3f4f7",
  raised: "#ffffff",
  text: "#0f172a",
  muted: "#6b7385",
  accent: "#2f6fed",
  accentSoft: "rgb(47 111 237 / 0.14)",
  onAccent: "#ffffff",
  positive: "#15803d",
  positiveSoft: "rgb(22 163 74 / 0.12)",
  border: "rgb(15 23 42 / 0.07)",
  nav: "#ffffff",
  radius: 18,
};

export const emeraldTheme: AppTheme = {
  ...calmTheme,
  accent: "#0d9f6e",
  accentSoft: "rgb(13 159 110 / 0.14)",
  radius: 28,
};

/** The mood a style reference (Midnight Bakery) carries over. */
export const warmDarkTheme: AppTheme = {
  bg: "#12100e",
  surface: "#1f1b17",
  raised: "#2a241f",
  text: "#f3e8d7",
  muted: "#a8998a",
  accent: "#c98b51",
  accentSoft: "rgb(201 139 81 / 0.18)",
  onAccent: "#12100e",
  positive: "#9fcb86",
  positiveSoft: "rgb(159 203 134 / 0.14)",
  border: "rgb(243 232 215 / 0.08)",
  nav: "#1a1714",
  radius: 22,
};

export function themeVars(theme: AppTheme): CSSProperties {
  return {
    "--app-bg": theme.bg,
    "--app-surface": theme.surface,
    "--app-raised": theme.raised,
    "--app-text": theme.text,
    "--app-muted": theme.muted,
    "--app-accent": theme.accent,
    "--app-accent-soft": theme.accentSoft,
    "--app-on-accent": theme.onAccent,
    "--app-positive": theme.positive,
    "--app-positive-soft": theme.positiveSoft,
    "--app-border": theme.border,
    "--app-nav": theme.nav,
    "--app-radius": `${theme.radius}px`,
  } as CSSProperties;
}

export type AppScreenName = "home" | "insights" | "wallet" | "transfer" | "goal";

/** Root of a single screen. Pass the theme once; everything inside follows it. */
export function AppFrame({
  theme,
  children,
  className,
  statusTone,
}: {
  theme: AppTheme;
  children: ReactNode;
  className?: string;
  statusTone?: "light" | "dark";
}) {
  return (
    <div
      className={cn("mk-app relative h-full w-full overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]", className)}
      style={themeVars(theme)}
    >
      <StatusBar tone={statusTone} />
      {children}
    </div>
  );
}

export function StatusBar({ tone }: { tone?: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "relative z-20 flex h-[54px] items-center justify-between px-8 pt-1 text-[16px] font-semibold tabular-nums",
        tone === "light" && "text-white",
      )}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-3 items-end gap-[2px]">
          {[4, 6, 8, 11].map((height) => (
            <span key={height} className="w-[3px] rounded-[1px] bg-current" style={{ height }} />
          ))}
        </span>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .5 10.2 10.2 0 0 0 .9 3.4L2 4.6a8.5 8.5 0 0 1 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.1-1.2A7 7 0 0 0 8 3.9a7 7 0 0 0-4.7 1.9L4.4 7A5.2 5.2 0 0 1 8 5.6Zm0 3.3c.6 0 1.1.2 1.5.6L8 11.1 6.5 9.5c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <span className="relative flex h-[12px] w-[25px] items-center rounded-[4px] border border-current/40 p-[1.5px]">
          <span className="h-full w-[76%] rounded-[2px] bg-current" />
          <span className="absolute -right-[3px] top-1/2 h-[4px] w-[1.5px] -translate-y-1/2 rounded-r bg-current/40" />
        </span>
      </span>
    </div>
  );
}

/** Wraps a block that "builds" during generation: a skeleton that resolves into content. */
export function Build({
  ready = true,
  children,
  className,
  delay = 0,
}: {
  ready?: boolean;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      <div
        className="transition-[opacity,transform,filter] duration-500 ease-mk"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? "none" : "translateY(8px)",
          filter: ready ? "none" : "blur(6px)",
          transitionDelay: ready ? `${delay}ms` : "0ms",
        }}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "mk-skeleton pointer-events-none absolute inset-0 rounded-[var(--app-radius)] transition-opacity duration-500",
          !ready && "mk-skeleton-sheen",
        )}
        style={{ opacity: ready ? 0 : 1, transitionDelay: ready ? `${delay}ms` : "0ms" }}
      />
    </div>
  );
}

const navItems = [
  { id: "home", label: "Home", icon: House },
  { id: "insights", label: "Insights", icon: PieChart },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type NavTab = (typeof navItems)[number]["id"];

export function BottomNav({ active, ready = true, overlay }: { active: NavTab; ready?: boolean; overlay?: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
      <Build ready={ready} className="rounded-[calc(var(--app-radius)_+_8px)]">
        <div
          data-anchor="nav"
          className="relative flex h-[66px] items-center justify-around rounded-[calc(var(--app-radius)_+_8px)] border border-[var(--app-border)] bg-[var(--app-nav)] shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]"
        >
          {navItems.map(({ id, label, icon: Icon }) => (
            <span
              key={id}
              className={cn(
                "flex w-16 flex-col items-center gap-1 text-[11px] font-medium",
                id === active ? "text-[var(--app-accent)]" : "text-[var(--app-muted)]",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={id === active ? 2.3 : 1.8} />
              {label}
            </span>
          ))}
          {overlay}
        </div>
      </Build>
    </div>
  );
}

function ScreenHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-[52px] items-center justify-between px-5">
      <span className="flex size-10 items-center justify-center rounded-full bg-[var(--app-surface)]">
        {left ?? <User className="size-[19px]" strokeWidth={1.9} />}
      </span>
      <span className="text-[17px] font-semibold tracking-tight">{title}</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-[var(--app-surface)]">
        {right ?? <Bell className="size-[19px]" strokeWidth={1.9} />}
      </span>
    </div>
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-[7px] w-full overflow-hidden rounded-full bg-[var(--app-surface)]", className)}>
      <div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: `${value}%` }} />
    </div>
  );
}

function PositiveChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--app-positive-soft)] px-2 py-1 text-[12px] font-semibold text-[var(--app-positive)]">
      <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
      {children}
    </span>
  );
}

/* ───────────────────────────── Home ───────────────────────────── */

export type HomeProps = {
  /** Number of blocks that have finished building (0–5). Omit for a finished screen. */
  built?: number;
  balanceVariant?: "default" | "deep";
  savingsVariant?: "default" | "ring";
  budgetTitle?: ReactNode;
  overlays?: Partial<Record<"header" | "balance" | "stats" | "actions" | "budget" | "shopping" | "nav", ReactNode>>;
};

export function HomeScreen({
  built = 5,
  balanceVariant = "default",
  savingsVariant = "default",
  budgetTitle = "Monthly budget",
  overlays = {},
}: HomeProps) {
  const deep = balanceVariant === "deep";

  return (
    <>
      <Build ready={built > 0} className="mx-5 rounded-full">
        <div data-anchor="header" className="relative -mx-5 rounded-[var(--app-radius)]">
          <ScreenHeader title="Good morning, Kim!" />
          {overlays.header}
        </div>
      </Build>

      <Build ready={built > 1} className="mx-5 mt-3 rounded-[var(--app-radius)]" delay={40}>
        <div data-anchor="balance" className="relative rounded-[var(--app-radius)]">
          <div
            className={cn(
              "relative overflow-hidden rounded-[var(--app-radius)] p-[18px]",
              deep ? "bg-[#1b3db8] text-white shadow-[0_22px_48px_-20px_rgba(37,76,212,0.9)]" : "bg-[var(--app-surface)]",
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,#4f7dff_0%,transparent_55%),radial-gradient(90%_80%_at_0%_100%,#0f2a8a_0%,transparent_60%)] transition-opacity duration-700"
              style={{ opacity: deep ? 1 : 0 }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className={cn("text-[14px] font-medium", deep ? "text-white/70" : "text-[var(--app-muted)]")}>Total balance</div>
                <div className="mt-1 text-[30px] font-bold leading-tight tracking-tight tabular-nums">$109,520.00</div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[12px] font-semibold",
                  deep ? "bg-white/15 text-white" : "bg-[var(--app-positive-soft)] text-[var(--app-positive)]",
                )}
              >
                <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
                14.5%
              </span>
            </div>

            <div data-anchor="stats" className="relative mt-4 grid grid-cols-2 gap-2.5 rounded-[calc(var(--app-radius)_-_6px)]">
              <StatTile deep={deep} label="Spending" value="$2,750.00" />
              {savingsVariant === "ring" ? (
                <SavingsRingTile deep={deep} />
              ) : (
                <StatTile deep={deep} label="Savings" value="$15,000.00" />
              )}
              {overlays.stats}
            </div>
          </div>
          {overlays.balance}
        </div>
      </Build>

      <Build ready={built > 2} className="mx-5 mt-5 rounded-[var(--app-radius)]" delay={80}>
        <div data-anchor="actions" className="relative grid grid-cols-4 gap-2 rounded-[var(--app-radius)]">
          {[
            { label: "Send", icon: Send, primary: true },
            { label: "Request", icon: ArrowDownToLine, primary: false },
            { label: "Cards", icon: CreditCard, primary: false },
            { label: "More", icon: Ellipsis, primary: false },
          ].map(({ label, icon: Icon, primary }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-full",
                  primary ? "bg-[var(--app-accent)] text-[var(--app-on-accent)] shadow-[0_10px_22px_-12px_var(--app-accent)]" : "bg-[var(--app-surface)]",
                )}
              >
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <span className="text-[13px] font-medium">{label}</span>
            </div>
          ))}
          {overlays.actions}
        </div>
      </Build>

      <Build ready={built > 3} className="mx-5 mt-6 rounded-[var(--app-radius)]" delay={120}>
        <div data-anchor="budget" className="relative rounded-[var(--app-radius)]">
          <div className="flex items-baseline justify-between">
            <span data-anchor="budget-title" className="relative text-[17px] font-semibold tracking-tight">
              {budgetTitle}
            </span>
            <span className="text-[14px] text-[var(--app-muted)]">See all</span>
          </div>
          <BudgetRow anchor="shopping" icon={ShoppingBag} title="Shopping" detail="$320 left from $1,600" amount="$1,280" value={80} overlay={overlays.shopping} />
          <BudgetRow icon={Car} title="Transport" detail="$150 left from $600" amount="$450" value={75} />
          {overlays.budget}
        </div>
      </Build>

      <BottomNav active="home" ready={built > 4} overlay={overlays.nav} />
    </>
  );
}

function StatTile({ label, value, deep }: { label: string; value: string; deep: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--app-radius)_-_6px)] p-3.5",
        deep ? "bg-white/10" : "bg-[var(--app-raised)]",
      )}
    >
      <div className={cn("text-[13px] font-medium", deep ? "text-white/70" : "text-[var(--app-muted)]")}>{label}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SavingsRingTile({ deep }: { deep: boolean }) {
  const circumference = 2 * Math.PI * 17;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[calc(var(--app-radius)_-_6px)] p-3",
        deep ? "bg-white/10" : "bg-[var(--app-raised)]",
      )}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r="17" fill="none" stroke="var(--app-accent-soft)" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r="17"
          fill="none"
          stroke="var(--app-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.32}
        />
      </svg>
      <div>
        <div className={cn("text-[12px] font-medium", deep ? "text-white/70" : "text-[var(--app-muted)]")}>Goal · 68%</div>
        <div className="text-[15px] font-bold tabular-nums">$15,000</div>
      </div>
    </div>
  );
}

function BudgetRow({
  anchor,
  icon: Icon,
  title,
  detail,
  amount,
  value,
  overlay,
}: {
  anchor?: string;
  icon: typeof ShoppingBag;
  title: string;
  detail: string;
  amount: string;
  value: number;
  overlay?: ReactNode;
}) {
  return (
    <div data-anchor={anchor} className="relative mt-4 rounded-[calc(var(--app-radius)_-_6px)]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[calc(var(--app-radius)_-_6px)] bg-[var(--app-surface)]">
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold">{title}</div>
          <div className="text-[13px] text-[var(--app-muted)]">{detail}</div>
        </div>
        <div className="text-[16px] font-semibold tabular-nums">{amount}</div>
      </div>
      <ProgressBar value={value} className="mt-3" />
      {overlay}
    </div>
  );
}

/* ───────────────────────────── Insights ───────────────────────────── */

const spendBars = [58, 86, 44, 72, 30, 64, 50];
const spendDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function InsightsScreen({ built = 5 }: { built?: number }) {
  return (
    <>
      <Build ready={built > 0} className="mx-5 rounded-full">
        <div className="-mx-5">
          <ScreenHeader title="Insights" right={<SlidersHorizontal className="size-[18px]" strokeWidth={1.9} />} />
        </div>
      </Build>

      <Build ready={built > 1} className="mx-5 mt-3 rounded-[var(--app-radius)]" delay={40}>
        <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] p-[18px]">
          <div className="text-[13px] font-medium text-[var(--app-muted)]">Monthly dining out budget</div>
          <div className="mt-1 text-[17px] font-semibold">$120 left of $500</div>
          <ProgressBar value={76} className="mt-3 bg-[var(--app-raised)]" />
        </div>
      </Build>

      <Build ready={built > 2} className="mx-5 mt-3 rounded-[var(--app-radius)]" delay={80}>
        <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] p-[18px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[13px] font-medium text-[var(--app-muted)]">Total spent</div>
              <div className="mt-1 text-[30px] font-bold leading-tight tracking-tight tabular-nums">$109,520.00</div>
            </div>
            <PositiveChip>3.5%</PositiveChip>
          </div>
          <div className="mt-5 flex h-[120px] items-end justify-between gap-2">
            {spendBars.map((height, index) => (
              <div key={spendDays[index]} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-[100px] w-full items-end overflow-hidden rounded-[calc(var(--app-radius)_-_8px)] bg-[var(--app-raised)]">
                  <div
                    className="w-full rounded-[calc(var(--app-radius)_-_8px)] bg-[var(--app-accent)]"
                    style={{ height: `${height}%`, opacity: index === 1 ? 1 : 0.55 }}
                  />
                </div>
                <span className="text-[11px] text-[var(--app-muted)]">{spendDays[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </Build>

      <Build ready={built > 3} className="mx-5 mt-3 rounded-[var(--app-radius)]" delay={120}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Daily average", value: "$1,726.00", icon: CalendarDays },
            { label: "Highest spend", value: "Shopping", icon: Link2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[var(--app-radius)] bg-[var(--app-surface)] p-4 text-center">
              <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <div className="mt-3 text-[12px] text-[var(--app-muted)]">{label}</div>
              <div className="mt-0.5 text-[16px] font-bold">{value}</div>
            </div>
          ))}
        </div>
      </Build>

      <BottomNav active="insights" ready={built > 4} />
    </>
  );
}

/* ───────────────────────────── Wallet ───────────────────────────── */

export function WalletScreen({ built = 5 }: { built?: number }) {
  return (
    <>
      <Build ready={built > 0} className="mx-5 rounded-full">
        <div className="-mx-5">
          <ScreenHeader title="Wallet" right={<Plus className="size-[19px]" strokeWidth={1.9} />} />
        </div>
      </Build>

      <Build ready={built > 1} className="mx-5 mt-3 rounded-[var(--app-radius)]" delay={40}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-9 w-14 rounded-[10px] bg-[var(--app-accent)] opacity-80" />
            <span className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--app-surface)] px-2.5 text-[11px] font-semibold">
              <span className="h-5 w-7 rounded-[5px] bg-gradient-to-br from-rose-400 to-pink-500" />
              •••• 7482
            </span>
          </div>
          <div className="mt-6 text-[13px] text-[var(--app-muted)]">Total balance</div>
          <div className="mt-1 text-[36px] font-bold tracking-tight tabular-nums">$2,746.08</div>
          <div className="mt-2 inline-flex">
            <PositiveChip>9.67% vs last month</PositiveChip>
          </div>
        </div>
      </Build>

      <Build ready={built > 2} className="mx-5 mt-6 rounded-[var(--app-radius)]" delay={80}>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: "Top up", icon: Plus },
            { label: "Freeze", icon: Snowflake },
            { label: "Details", icon: Landmark },
            { label: "Limits", icon: Lock },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="flex size-[58px] items-center justify-center rounded-[calc(var(--app-radius)_-_2px)] bg-[var(--app-surface)]">
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <span className="text-[12px] font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </Build>

      <Build ready={built > 3} className="mx-5 mt-6 rounded-[var(--app-radius)]" delay={120}>
        <div className="space-y-2.5">
          {[
            { title: "Online payments", detail: "Pay on websites and apps", icon: Globe, on: true },
            { title: "Contactless", detail: "Tap to pay in stores", icon: Nfc, on: false },
            { title: "ATM withdrawals", detail: "Withdraw cash from ATMs", icon: CreditCard, on: true },
          ].map(({ title, detail, icon: Icon, on }) => (
            <div key={title} className="flex items-center gap-3 rounded-[var(--app-radius)] bg-[var(--app-surface)] px-4 py-3.5">
              <Icon className="size-5 shrink-0 text-[var(--app-muted)]" strokeWidth={1.9} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{title}</div>
                <div className="text-[12px] text-[var(--app-muted)]">{detail}</div>
              </div>
              <span className={cn("flex h-[28px] w-[48px] items-center rounded-full p-[3px]", on ? "bg-[var(--app-accent)]" : "bg-[var(--app-border)]")}>
                <span className={cn("size-[22px] rounded-full bg-white shadow-sm", on && "translate-x-[20px]")} />
              </span>
            </div>
          ))}
        </div>
      </Build>

      <BottomNav active="wallet" ready={built > 4} />
    </>
  );
}

/* ───────────────────────────── Transfer ───────────────────────────── */

const recipients = [
  { name: "Maya", initials: "M", tint: "from-amber-200 to-orange-300" },
  { name: "Leo", initials: "L", tint: "from-sky-200 to-blue-300" },
  { name: "Ana", initials: "A", tint: "from-rose-200 to-pink-300" },
  { name: "Omar", initials: "O", tint: "from-emerald-200 to-teal-300" },
];

export function TransferScreen() {
  return (
    <>
      <div className="flex h-[52px] items-center justify-between px-5">
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--app-surface)]">
          <ChevronLeft className="size-5" strokeWidth={2} />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">Send money</span>
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--app-surface)]">
          <X className="size-[18px]" strokeWidth={2} />
        </span>
      </div>

      <div className="mx-5 mt-4">
        <div className="text-[13px] font-medium text-[var(--app-muted)]">To</div>
        <div className="mt-3 flex items-center gap-4">
          {recipients.map((person, index) => (
            <div key={person.name} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-[54px] items-center justify-center rounded-full bg-gradient-to-br text-[17px] font-bold text-slate-800",
                  person.tint,
                  index === 0 && "ring-[3px] ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-bg)]",
                )}
              >
                {person.initials}
              </span>
              <span className="text-[12px] font-medium">{person.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-8 rounded-[var(--app-radius)] bg-[var(--app-surface)] px-5 py-7 text-center">
        <div className="text-[13px] text-[var(--app-muted)]">Amount</div>
        <div className="mt-1 text-[46px] font-bold tracking-tight tabular-nums">$250.00</div>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--app-raised)] px-3 py-1.5 text-[12px] font-semibold">
          <span className="h-3.5 w-5 rounded-[3px] bg-[var(--app-accent)]" />
          Everyday •••• 7482
        </span>
      </div>

      <div className="mx-5 mt-3 flex items-center justify-between rounded-[var(--app-radius)] bg-[var(--app-surface)] px-4 py-4 text-[14px]">
        <span className="text-[var(--app-muted)]">Note</span>
        <span className="font-medium">Dinner on Friday 🍜</span>
      </div>

      <div className="absolute inset-x-5 bottom-9">
        <div className="flex h-[56px] items-center justify-center rounded-full bg-[var(--app-accent)] text-[16px] font-semibold text-[var(--app-on-accent)]">
          Send $250.00
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────── Goal (image) ───────────────────────────── */

/** Illustrated "photos" for the image-replacement demo. */
export function GoalArt({ variant }: { variant: "dusk" | "night" }) {
  const night = variant === "night";
  return (
    <svg viewBox="0 0 390 330" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          {night ? (
            <>
              <stop offset="0" stopColor="#0b1437" />
              <stop offset="0.55" stopColor="#23306e" />
              <stop offset="1" stopColor="#6a4c8f" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#f7c6a3" />
              <stop offset="0.5" stopColor="#f3a6a0" />
              <stop offset="1" stopColor="#c98fb5" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`sun-${variant}`} cx="0.72" cy="0.38" r="0.3">
          <stop offset="0" stopColor={night ? "#fff7d6" : "#fff4e0"} stopOpacity="0.95" />
          <stop offset="1" stopColor={night ? "#fff7d6" : "#fff4e0"} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="330" fill={`url(#sky-${variant})`} />
      <circle cx="282" cy="118" r={night ? 22 : 34} fill={night ? "#fff5d1" : "#fff1dc"} opacity={night ? 0.95 : 0.9} />
      <rect width="390" height="330" fill={`url(#sun-${variant})`} />
      {night
        ? Array.from({ length: 26 }, (_, index) => (
            <circle key={index} cx={(index * 67) % 390} cy={(index * 37) % 150} r={index % 3 === 0 ? 1.4 : 0.9} fill="#fff" opacity="0.7" />
          ))
        : null}
      <path d="M0 250 C60 230 110 236 160 246 C220 258 280 236 390 244 L390 330 L0 330 Z" fill={night ? "#1b1f4a" : "#b9778f"} opacity="0.9" />
      <g fill={night ? "#0c0f2b" : "#5b3350"}>
        <rect x="170" y="150" width="40" height="120" />
        <path d="M150 158 L230 158 L214 142 L166 142 Z" />
        <path d="M156 190 L224 190 L210 176 L170 176 Z" />
        <path d="M160 222 L220 222 L208 208 L172 208 Z" />
        <path d="M184 142 L196 118 L196 142 Z" />
      </g>
      {night
        ? [110, 150, 236, 276].map((x) => <circle key={x} cx={x} cy={262} r="4" fill="#ffb454" opacity="0.9" />)
        : null}
      <path d="M0 280 C90 266 150 290 220 282 C290 274 330 290 390 284 L390 330 L0 330 Z" fill={night ? "#080a1f" : "#7a4467"} />
    </svg>
  );
}

export function GoalScreen({ art, overlays = {} }: { art: "dusk" | "night"; overlays?: Partial<Record<"image", ReactNode>> }) {
  return (
    <div className="absolute inset-0">
      <div data-anchor="goal-image" className="absolute inset-x-0 top-0 h-[360px]">
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: art === "dusk" ? 1 : 0 }}>
          <GoalArt variant="dusk" />
        </div>
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: art === "night" ? 1 : 0 }}>
          <GoalArt variant="night" />
        </div>
        <div className="absolute inset-x-5 top-[62px] flex justify-between">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/80 text-slate-900 backdrop-blur">
            <ChevronLeft className="size-5" strokeWidth={2} />
          </span>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/80 text-slate-900 backdrop-blur">
            <ArrowUpRight className="size-[18px]" strokeWidth={2} />
          </span>
        </div>
        {overlays.image}
      </div>

      <div className="absolute inset-x-0 top-[330px] bottom-0 rounded-t-[28px] bg-[var(--app-bg)] px-5 pt-6">
        <div className="text-[13px] font-medium text-[var(--app-muted)]">Savings goal</div>
        <div className="mt-1 text-[26px] font-bold tracking-tight">Trip to Kyoto</div>
        <div className="mt-4 flex items-baseline justify-between text-[14px]">
          <span className="font-semibold tabular-nums">$3,240 saved</span>
          <span className="text-[var(--app-muted)]">of $5,000</span>
        </div>
        <ProgressBar value={65} className="mt-2.5" />
        <div className="mt-6 text-[15px] font-semibold">Recent contributions</div>
        {[
          { label: "Round-ups", date: "Today", amount: "+$12.40" },
          { label: "Weekly transfer", date: "Mon", amount: "+$150.00" },
        ].map((row) => (
          <div key={row.label} className="mt-3 flex items-center justify-between rounded-[var(--app-radius)] bg-[var(--app-surface)] px-4 py-3.5">
            <div>
              <div className="text-[14px] font-semibold">{row.label}</div>
              <div className="text-[12px] text-[var(--app-muted)]">{row.date}</div>
            </div>
            <span className="text-[14px] font-semibold text-[var(--app-positive)] tabular-nums">{row.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
