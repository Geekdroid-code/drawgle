"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Settings, ArrowRight, Check, Activity, Flame, ChevronRight, MapPin, Trophy, ChevronLeft, ShoppingBag, Home, Search, Heart, Code, Play, Loader, Smartphone, User, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SvgDivider = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 18" className="h-[18px] w-12 shrink-0 hidden md:block opacity-60">
    <path stroke="#E0E0E0" d="M0 8.5h48"></path>
    <g clipPath="url(#rapid-dev-top-divider_svg__a)">
      <rect width="16" height="16" x="16" y="1" fill="#F7F7F7" rx="8"></rect>
      <path fill="#B8B8B8" fillRule="evenodd" d="M20.813 5.98a.5.5 0 0 1 .707 0l2.195 2.195a1.167 1.167 0 0 1 0 1.65L21.52 12.02a.5.5 0 1 1-.707-.707l2.195-2.195a.167.167 0 0 0 0-.236l-2.195-2.195a.5.5 0 0 1 0-.707m4.667 0a.5.5 0 0 1 .707 0l2.195 2.195a1.167 1.167 0 0 1 0 1.65l-2.195 2.195a.5.5 0 1 1-.707-.707l2.195-2.195a.167.167 0 0 0 0-.236L25.48 6.687a.5.5 0 0 1 0-.707" clipRule="evenodd"></path>
    </g>
    <rect width="17" height="17" x="15.5" y="0.5" stroke="#E0E0E0" rx="8.5"></rect>
    <defs>
      <clipPath id="rapid-dev-top-divider_svg__a">
        <rect width="16" height="16" x="16" y="1" fill="#fff" rx="8"></rect>
      </clipPath>
    </defs>
  </svg>
);

const BracketDown = () => (
  <div className="flex justify-center w-full my-3 md:my-5 opacity-60">
    <svg width="240" height="30" viewBox="0 0 240 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.5 1C0.5 1 119.5 1 119.5 15C119.5 29 119.5 29 119.5 29" stroke="#E0E0E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M239.5 1C239.5 1 120.5 1 120.5 15C120.5 29 120.5 29 120.5 29" stroke="#E0E0E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="120" cy="28" r="2" fill="#B8B8B8"/>
    </svg>
  </div>
);

const VerticalRuler = ({ side }: { side: 'left' | 'right' }) => {
  const ticks = Array.from({ length: 30 }).map((_, i) => i * 50);
  
  return (
    <div className={`absolute top-0 bottom-0 w-8 pointer-events-none hidden xl:block opacity-60
      ${side === 'left' ? 'left-0 border-r border-gray-200' : 'right-0 border-l border-gray-200'}`}
    >
      {ticks.map(tick => (
        <div key={tick} className={`absolute w-full flex items-center h-[1px] ${side === 'left' ? 'justify-end' : 'justify-start'}`} style={{ top: `${tick}px` }}>
           {side === 'left' ? (
             <>
               <span className="text-[10px] font-mono text-[#BDBDBD] -rotate-90 origin-right mr-1.5 -translate-y-1/2 select-none tracking-widest">
                 {tick === 0 ? '0' : tick}
               </span>
               <div className="w-1.5 h-[1px] bg-gray-300"></div>
             </>
           ) : (
             <>
               <div className="w-1.5 h-[1px] bg-gray-300"></div>
               <span className="text-[10px] font-mono text-[#BDBDBD] -rotate-90 origin-left ml-1.5 -translate-y-1/2 select-none tracking-widest">
                 {tick === 0 ? '0' : tick}
               </span>
             </>
           )}
        </div>
      ))}
    </div>
  );
};

