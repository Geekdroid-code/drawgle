'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Layers, 
  SlidersHorizontal, 
  Palette, 
  Smartphone,
  RefreshCw,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';

interface HowItWorksProps {
  onOpenDownload?: () => void;
}

export function KeyBenefits({ onOpenDownload }: HowItWorksProps) {
  // State for interactive refinement simulation on Card 3
  const [accentApplied, setAccentApplied] = useState(true);
  const [activeStepTab, setActiveStepTab] = useState<'checkout' | 'tokens'>('checkout');

  // Exact same background CSS styles as nav (Framer/Mobbin glass styling)
  const navGlassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '30px',
  };

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-white relative">
      {/* Anchor for backwards compatibility */}
      <span id="benefits" className="absolute -top-24 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-neutral-400 tracking-wider uppercase mb-3 block">
            HOW IT WORKS
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[rgb(69,69,69)] mb-4">
            From idea to production <span className="text-[rgb(20,20,20)] font-semibold">in three simple steps</span>
          </h2>
          <p className="text-base sm:text-lg text-[rgb(69,69,69)] max-w-2xl mx-auto leading-relaxed">
            No design tools, complex layers, or blank canvas paralysis. Describe what you need, get connected native screens, and refine seamlessly.
          </p>
        </motion.div>

        {/* 3 Bento Cards Grid - Exact same nav glass background, border-black/[0.04], zero shadows */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7 items-stretch">
          
          {/* ════════════════════════════════════════════════════════════
              CARD 1: Describe your app
              Text at TOP, Graphic emerging from BOTTOM
             ════════════════════════════════════════════════════════════ */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={navGlassStyle}
            className="border-0 p-6 sm:p-7 flex flex-col justify-between overflow-hidden relative group"
          >
            {/* Step Badge & Text at top */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[#305dde]/10 text-[#305dde] text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Step 01
                </span>
              </div>
              <h3 className="text-xl sm:text-[22px] font-semibold text-[rgb(20,20,20)] tracking-tight mb-2.5">
                Describe your app
              </h3>
              <p className="text-xs sm:text-sm text-[rgb(69,69,69)] leading-relaxed">
                Tell Drawgle what you’re building, the style you want, and the screens or user flow you need.
              </p>
            </div>

            {/* Graphic 1: Natural Language App Brief & Spec Sheet (emerging from bottom) */}
            <div className="mt-auto -mb-8 pt-4 flex justify-center">
              <div className="w-[285px] bg-[#111315] rounded-t-[32px] p-3 pb-10 border-t-[4px] border-x-[4px] border-[#25282d] text-left shadow-xl">
                
                {/* Micro phone notch */}
                <div className="w-16 h-3 bg-black rounded-full mx-auto mb-3 flex items-center justify-end px-1.5">
                  <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                </div>

                {/* Prompt Input Box */}
                <div className="bg-[#191d24] rounded-2xl p-3 border border-white/10 mb-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-[#305dde]" />
                    <span className="text-[10px] font-semibold text-neutral-300">Prompt Input</span>
                  </div>
                  <p className="text-[11px] text-white font-medium leading-relaxed mb-2.5 bg-black/40 p-2 rounded-xl border border-white/5">
                    &ldquo;Specialty coffee app with dark roast aesthetic, bean origin tasting notes, and 1-tap cart.&rdquo;
                  </p>

                  {/* Detected Specifications */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between text-[9px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Palette className="w-2.5 h-2.5 text-amber-400" /> Style:
                      </span>
                      <span className="text-neutral-200 font-mono">Dark Roast • Warm Sand</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-sky-400" /> Target Screens:
                      </span>
                      <span className="text-neutral-200 font-mono">Home → Tasting → Checkout</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-2.5 h-2.5 text-emerald-400" /> Platform:
                      </span>
                      <span className="text-neutral-200 font-mono">iOS SwiftUI & tokens</span>
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between px-2 text-[9px] text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Check className="w-2.5 h-2.5" /> Spec Parsed
                  </span>
                  <span className="font-mono text-neutral-500">100% understood</span>
                </div>

              </div>
            </div>
          </motion.div>

          {/* ════════════════════════════════════════════════════════════
              CARD 2: Generate your UI
              Graphic at TOP, Text at BOTTOM (Preserving original alternating rhythm)
             ════════════════════════════════════════════════════════════ */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={navGlassStyle}
            className="border-0 p-6 sm:p-7 flex flex-col justify-between overflow-hidden relative group"
          >
            {/* Graphic 2: Connected Multi-Screen User Flow (at top of card) */}
            <div className="-mt-9 mb-6 flex justify-center">
              <div className="w-[285px] bg-[#111315] rounded-b-[32px] p-3 pt-6 border-b-[4px] border-x-[4px] border-[#25282d] text-left shadow-xl">
                
                {/* Dynamic Island */}
                <div className="w-16 h-3 bg-black rounded-full mx-auto mb-2.5 flex items-center justify-end px-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                </div>

                {/* Connected Flow Badge */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Roast & Co.
                  </span>
                  <span className="text-[9px] bg-[#305dde]/20 text-[#305dde] px-2 py-0.5 rounded-full font-semibold">
                    Connected Flow
                  </span>
                </div>

                {/* Dual Screen Connected Micro-Preview */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  {/* Screen A: Catalog Card */}
                  <div className="bg-[#1b2027] rounded-xl p-2 border border-white/10 flex flex-col justify-between min-h-[120px]">
                    <div className="h-10 bg-gradient-to-br from-[#2c1810] to-[#4a2618] rounded-lg p-1.5 flex items-end">
                      <span className="text-[8px] font-bold text-amber-200">Ethiopia Yirgacheffe</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-neutral-400 block">Floral • Bergamot</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-white">$18.50</span>
                        <span className="text-[8px] bg-[#305dde] text-white px-1.5 py-0.5 rounded-full">
                          + Add
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Screen B: Slide-in Cart / Checkout Sheet */}
                  <div className="bg-[#1b2027] rounded-xl p-2 border border-[#305dde]/40 flex flex-col justify-between min-h-[120px] relative">
                    <div className="flex items-center justify-between text-[8px] text-neutral-300 pb-1 border-b border-white/5">
                      <span className="font-semibold">Order Bag</span>
                      <span className="text-[#305dde] font-mono">1 Item</span>
                    </div>
                    <div className="my-auto py-1">
                      <div className="flex items-center justify-between text-[8px] text-white">
                        <span>Yirgacheffe (250g)</span>
                        <span className="font-bold">$18.50</span>
                      </div>
                      <span className="text-[7px] text-neutral-400 block mt-0.5">Whole Bean • 2-day delivery</span>
                    </div>
                    <button 
                      onClick={onOpenDownload}
                      className="w-full py-1 bg-white text-neutral-900 rounded-md text-[8px] font-bold text-center border-0 cursor-pointer"
                    >
                      Checkout →
                    </button>
                  </div>
                </div>

                {/* Shared Token Sync Indicator */}
                <div className="flex items-center justify-between bg-black/40 px-2 py-1 rounded-lg border border-white/5 text-[8px] text-neutral-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Consistent Layout Tokens
                  </span>
                  <span className="font-mono text-neutral-300">2 Screens</span>
                </div>

              </div>
            </div>

            {/* Step Badge & Text at bottom */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[#305dde]/10 text-[#305dde] text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Step 02
                </span>
              </div>
              <h3 className="text-xl sm:text-[22px] font-semibold text-[rgb(20,20,20)] tracking-tight mb-2.5">
                Generate your UI
              </h3>
              <p className="text-xs sm:text-sm text-[rgb(69,69,69)] leading-relaxed">
                Drawgle turns your idea into polished, connected mobile app screens with consistent layouts, components, and visual direction.
              </p>
            </div>
          </motion.div>

          {/* ════════════════════════════════════════════════════════════
              CARD 3: Refine and keep building
              Text at TOP, Graphic emerging from BOTTOM
             ════════════════════════════════════════════════════════════ */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={navGlassStyle}
            className="border-0 p-6 sm:p-7 flex flex-col justify-between overflow-hidden relative group"
          >
            {/* Step Badge & Text at top */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[#305dde]/10 text-[#305dde] text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Step 03
                </span>
              </div>
              <h3 className="text-xl sm:text-[22px] font-semibold text-[rgb(20,20,20)] tracking-tight mb-2.5">
                Refine and keep building
              </h3>
              <p className="text-xs sm:text-sm text-[rgb(69,69,69)] leading-relaxed">
                Ask for changes, add new screens, or continue the flow while Drawgle keeps the existing design consistent.
              </p>
            </div>

            {/* Graphic 3: Iterative Refinement & Design Token Guard (emerging from bottom) */}
            <div className="mt-auto -mb-8 pt-4 flex justify-center">
              <div className="w-[285px] bg-[#111315] rounded-t-[32px] p-3 pb-10 border-t-[4px] border-x-[4px] border-[#25282d] text-left shadow-xl">
                
                {/* Micro notch */}
                <div className="w-16 h-3 bg-black rounded-full mx-auto mb-3 flex items-center justify-end px-1.5">
                  <div className="w-1 h-1 rounded-full bg-purple-500/50" />
                </div>

                {/* Iteration Prompt Pill */}
                <div className="bg-[#191d24] rounded-2xl p-3 border border-white/10 mb-2.5">
                  <div className="flex items-center justify-between mb-1.5 text-[9px]">
                    <span className="text-[#305dde] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5" /> Refinement Request
                    </span>
                    <span className="text-emerald-400 font-mono">Applied</span>
                  </div>

                  <p className="text-[10px] text-white font-medium bg-black/40 p-2 rounded-xl border border-white/5 leading-relaxed mb-2.5">
                    &ldquo;Add an Apple Pay express button and keep the 16px corner radius.&rdquo;
                  </p>

                  {/* Live Updated Component Preview */}
                  <div className="bg-black/60 rounded-xl p-2.5 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-neutral-400 font-mono">Updated Checkout Action</span>
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                        ✓ Tokens Kept
                      </span>
                    </div>

                    {/* Apple Pay Button */}
                    <div className="w-full py-1.5 bg-white text-black rounded-lg text-center font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm">
                      <span>Pay</span>
                      <span className="text-neutral-400 font-normal">| $18.50</span>
                    </div>
                  </div>

                  {/* Refinement Quick Actions */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button 
                      onClick={() => setAccentApplied(!accentApplied)}
                      className="flex-1 py-1 px-2 bg-white/10 hover:bg-white/15 text-neutral-200 rounded-lg text-[9px] font-medium text-center transition-colors border-0 cursor-pointer truncate"
                    >
                      + Add Tracking Screen
                    </button>
                    <button 
                      onClick={() => setActiveStepTab(activeStepTab === 'checkout' ? 'tokens' : 'checkout')}
                      className="py-1 px-2 bg-[#305dde]/20 hover:bg-[#305dde]/30 text-[#305dde] rounded-lg text-[9px] font-semibold transition-colors border-0 cursor-pointer"
                    >
                      Tokens (12)
                    </button>
                  </div>
                </div>

                {/* Consistency Guarantee footer */}
                <div className="flex items-center justify-between px-2 text-[9px] text-neutral-400">
                  <span className="flex items-center gap-1 text-sky-400">
                    <Check className="w-2.5 h-2.5" /> Design System Locked
                  </span>
                  <span className="font-mono text-neutral-500">v1.2</span>
                </div>

              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
