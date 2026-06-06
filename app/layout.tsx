import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const geistPixelSquare = GeistPixelSquare;

export const metadata: Metadata = {
  title: 'Drawgle',
  description: 'AI UI generation on a production-grade Supabase and Trigger.dev architecture.',
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
