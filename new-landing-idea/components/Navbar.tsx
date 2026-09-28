'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';

interface NavbarProps {
  onOpenDownload: () => void;
}

export function Navbar({ onOpenDownload }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Features', href: '#features' },
    { name: 'Reviews', href: '#reviews' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'FAQs', href: '#faqs' },
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-3.5 sm:top-5 inset-x-0 z-50 px-4 flex justify-center pointer-events-none"
    >
      {/* 
        Single unified nav element matching the exact Framer/Mobbin reference provided:
        - backdrop-filter: blur(48px)
        - background-color: rgba(237, 237, 237, 0.64)
        - border-radius: 30px (closed) / 28px (open)
        - No shadows, subtle 1px hairline border border-black/[0.04]
        - When opened: expands downwards as part of the exact same container (width 390px, padding 16px 20px, gap 20px)
      */}
      <nav
        style={{
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          backgroundColor: 'rgba(237, 237, 237, 0.64)',
          borderRadius: '30px',
        }}
        className={`pointer-events-auto border-0 overflow-hidden flex flex-col px-4 sm:px-5 py-2.5 transition-[max-width] duration-300 ${
          isOpen
            ? 'w-[390px] max-w-[calc(100vw-32px)]'
            : 'w-full max-w-[390px] md:max-w-3xl'
        }`}
      >
        {/* Top Header Row (Logo + Desktop Links + Hamburger Toggle) - ALWAYS full width */}
        <div className="flex items-center justify-between w-full h-8 sm:h-9">
          {/* Logo */}
          <a
            href="#"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 group cursor-pointer select-none shrink-0"
          >
            {/* Minimalist glyph matching Mobbin's exact rgb(20, 20, 20) branding */}
            <div className="w-7 h-7 rounded-full bg-[rgb(20,20,20)] flex items-center justify-center text-white shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.5c-3.8 0-7 3.2-7 7.2 0 4.8 7 11.8 7 11.8s7-7 7-11.8c0-4-3.2-7.2-7-7.2z" />
                <circle cx="12" cy="10" r="2.8" fill="white" fillOpacity="0.4" />
              </svg>
            </div>
            <span 
              style={{ color: 'rgb(20, 20, 20)' }} 
              className="font-semibold text-base tracking-tight"
            >
              Drawgle
            </span>
          </a>

          {/* Desktop inline links when closed */}
          {!isOpen && (
            <div className="hidden md:flex items-center gap-6 lg:gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  style={{
                    color: 'rgb(20, 20, 20)',
                    fontSize: '15px',
                    fontWeight: 600,
                    letterSpacing: '0.2px',
                    lineHeight: '22px',
                  }}
                  className="hover:opacity-60 transition-opacity"
                >
                  {link.name}
                </a>
              ))}
            </div>
          )}

          {/* Right Area: CTA Button (Desktop) & Hamburger / Cross Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isOpen && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenDownload}
                className="hidden md:inline-flex"
              >
                Design Your UI
              </Button>
            )}

            {/* 
              Hamburger / Cross trigger matching Framer's exact animated two SVG bars.
              Hidden on desktop, active on mobile/tablet. Pinned rock-solid to the right.
            */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-[rgb(20,20,20)] hover:bg-black/5 active:scale-90 transition-all cursor-pointer select-none"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <motion.span
                  animate={isOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -3 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ backgroundColor: 'rgb(20, 20, 20)' }}
                  className="absolute w-4 h-[1.75px] rounded-full"
                />
                <motion.span
                  animate={isOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 3 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ backgroundColor: 'rgb(20, 20, 20)' }}
                  className="absolute w-4 h-[1.75px] rounded-full"
                />
              </div>
            </button>
          </div>
        </div>

        {/* 
          Expanded Content:
          Moves as one single solid sheet with the links and button in unison.
          Zero delayed staggering, zero secondary jerking.
        */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="framer-expanded-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="md:hidden overflow-hidden flex flex-col pt-3 pb-1"
            >
              {/* Menu links list */}
              <div className="flex flex-col space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '20px',
                      fontWeight: 600,
                      letterSpacing: '0px',
                      lineHeight: '26px',
                      color: 'rgb(20, 20, 20)',
                    }}
                    className="py-1.5 hover:opacity-60 transition-opacity block text-left"
                  >
                    {link.name}
                  </a>
                ))}
              </div>

              {/* Full-width CTA moving as one solid sheet with the links - NO separate delay, NO separate jerking */}
              <div className="pt-3">
                <Button
                  variant="primary"
                  size="default"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDownload();
                  }}
                  className="w-full"
                >
                  Design Your UI
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}
