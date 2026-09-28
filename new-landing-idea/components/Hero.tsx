'use client';

import React, { useState } from 'react';
import { Star, Sparkles, Paperclip, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { InPageVideoPlayer } from '@/components/InPageVideoPlayer';

interface HeroProps {
  onOpenDownload: () => void;
}

export function Hero({ onOpenDownload }: HeroProps) {
  const [promptText, setPromptText] = useState('Design a modern mobile app for snickers store...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

  const samplePrompts = [
    'Design a modern mobile app for snickers store...',
    'Minimalist crypto trading wallet with live balance charts',
    'Specialty coffee ordering app with bean notes and pickup timer',
  ];

  const handleGenerate = () => {
    if (!promptText.trim()) return;
    setIsGenerating(true);
    setGenerationStep('Synthesizing layout tokens...');
    setTimeout(() => {
      setGenerationStep('Assembling agent-ready SwiftUI...');
    }, 800);
    setTimeout(() => {
      setGenerationStep('Mobile UI Generated!');
    }, 1600);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerationStep(null);
    }, 2800);
  };

  return (
    <section className="relative pt-28 sm:pt-36 md:pt-40 pb-16 md:pb-24 overflow-hidden bg-white">
      {/* Background ambient radial glow */}
      <div 
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-[#305dde]/10 via-[#2563eb]/5 to-transparent blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Top Kicker Badge - Matching Reference */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            backgroundColor: 'rgba(237, 237, 237, 0.64)',
            backdropFilter: 'blur(48px)',
            WebkitBackdropFilter: 'blur(48px)',
          }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[rgb(20,20,20)] mb-6 sm:mb-8 border border-black/[0.06] select-none"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#305dde]" />
          <span>AI Mobile App UI Designer</span>
        </motion.div>

        {/* Main Headline - Exact content from reference */}
        <motion.h1 
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ letterSpacing: '-0.025em' }}
          className="text-4xl sm:text-[52px] md:text-[62px] font-medium text-[rgb(30,30,30)] max-w-4xl mx-auto leading-[1.12] md:leading-[66px] mb-6"
        >
          Design premium Mobile UIs <br />
          <span className="text-[#305dde] font-semibold">at the speed of thought</span>
        </motion.h1>

        {/* Subtitle / Description - Exact content from reference */}
        <motion.p 
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-base sm:text-[18px] text-[rgb(69,69,69)] max-w-3xl mx-auto leading-relaxed md:leading-[28px] mb-10 sm:mb-12 font-normal"
        >
          Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.
        </motion.p>

        {/* Premium Prompt Input Box - Clean, minimal glass styling */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl mx-auto mb-8 sm:mb-9 text-left"
        >
          <div 
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
            }}
            className="rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 border border-black/[0.08] shadow-[0_16px_40px_-15px_rgba(0,0,0,0.06)] transition-all focus-within:border-[#305dde]/60 focus-within:ring-4 focus-within:ring-[#305dde]/10 group"
          >
            {/* Input / Textarea */}
            <div className="relative">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                rows={2}
                placeholder="Describe the mobile screen, flow, or app you want to design..."
                className="w-full bg-transparent resize-none outline-none text-[15px] sm:text-base font-medium text-[rgb(20,20,20)] placeholder-neutral-400 leading-relaxed"
              />

              {/* Live generation indicator overlay */}
              <AnimatePresence>
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-[#305dde]"
                  >
                    <div className="w-4 h-4 border-2 border-[#305dde] border-t-transparent rounded-full animate-spin" />
                    <span>{generationStep}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Bar: Attach action & Submit circular arrow */}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAttachedFile(attachedFile ? null : 'brand_guidelines.pdf')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border-0 ${
                    attachedFile 
                      ? 'bg-[#305dde]/10 text-[#305dde]' 
                      : 'text-neutral-500 hover:text-neutral-800 hover:bg-black/[0.04]'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{attachedFile ? 'brand_guidelines.pdf' : 'Attach'}</span>
                </button>

                {/* Sample Prompt Chips */}
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="opacity-60">Try:</span>
                  <button
                    type="button"
                    onClick={() => setPromptText(samplePrompts[0])}
                    className="hover:text-[#305dde] underline underline-offset-2 decoration-neutral-300 transition-colors cursor-pointer"
                  >
                    Snickers Store
                  </button>
                  <span className="opacity-40">•</span>
                  <button
                    type="button"
                    onClick={() => setPromptText(samplePrompts[1])}
                    className="hover:text-[#305dde] underline underline-offset-2 decoration-neutral-300 transition-colors cursor-pointer"
                  >
                    Crypto Wallet
                  </button>
                </div>
              </div>

              {/* Submit circular icon */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                aria-label="Generate mobile UI"
                className="w-8 h-8 rounded-full bg-[#305dde] text-white flex items-center justify-center hover:bg-[#254cc4] active:scale-95 transition-all cursor-pointer border-0 shrink-0"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* CTA Buttons - Matching Reference */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3.5 mb-7"
        >
          <Button variant="primary" size="default" onClick={onOpenDownload}>
            Design Your UI
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={() => {
              const el = document.getElementById('demo-player');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Watch Demo
          </Button>
        </motion.div>

        {/* Social Proof & Playful Annotation - Matching Reference */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative inline-flex flex-col items-center justify-center mb-14 sm:mb-16 select-none"
        >
          {/* Avatars + 15+ + 5 Stars */}
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2 overflow-hidden p-0.5">
              <div className="w-7 h-7 rounded-full border-2 border-white bg-amber-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#FDE68A"/>
                  <circle cx="16" cy="12" r="5" fill="#78350F"/>
                  <path d="M7 26c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="#78350F"/>
                </svg>
              </div>
              <div className="w-7 h-7 rounded-full border-2 border-white bg-rose-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#FECDD3"/>
                  <circle cx="16" cy="12" r="5" fill="#9F1239"/>
                  <path d="M7 26c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="#9F1239"/>
                </svg>
              </div>
              <div className="w-7 h-7 rounded-full border-2 border-white bg-sky-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#BAE6FD"/>
                  <circle cx="16" cy="12" r="5" fill="#0369A1"/>
                  <path d="M7 26c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="#0369A1"/>
                </svg>
              </div>
              <div className="w-7 h-7 rounded-full border-2 border-white bg-emerald-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#A7F3D0"/>
                  <circle cx="16" cy="12" r="5" fill="#065F46"/>
                  <path d="M7 26c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="#065F46"/>
                </svg>
              </div>
              <div className="w-7 h-7 rounded-full border-2 border-white bg-[#141414] text-white flex items-center justify-center text-[9px] font-bold">
                15+
              </div>
            </div>

            {/* Stars */}
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
              ))}
            </div>
          </div>

          {/* Pricing tag */}
          <span className="text-xs font-semibold text-neutral-500 mt-1.5 tracking-tight">
            Starting at <strong className="text-neutral-900 font-bold">$9 ONLY</strong>
          </span>

          {/* Whimsical Handwritten Arrow Annotation - Matching Reference */}
          <div className="hidden md:flex items-center gap-1.5 absolute -right-60 top-1/2 -translate-y-1/2 text-left pointer-events-none">
            <svg 
              className="w-10 h-10 text-[#305dde] -scale-x-100 rotate-12 shrink-0 opacity-80" 
              viewBox="0 0 50 50" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.8"
            >
              <path d="M10 40 C 20 20, 35 15, 42 12" strokeLinecap="round" strokeDasharray="3 3"/>
              <path d="M35 8 L 44 12 L 38 20" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span 
              style={{ fontFamily: 'cursive, system-ui, sans-serif' }}
              className="text-xs text-[#305dde] font-medium italic max-w-[130px] leading-tight"
            >
              Watch it live before you give your money to us
            </span>
          </div>
        </motion.div>

        {/* In-Page Video Player - Clean, Premium, Minimal */}
        <motion.div 
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-5xl mx-auto pt-2"
        >
          <InPageVideoPlayer onOpenDownload={onOpenDownload} />
        </motion.div>

      </div>
    </section>
  );
}
