'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';

export function Reviews() {
  const navGlassStyle: React.CSSProperties = {
    backdropFilter: 'blur(48px)',
    WebkitBackdropFilter: 'blur(48px)',
    backgroundColor: 'rgba(237, 237, 237, 0.64)',
    borderRadius: '30px',
  };

  const reviews = [
    {
      name: 'Alex Rivera',
      role: 'Staff Mobile Engineer',
      company: 'Veloce Labs',
      metric: 'Shipped app 4x faster',
      content: 'Drawgle turned our 3-sentence product prompt into a complete, gorgeous SwiftUI mobile app with tokens. We dropped the agent-ready files straight into Xcode with zero refactoring.',
      rating: 5,
      avatarColor: 'from-amber-200 to-orange-400',
    },
    {
      name: 'Elena Rostova',
      role: 'Lead Product Designer',
      company: 'Studio Kanso',
      metric: 'Saved 18 hrs / project',
      content: 'The mobile UI quality is shockingly high. Rather than generic templates, Drawgle creates customized layouts, typography hierarchies, and component tokens that respect native platform guidelines.',
      rating: 5,
      avatarColor: 'from-rose-200 to-pink-400',
    },
    {
      name: 'Marcus Chen',
      role: 'Founder & iOS Dev',
      company: 'Pulse Mobile',
      metric: '100% Agent-Ready',
      content: 'Using Drawgle with Cursor is pure magic. I prompt Drawgle for the screen, copy the generated SwiftUI and design tokens, and let my coding agent hook up the backend state in minutes.',
      rating: 5,
      avatarColor: 'from-sky-200 to-blue-400',
    },
  ];

  return (
    <section id="reviews" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-neutral-400 tracking-wide uppercase mb-3 block">
            Reviews
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-400">
            Loved by <span className="text-neutral-900 font-bold">500,000+ productive minds</span>
          </h2>
          <p className="text-sm sm:text-base text-neutral-500 max-w-xl mx-auto mt-3">
            From solo founders to busy executive teams, see how Appdrop transforms daily chaos into focus.
          </p>
        </motion.div>

        {/* Testimonials Grid - No shadows, crisp borders with staggered scroll micro-motion */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {reviews.map((rev, index) => (
            <motion.div
              key={rev.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={navGlassStyle}
              className="border-0 p-6 sm:p-7 flex flex-col justify-between"
            >
              <div>
                {/* Rating Stars & Metric */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 stroke-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[rgb(20,20,20)] bg-white/70 px-2.5 py-0.5 rounded-full border-0">
                    {rev.metric}
                  </span>
                </div>

                {/* Quote content */}
                <p className="text-sm text-neutral-700 leading-relaxed mb-6 font-normal">
                  &ldquo;{rev.content}&rdquo;
                </p>
              </div>

              {/* Author Info */}
              <div className="flex items-center gap-3 pt-4 border-t border-black/[0.04]">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${rev.avatarColor} border-2 border-white flex items-center justify-center font-bold text-neutral-800 text-xs`}>
                  {rev.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                    {rev.name}
                  </h4>
                  <p className="text-xs text-neutral-500">
                    {rev.role} · {rev.company}
                  </p>
                </div>
              </div>

            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
