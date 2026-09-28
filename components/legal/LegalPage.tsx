import type { ReactNode } from "react";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";

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
    <MarketingShell>
      <main className="bg-white pt-32 text-mk-ink sm:pt-40">
        <div className="mx-auto max-w-5xl px-5 pb-20 sm:px-8 sm:pb-28">
          <header className="border-b border-black/[0.06] pb-12 sm:pb-16">
            <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 sm:text-sm">{eyebrow}</span>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-mk-heading sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-mk-body sm:text-lg">{description}</p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">Effective June 8, 2026</p>
          </header>

          <div className="grid gap-10 pt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
            <aside className="lg:sticky lg:top-28 lg:h-fit">
              <nav className="mk-surface rounded-[24px] p-4" aria-label={`${title} sections`}>
                <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">On this page</div>
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex gap-3 rounded-2xl px-2 py-2 text-[13px] leading-5 text-neutral-500 transition-colors hover:bg-white hover:text-mk-ink"
                  >
                    <span className="pt-px font-mono text-[10px] text-neutral-400">{String(index + 1).padStart(2, "0")}</span>
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
                  className="scroll-mt-28 border-b border-black/[0.06] py-9 first:pt-0 last:border-b-0"
                >
                  <div className="mb-4 flex items-baseline gap-3">
                    <span className="font-mono text-[11px] tracking-[0.1em] text-mk-accent">{String(index + 1).padStart(2, "0")}</span>
                    <h2 className="text-xl font-semibold tracking-tight text-mk-ink sm:text-2xl">{section.title}</h2>
                  </div>
                  <div className="space-y-4 text-[15px] leading-7 text-mk-body">{section.content}</div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2.5 pl-5 marker:text-mk-accent">{children}</ul>;
}

export function LegalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="font-medium text-mk-accent underline decoration-mk-accent/25 underline-offset-4 hover:decoration-mk-accent" href={href}>
      {children}
    </Link>
  );
}
