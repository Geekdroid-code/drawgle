"use client";

import { useEffect, useRef, useState } from "react";
import type { ShowcaseScreen } from "@/lib/showcase";

export function VirtualizedScreen({
  collectionName,
  screen,
}: {
  collectionName: string;
  screen: ShowcaseScreen;
}) {
  const observerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setNearViewport(entry.isIntersecting);
        if (!entry.isIntersecting) setLoaded(false);
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const updateScale = () => setScale(preview.clientWidth / 390);
    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={observerRef} className="min-w-0">
      <div
        ref={previewRef}
        className="relative aspect-[390/844] w-full overflow-hidden rounded-[clamp(16px,2vw,30px)] border border-black/[0.12] bg-[#ececea] shadow-[0_24px_60px_-48px_rgba(0,0,0,0.55)]"
      >
        {!loaded && (
          <div className="absolute inset-0 animate-pulse bg-[#eeeeeb] p-[8%]">
            <div className="h-[4%] w-[34%] rounded-full bg-black/[0.08]" />
            <div className="mt-[12%] h-[25%] rounded-[18px] bg-black/[0.06]" />
            <div className="mt-[7%] grid grid-cols-2 gap-[6%]">
              <div className="aspect-square rounded-[16px] bg-black/[0.055]" />
              <div className="aspect-square rounded-[16px] bg-black/[0.055]" />
            </div>
            <div className="mt-[8%] h-[18%] rounded-[18px] bg-black/[0.05]" />
          </div>
        )}

        {nearViewport && scale > 0 && (
          <iframe
            src={screen.src}
            title={`${collectionName} ${screen.label} interactive mobile UI`}
            sandbox="allow-scripts"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`absolute left-0 top-0 h-[844px] w-[390px] origin-top-left border-0 transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ transform: `scale(${scale})` }}
          />
        )}
      </div>
      <div className="mt-3 text-center">
        <div className="text-sm font-semibold tracking-tight text-black">{screen.label}</div>
        <div className="mt-0.5 text-xs text-black/40">{screen.role}</div>
      </div>
    </article>
  );
}
