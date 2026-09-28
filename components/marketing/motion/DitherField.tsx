"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { usePlayback } from "./hooks";

/**
 * A colorful ordered-dither texture. Soft color fields drift slowly; a Bayer matrix turns them
 * into crisp pixels, and overlapping fields interleave pixel by pixel instead of blending to mud.
 * Rendered at 1/cell resolution and scaled up with `image-rendering: pixelated`.
 */

// 8×8 Bayer matrix, normalized to (0, 1).
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11,
  43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((value) => (value + 0.5) / 64);

type Field = {
  /** Resting center, as a fraction of width / height. */
  x: number;
  y: number;
  /** Radius as a fraction of width. */
  r: number;
  color: [number, number, number];
  strength: number;
  /** Drift amplitude (fractions) and speed (radians per second). */
  ax: number;
  ay: number;
  speed: number;
  phase: number;
};

const FIELDS: Field[] = [
  { x: 0.06, y: 0.2, r: 0.26, color: [48, 93, 222], strength: 1.05, ax: 0.03, ay: 0.05, speed: 0.21, phase: 0 },
  { x: 0.95, y: 0.16, r: 0.24, color: [139, 92, 246], strength: 1, ax: 0.03, ay: 0.04, speed: 0.17, phase: 1.7 },
  { x: 0.9, y: 0.6, r: 0.22, color: [255, 106, 61], strength: 0.95, ax: 0.04, ay: 0.05, speed: 0.19, phase: 3.1 },
  { x: 0.1, y: 0.68, r: 0.2, color: [255, 176, 32], strength: 0.9, ax: 0.035, ay: 0.04, speed: 0.23, phase: 4.4 },
  { x: 0.5, y: 1.02, r: 0.3, color: [16, 185, 129], strength: 0.85, ax: 0.06, ay: 0.02, speed: 0.15, phase: 2.2 },
  { x: 0.34, y: 0.02, r: 0.16, color: [236, 72, 153], strength: 0.7, ax: 0.04, ay: 0.02, speed: 0.25, phase: 5.2 },
];

const POINTER_COLOR: [number, number, number] = [48, 93, 222];
const FRAME_MS = 66;

