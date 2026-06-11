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
  const [screenDocument, setScreenDocument] = useState<string | null>(null);

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
    if (!nearViewport || screenDocument) return;

    const controller = new AbortController();
    void fetch(screen.src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load showcase screen: ${screen.src}`);
        return response.text();
      })
      .then((html) => {
        const showcaseStyle = `
          <base href="/">
          <style data-drawgle-showcase-scrollbars>
            html, body, * {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            html::-webkit-scrollbar,
            body::-webkit-scrollbar,
            *::-webkit-scrollbar {
              width: 0 !important;
              height: 0 !important;
              display: none !important;
            }
          </style>
        `;
        setScreenDocument(
          html.includes("</head>")
            ? html.replace("</head>", `${showcaseStyle}</head>`)
            : `${showcaseStyle}${html}`,
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });

    return () => controller.abort();
  }, [nearViewport, screen.src, screenDocument]);

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
        className="relative aspect-[390/844] w-full overflow-hidden rounded-[clamp(10px,1.4vw,18px)] border border-black/[0.12] bg-[#ececea] shadow-[0_18px_42px_-36px_rgba(0,0,0,0.6)]"
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

        {nearViewport && screenDocument && scale > 0 && (
          <iframe
            srcDoc={screenDocument}
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
      <div className="mt-2 text-center">
        <div className="truncate text-[10px] font-semibold tracking-tight text-black sm:text-xs">{screen.label}</div>
        <div className="mt-0.5 hidden truncate text-[10px] text-black/40 sm:block">{screen.role}</div>
      </div>
    </article>
  );
}
