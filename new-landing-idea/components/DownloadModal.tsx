'use client';

import React, { useState } from 'react';
import { X, Apple, Smartphone, Check, Send, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: 'ios' | 'android';
}

export function DownloadModal({ isOpen, onClose, defaultPlatform = 'ios' }: DownloadModalProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android'>(defaultPlatform);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              backdropFilter: 'blur(48px)',
              WebkitBackdropFilter: 'blur(48px)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '30px',
            }}
            className="relative w-full max-w-md border-0 overflow-hidden text-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-black/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[rgb(20,20,20)] flex items-center justify-center border-0 text-white">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.5c-4.97 0-9 4.03-9 9 0 3.32 1.8 6.22 4.47 7.78-.17-.6-.27-1.23-.27-1.88 0-4.08 3.32-7.4 7.4-7.4.65 0 1.28.1 1.88.27C14.92 7.6 13.62 2.5 12 2.5z" opacity="0.6"/>
                    <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5c0-3.04-2.46-5.5-5.5-5.5z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900 tracking-tight">Start with Drawgle</h3>
                  <p className="text-xs text-neutral-500">Instant access to Drawgle Studio & exports</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Platform selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/[0.04] rounded-2xl border-0">
                <button
                  type="button"
                  onClick={() => setPlatform('ios')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs transition-all cursor-pointer border-0 ${
                    platform === 'ios'
                      ? 'bg-white text-neutral-900'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Apple className="w-4 h-4" />
                  <span>Apple iOS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('android')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs transition-all cursor-pointer border-0 ${
                    platform === 'android'
                      ? 'bg-white text-neutral-900'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Google Play</span>
                </button>
              </div>

              {/* QR code card - Zero shadow, zero border */}
              <div 
                style={{
                  backgroundColor: 'rgba(237, 237, 237, 0.64)',
                  backdropFilter: 'blur(48px)',
                  WebkitBackdropFilter: 'blur(48px)',
                }}
                className="flex items-center gap-4 p-4 rounded-2xl border-0"
              >
                <div className="p-2.5 bg-white rounded-xl border-0 shrink-0">
                  <div className="w-20 h-20 bg-white grid grid-cols-7 grid-rows-7 gap-0.5 p-1">
                    <div className="bg-neutral-900 col-span-3 row-span-3 p-1">
                      <div className="w-full h-full bg-white p-1">
                        <div className="w-full h-full bg-neutral-900"></div>
                      </div>
                    </div>
                    <div className="bg-neutral-900 col-span-1 row-span-1"></div>
                    <div className="bg-neutral-900 col-span-3 row-span-3 p-1">
                      <div className="w-full h-full bg-white p-1">
                        <div className="w-full h-full bg-neutral-900"></div>
                      </div>
                    </div>
                    <div className="bg-neutral-900 col-span-1 row-span-1"></div>
                    <div className="bg-neutral-900 col-span-2 row-span-1"></div>
                    <div className="bg-neutral-900 col-span-1 row-span-2"></div>
                    <div className="bg-neutral-900 col-span-3 row-span-3 p-1">
                      <div className="w-full h-full bg-white p-1">
                        <div className="w-full h-full bg-neutral-900"></div>
                      </div>
                    </div>
                    <div className="bg-neutral-900 col-span-2 row-span-1"></div>
                    <div className="bg-neutral-900 col-span-1 row-span-1"></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                    <QrCode className="w-3.5 h-3.5 text-[#0099ff]" />
                    <span>Scan with phone camera</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Point your phone camera to download directly on the {platform === 'ios' ? 'App Store' : 'Play Store'}.
                  </p>
                </div>
              </div>

              {/* Email link form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email) return;
                  setSubmitted(true);
                  setTimeout(() => {
                    setSubmitted(false);
                    setEmail('');
                  }, 4000);
                }} 
                className="space-y-3"
              >
                <label className="block text-xs font-medium text-neutral-700">
                  Or receive download link by email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0099ff]/30 focus:border-[#0099ff] transition-all bg-neutral-50"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submitted}
                    icon={false}
                  >
                    {submitted ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>Sent!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1" />
                        <span>Send</span>
                      </>
                    )}
                  </Button>
                </div>
                {submitted && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    Link sent to {email}! Check your inbox.
                  </p>
                )}
              </form>

              {/* Quick download links */}
              <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-200">
                <span>Free 14-day trial included</span>
                <span className="text-neutral-400">·</span>
                <span>No credit card required</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
