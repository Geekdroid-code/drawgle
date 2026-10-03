"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, GitFork, Loader2 } from "lucide-react";

import { marketingFontVariables } from "@/components/marketing/fonts";
import { track } from "@/lib/analytics";
import { getTemplateSlug, showcaseCollections } from "@/lib/showcase";
import { cn } from "@/lib/utils";

export function TemplateStarter({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const collection = showcaseCollections.find((item) => getTemplateSlug(item) === slug);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const storageKey = `drawgle:template-start:${slug}`;
    const idempotencyKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, idempotencyKey);

    void fetch(`/api/templates/${encodeURIComponent(slug)}/instantiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.projectId) throw new Error(payload.error || "Unable to start from this design.");
        track("template_started", { template: slug });
        router.replace(`/project/${payload.projectId}`);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to start from this design."));
  }, [router, slug]);

  return (
    <main className={cn(marketingFontVariables, "font-marketing flex min-h-[calc(100svh-3.5rem)] flex-col bg-[var(--dg-bg)] px-5 py-8 text-[var(--dg-text)] sm:px-8 sm:py-10")}>
      <div className="mx-auto w-full max-w-[560px]">
        <Link
          href="/showcase"
          className="inline-flex items-center gap-2 rounded-full px-1 py-2 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#305dde] dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to showcase
        </Link>
      </div>

      <section aria-labelledby="template-start-title" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-10 sm:py-14">
        <div className="mb-7 text-center sm:mb-9">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#305dde]/15 bg-[#305dde]/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#305dde] dark:border-[#8caaff]/20 dark:bg-[#8caaff]/[0.08] dark:text-[#a3bbff]">
            <GitFork className="size-3.5" aria-hidden="true" />
            Your own starting point
          </span>
          <h1 id="template-start-title" className="text-balance text-[30px] font-medium leading-[1.12] tracking-[-0.045em] text-neutral-900 dark:text-neutral-100 sm:text-[38px]">
            {error ? "We couldn’t create your copy." : <>Preparing <span className="text-[#305dde] dark:text-[#a3bbff]">{title}.</span></>}
          </h1>
          <p className="mx-auto mt-3 max-w-[360px] text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {error ? "Your source design is still here. You can try again whenever you’re ready." : "A considered design, ready to make your own."}
          </p>
        </div>

        <div className="rounded-[30px] border border-black/[0.08] bg-white p-1.5 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.22)] dark:border-white/[0.1] dark:bg-[#222326] dark:shadow-none">
          <div className="relative flex h-[250px] items-center justify-center gap-3 overflow-hidden rounded-[24px] border border-black/[0.04] bg-[#f5f5f5] px-5 sm:h-[300px] sm:gap-4 dark:border-white/[0.04] dark:bg-[#191a1d]">
            {collection ? (
              collection.screens.slice(0, 3).map((screen, index) => (
                <div
                  key={screen.id}
                  className={cn(
                    "relative w-[28%] max-w-[100px] shrink-0 overflow-hidden rounded-[18px] bg-white p-[3px] shadow-[0_14px_30px_-20px_rgba(15,23,42,0.28)] ring-1 ring-black/[0.09] sm:w-[120px] sm:max-w-none sm:rounded-[22px] dark:bg-[#333438] dark:ring-white/[0.12]",
                    index === 0 && "-rotate-[6deg] translate-y-4",
                    index === 1 && "z-10 -translate-y-2",
                    index === 2 && "rotate-[6deg] translate-y-4",
                  )}
                >
                  <div className="relative aspect-[390/844] overflow-hidden rounded-[15px] sm:rounded-[19px]">
                    <Image src={screen.screenshot} alt={`${title}: ${screen.label}`} fill sizes="(min-width: 640px) 120px, 100px" className="object-cover object-top" />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex size-20 items-center justify-center rounded-[26px] border border-[#305dde]/10 bg-white text-[#305dde] shadow-sm dark:border-white/10 dark:bg-[#24262b] dark:text-[#a3bbff]">
                <GitFork className="size-7" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-neutral-800 dark:text-neutral-100">{title}</p>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                {collection ? `${collection.screens.length} editable screens · Original showcase design` : "Your editable showcase design"}
              </p>
            </div>
            {collection ? (
              <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                {collection.palette.slice(0, 4).map((color) => (
                  <span key={color} className="size-4 rounded-full border border-black/[0.1] ring-2 ring-white dark:ring-[#222326]" style={{ backgroundColor: color }} />
                ))}
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-6 text-center">
            <p role="alert" className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-[13px] leading-relaxed text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.08] dark:text-rose-200">{error}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#305dde] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#264dc1] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#305dde]">
                Try again
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
              <Link href="/project/new" className="inline-flex h-10 items-center rounded-full px-4 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#305dde] dark:text-neutral-400 dark:hover:text-white">Start a new idea</Link>
            </div>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="mt-6 text-center">
            <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-200">
              <Loader2 className="size-3.5 animate-spin text-[#305dde] motion-reduce:animate-none dark:text-[#a3bbff]" aria-hidden="true" />
              Creating your editable copy
            </p>
            <p className="mt-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">No generation credits are used.</p>
          </div>
        )}
      </section>
    </main>
  );
}
