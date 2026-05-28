"use client";
import React, { useState, useEffect } from 'react';
import { Settings, ArrowRight, Check, Activity, Flame, ChevronRight, MapPin, Trophy, ChevronLeft, ShoppingBag, Home, Search, Heart, Code, Play, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SvgDivider = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 18" className="h-[18px] w-12 shrink-0 hidden md:block">
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

export default function DescribeToDesign() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    const runSequence = async () => {
      if (!mounted) return;
      setCurrentStep(0);
      await new Promise(r => setTimeout(r, 800));
      
      if (!mounted) return;
      setCurrentStep(1);
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(2);
      await new Promise(r => setTimeout(r, 2500));
      
      if (!mounted) return;
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 5000));
      
      if (!mounted) return;
      runSequence();
    };

    runSequence();

    return () => {
      mounted = false;
    };
  }, []);

  const codeBlocks = [
    {
      step: 1,
      lines: [
        { text: '<!-- Storefront Header -->' },
        { tag: 'div', attrs: 'class="flex justify-between px-6 py-4"', indent: 0 },
        { tag: 'button', attrs: 'class="btn-back"', content: '<ChevronLeft />', indent: 1 },
        { tag: 'h1', attrs: 'class="font-black text-xl"', content: 'JMDF', indent: 1 },
        { tag: 'button', attrs: 'class="btn-cart"', content: '<ShoppingBag />', indent: 1 },
        { closeTag: 'div', indent: 0 },
        { text: '' },
        { text: '<!-- Hero Product -->' },
        { tag: 'div', attrs: 'class="hero-card bg-gray-100 rounded-3xl p-4"', indent: 0 },
        { tag: 'h2', attrs: 'class="text-2xl font-bold"', content: 'JMDA Max Lift', indent: 1 },
        { tag: 'button', attrs: 'class="bg-black text-white px-6"', content: 'Shop now', indent: 1 },
        { tag: 'img', attrs: 'src="/shoes/max-lift.png"', content: null, indent: 1 },
        { closeTag: 'div', indent: 0 },
      ]
    },
    {
      step: 2,
      lines: [
        { text: '' },
        { text: '<!-- Categories -->' },
        { tag: 'div', attrs: 'class="flex overflow-x-auto gap-6 px-6 mt-8"', indent: 0 },
        { tag: 'div', attrs: 'class="category active"', content: 'Running', indent: 1 },
        { tag: 'div', attrs: 'class="category opacity-30"', content: 'Lifestyle', indent: 1 },
        { tag: 'div', attrs: 'class="category opacity-30"', content: 'Gym', indent: 1 },
        { closeTag: 'div', indent: 0 },
      ]
    },
    {
      step: 3,
      lines: [
        { text: '' },
        { text: '<!-- Floating Navigation -->' },
        { tag: 'nav', attrs: 'class="fixed bottom-6 flex items-center bg-white shadow-xl"', indent: 0 },
        { tag: 'a', attrs: 'href="/" class="nav-item"', content: '<Home />', indent: 1 },
        { tag: 'button', attrs: 'class="nav-search bg-black text-white"', content: '<Search />', indent: 1 },
        { tag: 'a', attrs: 'href="/likes" class="nav-item"', content: '<Heart />', indent: 1 },
        { closeTag: 'nav', indent: 0 },
      ]
    }
  ];

  const renderCodeLine = (line: any) => {
    return (
      <div style={{ marginLeft: `${(line.indent || 0) * 16}px` }}>
        {line.text && <span className="text-[#8C999E]">{line.text}</span>}
        {line.tag && (
          <>
            <span className="text-[#8C999E]">&lt;</span>
            <span className="text-[#E06C75]">{line.tag}</span>
            {line.attrs && (
              <span className="text-[#D19A66]">
                {' '}
                <span className="text-[#D19A66]">{line.attrs.split('=')[0]}</span>
                <span className="text-[#8C999E]">=</span>
                <span className="text-[#98C379]">{line.attrs.split('=')[1]}</span>
              </span>
            )}
            {line.content === null ? (
              <span className="text-[#8C999E]"> /&gt;</span>
            ) : (
              <span className="text-[#8C999E]">&gt;</span>
            )}
            {line.content && <span className="text-[#ABB2BF]">{line.content}</span>}
            {line.content !== null && (
              <>
                <span className="text-[#8C999E]">&lt;/</span>
                <span className="text-[#E06C75]">{line.tag}</span>
                <span className="text-[#8C999E]">&gt;</span>
              </>
            )}
          </>
        )}
        {line.closeTag && !line.tag && (
          <>
            <span className="text-[#8C999E]">&lt;/</span>
            <span className="text-[#E06C75]">{line.closeTag}</span>
            <span className="text-[#8C999E]">&gt;</span>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="relative w-full max-w-[1200px] mx-auto px-4 md:px-6 py-16 md:py-24 z-10 bg-[#FAFAFA] font-sans">
      
      <div className="flex flex-col items-center text-center">
        <h2 className="text-[28px] md:text-[36px] font-medium text-[#4A4A4A] leading-[1.2] mb-3">
          Rapidly build <span className="font-bold text-black">unique designs</span> with our <span className="font-bold text-black">adaptable</span> UI generator.
        </h2>
      </div>

      {/* Prompts/Steps Strip (AlignUI Style) */}
      <div className="flex flex-col items-center justify-center mt-12 w-full relative">
        <div className="flex items-center justify-center gap-2 md:gap-3 w-full overflow-x-auto px-4 pb-2 no-scrollbar snap-x">
          
          {/* Pill 1 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 1 ? 'border-green-200 bg-green-50/50 text-gray-800' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 1 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
            )}
            Minimal storefront
          </div>

          <SvgDivider />

          {/* Pill 2 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 2 ? 'border-green-200 bg-green-50/50 text-gray-800' : currentStep === 1 ? 'border-orange-200 bg-white text-gray-800' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 2 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 1 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
            )}
            Product sections
          </div>

          <SvgDivider />

          {/* Pill 3 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors snap-center ${currentStep >= 3 ? 'border-green-200 bg-green-50/50 text-gray-800' : currentStep === 2 ? 'border-orange-200 bg-white text-gray-800' : 'border-gray-200 bg-white text-gray-400'}`}>
            {currentStep >= 3 ? (
              <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3}/></div>
            ) : currentStep === 2 ? (
              <div className="text-orange-500 flex items-center justify-center"><Loader size={14} className="animate-spin"/></div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
            )}
            Floating navigation
          </div>
        </div>

        <BracketDown />
      </div>

      {/* Main Split Panel (AlignUI Style Unified Card) */}
      <div className="w-full max-w-[1000px] mx-auto bg-white rounded-[24px] border border-gray-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col mb-16 relative z-20">
        
        {/* Top Bar */}
        <div className="h-[48px] border-b border-gray-100 flex items-center px-4 bg-white select-none">
          {/* Left - File Tab */}
          <div className="flex items-center gap-2 text-gray-600 h-full">
            <div className="w-4 h-4 text-orange-500 flex items-center justify-center">
              <Code size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-mono font-bold tracking-tight text-gray-700">index.html</span>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1"></div>
          </div>
          
          <div className="flex-1"></div>
          
          {/* Right - Preview Tab */}
          <div className="flex items-center gap-2 border-l border-gray-100 pl-4 h-full text-gray-400">
            <Play size={12} className="fill-current" />
            <span className="text-[13px] font-bold tracking-wide">preview</span>
          </div>
        </div>

        {/* Split Body */}
        <div className="flex flex-col lg:flex-row h-auto min-h-[580px]">
          
          {/* LEFT: Code Panel */}
          <div className="flex-1 p-6 overflow-x-auto bg-white font-mono text-[12px] md:text-[13px] leading-[1.8]">
            <div className="flex min-w-[400px]">
               <div className="w-8 text-right pr-4 text-[#D5D5D5] select-none flex flex-col font-medium opacity-60">
                  {Array.from({length: 25}).map((_, i) => <div key={i}>{i+1}</div>)}
               </div>
               <div className="flex-1 text-[#2C3132]">
                  {codeBlocks.map((block) => (
                    <AnimatePresence key={block.step}>
                      {currentStep >= block.step && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.4 }}
                          className="overflow-hidden"
                        >
                          {block.lines.map((line, idx) => (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 + 0.1 }}
                              className="whitespace-pre flex"
                            >
                              {renderCodeLine(line)}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}

                  {/* Blinking Cursor */}
                  {currentStep > 0 && currentStep < 3 && (
                    <motion.div 
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2 h-[15px] bg-orange-400 mt-1 inline-block"
                    />
                  )}
               </div>
            </div>
          </div>

          {/* RIGHT: UI Preview Panel */}
          <div className="w-full lg:w-[460px] bg-[#FAFAFA] border-t lg:border-t-0 lg:border-l border-gray-100 flex items-center justify-center p-8 relative overflow-hidden">
             
             {/* The Premium Hardware Phone Frame */}
             <div className="w-[300px] h-[600px] bg-[#E8E8E8] rounded-[48px] p-[6px] shadow-[0_12px_32px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.8)] relative z-10 flex flex-col box-border border border-gray-200 shrink-0">
                
                {/* Inner Bezel Screen */}
                <div className="w-full h-full bg-white rounded-[42px] relative overflow-hidden flex flex-col shadow-sm">
                  
                  {/* Dynamic Island */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[90px] h-[26px] bg-black rounded-full z-[60] flex items-center justify-between px-2.5 shadow-[inset_0_-1px_1px_rgba(255,255,255,0.1)]">
                     <div className="w-2 h-2 rounded-full bg-[#111] border border-white/5"></div>
                     <div className="w-2 h-2 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-indigo-400 blur-[1px]"></div>
                     </div>
                  </div>

                  {/* UI Render Area (Sneakers Store) */}
                  <div className="flex-1 relative z-10 font-sans text-black w-full h-full flex flex-col bg-white overflow-x-hidden overflow-y-auto no-scrollbar">
                    
                    {/* Placeholder Base */}
                    <AnimatePresence>
                      {currentStep === 0 && (
                        <motion.div 
                          exit={{ opacity: 0 }} 
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                           <div className="text-gray-300">
                             <Settings size={28} className="animate-[spin_4s_linear_infinite]" />
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Step 1: Header + Hero */}
                    <AnimatePresence>
                      {currentStep >= 1 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, type: 'spring' }}
                          className="flex flex-col w-full pt-10 shrink-0"
                        >
                          <div className="flex items-center justify-between px-5 h-14">
                            <button className="w-9 h-9 flex items-center justify-center border border-gray-100 rounded-[10px] bg-white">
                              <ChevronLeft size={18} />
                            </button>
                            <div className="font-black text-[18px] tracking-tighter text-black">JMDF</div>
                            <button className="w-9 h-9 flex items-center justify-center border border-gray-100 rounded-[10px] bg-white relative">
                              <ShoppingBag size={18} />
                              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-black rounded-full border-2 border-white"></div>
                            </button>
                          </div>

                          <div className="px-5 mt-1">
                            <div className="text-[22px] font-[800] leading-tight text-black m-0">New Collection</div>
                            <div className="text-[12px] font-[400] text-[#666666] mt-0.5">JMDA Original 2025</div>
                          </div>

                          <div className="px-5 mt-4 relative">
                            <div className="w-full h-[160px] bg-[#F5F5F5] rounded-[24px] p-[16px] flex flex-col justify-center relative overflow-visible">
                              <div className="z-10 w-[60%]">
                                <div className="text-[18px] font-[700] leading-tight text-black m-0">JMDA Max Lift</div>
                                <div className="text-[11px] font-[400] text-[#666666] mb-3 mt-1">Men&apos;s shoes</div>
                                <button className="h-[32px] px-5 bg-black text-white rounded-full text-[13px] font-[600] flex items-center justify-center">
                                  Shop now
                                </button>
                              </div>
                              <div className="absolute -right-[10%] top-[5%] w-[180px] h-[140px] pointer-events-none z-20">
                                <img src="https://static.vecteezy.com/system/resources/previews/058/272/032/non_2x/sleek-and-minimalist-running-shoe-with-transparent-design-free-png.png" alt="Running Shoe" className="w-full h-full object-contain drop-shadow-xl" />
                              </div>
                              <div className="absolute bottom-[16px] left-[50%] -translate-x-1/2 flex gap-1 z-30">
                                <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0]"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0]"></div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Step 2: Categories */}
                    <AnimatePresence>
                      {currentStep >= 2 && (
                         <motion.div 
                           initial={{ opacity: 0, x: 10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ duration: 0.4, delay: 0.1 }}
                           className="w-full mt-6 shrink-0"
                         >
                            <div className="flex overflow-x-hidden px-5 gap-5 items-end">
                              <div className="flex flex-col flex-shrink-0">
                                <span className="text-[18px] font-[700] text-black">Running</span>
                                <span className="text-[11px] text-[#666666]">4 items</span>
                              </div>
                              <div className="flex flex-col flex-shrink-0 opacity-30">
                                <span className="text-[18px] font-[700] text-black">Lifestyle</span>
                                <span className="text-[11px] text-[#666666]">9 items</span>
                              </div>
                              <div className="flex flex-col flex-shrink-0 opacity-30">
                                <span className="text-[18px] font-[700] text-black">Gym</span>
                                <span className="text-[11px] text-[#666666]">5 items</span>
                              </div>
                            </div>
                         </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Step 3: Bottom Nav (We skip product grid for brevity so the nav is easily visible) */}
                    <AnimatePresence>
                      {currentStep >= 3 && (
                        <motion.div 
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4, type: 'spring' }}
                          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex justify-center items-end z-[90]"
                        >
                          <div className="flex items-center justify-between w-[200px] h-[56px] px-3 bg-white rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-[#EEEEEE]">
                            <button className="flex flex-col items-center justify-center w-10 h-10 rounded-full text-black relative">
                                <Home size={20} strokeWidth={2.5} />
                                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-black"></span>
                            </button>
                            <div className="relative -top-4">
                              <button className="flex items-center justify-center w-[50px] h-[50px] bg-black rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
                                <Search size={20} className="text-white" />
                              </button>
                            </div>
                            <button className="flex flex-col items-center justify-center w-10 h-10 rounded-full text-[#BDBDBD]">
                                <Heart size={20} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Fake content to allow scroll */}
                    {currentStep >= 3 && <div className="h-[200px]"></div>}

                  </div>

                  {/* Gradient to cover overscroll/overlap at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-[80]"></div>

                  {/* Home indicator pill */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[35%] h-[4px] bg-[#000000]/30 rounded-full z-[100]"></div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </section>
  );
}
      