import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { AgentBall } from "@/components/AgentBall";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function LegalPage({
  description,
  eyebrow,
  sections,
  title,
}: {
  description: string;
  eyebrow: string;
  sections: LegalSection[];
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-black">
      <header className="border-b border-black/[0.09] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <AgentBall className="h-6 w-6" />
            Drawgle
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-black/45 transition-colors hover:text-black"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Drawgle
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
        <div className="border-b border-black/[0.1] pb-12 sm:pb-16">
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#1b7fcc]">
            {eyebrow}
          </div>
          <h1 className="mt-4 max-w-4xl font-pixel-square text-[42px] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-black/50 sm:text-base sm:leading-7">
            {description}
          </p>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-black/30">
            Effective June 8, 2026
          </p>
        </div>

        <div className="grid gap-12 pt-12 lg:grid-cols-[230px_minmax(0,720px)] lg:justify-between lg:gap-20">
          <aside className="lg:sticky lg:top-8 lg:h-fit">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/30">
              On this page
            </div>
            <nav className="mt-4 border-l border-black/[0.1]" aria-label={`${title} sections`}>
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex gap-3 border-l border-transparent py-2 pl-4 text-xs leading-5 text-black/45 transition-colors hover:border-[#1b7fcc] hover:text-black"
                >
                  <span className="font-mono text-[8px] text-black/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-8 border-b border-black/[0.09] py-9 first:pt-0 last:border-b-0"
              >
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="font-mono text-[8px] tracking-[0.14em] text-[#1b7fcc]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-xl font-semibold tracking-tight text-black sm:text-2xl">
                    {section.title}
                  </h2>
                </div>
                <div className="legal-copy space-y-4 text-sm leading-7 text-black/58">{section.content}</div>
              </section>
            ))}
          </article>
        </div>
      </div>

      <footer className="border-t border-black/[0.09] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 text-xs text-black/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Drawgle. All rights reserved.</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="hover:text-black">Terms</Link>
            <Link href="/privacy-policy" className="hover:text-black">Privacy</Link>
            <Link href="/refunds-policy" className="hover:text-black">Refunds</Link>
            <a href="mailto:support@drawgle.com" className="flex items-center gap-1.5 hover:text-black">
              Contact
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-5 marker:text-[#1b7fcc]">{children}</ul>;
}

export function LegalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="font-medium text-[#1b7fcc] underline decoration-[#1b7fcc]/25 underline-offset-4" href={href}>
      {children}
    </Link>
  );
}
