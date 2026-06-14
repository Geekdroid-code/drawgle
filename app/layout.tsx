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
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, geistPixelSquare.variable)}>
      <body>
        {children}
      </body>
    </html>
  );
}
