import type {Metadata} from 'next';
import { Inter_Tight } from 'next/font/google';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Drawgle - Design Premium Mobile UIs at the Speed of Thought',
  description: 'Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.',
  openGraph: {
    title: 'Drawgle - Design Premium Mobile UIs at the Speed of Thought',
    description: 'Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drawgle - Design Premium Mobile UIs at the Speed of Thought',
    description: 'Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`scroll-smooth ${interTight.variable}`}>
      <body className={`${interTight.className} font-sans antialiased bg-white text-[#111827] selection:bg-[#0099ff]/20 selection:text-[#0077b6]`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
