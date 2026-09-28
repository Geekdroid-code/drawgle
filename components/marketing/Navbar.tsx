"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { BrandMark } from "@/components/marketing/BrandMark";
import { MkButton } from "@/components/marketing/MkButton";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "How It Works", href: "/#how-it-works" },
  { name: "Features", href: "/#features" },
  { name: "Showcase", href: "/#showcase" },
  { name: "Pricing", href: "/#pricing" },
  { name: "FAQs", href: "/#faqs" },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="pointer-events-none fixed inset-x-0 top-3.5 z-50 flex justify-center px-4 sm:top-5"
    >
      <nav
        aria-label="Primary"
        className={cn(
          "mk-glass pointer-events-auto flex flex-col overflow-hidden rounded-[30px] px-4 py-2.5 transition-[max-width] duration-300 sm:px-5",
          isOpen ? "w-[390px] max-w-[calc(100vw-32px)]" : "w-full max-w-[390px] md:max-w-3xl",
        )}
      >
        <div className="flex h-8 w-full items-center justify-between sm:h-9">
          <Link href="/" onClick={() => setIsOpen(false)} aria-label="Drawgle home" className="shrink-0">
            <BrandMark />
          </Link>

          {!isOpen ? (
            <div className="hidden items-center gap-6 md:flex lg:gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-[15px] font-semibold leading-[22px] tracking-[0.2px] text-mk-ink transition-opacity hover:opacity-60"
                >
                  {link.name}
                </a>
              ))}
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {!isOpen ? (
              <MkButton href="/project/new" size="sm" className="hidden md:inline-flex">
                Design Your UI
              </MkButton>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              className="flex size-8 select-none items-center justify-center rounded-full text-mk-ink transition-all hover:bg-black/5 active:scale-90 md:hidden"
            >
              <span className="relative flex size-4 items-center justify-center">
                <motion.span
                  animate={isOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -3 }}
                  transition={{ duration: 0.22, ease }}
                  className="absolute h-[1.75px] w-4 rounded-full bg-mk-ink"
                />
                <motion.span
                  animate={isOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 3 }}
                  transition={{ duration: 0.22, ease }}
                  className="absolute h-[1.75px] w-4 rounded-full bg-mk-ink"
                />
              </span>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease }}
              className="flex flex-col overflow-hidden pb-1 pt-3 md:hidden"
            >
              <div className="flex flex-col space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block py-1.5 text-left text-[20px] font-semibold leading-[26px] text-mk-ink transition-opacity hover:opacity-60"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
              <div className="pt-3">
                <MkButton href="/project/new" onClick={() => setIsOpen(false)} className="w-full">
                  Design Your UI
                </MkButton>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}
