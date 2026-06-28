"use client"

import { Shield } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

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

  const starterFeatures = [
    "600 AI credits per month",
    "Generate ~30 full screens",
    "Standard build speeds",
    "AI-powered element edits",
    "Agent-ready HTML & design context",
    "Full commercial license"
  ]

  const proFeatures = [
    "2,400 AI credits per month",
    "Generate ~120 full screens",
    "Priority generation speed",
    "Advanced screen layout options",
    "Full commercial license",
    "Premium customer support"
  ]

  const studioFeatures = [
    "8,000 AI credits per month",
    "Generate ~400 full screens",
    "Ultra-priority processing",
    "Agency & team collaboration",
    "Custom design system presets",
    "Dedicated account manager"
  ]

  return (
    <section className="relative mx-auto py-16 sm:py-24 overflow-hidden bg-[#F7F5F3] px-4">
      {/* Heading Section */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-6xl max-w-4xl mx-auto font-bold leading-[1.1] mb-4 font-[var(--font-inter-tight)]">
            Fair pricing. <br />
            <span className="text-[#1b7fcccc]">Start designing for less than a lunch.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-tight mb-4">
            Pick a plan that fits your build speed. No hidden fees, cancel anytime. Whether you are validating a weekend project or building app flows for clients, choose the tier that matches your design volume.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Starter Plan - Light Card */}
          <div className="bg-[#F7F5F3] rounded-3xl p-2 shadow-[0_12px_50px_-15px_rgba(0,0,0,0.1)] border border-gray-200/60 flex flex-col h-full">
            <div className="bg-white rounded-2xl p-8 mb-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-pixel-square text-3xl font-bold text-gray-900 tracking-tight">Starter</h3>
                <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Friction Killer</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed min-h-[60px] mb-6">
                Perfect for upgrading your digital identity, validating concepts, and skeptical developers looking to get started.
              </p>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-bold text-gray-900 tracking-tighter">$9</span>
                <span className="text-gray-500 text-sm font-semibold ml-1">/ month</span>
              </div>
              <Link href="/login" className="block text-center w-full group relative bg-[#1b7fcccc] hover:bg-[#1b7fcccc]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12 py-4 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)] transition-colors">
                Start Building Now
                <div className="bg-white rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
                  <img
                    src="/arrow.svg"
                    alt="arrow-right"
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </div>
              </Link>
            </div>
            <div className="bg-[#F7F5F3] px-6 pb-6 pt-4 flex-grow flex flex-col justify-between">
              <div className="grid grid-cols-1 gap-y-3 mb-6">
                {starterFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <LightCheckIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-700 text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200 mt-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Generates:</span>
                  <span className="font-semibold text-gray-900">~30 full screens/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pro Plan - Dark Card */}
          <div className="bg-gray-900 rounded-3xl p-2 shadow-[0_2px_40px_rgba(27,127,204,0.15)] md:-translate-y-4 border-2 border-[#1b7fcccc] flex flex-col h-full relative z-10">
            <div aria-hidden="true" className="pointer-events-none absolute -inset-[7px] hidden md:block">
              <span className="absolute left-0 top-0 h-2 w-2 border-l border-t border-[#5ba8e2] bg-[#F7F5F3]" />
              <span className="absolute right-0 top-0 h-2 w-2 border-r border-t border-[#5ba8e2] bg-[#F7F5F3]" />
              <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-[#5ba8e2] bg-[#F7F5F3]" />
              <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-[#5ba8e2] bg-[#F7F5F3]" />
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[10px] text-gray-500 shadow-sm">
                recommended.plan
              </span>
              <span className="absolute -top-4 left-1/2 h-3 -translate-x-1/2 border-l border-dashed border-gray-400" />
            </div>
            <div className="bg-gray-800 rounded-2xl p-8 mb-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-pixel-square text-3xl font-bold text-white tracking-tight">Pro</h3>
                <span className="bg-[#1b7fcccc] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">Most Popular</span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed min-h-[60px] mb-6">
                The sweet spot. High volume and priority speed for active app builders, startups, and solo indie hackers.
              </p>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-bold text-white tracking-tighter">$29</span>
                <span className="text-gray-400 text-sm font-semibold ml-1">/ month</span>
              </div>
              <Link href="/login" className="block text-center w-full group relative bg-white hover:bg-white/90 text-black rounded-md overflow-hidden cursor-pointer pr-12 py-4 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)] transition-colors">
                Choose Pro Plan
                <div className="bg-[#1b7fcccc] rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
                  <img
                    src="/arrow.svg"
                    alt="arrow-right"
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 brightness-0 invert"
                  />
                </div>
              </Link>
            </div>
            <div className="flex-grow flex flex-col justify-between px-6 pb-6 pt-4">
              <div className="grid grid-cols-1 gap-y-3 mb-6">
                {proFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <DarkCheckIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-300 text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-700 mt-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Generates:</span>
                  <span className="font-semibold text-white">~120 full screens/mo</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-300">Value Multiplier:</span>
                  <span className="font-semibold text-[#1b7fcccc]">4x screens for 3x price</span>
                </div>
              </div>
            </div>
          </div>

          {/* Studio Plan - Light Card */}
          <div className="bg-[#F7F5F3] rounded-3xl p-2 shadow-[0_12px_50px_-15px_rgba(0,0,0,0.1)] border border-gray-200/60 flex flex-col h-full">
            <div className="bg-white rounded-2xl p-8 mb-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-pixel-square text-3xl font-bold text-gray-900 tracking-tight">Studio</h3>
                <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">For Teams</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed min-h-[60px] mb-6">
                The anchor for product agencies, hyper-active teams, and development studios looking for maximum design output.
              </p>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-bold text-gray-900 tracking-tighter">$79</span>
                <span className="text-gray-500 text-sm font-semibold ml-1">/ month</span>
              </div>
              <Link href="/login" className="block text-center w-full group relative bg-[#1b7fcccc] hover:bg-[#1b7fcccc]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12 py-4 font-semibold text-base shadow-[0_4px_20px_-5px_rgba(0,0,0,0.2)] transition-colors">
                Choose Studio Plan
                <div className="bg-white rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
                  <img
                    src="/arrow.svg"
                    alt="arrow-right"
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </div>
              </Link>
            </div>
            <div className="bg-[#F7F5F3] px-6 pb-6 pt-4 flex-grow flex flex-col justify-between">
              <div className="grid grid-cols-1 gap-y-3 mb-6">
                {studioFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <LightCheckIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-gray-700 text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-200 mt-auto">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Generates:</span>
                  <span className="font-semibold text-gray-900">~400 full screens/mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-center text-gray-600 text-base leading-relaxed mt-12">
          <Shield className="w-4 h-4 text-[#1b7fcccc] inline-block mr-1" />
          Payments are processed securely with 
          <Image src="/dodo-logo.png" alt="dodopayments" width={96} height={96} className="inline-block ml-1 bg-black" />
        </p>
      </div>
    </section>
  )
}
