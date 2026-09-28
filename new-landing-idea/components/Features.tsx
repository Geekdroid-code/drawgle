'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ChevronLeft, 
  ArrowUp,
  Check,
  SlidersHorizontal,
  MousePointer2,
  Image as ImageIcon,
  Palette,
  Network,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

interface FeaturesProps {
  onOpenDownload?: () => void;
}

export function Features({ onOpenDownload }: FeaturesProps) {
  const [activeFeature, setActiveFeature] = useState<number>(0);
  const [approved, setApproved] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [extraMessages, setExtraMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = customInput.trim() || 'Adjust primary button radius to 16px';
    setExtraMessages((prev) => [
      ...prev,
      { sender: 'user', text: textToSend },
      { sender: 'assistant', text: `Updated design tokens: primary radius set to 16px across all screens.` }
    ]);
    setCustomInput('');
  };

  // Left 4 features from the core features list
  const leftFeatures = [
    {
      id: 0,
      icon: SlidersHorizontal,
      title: 'Update shared design tokens once',
      description: 'Adjust a color, font, spacing value, corner radius, or shadow once. Every connected screen updates live without regenerating your work.',
    },
    {
      id: 1,
      icon: MousePointer2,
      title: 'Edit a selected element in place',
      description: 'Select a card, button, section, or navigation item and describe the improvement. Drawgle edits that part while preserving everything around it.',
    },
    {
      id: 2,
      icon: ImageIcon,
      title: 'Rebuild a screenshot as editable UI',
      description: 'Upload a UI screenshot when you want its layout rebuilt as a real, editable screen instead of receiving a flattened image.',
    },
    {
      id: 3,
      icon: Palette,
      title: 'Use an interface as a style reference',
      description: 'Use any interface as visual inspiration. Drawgle carries over its mood, surfaces, typography, and rhythm while designing your own app and features.',
    },
  ];

  // Right 4 features from the core features list
  const rightFeatures = [
    {
      id: 4,
      icon: Network,
      title: 'Design connected mobile screen flows',
      description: 'Generate multiple screens with shared navigation and one consistent visual language, so dashboards, details, and flows feel like the same product.',
    },
    {
      id: 5,
      icon: MessageSquare,
      title: 'Keep product context across iterations',
      description: 'Drawgle keeps your audience, goals, features, visual direction, and earlier decisions in context when you add or refine screens later.',
    },
    {
      id: 6,
      icon: RefreshCw,
      title: 'Replace images without rebuilding the screen',
      description: 'Select an image or visual placeholder, upload the right asset, and replace it in place while keeping the surrounding layout intact.',
    },
    {
      id: 7,
      icon: Check,
      title: 'Keep generated screens editable',
      description: 'The first output is a starting point, not a dead export. Continue adding screens, changing the system, and refining details on the same canvas.',
    },
  ];

  const navGlassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '26px',
  };

  return (
    <section id="features" className="py-20 sm:py-28 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 sm:mb-20"
        >
          {/* Top Kicker Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-800 mb-5 bg-[#ededed]/64 backdrop-blur-xl border border-black/[0.04] select-none">
            <Sparkles className="w-3.5 h-3.5 text-[#305dde]" />
            <span className="tracking-wider uppercase text-[11px]">CORE FEATURES</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[rgb(30,30,30)] leading-tight mb-4">
            Keep every mobile screen <br />
            <span className="text-[#305dde] font-semibold">visually consistent.</span>
          </h2>
          
          <p className="text-sm sm:text-base text-[rgb(69,69,69)] max-w-2xl mx-auto leading-relaxed">
            Use one shared system for colors, type, spacing, radii, shadows, layout, and navigation. Update it once to keep connected mobile screens aligned.
          </p>
        </motion.div>

        {/* 3-Column Layout: Left 4 Cards | Center iPhone Mockup | Right 4 Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          
          {/* Left Column: 4 Feature Cards */}
          <div className="lg:col-span-4 space-y-3.5 sm:space-y-4 order-2 lg:order-1">
            {leftFeatures.map((feat, index) => {
              const Icon = feat.icon;
              const isSelected = activeFeature === feat.id;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setActiveFeature(feat.id)}
                  style={navGlassStyle}
                  className={`p-4 sm:p-5 border-0 cursor-pointer text-left transition-all ${
                    isSelected
                      ? 'opacity-100 ring-2 ring-[rgb(20,20,20)]/15 shadow-sm'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[rgb(20,20,20)] mb-2.5 shadow-xs">
                    <Icon className="w-4 h-4 text-[#305dde]" />
                  </div>
                  <h3 className="text-sm sm:text-[15px] font-bold text-neutral-900 mb-1 tracking-tight leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Center Column: iPhone Mockup (Kept same as requested) */}
          <motion.div 
            initial={{ opacity: 0, y: 35, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 flex justify-center order-1 lg:order-2"
          >
            <div className="relative w-full max-w-[320px] sm:max-w-[340px] rounded-[48px] bg-white p-3 border-[6px] border-[#22252a]">
              
              {/* Dynamic Island Notch */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-between px-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1c1c1e] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-900/60"></div>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#111]"></div>
              </div>

              {/* iOS Screen */}
              <div className="rounded-[38px] bg-[#fbfcfd] text-neutral-900 pt-7 pb-3 px-3.5 overflow-hidden text-left relative min-h-[580px] border border-neutral-200/80 flex flex-col justify-between">
                
                <div>
                  {/* Status Bar */}
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-900 px-2 mb-3">
                    <span>09:45</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-end gap-0.5 h-2.5">
                        <span className="w-0.5 h-1 bg-neutral-900 rounded-xs"></span>
                        <span className="w-0.5 h-1.5 bg-neutral-900 rounded-xs"></span>
                        <span className="w-0.5 h-2 bg-neutral-900 rounded-xs"></span>
                        <span className="w-0.5 h-2.5 bg-neutral-900 rounded-xs"></span>
                      </div>
                      <div className="w-5 h-2.5 rounded-sm border border-neutral-900 p-0.5 flex items-center">
                        <div className="h-full w-4 bg-neutral-900 rounded-xs"></div>
                      </div>
                    </div>
                  </div>

                  {/* Header: < AI Assistant */}
                  <div className="flex items-center gap-2 pb-3 border-b border-neutral-200/80 mb-3 px-1">
                    <ChevronLeft className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs font-bold text-neutral-900">AI Assistant</span>
                  </div>

                  {/* Chat Stream matching Image 3 */}
                  <div className="space-y-3 px-1 text-xs">
                    
                    {/* Message 1: Assistant */}
                    <div className="max-w-[85%] bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-sm p-3 border border-neutral-200/60">
                      <p className="font-medium mb-1 text-[11px] leading-relaxed">
                        I&apos;m your AI task assistant, ask anything.
                      </p>
                      <ul className="text-[10px] text-neutral-600 space-y-0.5 pl-1">
                        <li>• Create tasks from natural language</li>
                        <li>• Analyze your productivity</li>
                      </ul>
                    </div>

                    {/* Message 2: User */}
                    <div className="ml-auto max-w-[85%] bg-[#e0f2fe] text-[#0369a1] rounded-2xl rounded-tr-sm p-3 font-medium text-[11px] leading-relaxed border border-sky-200/80">
                      Tomorrow&apos;s meeting has been postponed 1 hour, adjust remaining tasks accordingly.
                    </div>

                    {/* Message 3: Assistant with Approve button */}
                    <div className="max-w-[85%] bg-neutral-100 text-neutral-800 rounded-2xl rounded-tl-sm p-3 border border-neutral-200/60">
                      <p className="font-medium mb-1.5 text-[11px] leading-relaxed">
                        Okay, Adjusting these tasks by 1 hour:
                      </p>
                      <ul className="text-[10px] text-neutral-600 space-y-0.5 pl-1 mb-2.5">
                        <li>• Campaign Launch Meeting</li>
                        <li>• Design Assets Handover</li>
                      </ul>
                      <button
                        onClick={() => setApproved(true)}
                        className={`px-4 py-1.5 rounded-full font-bold text-[10px] text-white transition-all cursor-pointer border-0 ${
                          approved
                            ? 'bg-emerald-500'
                            : 'bg-[#305dde] hover:bg-[#254cc4] active:scale-95'
                        }`}
                      >
                        {approved ? (
                          <span className="flex items-center gap-1">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        ) : (
                          'Approve'
                        )}
                      </button>
                    </div>

                    {/* Additional user inputs */}
                    {extraMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-2xl p-2.5 text-[11px] border ${
                          msg.sender === 'user'
                            ? 'ml-auto bg-[#e0f2fe] text-[#0369a1] rounded-tr-sm font-medium border-sky-200/80'
                            : 'bg-neutral-100 text-neutral-800 rounded-tl-sm border-neutral-200/60'
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}

                  </div>
                </div>

                {/* Bottom Input & Realistic iOS Keyboard */}
                <div className="mt-3 pt-2 border-t border-neutral-200/80">
                  
                  {/* Input field with blue circular arrow */}
                  <form onSubmit={handleSend} className="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5 mb-2.5 border border-neutral-300/70">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Add task: Buy groceries tomorrow"
                      className="flex-1 bg-transparent text-[11px] text-neutral-800 placeholder-neutral-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full bg-[#305dde] hover:bg-[#254cc4] text-white flex items-center justify-center shrink-0 cursor-pointer border-0"
                    >
                      <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </form>

                  {/* iOS Keyboard representation */}
                  <div className="bg-[#e4e7ec] rounded-2xl p-1.5 space-y-1 text-[9px] font-semibold text-neutral-800 select-none border border-neutral-300/80">
                    {/* Row 1 */}
                    <div className="flex justify-between gap-0.5">
                      {['Q','W','E','R','T','Y','U','I','O','P'].map((k) => (
                        <div key={k} className="flex-1 py-1.5 bg-white rounded-md text-center border border-neutral-200/60">
                          {k}
                        </div>
                      ))}
                    </div>
                    {/* Row 2 */}
                    <div className="flex justify-between gap-0.5 px-2">
                      {['A','S','D','F','G','H','J','K','L'].map((k) => (
                        <div key={k} className="flex-1 py-1.5 bg-white rounded-md text-center border border-neutral-200/60">
                          {k}
                        </div>
                      ))}
                    </div>
                    {/* Row 3 */}
                    <div className="flex justify-between gap-0.5">
                      <div className="w-6 py-1.5 bg-neutral-300 rounded-md text-center text-[8px] flex items-center justify-center">
                        ⇧
                      </div>
                      {['Z','X','C','V','B','N','M'].map((k) => (
                        <div key={k} className="flex-1 py-1.5 bg-white rounded-md text-center border border-neutral-200/60">
                          {k}
                        </div>
                      ))}
                      <div className="w-6 py-1.5 bg-neutral-300 rounded-md text-center text-[8px] flex items-center justify-center">
                        ⌫
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </motion.div>

          {/* Right Column: 4 Feature Cards */}
          <div className="lg:col-span-4 space-y-3.5 sm:space-y-4 order-3">
            {rightFeatures.map((feat, index) => {
              const Icon = feat.icon;
              const isSelected = activeFeature === feat.id;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setActiveFeature(feat.id)}
                  style={navGlassStyle}
                  className={`p-4 sm:p-5 border-0 cursor-pointer text-left transition-all ${
                    isSelected
                      ? 'opacity-100 ring-2 ring-[rgb(20,20,20)]/15 shadow-sm'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[rgb(20,20,20)] mb-2.5 shadow-xs">
                    <Icon className="w-4 h-4 text-[#305dde]" />
                  </div>
                  <h3 className="text-sm sm:text-[15px] font-bold text-neutral-900 mb-1 tracking-tight leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}
