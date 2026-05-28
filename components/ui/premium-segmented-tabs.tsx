"use client";

import { useId, type ComponentType, type ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";

import { cn } from "@/lib/utils";

const activeTabSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 34,
  mass: 0.82,
};

const quickPanel = {
  duration: 0.16,
  ease: "easeOut",
} as const;

export type PremiumSegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  compactLabel?: string;
  icon?: ComponentType<{ className?: string }>;
};

export function PremiumSegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  className,
  tabClassName,
  activeClassName,
  inactiveClassName,
  layoutId,
  size = "md",
  fullWidth = true,
  hideLabelsOnMobile = false,
}: {
  items: Array<PremiumSegmentedTabItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  tabClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  layoutId?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  hideLabelsOnMobile?: boolean;
}) {
  const generatedId = useId();
  const reduceMotion = useReducedMotion();
  const groupId = layoutId ?? generatedId;
  const activeLayoutId = `${groupId}-active-tab`;

  return (
    <LayoutGroup id={groupId}>
      <div
        className={cn(
          "relative flex items-center gap-1 rounded-[14px] border border-[var(--dg-border)] bg-[var(--dg-surface-muted)] p-1 text-[var(--dg-text-muted)]",
          fullWidth ? "w-full" : "w-fit",
          className,
        )}
      >
        {items.map((item) => {
          const active = value === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onValueChange(item.id)}
              className={cn(
                "relative isolate inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] font-semibold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--dg-border-strong)]",
                fullWidth && "flex-1",
                size === "sm" ? "h-8 px-2 text-[11px]" : "h-9 px-3 text-xs",
                active
                  ? cn("text-white", activeClassName)
                  : cn("text-[var(--dg-text-muted)] hover:text-[var(--dg-text)]", inactiveClassName),
                tabClassName,
              )}
              aria-pressed={active}
            >
              {active ? (
                <motion.span
                  layoutId={activeLayoutId}
                  initial={false}
                  className="dg-segmented-primary absolute inset-0 -z-10 rounded-[inherit] will-change-transform"
                  transition={reduceMotion ? { duration: 0 } : activeTabSpring}
                />
              ) : null}
              {Icon ? (
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-300",
                    active && "scale-110",
                    active && "dark:text-[#ffffff]",
                  )}
                />
              ) : null}
              <span className={cn("truncate", active && "dark:text-[#ffffff]", (hideLabelsOnMobile || item.compactLabel) && "hidden sm:inline")}>
                {item.label}
              </span>
              {item.compactLabel ? (
                <span className={cn("truncate sm:hidden", active && "dark:text-[#ffffff]")}>
                  {item.compactLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function PremiumTabPanel({
  panelKey,
  children,
  className,
}: {
  panelKey: string;
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panelKey}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(4px)" }}
        transition={reduceMotion ? { duration: 0 } : quickPanel}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
