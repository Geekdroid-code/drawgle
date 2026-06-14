"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Settings, ArrowRight, Check, Activity, Flame, ChevronRight, MapPin, Trophy, ChevronLeft, ShoppingBag, Home, Search, Heart, Code, Play, Loader, Smartphone, User, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SvgDivider = ({ complete }: { complete: boolean }) => (
  <div className="relative z-0 flex h-10 w-[18px] shrink-0 items-center justify-center md:h-[18px] md:w-12">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 18" className="absolute -z-10 h-[18px] w-12 rotate-90 md:rotate-0">
      <path stroke="#343434" d="M0 8.5h48" />
      <motion.path
        stroke="#F97316"
        strokeWidth="1.5"
        d="M0 8.5h48"
        initial={false}
        animate={{ pathLength: complete ? 1 : 0, opacity: complete ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      />
      <rect width="16" height="16" x="16" y="1" fill="#0B0B0B" rx="8" />
      <path
        fill={complete ? "#F97316" : "#626262"}
        fillRule="evenodd"
        d="M20.813 5.98a.5.5 0 0 1 .707 0l2.195 2.195a1.167 1.167 0 0 1 0 1.65L21.52 12.02a.5.5 0 1 1-.707-.707l2.195-2.195a.167.167 0 0 0 0-.236l-2.195-2.195a.5.5 0 0 1 0-.707m4.667 0a.5.5 0 0 1 .707 0l2.195 2.195a1.167 1.167 0 0 1 0 1.65L26.187 12.02a.5.5 0 1 1-.707-.707l2.195-2.195a.167.167 0 0 0 0-.236L25.48 6.687a.5.5 0 0 1 0-.707"
        clipRule="evenodd"
        className="transition-colors duration-500"
      />
      <rect width="17" height="17" x="15.5" y="0.5" stroke={complete ? "#F97316" : "#343434"} rx="8.5" className="transition-colors duration-500" />
    </svg>
  </div>
);

const BracketDown = () => (
  <div className="hidden md:flex justify-center w-full my-2 md:my-3 ">
   <svg className="w-[280px] md:w-[480px] h-[30px]" viewBox="0 0 480 30" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 2C1 10 6 14 16 14L224 14C234 14 239 20 240 28" stroke="#343434" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  
  <path d="M479 2C479 10 474 14 464 14L256 14C246 14 241 20 240 28" stroke="#343434" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  
  <circle cx="240" cy="28" r="2" fill="#626262"/>
</svg>


  </div>
);

const VerticalRuler = ({ side }: { side: 'left' | 'right' }) => {
  const ticks = Array.from({ length: 30 }).map((_, i) => i * 50);
  
  return (
    <div className={`absolute top-0 bottom-0 w-8 pointer-events-none hidden xl:block  overflow-hidden
      ${side === 'left' ? 'left-0 border-r border-white/10' : 'right-0 border-l border-white/10'}`}
    >
      {ticks.map(tick => (
        <div key={tick} className={`absolute w-full flex items-center h-[1px] ${side === 'left' ? 'justify-end' : 'justify-start'}`} style={{ top: `${tick}px` }}>
           {side === 'left' ? (
             <>
               <span className="text-[10px] font-mono text-white/25 -rotate-90 origin-right mr-1.5 -translate-y-1/2 select-none tracking-widest">
                 {tick === 0 ? '0' : tick}
               </span>
               <div className="w-1.5 h-[1px] bg-white/20"></div>
             </>
           ) : (
             <>
               <div className="w-1.5 h-[1px] bg-white/20"></div>
               <span className="text-[10px] font-mono text-white/25 -rotate-90 origin-left ml-1.5 -translate-y-1/2 select-none tracking-widest">
                 {tick === 0 ? '0' : tick}
               </span>
             </>
           )}
        </div>
      ))}
    </div>
  );
};

const PrecisionFrame = ({ label, detail }: { label: string; detail: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="pointer-events-none absolute -inset-[5px] z-50 rounded-[inherit] border border-[#1b7fcc]/70"
  >
    <span className="absolute -left-1 -top-1 h-2 w-2 border border-[#55a9e8] bg-[#101010]" />
    <span className="absolute -right-1 -top-1 h-2 w-2 border border-[#55a9e8] bg-[#101010]" />
    <span className="absolute -bottom-1 -left-1 h-2 w-2 border border-[#55a9e8] bg-[#101010]" />
    <span className="absolute -bottom-1 -right-1 h-2 w-2 border border-[#55a9e8] bg-[#101010]" />
    <span className="absolute -top-[23px] left-1 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-[#161616] px-1.5 py-0.5 font-mono text-[8px] text-white/50">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1b7fcc]" />
      {label}
      <span className="text-[#1b7fcc]">{detail}</span>
    </span>
  </motion.div>
);

export default function DescribeToDesign() {
  const [currentStep, setCurrentStep] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const activeToken = currentStep <= 2
    ? { name: '--dg-radius-hero', value: '32px', affected: 'hero card' }
    : currentStep <= 4
      ? { name: '--dg-radius-card', value: '24px', affected: '2 product cards' }
      : { name: '--dg-radius-pill', value: '9999px', affected: '4 components' };

  useEffect(() => {
    let mounted = true;
    
    const runSequence = async () => {
      if (!mounted) return;
      setCurrentStep(0);
      await new Promise(r => setTimeout(r, 2000));
      
      if (!mounted) return;
      setCurrentStep(1); // Hero Diff
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(2); // Hero Applied
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(3); // Nav Diff
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(4); // Nav Applied
      await new Promise(r => setTimeout(r, 2500));

      if (!mounted) return;
      setCurrentStep(5); // Export Diff
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(6); // Export Applied
      await new Promise(r => setTimeout(r, 4500));
      
      if (!mounted) return;
      runSequence();
    };

    runSequence();
    return () => { mounted = false; };
  }, []);

  // Auto-scroll logic to follow the diffs
  useEffect(() => {
    if (codeContainerRef.current) {
      let scrollTo = 0;
      if (currentStep === 1 || currentStep === 2) scrollTo = 150;
      if (currentStep === 3 || currentStep === 4) scrollTo = 600;
      if (currentStep === 5 || currentStep === 6) scrollTo = 0;
      
      codeContainerRef.current.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      });
    }
  }, [currentStep]);

  const codeLines = [
    { id: 1, text: '  <header class="flex justify-between items-center px-6 pt-6">', type: 'normal' },
    { id: 2, text: '    <button class="p-2.5 border border-gray-100 rounded-xl"><Menu size={18} /></button>', type: 'normal' },
    { id: 3, text: '    <h1 class="text-xl font-black tracking-tighter">JMDF</h1>', type: 'normal' },
    { id: 4, text: '    <button class="p-2.5 border border-gray-100 rounded-xl"><ShoppingBag size={18} /></button>', type: 'normal' },
    { id: 5, text: '  </header>', type: 'normal' },
    { id: 6, text: '', type: 'normal' },
    { id: 7, text: '  <main class="px-6 mt-6 pb-32 h-full overflow-y-auto">', type: 'normal' },
    
    // Step 1: Polish Hero
    { id: 8, text: '    <!-- Hero Section -->', type: 'normal' },
    { id: 9, text: '    <div class="hero-section mb-8">', type: 'normal' },
    
    { id: 10, text: '      <div class="bg-gray-100 rounded-2xl p-5 relative">', type: 'delete', step: 1 },
    { id: 11, text: '        <h2 class="text-lg font-bold">New Arrivals</h2>', type: 'delete', step: 1 },
    { id: 12, text: '        <p class="text-sm text-gray-500 mt-1">Explore the latest collection</p>', type: 'delete', step: 1 },
    { id: 13, text: '        <img src="/shoes/basic-runner.png" class="w-full h-32 object-contain mt-4" />', type: 'delete', step: 1 },
    { id: 14, text: '        <button class="w-full bg-black text-white py-3 rounded-lg mt-4 font-medium">View Product</button>', type: 'delete', step: 1 },
    { id: 15, text: '      </div>', type: 'delete', step: 1 },
    
    { id: 16, text: '      <div class="bg-[var(--dg-surface-muted)] rounded-[var(--dg-radius-hero)] p-[var(--dg-space-lg)] relative">', type: 'add', step: 1 },
    { id: 17, text: '        <h2 class="text-[22px] font-bold leading-tight text-black w-[60%]">JMDA Max Lift</h2>', type: 'add', step: 1 },
    { id: 18, text: '        <p class="text-[12px] font-medium text-[#666666] mt-2 mb-4">Men\'s running</p>', type: 'add', step: 1 },
    { id: 19, text: '        <button class="bg-[var(--dg-action-primary)] text-white px-6 py-2.5 rounded-[var(--dg-radius-pill)]">Shop now</button>', type: 'add', step: 1 },
    { id: 20, text: '        <img src="/shoes/max-lift.png" class="absolute -right-12 top-6 w-[240px] drop-shadow-2xl pointer-events-none" />', type: 'add', step: 1 },
    { id: 21, text: '      </div>', type: 'add', step: 1 },
    
    { id: 22, text: '    </div>', type: 'normal' },
    { id: 23, text: '', type: 'normal' },
    
    { id: 24, text: '    <!-- Categories -->', type: 'normal' },
    
    { id: 25, text: '    <div class="flex gap-6 mb-6">', type: 'delete', step: 5 },
    { id: 26, text: '      <div class="flex flex-col"><span class="font-bold text-[18px]">Running</span><span class="text-[12px] text-gray-500">4 items</span></div>', type: 'delete', step: 5 },
    { id: 27, text: '      <div class="flex flex-col opacity-40"><span class="font-bold text-[18px]">Lifestyle</span><span class="text-[12px] text-gray-500">9 items</span></div>', type: 'delete', step: 5 },
    { id: 28, text: '    </div>', type: 'delete', step: 5 },
    
    { id: 'c1', text: '    <div class="flex gap-[var(--dg-space-sm)] mb-6">', type: 'add', step: 5 },
    { id: 'c2', text: '      <div class="bg-[var(--dg-action-primary)] text-white px-4 py-2.5 rounded-[var(--dg-radius-pill)]">Running</div>', type: 'add', step: 5 },
    { id: 'c3', text: '      <div class="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-[var(--dg-radius-pill)]">Lifestyle</div>', type: 'add', step: 5 },
    { id: 'c4', text: '      <div class="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-[var(--dg-radius-pill)]">Basketball</div>', type: 'add', step: 5 },
    { id: 'c5', text: '    </div>', type: 'add', step: 5 },
    
    { id: 29, text: '', type: 'normal' },

    { id: 30, text: '    <!-- Product Grid -->', type: 'normal' },
    
    { id: 31, text: '    <div class="grid grid-cols-2 gap-4">', type: 'delete', step: 3 },
    { id: 32, text: '      <div class="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100 text-center">', type: 'delete', step: 3 },
    { id: 33, text: '        <img src="/shoes/shoe1.png" class="w-full h-24 object-contain mix-blend-multiply" />', type: 'delete', step: 3 },
    { id: 34, text: '        <div class="mt-3 font-semibold text-[14px]">Aero Glide</div>', type: 'delete', step: 3 },
    { id: 35, text: '        <div class="font-bold text-[14px] mt-1 text-gray-500">$120</div>', type: 'delete', step: 3 },
    { id: 36, text: '      </div>', type: 'delete', step: 3 },
    { id: 37, text: '    </div>', type: 'delete', step: 3 },
    
    { id: 'p1', text: '    <div class="grid grid-cols-2 gap-[var(--dg-space-md)]">', type: 'add', step: 3 },
    { id: 'p2', text: '      <div class="bg-white rounded-[var(--dg-radius-card)] p-4 shadow-[var(--dg-shadow-surface)]">', type: 'add', step: 3 },
    { id: 'p3', text: '        <div class="flex justify-between items-start mb-2">', type: 'add', step: 3 },
    { id: 'p4', text: '           <span class="bg-black text-white text-[9px] px-2 py-1 rounded-md font-bold">NEW</span>', type: 'add', step: 3 },
    { id: 'p5', text: '           <button class="text-gray-300"><Heart size={14} /></button>', type: 'add', step: 3 },
    { id: 'p6', text: '        </div>', type: 'add', step: 3 },
    { id: 'p7', text: '        <img src="/shoes/shoe1.png" class="w-full h-20 object-contain mx-auto" />', type: 'add', step: 3 },
    { id: 'p8', text: '        <div class="mt-2 font-bold text-[14px] text-black">Aero Glide</div>', type: 'add', step: 3 },
    { id: 'p9', text: '        <div class="text-[11px] text-gray-400 font-medium">Road Running</div>', type: 'add', step: 3 },
    { id: 'p10', text: '        <div class="font-black text-[15px] mt-2">$120</div>', type: 'add', step: 3 },
    { id: 'p11', text: '      </div>', type: 'add', step: 3 },
    { id: 'p12', text: '    </div>', type: 'add', step: 3 },
    
    { id: 43, text: '  </main>', type: 'normal' },
    { id: 44, text: '', type: 'normal' },
    
    { id: 45, text: '  <!-- Premium Navigation -->', type: 'normal' },
    { id: 46, text: '  <nav class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-between w-[240px] bg-black/90 backdrop-blur-xl rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/10 px-2 py-2">', type: 'normal' },
    { id: 47, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-white"><Home size={22} /></button>', type: 'normal' },
    { id: 48, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400"><Search size={22} /></button>', type: 'normal' },
    { id: 49, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400"><ShoppingBag size={22} /></button>', type: 'normal' },
    { id: 50, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400"><User size={22} /></button>', type: 'normal' },
    { id: 51, text: '  </nav>', type: 'normal' },
    
    { id: 59, text: '</div>', type: 'normal' },
  ];

  const visibleLines = codeLines.filter(line => {
    if (line.type === 'normal') return true;
    if (currentStep < line.step!) return line.type === 'delete';
    if (currentStep === line.step!) return true; 
    if (currentStep > line.step!) return line.type === 'add';
    return true;
  });

  return (
    <section className="relative z-10 w-full overflow-hidden bg-[#080808] px-4 py-16 font-sans text-white md:px-6 md:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.055),transparent_38%)]" />
      <VerticalRuler side="left" />
      <VerticalRuler side="right" />
      
      <div className="relative flex flex-col items-center text-center mb-6 px-4">
        <h2 className="text-[32px] sm:text-6xl tracking-tight max-w-4xl mx-auto font-semibold leading-[1.1] font-pixel-square">
          <span className="text-white">
            Iterate and refine UIs
          </span> <br className="hidden sm:block" />
          <span className="text-[#55a9e8]">
            without opening Figma
          </span>
        </h2>
        <p className="text-md sm:text-lg text-white/45 max-w-2xl mx-auto mt-6 mb-2">
          Stop settling for generic templates. Drawgle acts as your personal design engineer—simply click any component, describe what you want, and watch it perfect your UI line by line.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center mt-4 mb-8 sm:mb-4 w-full relative">
        <div className="isolate flex w-full flex-col items-center justify-center gap-0 px-4 md:flex-row md:flex-wrap">
          
          {/* Pill 1 */}
          <div className={`relative z-20 flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors ${currentStep >= 2 ? 'border-white/15 bg-[#141414] text-white' : currentStep === 1 ? 'border-orange-500/50 bg-[#16120f] text-white' : 'border-white/10 bg-[#101010] text-white/50'}`}>
            {currentStep >= 2 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 1 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/15 bg-white/[0.04]"></div>
            )}
            Select any UI detail
          </div>

          <SvgDivider complete={currentStep >= 2} />

          {/* Pill 2 */}
          <div className={`relative z-20 flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors ${currentStep >= 4 ? 'border-white/15 bg-[#141414] text-white' : currentStep === 3 ? 'border-orange-500/50 bg-[#16120f] text-white' : 'border-white/10 bg-[#101010] text-white/50'}`}>
            {currentStep >= 4 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 3 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/15 bg-white/[0.04]"></div>
            )}
            Refine with system tokens
          </div>

          <SvgDivider complete={currentStep >= 4} />

          {/* Pill 3 */}
          <div className={`relative z-20 flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors ${currentStep >= 6 ? 'border-white/15 bg-[#141414] text-white' : currentStep === 5 ? 'border-orange-500/50 bg-[#16120f] text-white' : 'border-white/10 bg-[#101010] text-white/50'}`}>
            {currentStep >= 6 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 5 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/15 bg-white/[0.04]"></div>
            )}
            Apply consistently everywhere
          </div>
        </div>

        <BracketDown />
      </div>

      <div className="relative z-20 mx-auto mb-16 w-full max-w-6xl rounded-[30px] border border-white/[0.11] bg-[#181818] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_28px_70px_-52px_rgba(0,0,0,0.9)] sm:p-2.5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex flex-col">
        
        {/* Editor Top Bar */}
        <div className="flex h-[50px] items-center px-4 select-none sm:px-5">
          <div className="flex items-center gap-2 text-white/55 h-full">
            <div className="w-4 h-4 text-orange-500 flex items-center justify-center">
              <Code size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-mono font-bold tracking-tight text-white/75">
              {currentStep >= 6 ? 'SneakerStore.tsx' : 'index.html'}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 ml-1"></div>
          </div>
          
          <div className="flex-1"></div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep >= 6 ? 'preserved' : activeToken.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`mr-3 hidden items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[10px] md:flex ${
                currentStep >= 6
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/[0.04] text-white/45'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${currentStep >= 6 ? 'bg-emerald-500' : 'bg-[#1b7fcc]'}`} />
              {currentStep >= 6 ? (
                <span>design system preserved</span>
              ) : (
                <>
                  <span>{activeToken.name}</span>
                  <span className="text-[#1b7fcc]">{activeToken.value}</span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          
          <div className="flex h-full items-center gap-2 border-l border-white/10 pl-4 text-white/50">
            <Play size={12} className="fill-current" />
            <span className="text-[13px] font-bold tracking-wide">preview</span>
          </div>
        </div>

        {/* Split Body */}
        <div className="mx-0.5 flex h-auto flex-col overflow-hidden rounded-[20px] border border-black/80 bg-[#0B0B0B] shadow-[0_1px_0_rgba(255,255,255,0.055),0_10px_28px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.025)] lg:h-[700px] lg:flex-row">
          
          {/* Left: Code Pane */}
          <div 
            ref={codeContainerRef}
            className="flex-none h-[380px] lg:flex-1 lg:h-auto p-4 overflow-x-auto overflow-y-auto bg-[#0D0D0D] font-mono text-[12px] md:text-[13px] leading-[1.8] min-w-0 custom-scrollbar shrink-0 border-b lg:border-b-0 border-white/10"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex min-w-max pb-12">
               <div className="w-8 text-right pr-4 text-white/20 select-none flex flex-col font-medium">
                  {visibleLines.map((_, i) => <div key={i} className="h-[23.4px]">{i+1}</div>)}
               </div>
               <div className="flex-1 text-white/55">
                  <AnimatePresence initial={false}>
                    {visibleLines.map((line) => {
                      const isDiffing = currentStep === line.step;
                      const isAdding = isDiffing && line.type === 'add';
                      const isDeleting = isDiffing && line.type === 'delete';
                      
                      let rowClass = 'px-2 rounded-md whitespace-pre transition-colors duration-300 flex items-center h-[23.4px] ';
                      let prefix = '  ';
                      
                      if (isAdding) {
                        rowClass += 'bg-emerald-500/10 text-emerald-400 font-medium';
                        prefix = '+ ';
                      } else if (isDeleting) {
                        rowClass += 'bg-red-500/10 text-red-400 line-through ';
                        prefix = '- ';
                      } else {
                        rowClass += 'text-white/55';
                      }

                      return (
                        <motion.div 
                          key={line.id}
                          layout="position"
                          initial={isAdding ? { opacity: 0, x: -10 } : false}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className={rowClass}
                        >
                          <span className="opacity-50 mr-2 select-none shrink-0 w-[14px]">{prefix}</span>
                          <span className="truncate">
                            {line.text.split(/("[^"]*")/g).map((part, i) => {
                              if (part.startsWith('"')) return <span key={i} className={isAdding || isDeleting ? "" : "text-[#55a9e8]"}>{part}</span>;
                              return <span key={i} className={isAdding || isDeleting ? "" : "text-white/55 font-medium"}>{part}</span>;
                            })}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
               </div>
            </div>
          </div>

          {/* Right: Phone Preview */}
          <div className="w-full lg:w-[460px] bg-[#151515] border-t lg:border-t-0 lg:border-l border-white/10 flex items-center justify-center py-10 lg:py-7 px-4 relative overflow-hidden shrink-0">
             
             
             {/* Hardware Frame */}
             <div className="w-[320px] h-[646px] bg-[#E8E8E8] rounded-[48px] p-[6px] shadow-[0_12px_32px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)] relative z-10 flex flex-col box-border border border-gray-200 shrink-0">
                
                {/* Screen */}
                <div className="w-full h-full bg-white rounded-[42px] relative overflow-hidden flex flex-col shadow-sm">
                  
                  {/* Dynamic Island */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[90px] h-[26px] bg-black rounded-full z-[60] flex items-center justify-between px-2.5 shadow-[inset_0_-1px_1px_rgba(255,255,255,0.1)]">
                     <div className="w-2 h-2 rounded-full bg-[#111] border border-white/5"></div>
                     <div className="w-2 h-2 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-indigo-400 blur-[1px]"></div>
                     </div>
                  </div>

                  {/* Scrollable Content Area */}
                  <div className="flex-1 relative z-10 font-sans text-black w-full h-full flex flex-col bg-white overflow-x-hidden overflow-y-auto no-scrollbar pt-5 pb-24">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 h-14 shrink-0">
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-[12px] bg-white">
                        <Menu size={20} />
                      </button>
                      <div className="font-black text-[18px] tracking-tighter text-black">JMDF</div>
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-[12px] bg-white relative">
                        <ShoppingBag size={20} />
                      </button>
                    </div>

                    {/* Diff 1: Hero Update */}
                    <div className="px-4 mt-4 relative shrink-0">
                      <AnimatePresence mode="wait">
                        {currentStep < 2 ? (
                          <motion.div 
                            key="v1-hero"
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-gray-100 h-[200px] rounded-2xl p-5 flex flex-col items-center justify-center text-center"
                          >
                            {currentStep === 1 && <PrecisionFrame label="selected.component" detail="hero" />}
                            <div className="text-[18px] font-bold text-gray-800">New Arrivals</div>
                            <div className="text-[12px] text-gray-500 mt-1 mb-3">Explore the latest collection</div>
                            <button className="w-full bg-black text-white py-3 rounded-xl text-[14px] font-medium mt-auto">
                              View Product
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="v2-hero"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full h-[180px] bg-[#F5F5F5] rounded-[32px] p-[24px] flex flex-col justify-center relative overflow-visible"
                          >
                            {currentStep === 2 && <PrecisionFrame label="--dg-radius-hero" detail="32px" />}
                            <div className="z-10 w-[60%]">
                              <div className="text-[22px] font-[800] leading-tight text-black m-0">JMDA Max Lift</div>
                              <div className="text-[12px] font-[500] text-[#666666] mb-4 mt-2">Men&apos;s running</div>
                              <button className="h-[36px] px-6 bg-black text-white rounded-full text-[13px] font-[600] flex items-center justify-center">
                                Shop now
                              </button>
                            </div>
                            <div className="absolute -right-[15%] top-[15%] w-[200px] h-[150px] pointer-events-none z-20">
                              <img src="https://static.vecteezy.com/system/resources/previews/058/272/032/non_2x/sleek-and-minimalist-running-shoe-with-transparent-design-free-png.png" alt="Running Shoe" className="w-full h-full object-contain drop-shadow-xl" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Categories */}
                    <div className="px-4 mt-8 shrink-0 relative h-[50px]">
                      <AnimatePresence mode="wait">
                        {currentStep < 6 ? (
                          <motion.div 
                            key="v1-cat"
                            exit={{ opacity: 0, y: 10 }}
                            className="flex gap-6 items-end absolute top-0 left-5"
                          >
                            {currentStep === 5 && <PrecisionFrame label="selected.component" detail="filters" />}
                            <div className="flex flex-col"><span className="text-[18px] font-[700] text-black">Running</span><span className="text-[12px] text-gray-500 font-medium">4 items</span></div>
                            <div className="flex flex-col opacity-40"><span className="text-[18px] font-[700] text-black">Lifestyle</span><span className="text-[12px] text-gray-500 font-medium">9 items</span></div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="v2-cat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 absolute top-0 left-5"
                          >
                            {currentStep === 6 && <PrecisionFrame label="--dg-radius-pill" detail="4 synced" />}
                            <div className="bg-black text-white px-4 py-2.5 rounded-full text-[13px] font-semibold">Running</div>
                            <div className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-full text-[13px] font-semibold">Lifestyle</div>
                            <div className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-full text-[13px] font-semibold">Basketball</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Diff 2: Product Grid Update */}
                    <div className="px-5 mt-5 shrink-0 relative h-[180px]">
                      <AnimatePresence mode="wait">
                        {currentStep < 4 ? (
                          <motion.div 
                            key="v1-grid"
                            exit={{ opacity: 0, y: 10 }}
                            className="grid grid-cols-2 gap-4 absolute top-0 w-[calc(100%-40px)]"
                          >
                             {currentStep === 3 && <PrecisionFrame label="selected.component" detail="product grid" />}
                             <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-4 flex flex-col items-center text-center">
                                <img src="https://static.vecteezy.com/system/resources/previews/016/542/379/non_2x/black-and-red-running-shoe-free-png.png" className="w-[100px] h-[80px] object-contain mb-2" />
                                <div className="text-[14px] font-semibold text-black">Aero Glide</div>
                                <div className="text-[14px] font-bold text-gray-500 mt-1">$120</div>
                             </div>
                             <div className="bg-[#FAFAFA] border border-gray-100 rounded-2xl p-4 flex flex-col items-center text-center">
                                <img src="https://static.vecteezy.com/system/resources/previews/010/893/781/non_2x/white-and-red-running-shoe-free-png.png" className="w-[100px] h-[80px] object-contain mb-2" />
                                <div className="text-[14px] font-semibold text-black">Stratus X</div>
                                <div className="text-[14px] font-bold text-gray-500 mt-1">$145</div>
                             </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="v2-grid"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-2 gap-4 absolute top-0 w-[calc(100%-40px)]"
                          >
                             {currentStep === 4 && <PrecisionFrame label="--dg-radius-card" detail="24px" />}
                             <div className="bg-white border border-gray-100/60 shadow-[0_8px_24px_rgba(0,0,0,0.06)] rounded-3xl p-4 flex flex-col text-left relative overflow-hidden">
                                <div className="flex justify-between items-start w-full mb-1">
                                  <span className="bg-black text-white text-[9px] px-2 py-1 rounded-md font-bold">NEW</span>
                                  <Heart size={14} className="text-gray-300" />
                                </div>
                                <img src="https://static.vecteezy.com/system/resources/previews/016/542/379/non_2x/black-and-red-running-shoe-free-png.png" className="w-[100px] h-[70px] object-contain mx-auto my-1" />
                                <div className="text-[14px] font-bold text-black leading-tight mt-1">Aero Glide</div>
                                <div className="text-[11px] font-medium text-gray-400 mt-0.5">Road Running</div>
                                <div className="text-[15px] font-black text-black mt-1">$120</div>
                             </div>
                             <div className="bg-white border border-gray-100/60 shadow-[0_8px_24px_rgba(0,0,0,0.06)] rounded-3xl p-4 flex flex-col text-left relative overflow-hidden">
                                <div className="flex justify-between items-start w-full mb-1">
                                  <span className="bg-black text-white text-[9px] px-2 py-1 rounded-md font-bold opacity-0">NEW</span>
                                  <Heart size={14} className="text-gray-300" />
                                </div>
                                <img src="https://static.vecteezy.com/system/resources/previews/010/893/781/non_2x/white-and-red-running-shoe-free-png.png" className="w-[100px] h-[70px] object-contain mx-auto my-1" />
                                <div className="text-[14px] font-bold text-black leading-tight mt-1">Stratus X</div>
                                <div className="text-[11px] font-medium text-gray-400 mt-0.5">Trail Running</div>
                                <div className="text-[15px] font-black text-black mt-1">$145</div>
                             </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>

                  {/* Static Premium Nav */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[90]">
                    <div className="flex items-center justify-between w-[240px] h-[56px] px-2 bg-black/90 backdrop-blur-xl rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/10">
                      <button className="flex flex-col items-center justify-center w-12 h-12 rounded-full text-white relative">
                          <Home size={22} strokeWidth={2.5} />
                      </button>
                      <button className="flex items-center justify-center w-12 h-12 rounded-full text-gray-400 hover:text-white transition-colors">
                          <Search size={22} strokeWidth={2} />
                      </button>
                      <button className="flex items-center justify-center w-12 h-12 rounded-full text-gray-400 hover:text-white transition-colors">
                          <ShoppingBag size={22} strokeWidth={2} />
                      </button>
                      <button className="flex flex-col items-center justify-center w-12 h-12 rounded-full text-gray-400 hover:text-white transition-colors">
                          <User size={22} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Removed Export Overlay */}

                  {/* Fade out for list scrolling */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-[80]"></div>
                  {/* iOS Home Indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[35%] h-[4px] bg-[#000000]/30 rounded-full z-[100]"></div>
                </div>
             </div>
          </div>

        </div>
        <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2 font-mono text-[9px] text-white/50 sm:px-5 sm:text-[10px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500 ${currentStep >= 6 ? 'bg-emerald-500' : 'bg-orange-400'}`} />
            <AnimatePresence mode="wait">
              <motion.span
                key={currentStep >= 6 ? 'ready' : activeToken.name}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="truncate"
              >
                {currentStep >= 6 ? 'Agent-ready handoff · design system preserved' : `Applying ${activeToken.name} across ${activeToken.affected}`}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span>semantic tokens</span>
            <span className="text-white/15">·</span>
            <span>no style drift</span>
          </div>
        </div>
      </div>
      </div>
      
      {/* CSS for custom scrollbar in the code editor to make it sleek */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 20px;
          transition: background-color 200ms ease;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.18);
        }
        .custom-scrollbar {
          scrollbar-color: transparent transparent;
        }
        .custom-scrollbar:hover {
          scrollbar-color: rgba(255,255,255,0.18) transparent;
        }
      `}} />
    </section>
  );
}
