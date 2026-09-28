'use client';

import React from 'react';
import { motion } from 'motion/react';

export function Challenge() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-white text-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Kicker label from Image 2 */}
        <motion.span 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-xs sm:text-sm font-semibold text-neutral-400 tracking-wide uppercase mb-4 block"
        >
          The Challenge
        </motion.span>

        {/* Challenge Statement */}
        <motion.h2 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ letterSpacing: '-0.02em' }}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] leading-[1.3] text-[rgb(69,69,69)] font-normal max-w-3xl mx-auto"
        >
          Translating design ideas into production-ready mobile apps is slow and fragmented.{' '}
          <strong className="text-[rgb(20,20,20)] font-semibold">
            Drawgle turns natural prompts directly into agent-ready mobile code.
          </strong>
        </motion.h2>

      </div>
    </section>
  );
}