export default function DescribeToDesign() {
  const [currentStep, setCurrentStep] = useState(0);
  const codeContainerRef = useRef<HTMLDivElement>(null);

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
    { id: 'rn1', text: 'import { View, Text, Image, ScrollView, TouchableOpacity } from "react-native";', type: 'add', step: 5 },
    { id: 'rn2', text: 'export default function SneakerStore() {', type: 'add', step: 5 },
    { id: 'rn3', text: '  return (', type: 'add', step: 5 },
    { id: 'rn4', text: '    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>', type: 'add', step: 5 },
    { id: 'html1', text: '<div class="app-container w-full h-full bg-white overflow-hidden">', type: 'delete', step: 5 },
    
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
    
    { id: 16, text: '      <div class="bg-[#F5F5F5] rounded-[32px] p-[24px] relative overflow-hidden">', type: 'add', step: 1 },
    { id: 17, text: '        <h2 class="text-[22px] font-bold leading-tight text-black w-[60%]">JMDA Max Lift</h2>', type: 'add', step: 1 },
    { id: 18, text: '        <p class="text-[12px] font-medium text-[#666666] mt-2 mb-4">Men\'s running</p>', type: 'add', step: 1 },
    { id: 19, text: '        <button class="bg-black text-white px-6 py-2.5 rounded-full text-[13px] font-semibold">Shop now</button>', type: 'add', step: 1 },
    { id: 20, text: '        <img src="/shoes/max-lift.png" class="absolute -right-12 top-6 w-[240px] drop-shadow-2xl pointer-events-none" />', type: 'add', step: 1 },
    { id: 21, text: '      </div>', type: 'add', step: 1 },
    
    { id: 22, text: '    </div>', type: 'normal' },
    { id: 23, text: '', type: 'normal' },
    
    { id: 24, text: '    <!-- Categories -->', type: 'normal' },
    { id: 25, text: '    <div class="flex gap-6 mb-6">', type: 'normal' },
    { id: 26, text: '      <div class="flex flex-col"><span class="font-bold text-[18px]">Running</span><span class="text-[12px] text-gray-500">4 items</span></div>', type: 'normal' },
    { id: 27, text: '      <div class="flex flex-col opacity-40"><span class="font-bold text-[18px]">Lifestyle</span><span class="text-[12px] text-gray-500">9 items</span></div>', type: 'normal' },
    { id: 28, text: '    </div>', type: 'normal' },
    { id: 29, text: '', type: 'normal' },

    { id: 30, text: '    <!-- Product Grid -->', type: 'normal' },
    { id: 31, text: '    <div class="grid grid-cols-2 gap-4">', type: 'normal' },
    { id: 32, text: '      <div class="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100">', type: 'normal' },
    { id: 33, text: '        <img src="/shoes/shoe1.png" class="w-full h-24 object-contain mix-blend-multiply" />', type: 'normal' },
    { id: 34, text: '        <div class="mt-3 font-semibold text-[14px]">Aero Glide</div>', type: 'normal' },
    { id: 35, text: '        <div class="font-bold text-[14px] mt-1">$120</div>', type: 'normal' },
    { id: 36, text: '      </div>', type: 'normal' },
    { id: 37, text: '      <div class="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100">', type: 'normal' },
    { id: 38, text: '        <img src="/shoes/shoe2.png" class="w-full h-24 object-contain mix-blend-multiply" />', type: 'normal' },
    { id: 39, text: '        <div class="mt-3 font-semibold text-[14px]">Stratus X</div>', type: 'normal' },
    { id: 40, text: '        <div class="font-bold text-[14px] mt-1">$145</div>', type: 'normal' },
    { id: 41, text: '      </div>', type: 'normal' },
    { id: 42, text: '    </div>', type: 'normal' },
    { id: 43, text: '  </main>', type: 'normal' },
    { id: 44, text: '', type: 'normal' },
    
    // Step 3: Iterate with natural language (Add Glass Nav)
    { id: 45, text: '  <!-- Bottom Navigation -->', type: 'normal' },
    { id: 46, text: '  <nav class="fixed bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8">', type: 'delete', step: 3 },
    { id: 47, text: '    <button class="text-black flex flex-col items-center"><Home size={22} /><span class="text-[10px] mt-1">Home</span></button>', type: 'delete', step: 3 },
    { id: 48, text: '    <button class="text-gray-400 flex flex-col items-center"><Search size={22} /><span class="text-[10px] mt-1">Search</span></button>', type: 'delete', step: 3 },
    { id: 49, text: '    <button class="text-gray-400 flex flex-col items-center"><Heart size={22} /><span class="text-[10px] mt-1">Saved</span></button>', type: 'delete', step: 3 },
    { id: 50, text: '    <button class="text-gray-400 flex flex-col items-center"><User size={22} /><span class="text-[10px] mt-1">Profile</span></button>', type: 'delete', step: 3 },
    { id: 51, text: '  </nav>', type: 'delete', step: 3 },
    
    { id: 52, text: '  <nav class="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-between w-[220px] bg-white/90 backdrop-blur-md rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-white p-1.5">', type: 'add', step: 3 },
    { id: 53, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-black"><Home size={20} /></button>', type: 'add', step: 3 },
    { id: 54, text: '    <div class="relative -top-5">', type: 'add', step: 3 },
    { id: 55, text: '      <button class="w-[52px] h-[52px] bg-black text-white rounded-full flex items-center justify-center shadow-xl"><Search size={20} /></button>', type: 'add', step: 3 },
    { id: 56, text: '    </div>', type: 'add', step: 3 },
    { id: 57, text: '    <button class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400"><Heart size={20} /></button>', type: 'add', step: 3 },
    { id: 58, text: '  </nav>', type: 'add', step: 3 },
    
    { id: 59, text: '</div>', type: 'delete', step: 5 },
    { id: 'rn5', text: '    </SafeAreaView>', type: 'add', step: 5 },
    { id: 'rn6', text: '  );', type: 'add', step: 5 },
    { id: 'rn7', text: '}', type: 'add', step: 5 },
  ];

  const visibleLines = codeLines.filter(line => {
    if (line.type === 'normal') return true;
    if (currentStep < line.step!) return line.type === 'delete';
    if (currentStep === line.step!) return true; 
    if (currentStep > line.step!) return line.type === 'add';
    return true;
  });

  return (
    <section className="relative w-full max-w-[1200px] mx-auto px-4 md:px-6 py-16 md:py-24 mb-16 z-10 bg-[#FAFAFA] font-sans">
      <VerticalRuler side="left" />
      <VerticalRuler side="right" />
      
      <div className="flex flex-col items-center text-center">
        <h2 className="text-[28px] md:text-[36px] font-medium text-[#4A4A4A] leading-[1.2] mb-3">
          Rapidly build <span className="font-bold text-black">unique designs</span> with our <span className="font-bold text-black">adaptable</span> AI generator.
        </h2>
      </div>

      <div className="flex flex-col items-center justify-center mt-12 w-full relative">
        <div className="flex items-center justify-center w-full overflow-x-auto px-4 pb-2 no-scrollbar snap-x">
          
          {/* Pill 1 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 2 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : currentStep === 1 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 2 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 1 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-100 bg-gray-50"></div>
            )}
            Iterate specific sections
          </div>

          <SvgDivider />

          {/* Pill 2 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 4 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : currentStep === 3 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 4 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 3 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-100 bg-gray-50"></div>
            )}
            Refine with premium components
          </div>

          <SvgDivider />

          {/* Pill 3 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 6 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : currentStep === 5 ? 'border-gray-200 bg-white text-gray-800 shadow-sm' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 6 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 5 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-100 bg-gray-50"></div>
            )}
            Export native code
          </div>
        </div>

        <BracketDown />
      </div>

      <div className="w-full max-w-[1060px] mx-auto relative mb-16 z-20">
        <div className="bg-white rounded-[24px] border border-gray-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
        
        {/* Editor Top Bar */}
        <div className="h-[48px] border-b border-gray-100 flex items-center px-4 bg-white select-none">
          <div className="flex items-center gap-2 text-gray-600 h-full">
            <div className="w-4 h-4 text-orange-500 flex items-center justify-center">
              <Code size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-mono font-bold tracking-tight text-gray-700">
              {currentStep >= 6 ? 'SneakerStore.tsx' : 'index.html'}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1"></div>
          </div>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2 border-l border-gray-100 pl-4 h-full text-gray-400">
            <Play size={12} className="fill-current" />
            <span className="text-[13px] font-bold tracking-wide">preview</span>
          </div>
        </div>

        {/* Split Body */}
        <div className="flex flex-col lg:flex-row h-auto lg:h-[620px]">
          
          {/* Left: Code Pane */}
          <div 
            ref={codeContainerRef}
            className="flex-1 p-4 md:p-6 overflow-x-auto overflow-y-auto bg-white font-mono text-[12px] md:text-[13px] leading-[1.8] min-w-0 custom-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex min-w-max pb-12">
               <div className="w-8 text-right pr-4 text-[#D5D5D5] select-none flex flex-col font-medium opacity-60">
                  {visibleLines.map((_, i) => <div key={i} className="h-[23.4px]">{i+1}</div>)}
               </div>
               <div className="flex-1 text-[#4A5568]">
                  <AnimatePresence initial={false}>
                    {visibleLines.map((line) => {
                      const isDiffing = currentStep === line.step;
                      const isAdding = isDiffing && line.type === 'add';
                      const isDeleting = isDiffing && line.type === 'delete';
                      
                      let rowClass = 'px-2 rounded-md whitespace-pre transition-colors duration-300 flex items-center h-[23.4px] ';
                      let prefix = '  ';
                      
                      if (isAdding) {
                        rowClass += 'bg-green-500/10 text-green-700 font-medium';
                        prefix = '+ ';
                      } else if (isDeleting) {
                        rowClass += 'bg-red-500/10 text-red-600 line-through opacity-60';
                        prefix = '- ';
                      } else {
                        rowClass += 'text-gray-600';
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
                            {line.text.split(/(<[^>]+>)/g).map((part, i) => {
                              if (part.startsWith('<')) return <span key={i} className={isAdding || isDeleting ? "" : "text-indigo-500"}>{part}</span>;
                              return <span key={i}>{part}</span>;
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
          <div className="w-full lg:w-[460px] bg-[#FAFAFA] border-t lg:border-t-0 lg:border-l border-gray-100 flex items-center justify-center py-8 px-4 relative overflow-hidden shrink-0">
             
             {/* Hardware Frame */}
             <div className="w-[300px] h-[600px] bg-[#E8E8E8] rounded-[48px] p-[6px] shadow-[0_12px_32px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)] relative z-10 flex flex-col box-border border border-gray-200 shrink-0">
                
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
                  <div className="flex-1 relative z-10 font-sans text-black w-full h-full flex flex-col bg-white overflow-x-hidden overflow-y-auto no-scrollbar pt-10 pb-24">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 h-14 shrink-0">
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-[12px] bg-white">
                        <Menu size={20} />
                      </button>
                      <div className="font-black text-[18px] tracking-tighter text-black">JMDF</div>
                      <button className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-[12px] bg-white relative">
                        <ShoppingBag size={20} />
                      </button>
                    </div>

                    {/* Diff 1: Hero Update */}
                    <div className="px-5 mt-4 relative shrink-0">
                      <AnimatePresence mode="wait">
                        {currentStep < 2 ? (
                          <motion.div 
                            key="v1-hero"
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-100 h-[200px] rounded-2xl p-5 flex flex-col items-center justify-center text-center"
                          >
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
                    <div className="flex gap-6 px-5 mt-8 items-end shrink-0">
                      <div className="flex flex-col"><span className="text-[18px] font-[700] text-black">Running</span><span className="text-[12px] text-gray-500 font-medium">4 items</span></div>
                      <div className="flex flex-col opacity-40"><span className="text-[18px] font-[700] text-black">Lifestyle</span><span className="text-[12px] text-gray-500 font-medium">9 items</span></div>
                    </div>

                    {/* Product Grid (Fills the empty space) */}
                    <div className="grid grid-cols-2 gap-4 px-5 mt-5 shrink-0">
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
                    </div>

                  </div>

                  {/* Diff 2: Navigation Update */}
                  <AnimatePresence mode="wait">
                    {currentStep < 4 ? (
                      <motion.div 
                        key="v1-footer"
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-0 w-full z-40 bg-white border-t border-gray-100 pb-6 pt-3 px-6 flex justify-between items-center"
                      >
                        <button className="flex flex-col items-center text-black"><Home size={22} /><span className="text-[10px] font-medium mt-1">Home</span></button>
                        <button className="flex flex-col items-center text-gray-400"><Search size={22} /><span className="text-[10px] font-medium mt-1">Search</span></button>
                        <button className="flex flex-col items-center text-gray-400"><Heart size={22} /><span className="text-[10px] font-medium mt-1">Saved</span></button>
                        <button className="flex flex-col items-center text-gray-400"><User size={22} /><span className="text-[10px] font-medium mt-1">Profile</span></button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="v2-nav"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', bounce: 0.4 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex justify-center items-end z-[90]"
                      >
                        <div className="flex items-center justify-between w-[220px] h-[60px] px-3 bg-white/95 backdrop-blur-md rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-white/60">
                          <button className="flex flex-col items-center justify-center w-11 h-11 rounded-full text-black relative">
                              <Home size={20} strokeWidth={2.5} />
                              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-black"></span>
                          </button>
                          <div className="relative -top-5">
                            <button className="flex items-center justify-center w-[52px] h-[52px] bg-black rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.3)] border-[3px] border-white">
                              <Search size={20} className="text-white" />
                            </button>
                          </div>
                          <button className="flex flex-col items-center justify-center w-11 h-11 rounded-full text-[#BDBDBD]">
                              <Heart size={20} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Diff 3: Export Success Overlay */}
                  <AnimatePresence>
                    {currentStep >= 6 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
                      >
                        <motion.div 
                          initial={{ scale: 0.9, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          className="bg-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2"
                        >
                          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                            <Smartphone size={14} strokeWidth={3} />
                          </div>
                          <span className="font-bold text-[13px]">React Native Exported</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Fade out for list scrolling */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-[80]"></div>
                  {/* iOS Home Indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[35%] h-[4px] bg-[#000000]/30 rounded-full z-[100]"></div>
                </div>
             </div>
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
          background-color: #E2E8F0;
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
        }
      `}} />
    </section>
  );
}