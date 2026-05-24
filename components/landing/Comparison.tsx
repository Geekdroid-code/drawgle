"use client"

import type React from "react"
import { XCircle, CheckCircle } from "lucide-react"

export default function TheVerdictFinal() {

  const traditionalPainPoints = [
    "Weeks of scheduling & waiting",
    "Expensive photographer fees",
    "Awkward, time-consuming poses",
    "Inconsistent lighting & results",
    "Limited shots to choose from",
  ];

  const unrealshotSolutions = [
    "Done-for-you, in minutes.",
    "A fraction of the cost.",
    "From the comfort of your couch.",
    "Perfect, studio-quality lighting.",
    "A portfolio of hundreds of options.",
  ];

  return (
    <section className="relative mx-auto py-16 sm:py-24 overflow-hidden bg-[#F7F5F3]">
      <div className="px-4 max-w-5xl mx-auto">
        {/* Header (Unchanged, as it works well) */}
        <div className="text-center mb-12">
          <h2 className="leading-none text-4xl sm:text-5xl md:text-6xl max-w-4xl mx-auto font-bold mb-4 font-[var(--font-inter-tight)] text-gray-900">
            The Traditional Photoshoot <span className="text-[#ff6f00]">is obsolete.</span>
          </h2>
        
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            See how the Unrealshot process delivers superior results with none of the friction.
          </p>
        </div>

        {/* --- The Definitive Comparison Card with Nested Dashed Borders --- */}
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-2xl shadow-gray-200/60 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
<div className="p-4 sm:p-6">
                <h3 className="text-xl text-center font-bold text-gray-500 mb-6">Traditional Photoshoot</h3>

            {/* --- Left Pane: The Pain (Traditional) --- */}
            <div className="p-4 sm:p-6 border border-dashed border-gray-300 rounded-2xl">
              <ul className="space-y-2">
                {traditionalPainPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-400 mb-1">TOTAL TIME</p>
                <p className="text-3xl font-bold text-gray-500">1-2 Weeks</p>
              </div>
            </div>
</div>
<div className="p-4 sm:p-6 ">
                 <h3 className="text-center text-xl font-bold text-[#ff6f00] mb-6">The Unrealshot Way</h3>

            {/* --- Right Pane: The Cure (Unrealshot) --- */}
            <div className="p-4 sm:p-6 bg-black border border-dashed border-gray-700 rounded-2xl">
               <ul className="space-y-2">
                {unrealshotSolutions.map((solution) => (
                  <li key={solution} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-200">{solution}</span>
                  </li>
                ))}
              </ul>
               <div className="mt-8 pt-6 border-t border-gray-700">
                <p className="text-sm font-medium text-[#ff6f00]/80 mb-1">TOTAL TIME</p>
                <p className="text-3xl font-bold text-white">~20 Minutes</p>
              </div>
            </div>
</div>
          </div>
        </div>
      </div>
    </section>
  );
}