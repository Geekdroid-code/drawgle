"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/contexts/app-theme-context";
import { cn } from "@/lib/utils";

export type ThemeTransitionVariant =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "rectangle"
  | "star";

type AnimatedThemeToggleProps = Omit<React.ComponentProps<typeof Button>, "onClick" | "children" | "variant"> & {
  duration?: number;
  variant?: ThemeTransitionVariant;
  fromCenter?: boolean;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

const polygonCollapsed = (cx: number, cy: number, vertexCount: number) => (
  `polygon(${Array.from({ length: vertexCount }, () => `${cx}px ${cy}px`).join(", ")})`
);

const getThemeTransitionClipPaths = (
  variant: ThemeTransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): [string, string] => {
  switch (variant) {
    case "circle":
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ];
    case "square": {
      const halfSide = Math.max(cx, viewportWidth - cx, cy, viewportHeight - cy) * 1.05;
      const end = [
        `${cx - halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy + halfSide}px`,
        `${cx - halfSide}px ${cy + halfSide}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "triangle": {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      const verts = [
        `${cx}px ${cy - scale}px`,
        `${cx + dx}px ${cy + 0.5 * scale}px`,
        `${cx - dx}px ${cy + 0.5 * scale}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 3), `polygon(${verts})`];
    }
    case "diamond": {
      const radius = maxRadius * Math.SQRT2;
      const end = [
        `${cx}px ${cy - radius}px`,
        `${cx + radius}px ${cy}px`,
        `${cx}px ${cy + radius}px`,
        `${cx - radius}px ${cy}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "hexagon": {
      const radius = maxRadius * Math.SQRT2;
      const verts = Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        return `${cx + radius * Math.cos(angle)}px ${cy + radius * Math.sin(angle)}px`;
      });
      return [polygonCollapsed(cx, cy, 6), `polygon(${verts.join(", ")})`];
    }
    case "rectangle": {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const end = [
        `${cx - halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy + halfH}px`,
        `${cx - halfW}px ${cy + halfH}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "star": {
      const radius = maxRadius * Math.SQRT2 * 1.03;
      const innerRatio = 0.42;
      const starPolygon = (r: number) => {
        const verts: string[] = [];
        for (let index = 0; index < 5; index += 1) {
          const outerAngle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
          verts.push(`${cx + r * Math.cos(outerAngle)}px ${cy + r * Math.sin(outerAngle)}px`);

          const innerAngle = outerAngle + Math.PI / 5;
          verts.push(`${cx + r * innerRatio * Math.cos(innerAngle)}px ${cy + r * innerRatio * Math.sin(innerAngle)}px`);
        }
        return `polygon(${verts.join(", ")})`;
      };
      return [starPolygon(Math.max(2, radius * 0.025)), starPolygon(radius)];
    }
    default:
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ];
  }
};

export function AnimatedThemeToggle({
  className,
  duration = 430,
  variant = "circle",
  fromCenter = false,
  size = "icon-sm",
  buttonVariant = "ghost",
  ...props
}: AnimatedThemeToggleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [transitioning, setTransitioning] = useState(false);
  const { resolvedTheme, setTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";

  const toggleTheme = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (transitioning) return;

    const button = buttonRef.current;
    const nextTheme = isDark ? "light" : "dark";

    const applyTheme = () => setTheme(nextTheme);
    if (!button || typeof document.startViewTransition !== "function") {
      applyTheme();
      return;
    }

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const rect = button.getBoundingClientRect();
    const x = fromCenter ? viewportWidth / 2 : rect.left + rect.width / 2;
    const y = fromCenter ? viewportHeight / 2 : rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y),
    );
    const clipPath = getThemeTransitionClipPaths(variant, x, y, maxRadius, viewportWidth, viewportHeight);

    const root = document.documentElement;
    setTransitioning(true);
    root.dataset.drawgleThemeVt = "active";
    root.style.setProperty("--dg-theme-toggle-vt-duration", `${duration}ms`);
    root.style.setProperty("--dg-theme-vt-clip-from", clipPath[0]);

    const cleanup = () => {
      delete root.dataset.drawgleThemeVt;
      root.style.removeProperty("--dg-theme-toggle-vt-duration");
      root.style.removeProperty("--dg-theme-vt-clip-from");
    };

    try {
      const transition = document.startViewTransition(() => {
        flushSync(applyTheme);
      });

      transition.finished.finally(() => {
        cleanup();
        setTransitioning(false);
      });
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath },
          {
            duration,
            easing: variant === "star" ? "linear" : "ease-in-out",
            fill: "forwards",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      }).catch(() => undefined);
    } catch (error) {
      cleanup();
      setTransitioning(false);
      applyTheme();
    }
  }, [duration, fromCenter, isDark, setTheme, transitioning, variant]);

  return (
    <Button
      {...props}
      type="button"
      ref={buttonRef}
      variant={buttonVariant}
      size={size}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      aria-busy={transitioning}
      className={cn("rounded-full", className)}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
