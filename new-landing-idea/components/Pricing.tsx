'use client';

import React from 'react';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';

interface PricingProps {
  onOpenDownload: () => void;
}

export function Pricing({ onOpenDownload }: PricingProps) {
  // Brand glass styling matching navbar, hero, and how-it-works cards
  const navGlassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '30px',
  };

  const plans = [
    {
      name: 'Starter',
      badge: 'Good for trying out',
      description: 'For founders and developers validating an app concept or designing a smaller mobile screen set.',
      price: 9,
      popular: false,
      cta: 'Start Building Now',
      features: [
        '600 AI credits per month',
        'Generate ~30 full screens',
        '20 credits per new parent screen',
        'Screenshot reconstruction and style references',
        'Tailwind HTML and Agent Pack exports',
        'Commercial use permitted under the Terms',
      ],
      capacity: '~30 full screens/mo',
    },
    {
      name: 'Pro',
      badge: 'Best value',
      description: 'Higher monthly capacity for active builders producing larger mobile UI projects.',
      price: 29,
      popular: true,
      cta: 'Choose Pro Plan',
      features: [
        '2,400 AI credits per month',
        'Generate ~120 full screens',
        'All editor and export features',
        'Shared design tokens and navigation',
        'Selected element and region edits',
        'Commercial use permitted under the Terms',
      ],
      capacity: '~120 full screens/mo',
    },
    {
      name: 'Studio',
      badge: 'High capacity',
      description: 'High monthly generation capacity for agencies, studios, and builders managing larger mobile UI workloads.',
      price: 79,
      popular: false,
      cta: 'Choose Studio Plan',
      features: [
        '8,000 AI credits per month',
        'Generate ~400 full screens',
        'High-volume multi-screen planning',
        'Shared design tokens and navigation',
        'Tailwind HTML and Agent Pack exports',
        'Commercial use permitted under the Terms',
      ],
      capacity: '~400 full screens/mo',
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-neutral-400 tracking-wide uppercase mb-3 block">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-400">
            Unthrottled creative power. <span className="text-neutral-900 font-bold">Zero feature gates.</span>
          </h2>
          <p className="text-sm sm:text-base text-neutral-500 max-w-2xl mx-auto mt-3 leading-relaxed">
            Every plan includes prompt-to-UI, screenshot reconstruction, design-token editing, Tailwind HTML, and Agent Pack exports. Plans differ by monthly credit capacity.
          </p>
        </motion.div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={navGlassStyle}
              className="border-0 p-6 sm:p-8 flex flex-col justify-between relative text-neutral-900"
            >
              {/* Most Popular / Best Value Top Pill */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[rgb(20,20,20)] text-white text-[11px] font-semibold px-3.5 py-1 rounded-full flex items-center gap-1.5 border-0 shadow-sm">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>Best Value</span>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold tracking-tight text-[rgb(20,20,20)]">
                    {plan.name}
                  </h3>
                  {plan.badge && !plan.popular && (
                    <span className="text-[10px] font-semibold bg-black/[0.05] text-neutral-600 px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed mb-6 text-neutral-500 min-h-[36px]">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[rgb(20,20,20)]">
                    ${plan.price}
                  </span>
                  <span className="text-xs font-medium text-neutral-500">
                    / month
                  </span>
                </div>

                {/* Primary or Secondary Button matching the site */}
                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  size="default"
                  onClick={onOpenDownload}
                  className="w-full mb-8"
                >
                  {plan.cta}
                </Button>

                {/* Features List */}
                <div className="space-y-3 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider block text-neutral-500">
                    What&apos;s included
                  </span>
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-[rgb(20,20,20)]" />
                      <span className="text-neutral-700 leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer with capacity */}
              <div className="mt-8 pt-4 border-t border-black/[0.05] flex items-center justify-between text-[11px] text-neutral-500">
                <span>Generates:</span>
                <span className="font-bold text-[rgb(20,20,20)] font-mono">
                  {plan.capacity}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Payment Security Badge */}
        <div className="mt-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-neutral-400" />
          <span>Payments are processed securely with Dodo Payments</span>
        </div>

      </div>
    </section>
  );
}
