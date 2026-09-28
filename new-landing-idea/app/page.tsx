'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Challenge } from '@/components/Challenge';
import { KeyBenefits } from '@/components/KeyBenefits';
import { Features } from '@/components/Features';
import { Reviews } from '@/components/Reviews';
import { Pricing } from '@/components/Pricing';
import { Faq } from '@/components/Faq';
import { CtaBanner } from '@/components/CtaBanner';
import { Footer } from '@/components/Footer';
import { DownloadModal } from '@/components/DownloadModal';

export default function HomePage() {
  const [downloadOpen, setDownloadOpen] = useState(false);

  const handleOpenDownload = () => {
    setDownloadOpen(true);
  };

  const handleCloseDownload = () => {
    setDownloadOpen(false);
  };

  return (
    <main className="min-h-screen bg-white text-[#111827] selection:bg-[#0099ff]/20 selection:text-[#0077b6] relative">
      {/* Floating Pill Top Navbar matching Image 1 */}
      <Navbar onOpenDownload={handleOpenDownload} />

      {/* Hero Section with Social Proof, Headline & Dual Phone Display matching Image 1 */}
      <Hero onOpenDownload={handleOpenDownload} />

      {/* The Challenge Section matching Image 2 Top */}
      <Challenge />

      {/* Key Benefits: Smarter Task Management matching Image 2 Bottom */}
      <KeyBenefits onOpenDownload={handleOpenDownload} />

      {/* Features: Built for human thinking. Automated Intelligently matching Image 3 */}
      <Features onOpenDownload={handleOpenDownload} />

      {/* User Reviews & Social Proof */}
      <Reviews />

      {/* Interactive Pricing */}
      <Pricing onOpenDownload={handleOpenDownload} />

      {/* Frequently Asked Questions */}
      <Faq />

      {/* Call to Action Banner */}
      <CtaBanner onOpenDownload={handleOpenDownload} />

      {/* Minimal iOS Style Footer */}
      <Footer />

      {/* Interactive Download Modal */}
      <DownloadModal
        isOpen={downloadOpen}
        onClose={handleCloseDownload}
      />
    </main>
  );
}
