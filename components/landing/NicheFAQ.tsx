"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
}

interface NicheFAQProps {
  faqItems: FAQItem[]
  title: string
  subtitle: string
}

export default function NicheFAQ({ faqItems, title, subtitle }: NicheFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="px-4 py-24 bg-[#111111]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-6" dangerouslySetInnerHTML={{ __html: title }}></h2>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-tight">
            {subtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4">
            {faqItems.slice(0, Math.ceil(faqItems.length / 2)).map((faq, index) => (
              <div
                key={index}
                className="bg-[#1a1a1a] rounded-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden transition-all duration-200"
              >
                <button
                  className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-[#222222] transition-colors duration-200"
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                >
                  <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                  <div className="flex-shrink-0">
                    {openIndex === index ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                  )}
                >
                  <div className="px-8 pb-6">
                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {faqItems.slice(Math.ceil(faqItems.length / 2)).map((faq, index) => {
              const actualIndex = index + Math.ceil(faqItems.length / 2);
              return (
                <div
                  key={actualIndex}
                  className="bg-[#1a1a1a] rounded-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden transition-all duration-200"
                >
                  <button
                    className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-[#222222] transition-colors duration-200"
                    onClick={() => setOpenIndex(openIndex === actualIndex ? null : actualIndex)}
                  >
                    <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                    <div className="flex-shrink-0">
                      {openIndex === actualIndex ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      openIndex === actualIndex ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                    )}
                  >
                    <div className="px-8 pb-6">
                      <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  )
}