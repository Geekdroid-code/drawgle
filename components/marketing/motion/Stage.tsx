"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders children at a fixed logical size and scales them to the container width,
 * so choreography can use stable pixel coordinates at every breakpoint.
 */
export function ScaledStage({
  width,
  height,
  className,
  innerClassName,
  innerRef,
  children,
  style,
}: {
  width: number;
  height: number;
  className?: string;
  innerClassName?: string;
  innerRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={outerRef}
      className={cn("relative w-full", className)}
      style={{ height: scale === null ? undefined : height * scale, aspectRatio: scale === null ? `${width} / ${height}` : undefined, ...style }}
    >
      <div
        ref={innerRef}
        className={cn("absolute left-0 top-0 origin-top-left transition-opacity duration-300", innerClassName)}
        style={{
          width,
          height,
          transform: `scale(${scale ?? 1})`,
          opacity: scale === null ? 0 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Center point of `[data-anchor=name]` in the stage's untransformed coordinate space.
 * Walks offsetParents, so it is unaffected by the stage's scale transform.
 */
export function measureAnchor(stage: HTMLElement, name: string, align: "center" | "top-left" = "center") {
  const target = stage.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
  if (!target) return null;

  let x = 0;
  let y = 0;
  let node: HTMLElement = target;
  while (node !== stage) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (!parent || !stage.contains(parent)) break;
    if (parent !== stage) {
      x += parent.clientLeft;
      y += parent.clientTop;
    }
    node = parent;
  }

  if (align === "top-left") return { x, y, width: target.offsetWidth, height: target.offsetHeight };
  return { x: x + target.offsetWidth / 2, y: y + target.offsetHeight / 2, width: target.offsetWidth, height: target.offsetHeight };
}
