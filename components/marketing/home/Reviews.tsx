import Image from "next/image";
import { Star } from "lucide-react";

import { Reveal, SectionHeader } from "@/components/marketing/Reveal";
import { testimonials } from "@/lib/marketing/home-content";

export function Reviews() {
  return (
    <section id="reviews" className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          kicker="Reviews"
          lead="Loved by builders"
          emphasis="who care how it feels."
          description="Founders, designers, and developers use Drawgle to move faster without giving up control of the system behind their interface."
        />

        <div className="columns-1 gap-6 sm:gap-8 md:columns-2 lg:columns-3 [&>*]:mb-6 sm:[&>*]:mb-8">
          {testimonials.map((review, index) => (
            <Reveal key={review.name} delay={(index % 3) * 0.12} y={30} className="break-inside-avoid">
              <figure className="mk-surface flex flex-col justify-between rounded-[30px] p-6 sm:p-7">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex text-amber-400" aria-label="Five stars">
                      {Array.from({ length: 5 }, (_, star) => (
                        <Star key={star} className="size-4 fill-amber-400 stroke-amber-400" />
                      ))}
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-mk-ink">{review.signal}</span>
                  </div>
                  <blockquote className="mb-6 text-sm font-normal leading-relaxed text-neutral-700">&ldquo;{review.quote}&rdquo;</blockquote>
                </div>
                <figcaption className="flex items-center gap-3 border-t border-black/[0.04] pt-4">
                  <Image
                    src={review.avatar}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full border-2 border-white object-cover"
                  />
                  <div>
                    <p className="text-sm font-bold leading-tight text-neutral-900">{review.name}</p>
                    <p className="text-xs text-neutral-500">{review.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
