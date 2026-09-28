'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200/80 py-12 sm:py-16 text-neutral-600 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#305dde] flex items-center justify-center text-white">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.5c-3.8 0-7 3.2-7 7.2 0 4.8 7 11.8 7 11.8s7-7 7-11.8c0-4-3.2-7.2-7-7.2z" />
                  <circle cx="12" cy="10" r="2.8" fill="white" fillOpacity="0.4" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight text-neutral-900">
                Drawgle
              </span>
            </div>
            <p className="text-xs text-neutral-500 max-w-xs leading-relaxed mb-4">
              AI Mobile App UI Designer turning prompts into premium mobile interfaces, agent-ready code, and design tokens.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Links Column 1: Product */}
          <div>
            <h4 className="font-bold text-neutral-900 text-xs tracking-tight mb-3">
              Product
            </h4>
            <ul className="space-y-2">
              <li><a href="#benefits" className="hover:text-neutral-900 transition-colors">Key Benefits</a></li>
              <li><a href="#features" className="hover:text-neutral-900 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-neutral-900 transition-colors">Pricing</a></li>
              <li><a href="#reviews" className="hover:text-neutral-900 transition-colors">Reviews</a></li>
              <li><a href="#faqs" className="hover:text-neutral-900 transition-colors">FAQs</a></li>
            </ul>
          </div>

          {/* Links Column 2: Platform */}
          <div>
            <h4 className="font-bold text-neutral-900 text-xs tracking-tight mb-3">
              Platform
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-neutral-900 transition-colors">iOS App</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">macOS App</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">watchOS Widget</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Android Play Store</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Web Companion</a></li>
            </ul>
          </div>

          {/* Links Column 3: Legal & Trust */}
          <div>
            <h4 className="font-bold text-neutral-900 text-xs tracking-tight mb-3">
              Legal & Privacy
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Security Architecture</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Data Encryption</a></li>
              <li><a href="#" className="hover:text-neutral-900 transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright and attribution */}
        <div className="pt-8 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
          <p>© {new Date().getFullYear()} AppDrop Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-neutral-600 transition-colors cursor-pointer">English (US)</span>
            <span>·</span>
            <span className="hover:text-neutral-600 transition-colors cursor-pointer">Status</span>
            <span>·</span>
            <span className="hover:text-neutral-600 transition-colors cursor-pointer">Security</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