export function DitherField({
  className,
  cell = 4,
  quietZone = { y: 0.27, height: 0.19, width: 0.37, depth: 0.95 },
  density = 0.72,
}: {
  className?: string;
  /** CSS pixels per dither pixel. */
  cell?: number;
  /** A squircle-shaped area (fractions of the field) kept nearly clear for the headline. */
  quietZone?: { y: number; height: number; width: number; depth: number };
  /** Peak dot coverage. Below 1 so even the brightest areas keep their dither texture. */
  density?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playing, reduced } = usePlayback(wrapperRef, 0);
  const pointer = useRef({ x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, power: 0, target: 0 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!wrapper || !canvas || !context) return;

    let width = 0;
    let height = 0;
    let image: ImageData | null = null;
    let columnQuiet = new Float32Array(0);
    let rowQuiet = new Float32Array(0);
    let rowFade = new Float32Array(0);
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
      // Separable masks: a calm ellipse behind the headline, and a fade at the bottom edge.
      columnQuiet = new Float32Array(width);
      rowQuiet = new Float32Array(height);
      rowFade = new Float32Array(height);
      // Fourth-power falloff: flat across the text block, then a quick release toward the edges.
      for (let x = 0; x < width; x += 1) {
        const u = (x / width - 0.5) / quietZone.width;
        columnQuiet[x] = Math.exp(-(u * u * u * u));
      }
      for (let y = 0; y < height; y += 1) {
        const v = y / height;
        const q = (v - quietZone.y) / quietZone.height;
        rowQuiet[y] = Math.exp(-(q * q * q * q)) * quietZone.depth;
        rowFade[y] = v > 0.82 ? Math.max(0, 1 - (v - 0.82) / 0.18) : 1;
      }
    };

    const render = (now: number) => {
      if (!image) return;
      const t = (now - start) / 1000;
      const data = image.data;
      const p = pointer.current;
      p.x += (p.tx - p.x) * 0.18;
      p.y += (p.ty - p.y) * 0.18;
      p.power += (p.target - p.power) * 0.12;

      const count = FIELDS.length + 1;
      const cx = new Float32Array(count);
      const cy = new Float32Array(count);
      const inv = new Float32Array(count);
      const power = new Float32Array(count);
      FIELDS.forEach((field, index) => {
        const drift = reduced ? 0 : t * field.speed + field.phase;
        cx[index] = (field.x + field.ax * Math.sin(drift)) * width;
        cy[index] = (field.y + field.ay * Math.cos(drift * 0.8)) * height;
        const radius = field.r * width;
        inv[index] = 1 / (radius * radius);
        power[index] = field.strength;
      });
      const pi = FIELDS.length;
      cx[pi] = p.x * width;
      cy[pi] = p.y * height;
      const pointerRadius = 0.1 * width;
      inv[pi] = 1 / (pointerRadius * pointerRadius);
      power[pi] = p.power;

      // Fields are smooth, so evaluate them once per 2×2 block; thresholds stay per pixel.
      const weights = new Float32Array(count);
      for (let by = 0; by < height; by += 2) {
        for (let bx = 0; bx < width; bx += 2) {
          let total = 0;
          for (let i = 0; i < count; i += 1) {
            const dx = bx + 0.5 - cx[i];
            const dy = by + 0.5 - cy[i];
            const falloff = 1 - (dx * dx + dy * dy) * inv[i];
            const weight = falloff > 0 ? falloff * falloff * power[i] : 0;
            weights[i] = weight;
            total += weight;
          }
          const strength = Math.min(1, total) * density;

          for (let y = by; y < by + 2 && y < height; y += 1) {
            const quietRow = rowQuiet[y];
            const fade = rowFade[y];
            const bayerRow = (y & 7) << 3;
            const colorRow = ((y + 3) & 7) << 3;
            for (let x = bx; x < bx + 2 && x < width; x += 1) {
              const offset = (y * width + x) * 4;
              const intensity = strength * (1 - quietRow * columnQuiet[x]) * fade;
              if (intensity <= BAYER[bayerRow + (x & 7)]) {
                data[offset + 3] = 0;
                continue;
              }

              // Pick one field's color by its share, with a second dither phase, so overlaps interleave.
              let pick = BAYER[colorRow + ((x + 5) & 7)] * total;
              let chosen = 0;
              for (let i = 0; i < count; i += 1) {
                pick -= weights[i];
                if (pick <= 0) {
                  chosen = i;
                  break;
                }
              }
              const color = chosen === pi ? POINTER_COLOR : FIELDS[chosen].color;
              data[offset] = color[0];
              data[offset + 1] = color[1];
              data[offset + 2] = color[2];
              data[offset + 3] = 150 + Math.round(intensity * 105);
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

    if (playing) frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cell, density, playing, quietZone.depth, quietZone.height, quietZone.width, quietZone.y, reduced]);

  useEffect(() => {
    if (reduced) return;
    const wrapper = wrapperRef.current;
    if (!wrapper || !window.matchMedia("(hover: hover)").matches) return;
    const section = wrapper.parentElement ?? wrapper;

    const onMove = (event: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      pointer.current.tx = (event.clientX - rect.left) / rect.width;
      pointer.current.ty = (event.clientY - rect.top) / rect.height;
      pointer.current.target = 0.75;
    };
    const onLeave = () => {
      pointer.current.target = 0;
    };
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={wrapperRef} aria-hidden="true" className={cn("pointer-events-none overflow-hidden", className)}>
      <canvas ref={canvasRef} className="block [image-rendering:pixelated]" />
    </div>
  );
}
