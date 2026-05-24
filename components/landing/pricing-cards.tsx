"use client"

import { Shield } from "lucide-react"
import Image from "next/image"



export default function PricingCards() {
 

  const LightCheckIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="8" fill="#111827" />
      <path d="M5.5 8.5L7 10L11 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  const DarkCheckIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="7.5" stroke="#4B5563" />
      <path d="M5.5 8.5L7 10L11 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  // Actual Starter plan features
  const starterFeatures = [
    "20 AI-generated photos",
    "1 model training included",
    "20 unique styles & backgrounds",
    "20 different outfits",
    "Full commercial license",
    "30 credits included"
  ]

  // Actual Pro plan features - positioning 1 model + 80 photos as main offer
  const proFeatures = [
    "80 AI-generated photos",
    "1 model training included",
    "80 unique styles & backgrounds",
    "80 different outfits",
    "Priority processing",
    "Premium customer support",
    "60 credits included"
  ]

  return (
    <section className="relative mx-auto py-16 sm:py-24 overflow-hidden bg-[#F7F5F3] px-4">
      {/* Heading Section */}
      <div className="w-full max-w-[820px] mx-auto">
        <div className="text-center mb-12">
          
           <h2 className="text-4xl sm:text-6xl max-w-4xl mx-auto font-bold leading-[1.1] mb-4 font-[var(--font-inter-tight)]">
            A professional photoshoot <br />
            <span className="text-[#ff6f00]">for a fraction of the cost.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-tight mb-4 ">
            Get a complete portfolio of stunning, high-quality images without the time, hassle, and expense of a traditional studio.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Starter Plan - Light Card */}
      <div className="bg-[#F7F5F3] rounded-3xl p-2 shadow-[0_12px_50px_-15px_rgba(0,0,0,0.1)] border border-gray-200/60 flex flex-col">
        <div className="bg-white rounded-2xl p-8 mb-2">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-3xl font-bold text-gray-900 tracking-tight">Starter</h3>
            <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Popular</span>
          </div>
          <p className="text-gray-600 text-base leading-relaxed mb-8">
            Perfect for upgrading your digital identity. Get 20 professional AI photos with unlimited styles, backgrounds, and outfits.
          </p>
          <div className="flex items-baseline mb-8">
            <span className="text-5xl font-bold text-gray-900 tracking-tighter">$9.99</span>
            <span className="text-gray-500 text-lg ml-1">one-time</span>
          </div>
          <button className="w-full group relative bg-[#ff6f00] hover:bg-[#ff6f00]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12 py-4 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)]">
            Start Your Photoshoot
            <div className="bg-white rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
              <img
                src="/arrow.svg"
                alt="arrow-right"
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
              />
            </div>
          </button>
        </div>
        <div className="bg-[#F7F5F3] px-6 pb-6 pt-4 flex-grow flex flex-col">
          <div className="grid grid-cols-1 gap-y-3 mb-auto">
            {starterFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <LightCheckIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-gray-700 text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Generates:</span>
              <span className="font-semibold text-gray-900">20 unique photos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pro Plan - Dark Card */}
      <div className="bg-gray-900 rounded-3xl p-2 shadow-[0_12px_50px_-15px_rgba(0,0,0,0.25)] border border-gray-700 flex flex-col">
        <div className="bg-gray-800 rounded-2xl p-8 mb-2">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-3xl font-bold text-white tracking-tight">Pro</h3>
            <span className="bg-[#ff6f00] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Best Value</span>
          </div>
          <p className="text-gray-300 text-base leading-relaxed mb-8">
            Get 80 professional AI photos with 1 model training. Perfect for maximum variety and creative control over your online presence.
          </p>
          <div className="flex items-baseline mb-8">
            <span className="text-5xl font-bold text-white tracking-tighter">$17.99</span>
            <span className="text-gray-400 text-lg ml-1">one-time</span>
          </div>
          <button className="w-full group relative bg-white hover:bg-white/90 text-black rounded-md overflow-hidden cursor-pointer pr-12 py-4 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)]">
            Get The Pro Photoshoot
            <div className="bg-[#ff6f00] rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
              <img
                src="/arrow.svg"
                alt="arrow-right"
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 filter invert"
              />
            </div>
          </button>
        </div>
        <div className="bg-gray-900 flex-grow flex flex-col px-6 pb-6 pt-4">
          <div className="grid grid-cols-1 gap-y-3 mb-auto">
            {proFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <DarkCheckIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-gray-300 text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Generates:</span>
              <span className="font-semibold text-white">80 unique photos</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-400">Best Value:</span>
              <span className="font-semibold text-[#ff6f00]"> 4x photos for 2x price</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p className="text-center  text-gray-600 text-base leading-relaxed mt-8"><Shield className="w-4 h-4 text-[#ff6f00] inline-block mr-1" />
     Payments are processed securly with 
     <Image src="/dodo-logo.png" alt="dodopayments" width={96} height={96} className="inline-block ml-1 bg-black" />
    </p>
  </div>
  </section>
  )
}
