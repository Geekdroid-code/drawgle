'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FaqItem {
  id: number;
  q: string;
  a: string;
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Exact same background aesthetic as nav & cards: frosted glass, 0 borders, 0 shadows
  const navGlassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '28px',
  };

  const faqs: FaqItem[] = [
    {
      id: 1,
      q: 'How does Drawgle turn prompts into mobile UIs?',
      a: 'Drawgle parses your prompt, derives layout hierarchies, applies brand tokens, and generates production-grade mobile screens with realistic typography, states, and components.',
    },
    {
      id: 2,
      q: 'Does Drawgle export agent-ready code for my repository?',
      a: 'Yes. Drawgle exports clean, modular SwiftUI, React Native, and HTML/Tailwind CSS code, complete with token JSON files and component props ready for your repo.',
    },
    {
      id: 3,
      q: 'Can I attach brand guidelines or existing design systems?',
      a: 'Absolutely. Use the Attach button in the prompt box to upload brand guidelines, token files, or screenshot references to ground generation in your style.',
    },
    {
      id: 4,
      q: 'What mobile frameworks are supported?',
      a: 'We support native iOS (SwiftUI), React Native (Expo), Flutter, and web companion components styled with Tailwind CSS.',
    },
    {
      id: 5,
      q: 'Is there a free trial?',
      a: 'Yes. You can generate your first 10 mobile screens completely free, with unlimited Pro generation starting at just $9/month.',
    },
    {
      id: 6,
      q: 'How do coding agents in my IDE use Drawgle output?',
      a: 'Drawgle outputs agent-ready files with standard component interfaces, props typing, and context documentation that coding tools (like Cursor, Claude Code, and Copilot) can immediately implement.',
    },
    {
      id: 7,
      q: 'Can I export directly to Figma?',
      a: 'Yes. In addition to production code, Drawgle allows one-click SVG and Figma vector component copy-pasting.',
    },
    {
      id: 8,
      q: 'Can I generate multi-screen user flows?',
      a: 'Yes. Drawgle can generate end-to-end screen sequences—like onboarding, checkout, and account settings—maintaining token and theme consistency across all screens.',
    },
  ];

  // Group contiguous items:
  // When all closed: 1 single continuous card containing all items (matches Image 1)
  // When an item is open: the open item is its own card, and contiguous closed items stay grouped (matches Image 2)
  type FaqGroup =
    | { type: 'open'; item: FaqItem; index: number }
    | { type: 'closed'; items: { item: FaqItem; index: number }[] };

  const groups: FaqGroup[] = [];
  let currentClosed: { item: FaqItem; index: number }[] = [];

  faqs.forEach((faq, index) => {
    if (openIndex === index) {
      if (currentClosed.length > 0) {
        groups.push({ type: 'closed', items: currentClosed });
        currentClosed = [];
      }
      groups.push({ type: 'open', item: faq, index });
    } else {
      currentClosed.push({ item: faq, index });
    }
  });

  if (currentClosed.length > 0) {
    groups.push({ type: 'closed', items: currentClosed });
  }

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faqs" className="py-20 sm:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <span className="text-xs sm:text-sm font-semibold text-neutral-400 tracking-wide uppercase mb-3 block">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[rgb(69,69,69)]">
            Everything you need <span className="text-[rgb(20,20,20)] font-semibold">to know</span>
          </h2>
        </motion.div>

        {/* Dynamic FAQ Blocks matching Image 1 & Image 2 with smooth, glitch-free transitions */}
        <div className="flex flex-col gap-3.5 sm:gap-4 max-w-3xl mx-auto">
          {groups.map((group, groupIdx) => {
            if (group.type === 'open') {
              return (
                <div
                  key={`open-${group.item.id}`}
                  style={navGlassStyle}
                  className="border-0 overflow-hidden"
                >
                  {/* Top Question Row - Exactly matching closed item padding and layout */}
                  <button
                    type="button"
                    onClick={() => handleToggle(group.index)}
                    className="w-full flex items-center justify-between py-4 sm:py-4.5 px-6 sm:px-7 text-left cursor-pointer select-none group"
                  >
                    <span className="text-base sm:text-[17px] font-medium text-[rgb(20,20,20)] tracking-tight">
                      {group.item.q}
                    </span>
                    {/* Fixed container ensuring the chevron NEVER shifts horizontally */}
                    <div className="shrink-0 ml-4 w-4 h-4 flex items-center justify-center">
                      <ChevronDown
                        className="w-4 h-4 text-neutral-500 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-180"
                        strokeWidth={1.5}
                      />
                    </div>
                  </button>

                  {/* Smooth Answer Reveal matching mobile navigation dropdown */}
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={`answer-${group.item.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        duration: 0.28,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="overflow-hidden px-6 sm:px-7 pb-5 sm:pb-6"
                    >
                      <p className="text-neutral-500 text-[15px] sm:text-base leading-relaxed font-normal">
                        {group.item.a}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              );
            }

            // Closed Group Card: houses contiguous closed questions in one unified card
            return (
              <div
                key={`closed-group-${groupIdx}-${group.items[0].item.id}`}
                style={navGlassStyle}
                className="border-0 overflow-hidden py-1 sm:py-1.5"
              >
                <div className="flex flex-col">
                  {group.items.map(({ item, index }) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggle(index)}
                      className="w-full flex items-center justify-between py-3.5 sm:py-4 px-6 sm:px-7 text-left cursor-pointer hover:opacity-75 transition-opacity select-none group"
                    >
                      <span className="text-base sm:text-[17px] font-medium text-[rgb(20,20,20)] tracking-tight">
                        {item.q}
                      </span>
                      {/* Fixed container ensuring the chevron NEVER shifts horizontally */}
                      <div className="shrink-0 ml-4 w-4 h-4 flex items-center justify-center">
                        <ChevronDown
                          className="w-4 h-4 text-neutral-500 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-0"
                          strokeWidth={1.5}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
