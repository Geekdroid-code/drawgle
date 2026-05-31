"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { XCircle, CheckCircle2, Rocket } from "lucide-react";

export default function MethodComparison() {
  const [method, setMethod] = useState<"generic" | "drawgle">("generic");

  const genericSteps = [
    { label: "GENERATE", text: "Outputs a generic, unpolished draft" },
    { label: "DRIFT", text: "Loses the design theme on the next screen" },
    { label: "MESSY CSS", text: "Spits out messy, inline-styled code" },
    { label: "REJECTION", text: "Developer refuses to use the garbage code" },
    { label: "MANUAL", text: "You end up rewriting it manually anyway", isFinal: true },
  ];

  const drawgleSteps = [
    { label: "TOKENS", text: "AI maps out a strict Design Token system" },
    { label: "POLISH", text: "Generates hyper-polished, premium screens" },
    { label: "SYSTEM", text: "Guarantees 100% consistency across all views" },
    { label: "EXPORT", text: "Exports modular, production-ready React code" },
    { label: "LAUNCH", text: "Ship directly to production in minutes", isFinal: true },
  ];

  const steps = method === "generic" ? genericSteps : drawgleSteps;

  return (
    <section className="py-24 bg-[#F7F5F3] relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 bg-white border border-gray-200 text-gray-600 shadow-sm">
            <Rocket className="w-4 h-4 text-orange-500" />
            Stop fixing AI garbage
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-gray-900 font-[var(--font-inter-tight)] tracking-tight">
            The Drawgle Difference
          </h2>
          
          {/* Toggle */}
          <div className="inline-flex bg-gray-200/60 border border-gray-300/50 p-1.5 rounded-full shadow-inner relative">
             <div 
               className="absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] bg-white rounded-full shadow-sm transition-all duration-300 ease-out z-0"
               style={{ left: method === "generic" ? "0.375rem" : "calc(50% + 0.375rem)" }}
             />
             <button
                onClick={() => setMethod("generic")}
                className={`relative z-10 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-300 w-40 sm:w-48 ${method === "generic" ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
             >
                Generic AI Builders
             </button>
             <button
                onClick={() => setMethod("drawgle")}
                className={`relative z-10 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-300 w-40 sm:w-48 ${method === "drawgle" ? "text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
             >
                The Drawgle Method
             </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center max-w-5xl mx-auto">
          
          {/* Left Column: Timeline */}
          <div className="relative">
             {/* Vertical Line */}
             <div className="absolute left-[1.35rem] top-4 bottom-4 w-px border-l-2 border-dashed border-gray-300" />
             
             <div className="space-y-12 relative z-10">
               <AnimatePresence mode="wait">
                 <motion.div
                   key={method}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.3 }}
                   className="space-y-10"
                 >
                   {steps.map((step, idx) => (
                     <motion.div 
                       key={`${method}-${idx}`}
                       initial={{ opacity: 0, x: -10 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: idx * 0.1, duration: 0.3 }}
                       className="flex items-center gap-6"
                     >
                        <div className="relative shrink-0 flex items-center justify-center bg-[#F7F5F3] py-2">
                           {method === "generic" ? (
                             <XCircle className="w-11 h-11 text-red-500 bg-[#F7F5F3]" strokeWidth={1.5} />
                           ) : (
                             <CheckCircle2 className="w-11 h-11 text-[#1b7fcc] bg-[#F7F5F3]" strokeWidth={1.5} />
                           )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
                          <div className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wider shrink-0 w-32 text-center border ${
                            method === "generic" 
                              ? "bg-red-50 text-red-500 border-red-200" 
                              : "bg-[#1b7fcc]/10 text-[#1b7fcc] border-[#1b7fcc]/20"
                          }`}>
                            {step.label}
                          </div>
                          <span className={`text-base ${step.isFinal ? "text-gray-900 font-bold" : "text-gray-600 font-medium"}`}>
                            {step.text}
                          </span>
                        </div>
                     </motion.div>
                   ))}
                 </motion.div>
               </AnimatePresence>
             </div>
          </div>

          {/* Right Column: Illustration */}
          <div className="flex justify-center items-center h-[400px] relative">
             <AnimatePresence mode="wait">
               {method === "generic" ? (
                  <motion.div
                    key="illustration-generic"
                    initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.9, rotate: 5 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="relative w-64 h-64 bg-red-500 rounded-full flex flex-col items-center justify-center shadow-[0_0_80px_rgba(239,68,68,0.15)] border-4 border-red-400"
                  >
                    {/* Angry Eyes */}
                    <div className="absolute top-[25%] flex gap-6">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
                        <div className="w-4 h-4 bg-red-900 rounded-full absolute top-2 right-2" />
                      </div>
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
                        <div className="w-4 h-4 bg-red-900 rounded-full absolute top-2 left-2" />
                      </div>
                    </div>
                    {/* Angry Eyebrows */}
                    <div className="absolute top-[22%] w-full flex justify-center gap-1 -mt-2">
                      <div className="w-14 h-3.5 bg-red-900 rotate-12 rounded" />
                      <div className="w-14 h-3.5 bg-red-900 -rotate-12 rounded" />
                    </div>
                    {/* Angry Mouth */}
                    <div className="absolute bottom-[35%] w-20 h-10 border-t-[6px] border-red-900 rounded-t-full" />
                    
                    {/* Tech Debt Label */}
                    <div className="absolute -bottom-6 bg-white px-8 py-3 rounded-xl shadow-xl transform -rotate-3 border border-red-100 z-20">
                      <span className="text-red-500 font-black text-2xl tracking-wider">TECH DEBT</span>
                    </div>

                    {/* Surrounding floating bad elements */}
                    <div className="absolute -left-12 -top-12 opacity-40 text-red-400 blur-[1px]">
                       <XCircle className="w-12 h-12" />
                    </div>
                    <div className="absolute -right-16 top-10 opacity-30 text-red-400 blur-[2px]">
                       <div className="text-4xl font-bold">!div</div>
                    </div>
                    <div className="absolute -left-16 bottom-10 opacity-40 text-red-400 blur-[1px]">
                       <div className="text-3xl font-bold">{"{...}"}</div>
                    </div>
                  </motion.div>
               ) : (
                  <motion.div
                    key="illustration-drawgle"
                    initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.9, rotate: -5 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="relative w-64 h-64 bg-[#1b7fcc] rounded-full flex flex-col items-center justify-center shadow-[0_0_80px_rgba(27,127,204,0.15)] border-4 border-[#1b7fcc]/80"
                  >
                    {/* Cool Sunglasses */}
                    <div className="absolute top-[30%] flex gap-2">
                      <div className="w-16 h-12 bg-gray-900 rounded-b-2xl rounded-t-md relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-8 h-12 bg-white/20 skew-x-12 translate-x-4" />
                      </div>
                      <div className="w-16 h-12 bg-gray-900 rounded-b-2xl rounded-t-md relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-8 h-12 bg-white/20 skew-x-12 translate-x-4" />
                      </div>
                      {/* Bridge */}
                      <div className="absolute top-[25%] left-[3.5rem] w-6 h-1.5 bg-gray-900" />
                    </div>
                    {/* Cool Smile */}
                    <div className="absolute bottom-[35%] w-16 h-8 border-b-[5px] border-white rounded-b-full" />
                    
                    {/* Production Ready Label */}
                    <div className="absolute -bottom-6 bg-white px-8 py-3 rounded-xl shadow-xl transform rotate-3 border border-blue-100 z-20">
                      <span className="text-[#1b7fcc] font-black text-2xl tracking-wider">PRODUCTION</span>
                    </div>

                    {/* Surrounding floating good elements */}
                    <div className="absolute -left-12 -top-12 opacity-80 text-blue-400">
                       <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div className="absolute -right-16 top-10 opacity-70 text-blue-400">
                       <div className="text-4xl font-bold">&lt;/&gt;</div>
                    </div>
                    <div className="absolute -left-16 bottom-10 opacity-80 text-blue-400">
                       <Rocket className="w-10 h-10" />
                    </div>
                  </motion.div>
               )}
             </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
