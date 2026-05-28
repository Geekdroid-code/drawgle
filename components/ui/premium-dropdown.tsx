"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import useMeasure from "react-use-measure";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface PremiumDropdownItem {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | null;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
}

interface PremiumDropdownProps {
  trigger: React.ReactNode;
  items?: PremiumDropdownItem[];
  activeItemId?: string | null;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  width?: number;
  header?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  menuClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function PremiumDropdown({
  trigger,
  items = [],
  activeItemId = null,
  align = "end",
  side = "bottom",
  width = 220,
  header,
  children,
  className,
  menuClassName,
  open,
  onOpenChange,
}: PremiumDropdownProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : localOpen;
  
  const setIsOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!isControlled) setLocalOpen(val);
  };

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [contentRef, contentBounds] = useMeasure();
  const [portalReady, setPortalReady] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      setTriggerRect(triggerRef.current?.getBoundingClientRect() ?? null);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen]);

  const openHeight = Math.max(40, Math.ceil(contentBounds.height || 40));

  // Determine origin point for scale/expand animation
  const originClass = cn(
    side === "top"
      ? align === "end"
        ? "origin-bottom-right"
        : align === "start"
        ? "origin-bottom-left"
        : "origin-bottom"
      : side === "right"
      ? align === "end"
        ? "origin-top-left"
        : align === "start"
        ? "origin-bottom-left"
        : "origin-left"
      : side === "left"
      ? align === "end"
        ? "origin-top-right"
        : align === "start"
        ? "origin-bottom-right"
        : "origin-right"
      : align === "end"
      ? "origin-top-right"
      : align === "start"
      ? "origin-top-left"
      : "origin-top"
  );

  const isHorizontalSide = side === "left" || side === "right";
  const popupPositionClass = cn(
    isHorizontalSide
      ? align === "end"
        ? "bottom-0"
        : align === "start"
        ? "top-0"
        : "top-1/2 -translate-y-1/2"
      : align === "end"
      ? "right-0"
      : align === "start"
      ? "left-0"
      : "left-1/2 -translate-x-1/2",
  );

  const fixedPositionStyle =
    isOpen && triggerRect && isHorizontalSide
      ? {
          left: side === "right" ? triggerRect.right + 8 : triggerRect.left - width - 8,
          top:
            align === "end"
              ? triggerRect.bottom - openHeight
              : align === "start"
              ? triggerRect.top
              : triggerRect.top + triggerRect.height / 2 - openHeight / 2,
        }
      : undefined;

  const dropdownContent = (
    <motion.div
      ref={menuRef}
      initial={{
        opacity: 0,
        scale: 0.92,
        width: 40,
        height: 40,
        borderRadius: 12,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        width: width,
        height: openHeight,
        borderRadius: 14,
      }}
      exit={{
        opacity: 0,
        scale: 0.92,
        width: 40,
        height: 40,
        borderRadius: 12,
        transition: { duration: 0.12, ease: "easeInOut" },
      }}
      transition={{
        type: "spring",
        damping: 34,
        stiffness: 380,
        mass: 0.8,
      }}
      style={fixedPositionStyle}
      className={cn(
        "z-[120] bg-white dark:bg-[#1b1b1b] border border-slate-950/[0.08] dark:border-white/[0.08] shadow-[0_20px_70px_rgba(15,23,42,0.15)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.55)] overflow-hidden",
        isHorizontalSide
          ? "fixed"
          : "absolute",
        side === "top"
          ? "bottom-full mb-2"
          : side === "right"
          ? ""
          : side === "left"
          ? ""
          : "top-full mt-2",
        !isHorizontalSide && popupPositionClass,
        originClass,
        menuClassName
      )}
    >
      <div ref={contentRef} className="w-max min-w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="p-1.5"
        >
          {header && (
            <div className="px-2.5 py-2 border-b border-slate-950/[0.06] dark:border-white/[0.06] mb-1.5">
              {header}
            </div>
          )}

          {children ? (
            <div onClick={() => {}} className="w-full">
              {children}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 m-0 p-0 list-none">
              {items.map((item, index) => {
                if (item.id === "divider" || item.label === "") {
                  return (
                    <motion.hr
                      key={item.id || `divider-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-slate-950/[0.06] dark:border-white/[0.06] my-1.5"
                    />
                  );
                }

                const isActive = activeItemId === item.id;
                const isDestructive = item.variant === "destructive";
                const showIndicator = hoveredItem
                  ? hoveredItem === item.id
                  : isActive;

                const itemDuration = isDestructive ? 0.12 : 0.15;
                const itemDelay = 0.05 + index * 0.015;

                return (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: itemDelay,
                      duration: itemDuration,
                      ease: easeOutQuint,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick?.(e);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg text-[13px] font-semibold cursor-pointer select-none pl-3 py-2 pr-6 transition-colors duration-150 ease-out whitespace-nowrap",
                      isDestructive && showIndicator
                        ? "text-rose-600 dark:text-rose-400"
                        : isActive
                        ? "text-slate-900 dark:text-white"
                        : isDestructive
                        ? "text-rose-600/80 dark:text-rose-400/80 hover:text-rose-600"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {showIndicator && (
                      <motion.div
                        layoutId="activeIndicator"
                        className={cn(
                          "absolute inset-0 rounded-lg -z-10",
                          isDestructive
                            ? "bg-rose-50 dark:bg-rose-950/20"
                            : "bg-slate-50 dark:bg-white/5"
                        )}
                        transition={{
                          type: "spring",
                          damping: 30,
                          stiffness: 520,
                          mass: 0.8,
                        }}
                      />
                    )}

                    {showIndicator && (
                      <motion.div
                        layoutId="leftBar"
                        className={cn(
                          "absolute left-0 top-0 bottom-0 my-auto w-[3px] h-5 rounded-full",
                          isDestructive
                            ? "bg-rose-500"
                            : "bg-slate-900 dark:bg-slate-100"
                        )}
                        transition={{
                          type: "spring",
                          damping: 30,
                          stiffness: 520,
                          mass: 0.8,
                        }}
                      />
                    )}

                    {item.icon && (
                      <item.icon className="w-4 h-4 shrink-0 relative z-10" />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </div>
    </motion.div>
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left not-prose", className)}
    >
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (isHorizontalSide && portalReady ? createPortal(dropdownContent, document.body) : dropdownContent)}
      </AnimatePresence>
    </div>
  );
}
