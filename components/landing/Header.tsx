"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AgentBall } from "@/components/AgentBall"

interface NavbarProps {
  children: React.ReactNode
  className?: string
}

interface NavBodyProps {
  children: React.ReactNode
  className?: string
}

interface NavItemsProps {
  items: {
    name: string
    link: string
  }[]
  className?: string
  onItemClick?: () => void
}

interface MobileNavProps {
  children: React.ReactNode
  className?: string
}

interface MobileNavHeaderProps {
  children: React.ReactNode
  className?: string
}

interface MobileNavMenuProps {
  children: React.ReactNode
  className?: string
  isOpen: boolean
  onClose: () => void
}

export const Navbar = ({ children, className }: NavbarProps) => {
  return <motion.div className={cn("fixed inset-x-0 top-0 z-60 w-full pt-4 px-4", className)}>{children}</motion.div>
}

export const NavBody = ({ children, className }: NavBodyProps) => {
  return (
    <motion.div
      className={cn(
        "relative z-[60] mx-auto hidden max-w-4xl flex-row items-center justify-between self-start overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(6,6,7,0.95)_0%,rgba(22,22,24,0.90)_48%,rgba(3,3,4,0.96)_100%)] px-3 py-2 text-white shadow-[0_18px_55px_-38px_rgba(0,0,0,0.85)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.13),transparent_34%),radial-gradient(circle_at_82%_100%,rgba(255,255,255,0.07),transparent_38%),linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.09)_42%,transparent_58%)] before:opacity-75 after:pointer-events-none after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/42 after:to-transparent lg:flex",
        className,
      )}
    >
      <div className="relative z-10 flex w-full items-center justify-between">
        {children}
      </div>
    </motion.div>
  )
}

export default Header
export { Header }

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "flex flex-1 flex-row items-center justify-center space-x-1 text-sm font-medium text-white/68 transition duration-200",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-3 py-2 font-semibold transition-colors cursor-pointer hover:text-white"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div layoutId="hovered" className="absolute inset-0 h-full w-full rounded-md bg-white/[0.08] ring-1 ring-white/[0.06]" />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  )
}

export const MobileNav = ({ children, className }: MobileNavProps) => {
  return (
    <motion.div
      className={cn(
        "relative z-50 mx-auto flex w-[95%] max-w-[calc(100vw-1rem)] flex-col items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(6,6,7,0.95)_0%,rgba(15,15,15,0.90)_48%,rgba(3,3,4,0.96)_100%)] px-4 py-3 text-white shadow-[0_18px_55px_-38px_rgba(0,0,0,0.85)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.12),transparent_36%),radial-gradient(circle_at_82%_100%,rgba(255,255,255,0.06),transparent_38%),linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.09)_42%,transparent_58%)] before:opacity-75 lg:hidden",
        className,
      )}
    >
      <div className="relative z-10 flex w-full flex-col items-center justify-between">
        {children}
      </div>
    </motion.div>
  )
}

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return <div className={cn("flex w-full flex-row items-center justify-between", className)}>{children}</div>
}

export const MobileNavMenu = ({ children, className, isOpen, onClose }: MobileNavMenuProps) => {
  void onClose

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { type: "spring", stiffness: 460, damping: 42, mass: 0.7 },
            opacity: { duration: 0.12 },
          }}
          className={cn(
            "w-full overflow-hidden font-semibold text-white",
            className,
          )}
        >
          <motion.div
            initial={{ y: -8, filter: "blur(5px)" }}
            animate={{ y: 0, filter: "blur(0px)" }}
            exit={{ y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="mt-3 border-t border-white/10 pt-4"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean
  onClick: () => void
}) => {
  return (
    <Button
      type="button"
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
      onClick={onClick}
      className="group relative h-10 w-10 overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.035))] p-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-8px_18px_rgba(0,0,0,0.24),0_14px_32px_-24px_rgba(0,0,0,0.95)] transition hover:border-white/18 hover:bg-white/[0.11]"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(255,255,255,0.26),transparent_38%),linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.12)_48%,transparent_72%)] opacity-80" />
      <span className="pointer-events-none absolute inset-[3px] rounded-[10px] border border-white/[0.05]" />
      <span className="relative block h-5 w-5">
        <motion.span
          className="absolute left-1/2 top-[4.5px] h-[1.5px] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.55),#fff)] shadow-[0_0_10px_rgba(255,255,255,0.18)]"
          animate={isOpen
            ? { x: "-50%", y: 5.5, rotate: 45, width: 17 }
            : { x: "-50%", y: 0, rotate: 0, width: 17 }}
          transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.75 }}
        />
        <motion.span
          className="absolute left-1/2 top-[9.5px] h-[1.5px] rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.14)]"
          animate={isOpen
            ? { x: "-50%", opacity: 0, scaleX: 0.2, width: 10 }
            : { x: "-50%", opacity: 1, scaleX: 1, width: 13 }}
          transition={isOpen ? { duration: 0.1 } : { duration: 0.16, delay: 0.04 }}
        />
        <motion.span
          className="absolute left-1/2 top-[14.5px] h-[1.5px] rounded-full bg-[linear-gradient(90deg,#fff,rgba(255,255,255,0.55))] shadow-[0_0_10px_rgba(255,255,255,0.16)]"
          animate={isOpen
            ? { x: "-50%", y: -4.5, rotate: -45, width: 17 }
            : { x: "-50%", y: 0, rotate: 0, width: 17 }}
          transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.75 }}
        />
      </span>
    </Button>
  )
}

const BrandLogo = ({ compact = false }: { compact?: boolean }) => (
  <Link href="/" className="flex items-center cursor-pointer">
    <span className={cn(
      "flex items-center justify-center rounded-md ",
      compact ? "size-8 [&_svg]:!size-5" : "size-9 [&_svg]:!size-6",
    )}>
      <AgentBall className={compact ? "h-5 w-5" : "h-6 w-6"} />
    </span>
    <span className="text-base font-semibold tracking-tight text-white">
      Drawgle
    </span>
  </Link>
)

function Header() {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { name: "Features", link: "/#features" },
    { name: "How it works", link: "/#how-it-works" },
    { name: "Blog", link: "/blog" },
  ]

  return (
    <Navbar>
      <NavBody>
        {/* Logo */}
        <div className="flex items-center">
          <BrandLogo />
        </div>

        {/* Navigation Items */}
        <NavItems items={navItems} />

        {/* CTA Button */}
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              className="group relative overflow-hidden rounded-lg dg-button-primary hover:dg-button-primary py-5 pr-10 text-sm text-white cursor-pointer"
            >
              Start designing
              <div className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-white p-[10px]">
              <img
                src="/arrow.svg"
                alt="arrow-right"
                className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1"
              />
              </div>
            </Button>
          </Link>
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <div className="flex items-center">
            <BrandLogo compact />
          </div>
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>

        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <div className="flex flex-col items-center w-full">
            {navItems.map((item, idx) => (
              <a
                key={idx}
                href={item.link}
                className="w-full rounded-lg px-2 py-2 text-center text-white/70 transition-colors cursor-pointer hover:bg-white/[0.08] hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="mt-4 flex w-full flex-col items-center gap-2">
              <Link href="/login">
                <Button
                  className="text-md group relative overflow-hidden rounded-lg dg-button-primary hover:dg-button-primary py-6 pr-12 text-white cursor-pointer shadow-none"
                >
                  Start designing
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-white p-3">
                    <img
                      src="/arrow.svg"
                      alt="arrow-right"
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </div>
                </Button>
              </Link>
            </div>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}
