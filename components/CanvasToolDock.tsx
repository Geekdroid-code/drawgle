"use client";

import * as React from "react";
import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useMeasure from "react-use-measure";
import {
  Hand,
  LassoSelect,
  Expand,
  MousePointer2,
  Palette,
  X,
  ZoomIn,
  ZoomOut,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DockButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

function DockButton({ label, active, disabled, onClick, children }: DockButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={`h-9 w-9 rounded-full transition md:h-10 md:w-10 ${
              active
                ? "bg-[var(--dg-text)] text-[var(--dg-bg)] hover:bg-[var(--dg-text)] hover:text-[var(--dg-bg)]"
                : "text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]"
            }`}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const dispatchCanvasEvent = (name: string) => {
  window.dispatchEvent(new Event(name));
};

export function CanvasToolDock({
  selectionMode,
  hasSelectedElement,
  selectedElementCanEditText,
  selectedElementCanEditDesign,
  disabled,
  isChatCollapsed,
  onToggleSelectionMode,
  onEditSelectedText,
  onEditSelectedDesign,
  onClearSelectedElement,
}: {
  selectionMode: boolean;
  hasSelectedElement: boolean;
  selectedElementCanEditText: boolean;
  selectedElementCanEditDesign: boolean;
  disabled?: boolean;
  isChatCollapsed: boolean;
  onToggleSelectionMode?: () => void;
  onEditSelectedText?: () => void;
  onEditSelectedDesign?: () => void;
  onClearSelectedElement?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [elementRef] = useMeasure();
  const [hiddenRef, hiddenBounds] = useMeasure();
  const [view, setView] = useState<"default" | "zoom" | "style">("default");

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setView("default");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const sharedHover =
    "group transition-all duration-100 px-3 py-2 text-[13.5px] font-semibold text-[var(--dg-text-muted)] w-full text-left rounded-xl hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]";

  const content = useMemo(() => {
    switch (view) {
      case "default":
        return null;

      case "zoom":
        return (
          <div className="flex items-center gap-1.5 p-1.5 min-w-[280px]">
            <button
              onClick={() => dispatchCanvasEvent("drawgle:canvas-zoom-out")}
              className="p-2 text-[var(--dg-text-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] rounded-xl transition duration-150"
            >
              <ZoomOut className="h-4.5 w-4.5" />
            </button>
            
            <button
              onClick={() => dispatchCanvasEvent("drawgle:canvas-fit")}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--dg-text-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] rounded-xl transition duration-150 border border-[var(--dg-border)]"
            >
              <Expand className="h-3.5 w-3.5" />
              <span>Fit Canvas</span>
            </button>

            <button
              onClick={() => dispatchCanvasEvent("drawgle:canvas-zoom-in")}
              className="p-2 text-[var(--dg-text-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-surface-muted)] rounded-xl transition duration-150"
            >
              <ZoomIn className="h-4.5 w-4.5" />
            </button>
          </div>
        );

      case "style":
        return (
          <div className="space-y-0.5 min-w-[210px] p-[6px] py-0.5">
            <button
              onClick={() => {
                setView("default");
                if (onEditSelectedDesign) {
                  onEditSelectedDesign();
                } else if (onEditSelectedText) {
                  onEditSelectedText();
                }
              }}
              disabled={disabled || !hasSelectedElement || (!selectedElementCanEditDesign && !selectedElementCanEditText)}
              className={`${sharedHover} flex items-center gap-3`}
            >
              <Palette className="h-4.5 w-4.5 text-[var(--dg-text-muted)] group-hover:text-[var(--dg-text)] transition duration-100" />
              <span>Open visual editor</span>
            </button>
            
            <button
              onClick={() => {
                setView("default");
                onClearSelectedElement?.();
              }}
              disabled={disabled || !hasSelectedElement}
              className={`${sharedHover} flex items-center gap-3 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600`}
            >
              <X className="h-4.5 w-4.5 transition duration-100" />
              <span>Clear selection</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  }, [
    view,
    disabled,
    hasSelectedElement,
    selectedElementCanEditDesign,
    selectedElementCanEditText,
    onEditSelectedDesign,
    onEditSelectedText,
    onClearSelectedElement,
  ]);

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={`canvas-pan-exclude absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-1/2 z-[55] -translate-x-1/2 flex flex-col items-center ${
          isChatCollapsed ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Hidden for measurement */}
        <div
          ref={hiddenRef}
          className="absolute left-[-9999px] top-[-9999px] invisible pointer-events-none"
        >
          <div className="rounded-2xl border border-[var(--dg-border)] bg-[var(--dg-surface)] py-1">
            {content}
          </div>
        </div>

        {/* Animated submenu */}
        <AnimatePresence mode="wait">
          {view !== "default" && (
            <motion.div
              key="submenu"
              initial={{
                opacity: 0,
                scaleY: 0.9,
                scaleX: 0.95,
                height: 0,
                width: 0,
                originY: 1,
                originX: 0.5,
              }}
              animate={{
                opacity: 1,
                scaleY: 1,
                scaleX: 1,
                height: hiddenBounds.height || "auto",
                width: hiddenBounds.width || "auto",
                originY: 1,
                originX: 0.5,
              }}
              exit={{
                opacity: 0,
                scaleY: 0.9,
                scaleX: 0.95,
                height: 0,
                width: 0,
                originY: 1,
                originX: 0.5,
              }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 380,
                mass: 0.8,
              }}
              style={{
                transformOrigin: "bottom center",
              }}
              className="absolute bottom-[60px] rounded-2xl border border-[var(--dg-border)] bg-[color-mix(in_oklab,var(--dg-surface)_94%,transparent)] backdrop-blur-xl shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)] overflow-hidden"
            >
              <div ref={elementRef}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={view}
                    initial={{
                      opacity: 0,
                      scale: 0.96,
                      filter: "blur(6px)",
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.95,
                      filter: "blur(8px)",
                    }}
                    transition={{
                      duration: 0.2,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="py-0.5"
                  >
                    {content}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex items-center gap-1 bg-[color-mix(in_oklab,var(--dg-surface)_92%,transparent)] border border-[var(--dg-border)] rounded-2xl p-1 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.8)] backdrop-blur-xl z-10">
          <DockButton
            label="Pointer"
            active={!selectionMode}
            disabled={disabled}
            onClick={selectionMode ? onToggleSelectionMode : undefined}
          >
            <MousePointer2 className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>
          
          <DockButton
            label={selectionMode ? "Exit select mode" : "Select element"}
            active={selectionMode}
            disabled={disabled}
            onClick={onToggleSelectionMode}
          >
            <LassoSelect className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>

          <div className="mx-1 h-6 w-px bg-[var(--dg-border-strong)]/30" />

          <DockButton label="Pan canvas" disabled={disabled}>
            <Hand className="h-4 w-4 md:h-5 md:w-5" />
          </DockButton>

          {/* Premium zoom switch button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setView(view === "zoom" ? "default" : "zoom")}
                  className={`h-9 rounded-xl px-2.5 flex items-center gap-1 transition md:h-10 ${
                    view === "zoom"
                      ? "bg-[var(--dg-surface-muted)] text-[var(--dg-text)]"
                      : "text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]"
                  }`}
                >
                  <span className="text-xs font-semibold">Zoom</span>
                  <ChevronUp
                    className={`h-3.5 w-3.5 transition-transform duration-250 ${
                      view === "zoom" ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              }
            />
            <TooltipContent>Zoom & view controls</TooltipContent>
          </Tooltip>

          {/* Visual settings */}
          {hasSelectedElement && (
            <>
              <div className="mx-1 h-6 w-px bg-[var(--dg-border-strong)]/30 animate-in fade-in zoom-in duration-200" />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      onClick={() => setView(view === "style" ? "default" : "style")}
                      className={`h-9 w-9 rounded-xl transition md:h-10 md:w-10 animate-in fade-in zoom-in duration-200 ${
                        view === "style"
                          ? "bg-[var(--dg-surface-muted)] text-[var(--dg-text)]"
                          : "text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]"
                      }`}
                    >
                      <Palette className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  }
                />
                <TooltipContent>Visual settings</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
