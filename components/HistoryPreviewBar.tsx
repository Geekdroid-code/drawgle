"use client";
import { useLayoutEffect, useState } from "react";
import { Eye } from "lucide-react";

import { EXIT_HISTORY_PREVIEW_EVENT, RESTORE_HISTORY_PREVIEW_EVENT, type CanvasHistoryPreview } from "@/components/HistoryControls";

const SIDE_PANELS = '[data-canvas-obstacle="left"], [data-canvas-obstacle="right"]';

/**
 * The open canvas between the chat on the left and the editor on the right, measured from the same markers the canvas
 * frames itself by. A panel wider than most of the screen is an overlay on a phone, as the canvas also treats it.
 */
function useOpenCanvas(active: boolean) {
  const [open, setOpen] = useState<{ center: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      let left = 0;
      let right = window.innerWidth;
      document.querySelectorAll<HTMLElement>(SIDE_PANELS).forEach((panel) => {
        const box = panel.getBoundingClientRect();
        if (!box.width || !box.height || box.width > window.innerWidth * 0.7 || getComputedStyle(panel).display === "none") return;
        if (panel.dataset.canvasObstacle === "left") left = Math.max(left, box.right);
        else right = Math.min(right, box.left);
      });
      setOpen({ center: (left + right) / 2, width: Math.max(0, right - left - 24) });
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    document.querySelectorAll(SIDE_PANELS).forEach((panel) => observer?.observe(panel));
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, [active]);
  return open;
}

/**
 * Says the canvas is showing a saved version from Recent changes, not the current design, and leaves it. On a phone,
 * where the editor panel steps aside so the canvas can be seen, it also restores the version. It sits over the open
 * canvas, clear of the side panels, and is not itself a canvas obstacle, so the canvas keeps its framing.
 */
export function HistoryPreviewBar({ preview }: { preview: CanvasHistoryPreview | null }) {
  const openCanvas = useOpenCanvas(Boolean(preview));
  if (!preview) return null;
  const action = "h-7 shrink-0 rounded-full px-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3563ee]";
  return (
    <div role="status" style={openCanvas ? { left: openCanvas.center, maxWidth: Math.min(480, openCanvas.width) } : undefined}
      className="absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+3.75rem)] z-50 flex max-w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-full dg-panel py-1 pl-3 pr-1 text-xs backdrop-blur-xl">
      <Eye className="h-3.5 w-3.5 shrink-0 text-[#3563ee]" aria-hidden />
      <span className="shrink-0 font-semibold">Preview</span>
      <span className="min-w-0 truncate text-[var(--dg-text-muted)]">{preview.side === "before" ? "Before" : "After"}: {preview.label}</span>
      <button type="button" onClick={() => window.dispatchEvent(new Event(RESTORE_HISTORY_PREVIEW_EVENT))}
        className={`${action} bg-[#3563ee] text-white md:hidden`}>
        Restore
      </button>
      <button type="button" onClick={() => window.dispatchEvent(new Event(EXIT_HISTORY_PREVIEW_EVENT))}
        className={`${action} text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)]`}>
        <span className="max-md:hidden">Exit preview</span><span className="md:hidden">Exit</span>
      </button>
    </div>
  );
}
