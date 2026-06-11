"use client"

import type React from "react"
import { XCircle, CheckCircle } from "lucide-react"

export default function TheVerdictFinal() {

  const traditionalPainPoints = [
    "Generic patterns. Recycled taste.",
    "One decent screen. No real system.",
    "Design drift after every edit.",
    "Flows lose polish as they grow.",
    "Hard to confidently present.",
  ];

  const unrealshotSolutions = [
    "Sharper hierarchy, spacing, and polish.",
    "A real design system behind the screens.",
    "Planned flows, not isolated drafts.",
    "Edits without visual drift.",
    "UI you can actually present.",
  ];

  return (
    <section className="relative mx-auto py-16 sm:py-24 overflow-hidden bg-[#F7F5F3]">
      <div className="px-4 max-w-5xl mx-auto">
        {/* Header (Unchanged, as it works well) */}
        <div className="text-center mb-12">
          <h2 className="leading-none text-4xl sm:text-5xl md:text-6xl max-w-4xl mx-auto font-bold mb-4 font-[var(--font-inter-tight)] text-gray-900">
            Most AI builders stop at drafts. <span className="text-[#1b7fcccc]">Drawgle gets you polished UI.</span>
          </h2>
        
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            Not just faster output. Better-looking screens that stay coherent across the whole product.
          </p>
        </div>

        {/* --- The Definitive Comparison Card with Nested Dashed Borders --- */}
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-2xl shadow-gray-200/60 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
<div className="p-4 sm:p-6">
                <h3 className="text-xl text-center font-bold text-gray-500 mb-6">Generic AI Builders</h3>

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
                <p className="text-sm font-medium text-gray-400 mb-1">RESULT</p>
                <p className="text-3xl font-bold text-gray-500">Looks done. Needs work.</p>
              </div>
            </div>
</div>
<div className="p-4 sm:p-6 ">
                 <h3 className="text-center text-xl font-bold text-[#1b7fcccc] mb-6">Drawgle</h3>

            {/* --- Right Pane: The Drawgle workflow --- */}
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
                <p className="text-sm font-medium text-[#1b7fcccc]/80 mb-1">RESULT</p>
                <p className="text-3xl font-bold text-white">Polished UI that holds up.</p>
              </div>
            </div>
</div>
          </div>
        </div>
      </div>
    </section>
  );
}
