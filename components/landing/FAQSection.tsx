"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
    question: "What kind of photos do I need to upload?",
    answer:
      "You should upload clear, front-facing photos with good lighting. Ensure your face is clearly visible and the photo is of high quality.",
  },
  {
    question: "Do I need to wear a suit in the photos I upload?",
    answer:
      "No, you don't necessarily need to wear a suit. Wear what you'd typically wear in daily life.",
  },
  {
    question: "What outfits will my headshots be wearing?",
    answer:
      "Our AI can generate a variety of professional outfits. You can specify preferences or let the AI choose based on common professional attire.",
  },
  {
    question: "What kind of backgrounds will my headshots have?",
    answer: "We offer a range of professional backgrounds, from solid colors to blurred office settings.",
  },
  {
    question: "Do I have full rights to use my AI photoshoots?",
    answer: "Yes, you have full commercial rights to all AI-generated images of yourself.",
  },
  {
    question: "Are my photos private?",
    answer:
      "Yes, we take your privacy seriously. Your uploaded and generated photos are kept private, secure and deleted after certain time period.",
  },
  {
    question: "How does Unrealshot AI photoshoot Generator work?",
    answer:
      "Unrealshot AI uses advanced AI technology to transform your input into high-quality photoshoots in just three simple steps. Simply upload your photo, choose your preferences, and let the AI do the rest!",
  },
  {
    question: "Is my payment information secure?",
    answer: "Absolutely. We use industry-standard encryption to ensure all payment information is secure.",
  },
  {
    question: "Can our company order headshots for multiple employees?",
    answer: "Yes, we offer corporate plans for companies looking to generate headshots for multiple employees.",
  },
  {
    question: "Is Unrealshot AI free to use?",
    answer:
      "Unrealshot AI operates on a credits-based system. You can purchase credits and use them to generate photoshoots based on your needs.",
  },
  {
    question: "How long does it take to generate a photoshoot?",
    answer:
      "Once you submit your request, Unrealshot AI typically trains an ai model and generates your photoshoot within a 20-30 minutes, depending on server load. You will receive an Email once it's ready.",
  },
  {
    question: "What if I'm not satisfied with the results? ",
    answer:
      "If you're not happy with your photoshoot, you can retry with different preferences or contact our support team for assistance.",
  },

  ]

  return (
    <section className="px-4 py-24 bg-[#111111]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          
          <h2 className="text-white text-4xl sm:text-6xl max-w-4xl mx-auto font-bold leading-[1.1] mb-4 font-[var(--font-inter-tight)]">
            Frequently asked <span className="text-[#ff6f00]">photoshoot questions</span> 
          </h2>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-tight">
            Everything you need to know about Unrealshot AI photoshoots.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* First Column */}
          <div className="space-y-4">
            {faqs.slice(0, 6).map((faq, index) => (
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
          
          {/* Second Column */}
          <div className="space-y-4">
            {faqs.slice(6).map((faq, index) => {
              const actualIndex = index + 6;
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