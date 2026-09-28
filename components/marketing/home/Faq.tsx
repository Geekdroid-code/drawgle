"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";
import { EASE } from "@/components/marketing/motion/hooks";
import type { FaqEntry } from "@/lib/marketing/home-content";
import { siteConfig } from "@/lib/seo/config";
import { cn } from "@/lib/utils";

type Group =
  | { type: "open"; item: FaqEntry; index: number }
  | { type: "closed"; items: { item: FaqEntry; index: number }[] };

/** Closed questions share one card; the open question lifts into its own card. */
function groupFaqs(items: FaqEntry[], openIndex: number | null) {
  const groups: Group[] = [];
  let closed: { item: FaqEntry; index: number }[] = [];

  items.forEach((item, index) => {
    if (index === openIndex) {
      if (closed.length) groups.push({ type: "closed", items: closed });
      closed = [];
      groups.push({ type: "open", item, index });
    } else {
      closed.push({ item, index });
    }
  });

  if (closed.length) groups.push({ type: "closed", items: closed });
  return groups;
}

function Question({ item, index, open, onToggle }: { item: FaqEntry; index: number; open: boolean; onToggle: (index: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(index)}
      aria-expanded={open}
      aria-controls={`faq-answer-${index}`}
      className={cn(
        "group flex w-full select-none items-center justify-between px-6 text-left sm:px-7",
        open ? "py-4 sm:py-4.5" : "py-3.5 transition-opacity hover:opacity-75 sm:py-4",
      )}
    >
      <span className="text-base font-medium tracking-tight text-mk-ink sm:text-[17px]">{item.question}</span>
      <span className="ml-4 flex size-4 shrink-0 items-center justify-center">
        <ChevronDown
          className={cn("size-4 text-neutral-500 transition-transform duration-300 ease-mk", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </span>
    </button>
  );
}

export function Faq({
  items,
  kicker = "Frequently Asked Questions",
  lead = "Everything you need",
  emphasis = "to know",
  id = "faqs",
}: {
  items: FaqEntry[];
  kicker?: string;
  lead?: string;
  emphasis?: string;
  id?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const groups = groupFaqs(items, openIndex);
  const toggle = (index: number) => setOpenIndex((current) => (current === index ? null : index));

  return (
    <section id={id} className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="mb-14 text-center">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-neutral-400 sm:text-sm">{kicker}</span>
          <h2 className="text-3xl font-medium tracking-tight text-mk-body sm:text-4xl md:text-5xl">
            {lead} <span className="font-semibold text-mk-ink">{emphasis}</span>
          </h2>
        </Reveal>

        <div className="mx-auto flex max-w-3xl flex-col gap-3.5 sm:gap-4">
          {groups.map((group, groupIndex) =>
            group.type === "open" ? (
              <div key={`open-${group.index}`} className="mk-surface overflow-hidden rounded-[28px]">
                <Question item={group.item} index={group.index} open onToggle={toggle} />
                <AnimatePresence initial={false}>
                  <motion.div
                    id={`faq-answer-${group.index}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="overflow-hidden px-6 pb-5 sm:px-7 sm:pb-6"
                  >
                    <p className="text-[15px] font-normal leading-relaxed text-neutral-500 sm:text-base">{group.item.answer}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <div key={`closed-${groupIndex}-${group.items[0].index}`} className="mk-surface overflow-hidden rounded-[28px] py-1 sm:py-1.5">
                {group.items.map(({ item, index }) => (
                  <div key={item.question}>
                    <Question item={item} index={index} open={false} onToggle={toggle} />
                    {/* Collapsed answers stay in the document, hidden until opened. */}
                    <div id={`faq-answer-${index}`} hidden>
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            ),
          )}
        </div>

        <Reveal className="mt-10 text-center" y={12}>
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-mk-ink transition-opacity hover:opacity-70"
          >
            Still have a question? Email us
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
