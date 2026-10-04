import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/marketing/BrandMark";
import { marketingFontVariables } from "@/components/marketing/fonts";
import { cn } from "@/lib/utils";

/** Full-page notice for dead ends: missing pages and crashes. */
export function StatusScreen({
  code,
  title,
  emphasis,
  description,
  reference,
  children,
}: {
  code: string;
  title: string;
  emphasis: string;
  description: ReactNode;
  /** Short crash reference to quote to support. */
  reference?: string | null;
  /** The ways out: buttons and links. */
  children: ReactNode;
}) {
  return (
    <div className={cn("mk-root", marketingFontVariables)}>
      <main className="flex min-h-svh flex-col bg-white px-5 py-6 sm:px-10">
        <header>
          <Link href="/" aria-label="Drawgle home" className="inline-flex">
            <BrandMark />
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{code}</p>
          <h1 className="mt-4 text-[34px] font-medium leading-[1.08] tracking-[-0.03em] text-mk-heading sm:text-[40px]">
            {title} <br />
            <span className="font-semibold text-mk-accent">{emphasis}</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-mk-body">{description}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
          {reference ? (
            <p className="mt-8 font-mono text-[11px] text-neutral-400">Reference {reference}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
