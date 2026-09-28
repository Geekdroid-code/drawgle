'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CtaBannerProps {
  onOpenDownload: () => void;
}

export function CtaBanner({ onOpenDownload }: CtaBannerProps) {
  // Signature Framer/Mobbin glass styling matching the navbar and bento cards
  const glassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '36px',
  };

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={glassStyle}
          className="border-0 p-8 sm:p-14 md:p-16 text-center relative overflow-hidden"
        >
          <div className="relative z-10 max-w-3xl mx-auto">
            
            {/* Clean Kicker Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-neutral-500 bg-white/70 border border-black/[0.04] mb-5 select-none shadow-2xs">
              <Sparkles className="w-3 h-3 text-[#305dde]" />
              <span className="tracking-wider uppercase text-[10px]">Start Designing in Seconds</span>
            </div>

            {/* Clean, High-Contrast Editorial Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-medium tracking-tight text-[rgb(69,69,69)] mb-4 sm:mb-5 leading-[1.12]">
              Design your next mobile app <br className="hidden sm:inline" />
              <span className="text-[rgb(20,20,20)] font-semibold">at the speed of thought.</span>
            </h2>

            {/* Calm, readable subheadline */}
            <p className="text-sm sm:text-base md:text-lg text-[rgb(69,69,69)] max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
              Describe your idea, generate connected mobile screens, and export clean, production-ready code with synchronized design tokens.
            </p>

            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="primary" size="lg" onClick={onOpenDownload}>
                Start Building Now
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const el = document.getElementById('demo-player');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Watch Demo
              </Button>
            </div>

            {/* Minimal Trust Badges */}
            <div className="mt-8 pt-6 border-t border-black/[0.04] flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-[#305dde]" /> Agent-Ready Code
              </span>
              <span className="hidden sm:inline text-neutral-300">·</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-[#305dde]" /> SwiftUI & React Native
              </span>
              <span className="hidden sm:inline text-neutral-300">·</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-[#305dde]" /> Zero Feature Gates
              </span>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
