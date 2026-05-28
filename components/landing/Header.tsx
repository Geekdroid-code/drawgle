"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import type React from "react"
import { useState } from "react"
import { Menu, X } from "lucide-react"
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
        "relative z-[60] mx-auto hidden max-w-4xl flex-row items-center justify-between self-start overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(7,10,16,0.94)_0%,rgba(16,19,27,0.88)_52%,rgba(5,8,13,0.95)_100%)] px-3 py-2 text-white shadow-[0_18px_55px_-38px_rgba(0,0,0,0.85)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,rgba(116,184,212,0.20),transparent_32%),linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.10)_42%,transparent_58%)] before:opacity-70 after:pointer-events-none after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/45 after:to-transparent lg:flex",
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
        "relative z-50 mx-auto flex w-[95%] max-w-[calc(100vw-1rem)] flex-col items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(7,10,16,0.94)_0%,rgba(16,19,27,0.88)_52%,rgba(5,8,13,0.95)_100%)] px-4 py-3 text-white shadow-[0_18px_55px_-38px_rgba(0,0,0,0.85)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,rgba(116,184,212,0.18),transparent_36%),linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.10)_42%,transparent_58%)] before:opacity-70 lg:hidden",
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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col justify-start gap-2 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(7,10,16,0.96),rgba(16,19,27,0.94))] px-4 py-6 font-semibold text-white shadow-[0_18px_55px_-38px_rgba(0,0,0,0.85)] backdrop-blur-xl",
            className,
          )}
        >
          {children}
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
    <Button onClick={onClick} className="group h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.08] p-0 text-sm text-white hover:bg-white/[0.14]">
      {isOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
    </Button>
  )
}

function Header() {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { name: "Features", link: "/#features" },
    { name: "How it works", link: "/#how-it-works" },
    { name: "Style Packs", link: "/#style-packs" },
    { name: "Blog", link: "/blog" },
  ]

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
            <div className="flex flex-col gap-2 mt-4 w-full items-center">
              <Link href="/login">
                <Button
                  className="text-md group relative overflow-hidden rounded-lg dg-button-primary hover:dg-button-primary py-6 pr-12 text-white cursor-pointer"
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
