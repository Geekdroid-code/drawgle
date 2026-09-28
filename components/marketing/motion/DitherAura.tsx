"use client";

import { useEffect, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { usePlayback } from "./hooks";

/**
 * A colorful ordered-dither aura around a piece of content.
 * The anchored area stays clean; pixels are densest right at its edge and dissolve outward,
 * so the pattern reads as light coming off the content rather than a separate backdrop.
 * The hue travels slowly around the anchor. Rendered at 1/cell resolution, scaled with
 * `image-rendering: pixelated`.
 */

// 8×8 Bayer matrix, normalized to (0, 1).
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11,
  43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((value) => (value + 0.5) / 64);

// Hue ring, walked clockwise around the anchor.
const RING: [number, number, number][] = [
  [48, 93, 222],
  [124, 92, 246],
  [236, 72, 153],
  [255, 106, 61],
  [255, 176, 32],
  [16, 185, 129],
];

const FRAME_MS = 80;

export function DitherAura({
  anchorRef,
  className,
  cell = 3,
  padding = 8,
  radius = 200,
  reach = 190,
}: {
  /** The content the aura surrounds. Its box (plus padding) stays clean. */
  anchorRef: RefObject<HTMLElement | null>;
  className?: string;
  /** CSS pixels per dither pixel. */
  cell?: number;
  /** Clean margin kept around the anchor, in CSS pixels. */
  padding?: number;
  /** Corner radius of the clean area, in CSS pixels. */
  radius?: number;
  /** How far the aura travels outward, in CSS pixels. */
  reach?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playing, reduced } = usePlayback(wrapperRef, 0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!wrapper || !canvas || !context) return;

    let width = 0;
    let height = 0;
    let image: ImageData | null = null;
    // Anchor box in dither pixels.
    let cx = 0;
    let cy = 0;
    let halfW = 0;
    let halfH = 0;
    let frame = 0;
    let last = 0;
    const start = performance.now();

    const layout = () => {
      width = Math.max(1, Math.ceil(wrapper.clientWidth / cell));
      height = Math.max(1, Math.ceil(wrapper.clientHeight / cell));
      canvas.width = width;
      canvas.height = height;
      // Exact integer upscale keeps every dither pixel the same crisp square.
      canvas.style.width = `${width * cell}px`;
      canvas.style.height = `${height * cell}px`;
      image = context.createImageData(width, height);

      const host = wrapper.getBoundingClientRect();
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (anchor && anchor.width > 0) {
        cx = (anchor.left - host.left + anchor.width / 2) / cell;
        cy = (anchor.top - host.top + anchor.height / 2) / cell;
        halfW = (anchor.width / 2 + padding) / cell;
        halfH = (anchor.height / 2 + padding) / cell;
      } else {
        cx = width / 2;
        cy = height / 2;
        halfW = width / 4;
        halfH = height / 4;
      }
    };

    const render = (now: number) => {
      if (!image) return;
      const t = reduced ? 0 : (now - start) / 1000;
      const data = image.data;
      const r = Math.min(radius / cell, halfW, halfH);
      const ramp = 90 / cell;
      const fall = reach / cell;
      const turn = t * 0.018;

      for (let by = 0; by < height; by += 2) {
        for (let bx = 0; bx < width; bx += 2) {
          // Signed distance to the rounded anchor box (positive outside).
          const px = bx + 1 - cx;
          const py = by + 1 - cy;
          const qx = Math.abs(px) - (halfW - r);
          const qy = Math.abs(py) - (halfH - r);
          const ox = qx > 0 ? qx : 0;
          const oy = qy > 0 ? qy : 0;
          const distance = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;

          let strength = 0;
          let hue = 0;
          if (distance > 0) {
            const angle = Math.atan2(py, px) / (Math.PI * 2) + 0.5;
            // Smooth rise from the content edge, then a long exponential release.
            const k = distance < ramp ? distance / ramp : 1;
            const rise = k * k * (3 - 2 * k);
            // A slow swell travels around the ring so the aura breathes instead of sitting still.
            const swell = 0.62 + 0.38 * Math.sin(angle * Math.PI * 6 + t * 0.35);
            strength = rise * Math.exp(-Math.max(0, distance - ramp * 0.6) / fall) * swell * 0.95;
            hue = (angle + turn) % 1;
          }

          for (let y = by; y < by + 2 && y < height; y += 1) {
            const bayerRow = (y & 7) << 3;
            const hueRow = ((y + 3) & 7) << 3;
            for (let x = bx; x < bx + 2 && x < width; x += 1) {
              const offset = (y * width + x) * 4;
              if (strength <= BAYER[bayerRow + (x & 7)]) {
                data[offset + 3] = 0;
                continue;
              }
              // Neighboring hues interleave pixel by pixel instead of blending to mud.
              const position = hue * RING.length;
              const base = Math.floor(position);
              const pick = position - base > BAYER[hueRow + ((x + 5) & 7)] ? base + 1 : base;
              const color = RING[pick % RING.length];
              data[offset] = color[0];
              data[offset + 1] = color[1];
              data[offset + 2] = color[2];
              data[offset + 3] = 255;
            }
          }
        }
      }
      context.putImageData(image, 0, 0);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      render(now);
    };

    layout();
    render(performance.now());
    const observer = new ResizeObserver(() => {
      layout();
      render(performance.now());
    });
    observer.observe(wrapper);
    if (anchorRef.current) observer.observe(anchorRef.current);

    if (playing) frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [anchorRef, cell, padding, playing, radius, reach, reduced]);

  return (
    <div ref={wrapperRef} aria-hidden="true" className={cn("pointer-events-none overflow-hidden", className)}>
      <canvas ref={canvasRef} className="block [image-rendering:pixelated]" />
    </div>
  );
}
