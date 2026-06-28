import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistPixelSquare = GeistPixelSquare;

export const metadata: Metadata = {
  title: {
    default: 'Drawgle — AI Mobile UI Design Tool',
    template: '%s | Drawgle',
  },
  description:
    'Design premium mobile app interfaces, then export agent-ready HTML, design tokens, and implementation context for your coding workflow.',
  keywords: [
    'AI mobile UI design',
    'app UI generator',
    'image to UI',
    'mobile app design',
    'agent-ready UI handoff',
    'HTML Tailwind export',
  ],
  metadataBase: new URL('https://drawgle.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Drawgle — AI Mobile UI Design Tool',
    description: 'Design premium mobile app interfaces, then export agent-ready HTML, design tokens, and implementation context for your coding workflow.',
    url: 'https://drawgle.com',
    siteName: 'Drawgle',
    images: [
      {
        url: '/bg-image.webp',
        width: 1200,
        height: 630,
        alt: 'Drawgle — AI Mobile UI Design Tool',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drawgle — AI Mobile UI Design Tool',
    description: 'Design premium mobile app interfaces, then export agent-ready HTML, design tokens, and implementation context for your coding workflow.',
    images: ['/bg-image.webp'],
    creator: '@9to5_Dad',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Drawgle",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "All",
  "description": "Design premium mobile app interfaces, then export agent-ready HTML, design tokens, and implementation context for your coding workflow.",
  "offers": {
    "@type": "Offer",
    "price": "9.99",
    "priceCurrency": "USD"
  }
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistPixelSquare.variable)}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
