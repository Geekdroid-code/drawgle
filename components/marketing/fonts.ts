import { Inter_Tight } from "next/font/google";
import { GeistMono } from "geist/font/mono";

export const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter-tight",
  display: "swap",
});

/** Font variables every public page needs. Apply once on the page root. */
export const marketingFontVariables = `${interTight.variable} ${GeistMono.variable}`;
